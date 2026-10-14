#!/usr/bin/env node
// Assemble a single MediaRecorder session's ordered byte-stream only after verifying every fragment.
import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { readFile, rm, rename } from 'node:fs/promises';
import { once } from 'node:events';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';

export async function assemble({ root, id, output }) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error('Bad session id');
  const dir = join(root, 'sessions', id);
  const manifest = JSON.parse(await readFile(join(dir, 'manifest.json'), 'utf8'));
  if (manifest.id !== id || manifest.status !== 'UPLOAD_FINISHED') throw new Error('Session not finalized');
  if (!manifest.parts.length) throw new Error('No media parts');
  const parts = [...manifest.parts].sort((a, b) => a.index - b.index);
  for (let i = 0; i < parts.length; i++) {
    if (parts[i].index !== i) throw new Error(`Missing or reordered part ${i}`);
  }
  const temp = `${output}.${randomUUID()}.tmp`;
  let stream;
  try {
    stream = createWriteStream(temp, { flags:'wx', mode:0o600 });
    let total = 0;
    for (const part of parts) {
      let size = 0; const hash = createHash('sha256');
      const source = createReadStream(join(dir, `${String(part.index).padStart(7,'0')}.chunk`));
      for await (const chunk of source) {
        size += chunk.length; hash.update(chunk);
        if (!stream.write(chunk)) await once(stream, 'drain');
      }
      if (size !== part.bytes || hash.digest('hex') !== part.sha256) throw new Error(`Damaged part ${part.index}`);
      total += size;
    }
    if (total !== manifest.bytesReceived) throw new Error('Source total mismatch');
    stream.end(); await once(stream, 'finish');
    await rename(temp, output);
    return { bytes: total, parts: parts.length, output };
  } catch (error) {
    if (stream && !stream.destroyed) stream.destroy();
    await rm(temp, { force:true });
    throw error;
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [root, id, output] = process.argv.slice(2);
  if (!root || !id || !output) { console.error('Usage: node assemble.mjs ROOT SESSION_ID OUTPUT.webm'); process.exit(2); }
  try { console.log(await assemble({ root, id, output })); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
