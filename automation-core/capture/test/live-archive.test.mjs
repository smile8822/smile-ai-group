import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile, utimes } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { mirrorCompletedLive } from '../live-archive-worker.mjs';

test('LIVE mirroring: archive only stable files, idempotency and source mutation fail closed', async () => {
 const root=await mkdtemp(join(tmpdir(),'smile-live-'));
 const recordingsRoot=join(root,'recordings'),receiptsRoot=join(root,'proof');
 const folder=join(recordingsRoot,'live');await mkdir(folder,{recursive:true});
 const done='2026-10-15_02-00-00-000000.mp4',active='2026-10-15_02-00-20-000000.mp4';
 await writeFile(join(folder,done),Buffer.from('completed source'));
 await writeFile(join(folder,active),Buffer.from('still recording'));
 const old=new Date(Date.now()-120000);await utimes(join(folder,done),old,old);
 const saved=new Map();
 const storage={prefix:'staging/capture',async ensurePart(key,path,part){
  const bytes=await readFile(path);assert.equal(bytes.length,part.bytes);
  assert.equal(createHash('sha256').update(bytes).digest('hex'),part.sha256);
  saved.set(key,part.sha256);
 }};
 try {
  const one=await mirrorCompletedLive({recordingsRoot,receiptsRoot,storage});
  assert.deepEqual([one.uploaded,one.skipped,one.failed],[1,1,0]);
  const two=await mirrorCompletedLive({recordingsRoot,receiptsRoot,storage});
  assert.deepEqual([two.uploaded,two.skipped,two.failed],[0,2,0]);
  assert.equal(saved.size,1);
  const [name]=await readdir(join(receiptsRoot,'live','live'));
  const proof=JSON.parse(await readFile(join(receiptsRoot,'live','live',name),'utf8'));
  assert.equal(proof.publishAllowed,false);
  await writeFile(join(folder,done),Buffer.from('CHANGED'));
  await utimes(join(folder,done),old,old);
  const bad=await mirrorCompletedLive({recordingsRoot,receiptsRoot,storage});
  assert.deepEqual([bad.uploaded,bad.failed],[0,1]);
  await assert.rejects(()=>mirrorCompletedLive({recordingsRoot,receiptsRoot,storage,channel:'../outside'}),/Invalid/);
 } finally {await rm(root,{recursive:true,force:true});}
});
