import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { createCaptureServer } from '../server.mjs';

test('capture sessions: authentication, checksums, idempotency, finalize and isolation', async () => {
  const root = await mkdtemp(join(tmpdir(), 'smile-capture-test-'));
  const token = 'test-only-strong-capture-token-0123456789';
  const app = createCaptureServer({ root, token, maxChunkBytes: 1000, maxSessionBytes: 2000 });
  await app.init(); app.server.listen(0, '127.0.0.1'); await once(app.server, 'listening');
  const base = `http://127.0.0.1:${app.server.address().port}`;
  const auth = { authorization:`Bearer ${token}` };
  const body = Buffer.from('mock segment bytes');
  const hash = createHash('sha256').update(body).digest('hex');
  try {
    assert.equal((await fetch(`${base}/healthz`)).status, 200);
    assert.equal((await fetch(`${base}/api/sessions`, { method:'POST' })).status, 401);
    const create = await fetch(`${base}/api/sessions`, { method:'POST', headers:{ ...auth, 'content-type':'application/json' }, body:JSON.stringify({ kind:'camera' }) });
    assert.equal(create.status, 201);
    const { id } = await create.json();
    const path = `${base}/api/sessions/${id}/chunks/0`;
    const headers = { ...auth, 'content-type':'video/webm', 'x-content-sha256':hash };
    assert.equal((await fetch(path, { method:'PUT', headers, body })).status, 201);
    assert.equal((await fetch(path, { method:'PUT', headers, body })).status, 200);
    assert.equal((await fetch(path, { method:'PUT', headers: { ...headers, 'x-content-sha256':'0'.repeat(64) }, body })).status, 409);
    assert.equal((await fetch(`${base}/api/sessions/${id}/chunks/1`, { method:'PUT', headers: { ...auth, 'content-type':'video/webm', 'x-content-sha256':'0'.repeat(64) }, body })).status, 422);
    const manifest = await (await fetch(`${base}/api/sessions/${id}`, { headers:auth })).json();
    assert.equal(manifest.parts.length, 1);
    assert.equal(manifest.bytesReceived, body.length);
    assert.deepEqual(await readFile(join(root,'sessions',id,'0000000.chunk')), body);
    assert.equal((await fetch(`${base}/api/sessions/${id}/finish`, { method:'POST', headers:auth })).status, 200);
    assert.equal((await fetch(`${base}/api/sessions/${id}/chunks/2`, { method:'PUT', headers, body })).status, 409);
    assert.equal((await fetch(`${base}/api/sessions/../random`, { headers:auth })).status, 404);
  } finally { app.server.closeAllConnections(); await new Promise(resolve => app.server.close(resolve)); await rm(root, { recursive:true, force:true }); }
});

test('persistent sessions can be assembled only when finalized and verified', async () => {
  const { assemble } = await import('../assemble.mjs');
  const root = await mkdtemp(join(tmpdir(), 'smile-capture-assembly-'));
  const token = 'test-only-strong-capture-token-0123456789';
  const app = createCaptureServer({ root, token });
  await app.init(); app.server.listen(0, '127.0.0.1'); await once(app.server, 'listening');
  const base = `http://127.0.0.1:${app.server.address().port}`;
  const auth = { authorization:`Bearer ${token}` };
  const output = join(root, 'assembled.webm');
  try {
    const response = await fetch(`${base}/api/sessions`, { method:'POST', headers:{ ...auth, 'content-type':'application/json' }, body:JSON.stringify({kind:'camera'}) });
    const { id } = await response.json();
    for (const [index, text] of ['aaa', 'bbb'].entries()) {
      const body = Buffer.from(text);
      const checksum = createHash('sha256').update(body).digest('hex');
      assert.equal((await fetch(`${base}/api/sessions/${id}/chunks/${index}`, { method:'PUT', headers:{ ...auth, 'content-type':'video/webm', 'x-content-sha256':checksum }, body })).status, 201);
    }
    await assert.rejects(() => assemble({ root, id, output }), /not finalized/);
    await fetch(`${base}/api/sessions/${id}/finish`, { method:'POST', headers:auth });
    assert.equal((await assemble({ root, id, output })).bytes, 6);
    assert.equal((await readFile(output)).toString(), 'aaabbb');
    // Recreate process context: manifest is persisted on disk, not in-memory.
    const other = createCaptureServer({ root, token });
    assert.equal((await readFile(join(root,'sessions',id,'manifest.json'),'utf8')).includes('UPLOAD_FINISHED'), true);
    other.server.close();
  } finally { app.server.closeAllConnections(); await new Promise(resolve => app.server.close(resolve)); await rm(root, {recursive:true,force:true}); }
});
