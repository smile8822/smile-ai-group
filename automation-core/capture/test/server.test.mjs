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
    assert.equal((await fetch(`${base}/api/sessions/${id}/finish`, { method:'POST', headers:{...auth, 'content-type':'application/json'}, body:JSON.stringify({expectedChunks:1}) })).status, 200);
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
    await fetch(`${base}/api/sessions/${id}/finish`, { method:'POST', headers:{...auth, 'content-type':'application/json'}, body:JSON.stringify({expectedChunks:2}) });
    assert.equal((await assemble({ root, id, output })).bytes, 6);
    assert.equal((await readFile(output)).toString(), 'aaabbb');
    // Recreate process context: manifest is persisted on disk, not in-memory.
    const other = createCaptureServer({ root, token });
    assert.equal((await readFile(join(root,'sessions',id,'manifest.json'),'utf8')).includes('UPLOAD_FINISHED'), true);
    other.server.close();
  } finally { app.server.closeAllConnections(); await new Promise(resolve => app.server.close(resolve)); await rm(root, {recursive:true,force:true}); }
});

test('does not finalize when last or middle segment is absent, and retries are idempotent', async () => {
  const root = await mkdtemp(join(tmpdir(), 'smile-capture-missing-'));
  const token = 'strong-token-012345678901234567890';
  const app = createCaptureServer({ root, token });
  await app.init(); app.server.listen(0, '127.0.0.1'); await once(app.server, 'listening');
  const base = `http://127.0.0.1:${app.server.address().port}`;
  const auth = { authorization: `Bearer ${token}` };
  const finish = (id, count) => fetch(`${base}/api/sessions/${id}/finish`, { method: 'POST', headers: {...auth, 'content-type':'application/json'}, body: JSON.stringify({ expectedChunks: count }) });
  const upload = async (id,index) => {
    const body = Buffer.from(`valid segment ${index}`);
    return fetch(`${base}/api/sessions/${id}/chunks/${index}`, { method: 'PUT', headers: {...auth, 'content-type':'video/webm','x-content-sha256': createHash('sha256').update(body).digest('hex') }, body });
  };
  try {
    const r = await fetch(`${base}/api/sessions`, { method: 'POST', headers: {...auth, 'content-type':'application/json'}, body: JSON.stringify({kind:'camera'}) });
    const {id}=await r.json();
    assert.equal((await finish(id,0)).status,400);
    assert.equal((await upload(id,0)).status,201);
    assert.equal((await upload(id,2)).status,201);
    assert.equal((await finish(id,3)).status,409); // absent middle
    assert.equal((await finish(id,2)).status,409); // noncontiguous
    assert.equal((await upload(id,1)).status,201);
    assert.equal((await finish(id,4)).status,409); // absent last
    assert.equal((await finish(id,3)).status,200);
    assert.equal((await finish(id,3)).status,200); // repeated finalize
    assert.equal((await finish(id,4)).status,409); // conflicting expected count
  } finally { app.server.closeAllConnections(); await new Promise(resolve => app.server.close(resolve)); await rm(root,{recursive:true,force:true}); }
});

test('a stalled previous recording cannot block 120 fragments of a new daily recording', async () => {
  const root = await mkdtemp(join(tmpdir(), 'smile-capture-daily-'));
  const token='strong-token-012345678901234567890';
  const app=createCaptureServer({root,token});
  await app.init(); app.server.listen(0, '127.0.0.1'); await once(app.server,'listening');
  const base=`http://127.0.0.1:${app.server.address().port}`;
  const auth={authorization:`Bearer ${token}`};
  const create=async()=>{
    const response=await fetch(`${base}/api/sessions`,{method:'POST',headers:{...auth,'content-type':'application/json'},body:JSON.stringify({kind:'camera'})});
    assert.equal(response.status,201);
    return (await response.json()).id;
  };
  try {
    const old=await create();
    const fresh=await create();
    const n=120;
    const expected=[];
    for(let index=0;index<n;index++){
      const bytes=Buffer.from(`segment-${index.toString().padStart(5,'0')}-`+'x'.repeat(512));
      expected.push(bytes);
      const r=await fetch(`${base}/api/sessions/${fresh}/chunks/${index}`, {method:'PUT',headers:{...auth,'content-type':'video/webm','x-content-sha256':createHash('sha256').update(bytes).digest('hex')},body:bytes});
      assert.equal(r.status,201);
    }
    assert.equal((await fetch(`${base}/api/sessions/${old}/finish`,{method:'POST',headers:{...auth,'content-type':'application/json'},body:JSON.stringify({expectedChunks:1})})).status,409);
    assert.equal((await fetch(`${base}/api/sessions/${fresh}/finish`,{method:'POST',headers:{...auth,'content-type':'application/json'},body:JSON.stringify({expectedChunks:n})})).status,200);
    const {assemble}=await import('../assemble.mjs');
    const output=join(root,'daily.webm');
    await assemble({root,id:fresh,output});
    assert.deepEqual(await readFile(output),Buffer.concat(expected));
  } finally {app.server.closeAllConnections(); await new Promise(resolve=>app.server.close(resolve)); await rm(root,{recursive:true,force:true});}
});

test('daily queue is independent and finalized media becomes a non-publishable QC job', async () => {
  const {QUEUES, listQueued, claimNext, reconcileDailyCapture} = await import('../jobs.mjs');
  const root = await mkdtemp(join(tmpdir(), 'smile-capture-queue-'));
  const token='test-only-strong-capture-token-0123456789';
  const app=createCaptureServer({root,token});
  await app.init();app.server.listen(0,'127.0.0.1');await once(app.server,'listening');
  const base=`http://127.0.0.1:${app.server.address().port}`;
  const auth={authorization:`Bearer ${token}`};
  try {
    const r=await fetch(`${base}/api/sessions`,{method:'POST',headers:{...auth,'content-type':'application/json'},body:JSON.stringify({kind:'camera'})});
    const {id}=await r.json();
    const bytes=Buffer.from('queue-media');
    assert.equal((await fetch(`${base}/api/sessions/${id}/chunks/0`,{method:'PUT',headers:{...auth,'content-type':'video/webm','x-content-sha256':createHash('sha256').update(bytes).digest('hex')},body:bytes})).status,201);
    assert.equal((await fetch(`${base}/api/sessions/${id}/finish`,{method:'POST',headers:{...auth,'content-type':'application/json'},body:JSON.stringify({expectedChunks:1})})).status,200);
    assert.deepEqual(await listQueued(root,QUEUES.ARCHIVE),[]);
    assert.deepEqual(await listQueued(root,QUEUES.DAILY),[`${id}.json`]);
    const claimed=await claimNext(root,QUEUES.DAILY);
    assert.equal(claimed.jobId,id);
    assert.equal(claimed.publishAllowed,false);
    assert.equal(claimed.qcStatus,'NOT_VERIFIED');
    assert.equal(await claimNext(root,QUEUES.ARCHIVE),null);
    // Reconciliation must not create duplicate queued entries for jobs already claimed.
    await reconcileDailyCapture(root);
    assert.deepEqual(await listQueued(root,QUEUES.DAILY),[]);
  } finally {app.server.closeAllConnections();await new Promise(resolve=>app.server.close(resolve));await rm(root,{recursive:true,force:true});}
});


test('receiver refuses new sessions if the required disk reserve is not available',async()=>{
  const root=await mkdtemp(join(tmpdir(),'smile-capture-capacity-'));
  const token='test-only-strong-capture-token-0123456789';
  const app=createCaptureServer({root,token,minFreeBytes:Number.MAX_SAFE_INTEGER});
  await app.init();app.server.listen(0,'127.0.0.1');await once(app.server,'listening');
  try{
    const base='http://127.0.0.1:'+app.server.address().port;
    const r=await fetch(base+'/api/sessions',{method:'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify({kind:'camera'})});
    assert.equal(r.status,507);
  }finally{
    app.server.closeAllConnections();
    await new Promise(resolve=>app.server.close(resolve));
    await rm(root,{recursive:true,force:true});
  }
});
