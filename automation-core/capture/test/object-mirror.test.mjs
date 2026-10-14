import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { once } from 'node:events';
import { mkdtemp,readFile,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createCaptureServer } from '../server.mjs';
import { PrivateS3Mirror } from '../storage.mjs';
import { mirrorCycle,mirrorOneSession } from '../mirror-worker.mjs';

const bearer='Bearer test-only-strong-capture-token-0123456789';
async function fixture() {
  const root=await mkdtemp(join(tmpdir(),'smile-capture-store-'));
  const app=createCaptureServer({root,token:bearer.slice(7)});
  await app.init();app.server.listen(0,'127.0.0.1');await once(app.server,'listening');
  const objects=new Map();
  const store=createServer(async(req,res)=>{
    const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    assert.match(String(req.headers.authorization),/^AWS4-HMAC-SHA256 Credential=/);
    if(req.method==='HEAD'){
      const value=objects.get(path);
      if(!value){res.writeHead(404);res.end();return;}
      res.writeHead(200,{'content-length':value.bytes.length,'x-amz-meta-sha256':value.sha});res.end();return;
    }
    if(req.method==='PUT'){
      const pieces=[];for await(const chunk of req) pieces.push(chunk);
      const bytes=Buffer.concat(pieces),sha=createHash('sha256').update(bytes).digest('hex');
      assert.equal(req.headers['x-amz-meta-sha256'],sha);
      assert.equal(req.headers['x-amz-content-sha256'],sha);
      objects.set(path,{bytes,sha});res.writeHead(200);res.end();return;
    }
    res.writeHead(405);res.end();
  });
  store.listen(0,'127.0.0.1');await once(store,'listening');
  const base='http://127.0.0.1:'+app.server.address().port;
  const mirror=new PrivateS3Mirror({endpoint:'http://127.0.0.1:'+store.address().port,allowHttpTestOnly:true,region:'sgp1',bucket:'smile-test-bucket',accessKeyId:'mock-id',secretAccessKey:'mock-secret'});
  const close=async()=>{app.server.closeAllConnections();store.closeAllConnections();await Promise.all([new Promise(r=>app.server.close(r)),new Promise(r=>store.close(r))]);await rm(root,{recursive:true,force:true});};
  return {root,app,store,base,mirror,objects,close};
}
async function record(base,value){
  const auth={authorization:bearer,'content-type':'application/json'};
  const create=await fetch(base+'/api/sessions',{method:'POST',headers:auth,body:JSON.stringify({kind:'camera'})});
  assert.equal(create.status,201);
  const {id}=await create.json();
  const bytes=Buffer.from(value);
  const sha=createHash('sha256').update(bytes).digest('hex');
  const result=await fetch(base+'/api/sessions/'+id+'/chunks/0',{method:'PUT',headers:{authorization:bearer,'content-type':'video/webm','x-content-sha256':sha},body:bytes});
  assert.equal(result.status,201);
  return {id,bytes};
}
test('mirrors verified segments while recording, without declaring media QC or SNS approval',async()=>{
  const f=await fixture();
  try{
    const {id,bytes}=await record(f.base,'a video segment');
    const inProgress=await mirrorOneSession({root:f.root,id,storage:f.mirror});
    assert.equal(inProgress.state,'MIRRORING');
    assert.equal(inProgress.remoteParts,1);
    assert.deepEqual([...f.objects.values()][0].bytes,bytes);
    await mirrorOneSession({root:f.root,id,storage:f.mirror});
    assert.equal(f.objects.size,1);
    const finish=await fetch(f.base+'/api/sessions/'+id+'/finish',{method:'POST',headers:{authorization:bearer,'content-type':'application/json'},body:JSON.stringify({expectedChunks:1})});
    assert.equal(finish.status,200);
    assert.equal((await mirrorOneSession({root:f.root,id,storage:f.mirror})).state,'ALL_CHUNKS_MIRRORED');
    const checkpoint=JSON.parse(await readFile(join(f.root,'sessions',id,'remote-mirror.json'),'utf8'));
    assert.equal(checkpoint.publishAllowed,undefined);
  } finally {await f.close();}
});
test('blocked archive session does not block the newest capture',async()=>{
  const f=await fixture();
  try{
    const old=await record(f.base,'old');
    await new Promise(r=>setTimeout(r,5));
    const current=await record(f.base,'new');
    const blocked=Object.create(f.mirror);
    blocked.ensurePart=async(key,path,part)=>{if(key.includes(old.id))throw new Error('provider quota');return f.mirror.ensurePart(key,path,part);};
    const results=await mirrorCycle({root:f.root,storage:blocked});
    assert.equal(results.length,2);
    assert.equal(results.find(x=>x.sessionId===old.id).state,'RETRY_LATER');
    assert.equal(results.find(x=>x.sessionId===current.id).state,'MIRRORING');
    assert.equal(f.objects.size,1);
  }finally{await f.close();}
});
test('rejects non-TLS endpoints and unsafe object prefixes',()=>{
  const config={region:'sgp1',bucket:'smile-test-bucket',accessKeyId:'a',secretAccessKey:'b'};
  assert.throws(()=>new PrivateS3Mirror({...config,endpoint:'http://external.example.com'}),/HTTPS/);
  assert.throws(()=>new PrivateS3Mirror({...config,endpoint:'https://external.example.com',prefix:'../secret'}),/Unsafe/);
});