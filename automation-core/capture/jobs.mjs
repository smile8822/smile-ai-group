// Independent queues: daily capture ingestion must not wait for historical archive repair.
// No video processing or SNS publishing is executed by this module.
import { mkdir, readFile, readdir, rename, writeFile, access } from 'node:fs/promises';
import { join } from 'node:path';

export const QUEUES = Object.freeze({ DAILY: 'SAME_DAY_CAPTURE', ARCHIVE: 'ARCHIVE_REPAIR' });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function ensureQueues(root) {
  for (const kind of Object.values(QUEUES)) {
    for (const state of ['queued','running','done','failed']) {
      await mkdir(join(root, 'jobs', kind, state), { recursive: true, mode: 0o700 });
    }
  }
}

export async function enqueueFinishedCapture(root, id) {
  if (!UUID.test(id)) throw new Error('Invalid session ID');
  const manifest = JSON.parse(await readFile(join(root, 'sessions', id, 'manifest.json'), 'utf8'));
  if (manifest.id !== id || manifest.status !== 'UPLOAD_FINISHED' || manifest.parts.length !== manifest.expectedChunks) {
    throw new Error('Only complete source manifests can be queued');
  }
  const dir = join(root,'jobs',QUEUES.DAILY,'queued');
  await mkdir(dir, {recursive:true,mode:0o700});
  // Never recreate a job that a worker has already claimed, finished, or rejected.
  for (const state of ['running','done','failed']) {
    try { await access(join(root,'jobs',QUEUES.DAILY,state,`${id}.json`)); return {jobId:id, alreadyQueued:true}; }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  const item = {
    jobId:id, sourceSessionId:id, kind:QUEUES.DAILY, state:'QUEUED',
    createdAt:manifest.updatedAt, bytes:manifest.bytesReceived,
    expectedChunks:manifest.expectedChunks,
    // This source has only passed transport verification; FFmpeg and editorial QC are pending.
    qcStatus:'NOT_VERIFIED', publishAllowed:false,
  };
  try { await writeFile(join(dir,`${id}.json`), JSON.stringify(item,null,2), {flag:'wx',mode:0o600}); }
  catch(e) { if (e.code!=='EEXIST') throw e; }
  return item;
}

// Idempotent recovery after crashes between finalizing source and creating its processing job.
export async function reconcileDailyCapture(root) {
  const dir=join(root,'sessions');
  let dirs=[];
  try { dirs=await readdir(dir,{withFileTypes:true}); }
  catch(e) { if(e.code==='ENOENT') return {queued:0};throw e; }
  let queued=0;
  for(const d of dirs){
    if(!d.isDirectory() || !UUID.test(d.name)) continue;
    try {
      const m=JSON.parse(await readFile(join(dir,d.name,'manifest.json'),'utf8'));
      if(m.status==='UPLOAD_FINISHED') {await enqueueFinishedCapture(root,d.name);queued++;}
    } catch(e){ if(e.code==='ENOENT') continue;throw e; }
  }
  return {verifiedSessionCount:queued};
}

export async function claimNext(root,kind) {
  if(!Object.values(QUEUES).includes(kind)) throw new Error('Invalid job kind');
  const queued=join(root,'jobs',kind,'queued');
  const running=join(root,'jobs',kind,'running');
  const names=(await readdir(queued)).filter(x=>x.endsWith('.json')).sort();
  for(const name of names){
    try {
      await rename(join(queued,name),join(running,name));
      return JSON.parse(await readFile(join(running,name),'utf8'));
    } catch(e) {if(e.code==='ENOENT') continue;throw e;}
  }
  return null;
}

export async function listQueued(root,kind) {
  if(!Object.values(QUEUES).includes(kind)) throw new Error('Invalid job kind');
  return (await readdir(join(root,'jobs',kind,'queued'))).filter(x=>x.endsWith('.json'));
}
