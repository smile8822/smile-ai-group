// LIVE completed-segment mirror; no deletion, publishing or TikTok retransmission.
import { createHash, randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { lstat, mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { mirrorFromEnv } from './storage.mjs';
const FILE=/^\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}-\d+\.(?:mp4|ts)$/;
const CHANNEL=/^[A-Za-z0-9_-]{1,64}$/;
async function sha(path) {const h=createHash('sha256');for await(const part of createReadStream(path))h.update(part);return h.digest('hex');}
async function receipt(path,data) {
 const temp=path+'.'+randomUUID()+'.tmp';
 try{await writeFile(temp,JSON.stringify(data,null,2),{mode:0o600,flag:'wx'});await rename(temp,path);}
 finally{await rm(temp,{force:true}).catch(()=>{});}
}
export async function mirrorCompletedLive({recordingsRoot,receiptsRoot,storage,channel='live',graceMs=60000,now=Date.now()}) {
 if(!recordingsRoot||!receiptsRoot||!storage||!CHANNEL.test(channel))throw Error('Invalid LIVE mirror settings');
 if(!Number.isSafeInteger(graceMs)||graceMs<5000)throw Error('Invalid minimum grace');
 const root=resolve(recordingsRoot),folder=resolve(root,channel);
 if(!folder.startsWith(root+sep))throw Error('Unsafe channel');
 const dir=await lstat(folder).catch(e=>{if(e.code==='ENOENT')return null;throw e;});
 const result={channel,uploaded:0,skipped:0,failed:0,errors:[]};
 if(!dir)return result;
 if(!dir.isDirectory()||dir.isSymbolicLink())throw Error('Unsafe recording directory');
 const receiptDir=join(receiptsRoot,'live',channel);
 await mkdir(receiptDir,{recursive:true,mode:0o700});
 for(const file of (await readdir(folder)).filter(x=>FILE.test(x)).sort()){
  const path=join(folder,file);
  try {
   const old=await lstat(path);
   if(!old.isFile()||old.isSymbolicLink()||!old.size||now-old.mtimeMs<graceMs){result.skipped++;continue;}
   const digest=await sha(path),current=await lstat(path);
   if(old.size!==current.size||old.mtimeMs!==current.mtimeMs){result.skipped++;continue;}
   const key=storage.prefix+'/live/'+channel+'/'+file;
   const proof=join(receiptDir,file+'.json');
   let prior=null;
   try{prior=JSON.parse(await readFile(proof,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
   if(prior){
    if(prior.sha256!==digest||prior.bytes!==old.size||prior.key!==key)throw Error('Source modified after checkpoint');
    result.skipped++;continue;
   }
   await storage.ensurePart(key,path,{bytes:old.size,sha256:digest});
   await receipt(proof,{key,bytes:old.size,sha256:digest,publishAllowed:false,source:'LIVE_COMPLETED_SEGMENT',mirroredAt:new Date().toISOString()});
   result.uploaded++;
  }catch(e){result.failed++;result.errors.push({file,error:String(e.message).slice(0,120)});}
 }
 return result;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const root=process.env.SMILE_CAPTURE_LIVE_RECORDINGS_ROOT;
 const receiptsRoot=process.env.CAPTURE_ROOT;
 if(!root||!receiptsRoot)throw Error('Missing recording and receipt paths');
 const storage=mirrorFromEnv();
 const interval=Number(process.env.SMILE_CAPTURE_LIVE_POLL_INTERVAL_MS||15000);
 if(!Number.isSafeInteger(interval)||interval<5000)throw Error('Invalid polling interval');
 do {
  console.log(JSON.stringify(await mirrorCompletedLive({recordingsRoot:root,receiptsRoot,storage,channel:process.env.SMILE_CAPTURE_LIVE_CHANNEL||'live'})));
  if(process.argv.includes('--once'))break;
  await new Promise(resolve=>setTimeout(resolve,interval));
 }while(true);
}
