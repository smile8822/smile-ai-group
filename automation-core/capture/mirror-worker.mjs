#!/usr/bin/env node
// SMILE CAPTURE segment mirror while recording; never deletes masters or changes publishing.
import { mkdir,readFile,readdir,rename,rm,writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { mirrorFromEnv } from './storage.mjs';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
async function checkpoint(path,value){
  const tmp=path+'.'+randomUUID()+'.tmp';
  try{await writeFile(tmp,JSON.stringify(value,null,2),{mode:0o600,flag:'wx'});await rename(tmp,path);}
  finally{await rm(tmp,{force:true}).catch(()=>{});}
}
export async function mirrorOneSession({root,id,storage}){
  if(!UUID.test(id)) throw new Error('Invalid session ID');
  const dir=join(root,'sessions',id);
  const manifest=JSON.parse(await readFile(join(dir,'manifest.json'),'utf8'));
  if(manifest.id!==id||!['RECORDING','UPLOAD_FINISHED'].includes(manifest.status)) throw new Error('Invalid session state');
  if(!Array.isArray(manifest.parts)) throw new Error('Invalid source parts');
  const receiptPath=join(dir,'remote-mirror.json');
  let receipt={sourceSessionId:id,state:'MIRRORING',parts:{},updatedAt:null};
  try{receipt=JSON.parse(await readFile(receiptPath,'utf8'));}
  catch(error){if(error.code!=='ENOENT') throw error;}
  if(receipt.sourceSessionId!==id) throw new Error('Mirror checkpoint mismatch');
  for(const part of manifest.parts){
    if(!Number.isSafeInteger(part.index)||!Number.isSafeInteger(part.bytes)||!/^([0-9a-f]{64})$/.test(part.sha256)) throw new Error('Invalid part metadata');
    const key=storage.keyForChunk(manifest,part);
    if(receipt.parts[part.index]?.sha256===part.sha256&&receipt.parts[part.index]?.bytes===part.bytes) continue;
    await storage.ensurePart(key,join(dir,String(part.index).padStart(7,'0')+'.chunk'),part);
    receipt.parts[part.index]={key,bytes:part.bytes,sha256:part.sha256};
    receipt.updatedAt=new Date().toISOString();
    receipt.state='MIRRORING';
    await checkpoint(receiptPath,receipt);
  }
  // A remote copy is not an AV/QC or social-publishing approval.
  if(manifest.status==='UPLOAD_FINISHED'&&manifest.parts.length===manifest.expectedChunks&&manifest.parts.every(p=>receipt.parts[p.index]?.sha256===p.sha256)){
    receipt.state='ALL_CHUNKS_MIRRORED';
  }
  receipt.updatedAt=new Date().toISOString();
  await checkpoint(receiptPath,receipt);
  return {sessionId:id,state:receipt.state,remoteParts:Object.keys(receipt.parts).length,sourceParts:manifest.parts.length};
}
export async function mirrorCycle({root,storage}){
  const sessions=join(root,'sessions');
  await mkdir(sessions,{recursive:true,mode:0o700});
  const entries=await readdir(sessions,{withFileTypes:true});
  const ids=entries.filter(x=>x.isDirectory()&&UUID.test(x.name)).map(x=>x.name);
  const dated=[];
  for(const id of ids){
    try{const m=JSON.parse(await readFile(join(sessions,id,'manifest.json'),'utf8'));dated.push({id,createdAt:m.createdAt});}
    catch{dated.push({id,createdAt:''});}
  }
  dated.sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));
  const result=[];
  for(const {id} of dated){
    try{result.push(await mirrorOneSession({root,id,storage}));}
    catch(error){result.push({sessionId:id,state:'RETRY_LATER',error:String(error.message).slice(0,170)});}
  }
  return result;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const root=process.env.CAPTURE_ROOT;
  if(!root){console.error('CAPTURE_ROOT required');process.exitCode=2;}
  else{
    const storage=mirrorFromEnv();
    const interval=Number(process.env.SMILE_CAPTURE_MIRROR_INTERVAL_MS||15000);
    if(!Number.isFinite(interval)||interval<5000) throw new Error('Mirror interval minimum 5000ms');
    const once=process.argv.includes('--once');
    do{
      console.log(JSON.stringify({at:new Date().toISOString(),result:await mirrorCycle({root,storage})}));
      if(once) break;
      await new Promise(resolve=>setTimeout(resolve,interval));
    }while(true);
  }
}