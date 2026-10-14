import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { createCaptureServer } from '../server.mjs';
import { processNextDailyQc } from '../qc-worker.mjs';
const run=promisify(execFile);

// A real decodable audio+video fixture, divided into arbitrary byte segments like an upload.
test('completed daily upload enters automated FFmpeg technical QC without granting publish approval',async(t)=>{
  try { await run('ffmpeg',['-version'],{timeout:3000}); }
  catch { t.skip('ffmpeg not installed on test runner');return; }
  const root=await mkdtemp(join(tmpdir(),'smile-capture-av-'));
  const source=join(root,'fixture.webm');
  const token='test-only-strong-capture-token-0123456789';
  let app;
  try {
    await run('ffmpeg',['-hide_banner','-loglevel','error','-y','-f','lavfi','-i','color=c=red:s=160x120:r=10','-f','lavfi','-i','sine=frequency=440:sample_rate=48000','-t','1.3','-c:v','libvpx','-b:v','300k','-c:a','libopus',source],{timeout:15000});
    const all=await readFile(source);
    app=createCaptureServer({root,token});
    await app.init();app.server.listen(0,'127.0.0.1');await once(app.server,'listening');
    const base=`http://127.0.0.1:${app.server.address().port}`;
    const auth={authorization:`Bearer ${token}`};
    const r=await fetch(`${base}/api/sessions`,{method:'POST',headers:{...auth,'content-type':'application/json'},body:JSON.stringify({kind:'camera'})});
    assert.equal(r.status,201);
    const {id}=await r.json();
    const segSize=Math.ceil(all.length/4);
    const chunks=[];
    for(let i=0;i<all.length;i+=segSize)chunks.push(all.subarray(i,i+segSize));
    for(const [index,bytes] of chunks.entries()){
      const res=await fetch(`${base}/api/sessions/${id}/chunks/${index}`,{method:'PUT',headers:{...auth,'content-type':'video/webm','x-content-sha256':createHash('sha256').update(bytes).digest('hex')},body:bytes});
      assert.equal(res.status,201);
    }
    const finish=await fetch(`${base}/api/sessions/${id}/finish`,{method:'POST',headers:{...auth,'content-type':'application/json'},body:JSON.stringify({expectedChunks:chunks.length})});
    assert.equal(finish.status,200);
    const qc=await processNextDailyQc({root});
    assert.equal(qc.status,'TECHNICAL_QC_PASSED',JSON.stringify(qc));
    assert.equal(qc.publishAllowed,false);
    assert.ok(qc.durationSeconds>1);
    assert.deepEqual(await readFile(qc.mediaPath),all);
    assert.equal(await processNextDailyQc({root}),null);
  } finally {
    if(app){app.server.closeAllConnections();await new Promise(resolve=>app.server.close(resolve));}
    await rm(root,{recursive:true,force:true});
  }
});
