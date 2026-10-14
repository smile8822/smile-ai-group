#!/usr/bin/env node
// Technical media validation worker. Does NOT perform editorial QC or SNS publication.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { assemble } from './assemble.mjs';
import { QUEUES, ensureQueues, claimNext } from './jobs.mjs';

const run = promisify(execFile);

async function atomicReceipt(path, receipt) {
  const temp=`${path}.${randomUUID()}.tmp`;
  await writeFile(temp,JSON.stringify(receipt,null,2),{flag:'wx',mode:0o600});
  await rename(temp,path);
}

export async function processNextDailyQc({root}) {
  await ensureQueues(root);
  const job=await claimNext(root,QUEUES.DAILY);
  if (!job) return null;
  const running=join(root,'jobs',QUEUES.DAILY,'running',`${job.jobId}.json`);
  try {
    const original=JSON.parse(await readFile(join(root,'sessions',job.sourceSessionId,'manifest.json'),'utf8'));
    const extension=original.parts[0]?.mime === 'video/mp4' ? 'mp4' : 'webm';
    const dir=join(root,'media');
    await mkdir(dir,{recursive:true,mode:0o700});
    const output=join(dir,`${job.jobId}.${extension}`);
    await assemble({root,id:job.sourceSessionId,output});
    const probe=await run('ffprobe',['-v','error','-show_entries','format=duration:stream=codec_type','-of','json',output],{timeout:120000,maxBuffer:1024*1024});
    const result=JSON.parse(probe.stdout);
    const duration=Number(result.format?.duration);
    const types=new Set((result.streams||[]).map(s=>s.codec_type));
    if(!Number.isFinite(duration)||duration<=0||!types.has('video')||!types.has('audio')) throw new Error('Missing decodable video/audio or positive duration');
    await run('ffmpeg',['-hide_banner','-loglevel','error','-nostdin','-i',output,'-map','0:v:0','-map','0:a:0','-f','null','-'],{timeout:3600000,maxBuffer:1024*1024});
    const receipt={...job,status:'TECHNICAL_QC_PASSED',qcStatus:'AV_DECODE_PASSED',durationSeconds:duration,completedAt:new Date().toISOString(),mediaPath:output,publishAllowed:false};
    await atomicReceipt(join(root,'jobs',QUEUES.DAILY,'done',`${job.jobId}.json`),receipt);
    await rename(running,join(root,'jobs',QUEUES.DAILY,'done',`${job.jobId}.source.json`));
    return receipt;
  } catch(error) {
    const receipt={...job,status:'TECHNICAL_QC_FAILED',qcStatus:'FAILED',publishAllowed:false,completedAt:new Date().toISOString(),reason:String(error.message).slice(0,250)};
    await atomicReceipt(join(root,'jobs',QUEUES.DAILY,'failed',`${job.jobId}.json`),receipt);
    await rename(running,join(root,'jobs',QUEUES.DAILY,'failed',`${job.jobId}.source.json`));
    return receipt;
  }
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const root=process.env.CAPTURE_ROOT;
  if(!root){console.error('CAPTURE_ROOT required');process.exitCode=2;}
  else processNextDailyQc({root}).then(x=>console.log(JSON.stringify(x||{idle:true}))).catch(e=>{console.error(e.message);process.exitCode=1;});
}
