import { createServer } from 'node:http';
import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Transform } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { ensureQueues, enqueueFinishedCapture, reconcileDailyCapture } from './jobs.mjs';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const JSON_LIMIT = 4096;
const SESSION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CHUNK_INDEX = /^(0|[1-9][0-9]{0,6})$/;
const MIME_TYPES = new Set(['video/webm', 'video/mp4', 'application/octet-stream']);

function reply(res, status, object) {
  const body = JSON.stringify(object);
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
  res.end(body);
}
function fail(status, message) { const error = new Error(message); error.status = status; throw error; }
function safeEqual(a, b) {
  const aa = Buffer.from(String(a)); const bb = Buffer.from(String(b));
  return aa.length === bb.length && timingSafeEqual(aa, bb);
}
async function readJson(req) {
  let chunks = []; let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > JSON_LIMIT) fail(413, 'JSON request too large');
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { fail(400, 'Invalid JSON'); }
}
async function atomicJson(path, value) {
  const temp = `${path}.${randomUUID()}.tmp`;
  try { await writeFile(temp, JSON.stringify(value, null, 2), { mode: 0o600 }); await rename(temp, path); }
  finally { await rm(temp, { force: true }).catch(() => {}); }
}

export function createCaptureServer({ root, token, maxChunkBytes = 100 * 1024 * 1024, maxSessionBytes = 40 * 1024 * 1024 * 1024 } = {}) {
  if (!root || !token || String(token).length < 24) throw new Error('CAPTURE_ROOT and strong CAPTURE_TOKEN (24+ chars) required');
  const locks = new Map();
  const sessionsDir = join(root, 'sessions');
  const withLock = async (id, fn) => {
    const previous = locks.get(id) || Promise.resolve();
    const next = previous.catch(() => {}).then(fn);
    locks.set(id, next);
    try { return await next; } finally { if (locks.get(id) === next) locks.delete(id); }
  };
  async function load(id) {
    try { return JSON.parse(await readFile(join(sessionsDir, id, 'manifest.json'), 'utf8')); }
    catch (error) { if (error.code === 'ENOENT') fail(404, 'Session not found'); throw error; }
  }
  async function save(id, manifest) { await atomicJson(join(sessionsDir, id, 'manifest.json'), manifest); }
  async function sendStatic(res, name, type) {
    const body = await readFile(join(HERE, 'public', name));
    res.writeHead(200, {
      'content-type': type, 'cache-control': 'no-store', 'x-content-type-options': 'nosniff',
      'content-security-policy': "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; media-src 'self' blob:; base-uri 'none'; form-action 'none'",
    });
    res.end(body);
  }
  const handler = async (req, res) => {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    try {
      if (req.method === 'GET' && pathname === '/healthz') return reply(res, 200, { ok: true });
      if (req.method === 'GET' && pathname === '/') return await sendStatic(res, 'index.html', 'text/html; charset=utf-8');
      if (req.method === 'GET' && pathname === '/capture.js') return await sendStatic(res, 'capture.js', 'text/javascript; charset=utf-8');
      if (!safeEqual(req.headers.authorization || '', `Bearer ${token}`)) return reply(res, 401, { error: 'Authentication required' });
      if (req.method === 'POST' && pathname === '/api/sessions') {
        const body = await readJson(req);
        if (!['camera', 'external-live-archive'].includes(body?.kind)) fail(400, 'Unsupported source kind');
        const id = randomUUID(); const dir = join(sessionsDir, id);
        await mkdir(dir, { recursive: false, mode: 0o700 });
        const now = new Date().toISOString();
        const manifest = { id, kind: body.kind, status: 'RECORDING', createdAt: now, updatedAt: now, bytesReceived: 0, parts: [] };
        await save(id, manifest);
        return reply(res, 201, { id, status: manifest.status });
      }
      const match = pathname.match(/^\/api\/sessions\/([^/]+)(?:\/(chunks)\/([^/]+)|\/(finish))?$/);
      if (!match || !SESSION_ID.test(match[1])) fail(404, 'Not found');
      const id = match[1];
      if (req.method === 'GET' && !match[2] && !match[4]) return reply(res, 200, await load(id));
      if (req.method === 'POST' && match[4] === 'finish') return await withLock(id, async () => {
        const { expectedChunks } = await readJson(req);
        if (!Number.isSafeInteger(expectedChunks) || expectedChunks < 1 || expectedChunks > 10_000_000) fail(400, 'expectedChunks must be a positive integer');
        const manifest = await load(id);
        if (manifest.status === 'UPLOAD_FINISHED') {
          if (manifest.expectedChunks !== expectedChunks) fail(409, 'Conflicting finalization');
          await enqueueFinishedCapture(root, id);
          return reply(res, 200, manifest);
        }
        if (manifest.parts.length !== expectedChunks || manifest.parts.some((part, i) => part.index !== i)) fail(409, 'Missing chunks: cannot finalize');
        manifest.expectedChunks = expectedChunks;
        manifest.status = 'UPLOAD_FINISHED'; manifest.updatedAt = new Date().toISOString();
        await save(id, manifest);
        await enqueueFinishedCapture(root, id);
        reply(res, 200, manifest);
      });
      if (req.method === 'PUT' && match[2] === 'chunks') {
        if (!CHUNK_INDEX.test(match[3])) fail(400, 'Bad chunk index');
        const index = Number(match[3]);
        const claimedHash = String(req.headers['x-content-sha256'] || '').toLowerCase();
        const mime = String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
        if (!/^[0-9a-f]{64}$/.test(claimedHash)) fail(400, 'Missing SHA256');
        if (!MIME_TYPES.has(mime)) fail(415, 'Unsupported content type');
        const length = Number(req.headers['content-length']);
        if (!Number.isSafeInteger(length) || length <= 0 || length > maxChunkBytes) fail(413, 'Invalid chunk length');
        return await withLock(id, async () => {
          const manifest = await load(id);
          const old = manifest.parts.find(p => p.index === index);
          if (old) {
            req.resume();
            return reply(res, old.sha256 === claimedHash && old.bytes === length ? 200 : 409, old.sha256 === claimedHash && old.bytes === length ? { stored: true, duplicate: true } : { error: 'Conflicting chunk' });
          }
          if (manifest.status !== 'RECORDING') fail(409, 'Session closed');
          if (manifest.bytesReceived + length > maxSessionBytes) fail(413, 'Session quota exceeded');
          const path = join(sessionsDir, id, `${String(index).padStart(7, '0')}.chunk`);
          const temp = `${path}.${randomUUID()}.tmp`;
          let received = 0; const hash = createHash('sha256');
          try {
            await pipeline(req, new Transform({
              transform(chunk, _enc, done) {
                received += chunk.length;
                if (received > maxChunkBytes || received > length) return done(new Error('Excess chunk bytes'));
                hash.update(chunk); done(null, chunk);
              },
            }), createWriteStream(temp, { flags: 'wx', mode: 0o600 }));
            if (received !== length || hash.digest('hex') !== claimedHash) fail(422, 'Chunk checksum/size mismatch');
            await rename(temp, path);
            manifest.parts.push({ index, bytes: received, sha256: claimedHash, mime, receivedAt: new Date().toISOString() });
            manifest.parts.sort((a, b) => a.index - b.index);
            manifest.bytesReceived += received; manifest.updatedAt = new Date().toISOString();
            await save(id, manifest);
            return reply(res, 201, { stored: true, duplicate: false, received: manifest.parts.length });
          } finally { await rm(temp, { force: true }).catch(() => {}); }
        });
      }
      fail(404, 'Not found');
    } catch (error) {
      if (!res.headersSent) reply(res, error.status || 500, { error: error.status ? error.message : 'Internal server error' });
      if (!error.status) console.error('capture-server:', error);
    }
  };
  return { server: createServer(handler), init: async () => {
    await mkdir(sessionsDir, {recursive:true,mode:0o700});
    await ensureQueues(root);
    await reconcileDailyCapture(root);
  } };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const root = process.env.CAPTURE_ROOT;
  const token = process.env.CAPTURE_TOKEN;
  const host = process.env.CAPTURE_HOST || '127.0.0.1';
  const port = Number(process.env.CAPTURE_PORT || '8787');
  const app = createCaptureServer({ root, token });
  await app.init();
  app.server.listen(port, host, () => console.log(`Capture server listening on ${host}:${port}`));
}
