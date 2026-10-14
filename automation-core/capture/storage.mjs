// SMILE CAPTURE private S3-compatible segment mirror. Credentials stay server-side.
import { createHash,createHmac } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { Readable } from 'node:stream';
const sha=v=>createHash('sha256').update(v).digest('hex');
const mac=(k,v)=>createHmac('sha256',k).update(v).digest();
const enc=v=>encodeURIComponent(v).replace(/[!'()*]/g,x=>'%' + x.charCodeAt(0).toString(16).toUpperCase());
export class PrivateS3Mirror {
  constructor({endpoint,region,bucket,accessKeyId,secretAccessKey,prefix='capture',allowHttpTestOnly=false}) {
    if (![region,bucket,accessKeyId,secretAccessKey].every(x=>typeof x==='string'&&x.length>0)) throw new Error('Object-store region, bucket and credentials required');
    if (!/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(bucket)) throw new Error('Invalid bucket');
    if (!/^[a-zA-Z0-9/_-]+$/.test(prefix)||prefix.startsWith('/')||prefix.includes('//')) throw new Error('Unsafe object prefix');
    if(!endpoint) throw new Error('Explicit S3-compatible endpoint required for pilot');
    const url=new URL(endpoint);
    if(url.protocol!=='https:'&&!(allowHttpTestOnly&&url.hostname==='127.0.0.1'&&url.protocol==='http:')) throw new Error('Storage endpoint must use HTTPS');
    if(url.username||url.password||url.search||url.hash) throw new Error('Storage endpoint cannot contain credentials/query/fragment');
    this.endpoint=url;this.bucket=bucket;this.region=region;this.accessKeyId=accessKeyId;this.secretAccessKey=secretAccessKey;this.prefix=prefix.replace(/\/$/,'');
  }
  keyForChunk(manifest,part) {
    if(!/^[-0-9a-f]{36}$/i.test(manifest.id)||!Number.isSafeInteger(part.index)||part.index<0||part.index>9999999) throw new Error('Invalid capture source identifier');
    const date=new Date(manifest.createdAt);
    if(Number.isNaN(+date)) throw new Error('Invalid source date');
    return this.prefix+'/'+date.toISOString().slice(0,10)+'/'+manifest.id+'/'+String(part.index).padStart(7,'0')+'.chunk';
  }
  async request(method,key,{body=null,bodyHash=sha(''),size,sha256}={}) {
    if(key.startsWith('/')||key.includes('..')||key.includes('//')) throw new Error('Unsafe object key');
    const uri=this.endpoint.pathname.replace(/\/$/,'')+'/'+enc(this.bucket)+'/'+key.split('/').map(enc).join('/');
    const dateTime=new Date().toISOString().replace(/[:-]|\.\d{3}/g,'');
    const date=dateTime.slice(0,8);
    const headers=new Headers({host:this.endpoint.host,'x-amz-content-sha256':bodyHash,'x-amz-date':dateTime});
    if(sha256) headers.set('x-amz-meta-sha256',sha256);
    if(size!==undefined) headers.set('content-length',String(size));
    const names=[...headers.keys()].sort();
    const canonicalHeaders=names.map(n=>n+':'+headers.get(n).trim()+'\n').join('');
    const signedHeaders=names.join(';');
    const requestHash=sha([method,uri,'',canonicalHeaders,signedHeaders,bodyHash].join('\n'));
    const scope=date+'/'+this.region+'/s3/aws4_request';
    const toSign=['AWS4-HMAC-SHA256',dateTime,scope,requestHash].join('\n');
    const keyMaterial=mac(mac(mac(mac('AWS4'+this.secretAccessKey,date),this.region),'s3'),'aws4_request');
    const signature=createHmac('sha256',keyMaterial).update(toSign).digest('hex');
    headers.set('authorization','AWS4-HMAC-SHA256 Credential='+this.accessKeyId+'/'+scope+', SignedHeaders='+signedHeaders+', Signature='+signature);
    const response=await fetch(this.endpoint.origin+uri,{method,headers,body:body?Readable.toWeb(body):undefined,...(body?{duplex:'half'}:{})});
    if(response.status===404&&method==='HEAD') return null;
    if(!response.ok){await response.body?.cancel().catch(()=>{});throw new Error('Object store '+method+' HTTP '+response.status);}
    if(response.body) await response.body.cancel().catch(()=>{});
    return response;
  }
  async statPart(key) {
    const found=await this.request('HEAD',key);
    return found?{bytes:Number(found.headers.get('content-length')),sha256:found.headers.get('x-amz-meta-sha256')}:null;
  }
  async ensurePart(key,path,{bytes,sha256}) {
    const found=await this.statPart(key);
    if(found) {
      if(found.bytes!==bytes||found.sha256!==sha256) throw new Error('Remote object conflicts with source checksum/length');
      return {alreadyStored:true};
    }
    await this.request('PUT',key,{body:createReadStream(path),bodyHash:sha256,size:bytes,sha256});
    const saved=await this.statPart(key);
    if(!saved||saved.bytes!==bytes||saved.sha256!==sha256) throw new Error('Remote object verification failed');
    return {alreadyStored:false};
  }
}
export function mirrorFromEnv(env=process.env) {
  const keys=['SMILE_CAPTURE_STORAGE_ENDPOINT','SMILE_CAPTURE_STORAGE_REGION','SMILE_CAPTURE_STORAGE_BUCKET','SMILE_CAPTURE_STORAGE_ACCESS_KEY_ID','SMILE_CAPTURE_STORAGE_SECRET_ACCESS_KEY'];
  for(const key of keys) if(!env[key]) throw new Error('Missing '+key);
  return new PrivateS3Mirror({endpoint:env.SMILE_CAPTURE_STORAGE_ENDPOINT,region:env.SMILE_CAPTURE_STORAGE_REGION,bucket:env.SMILE_CAPTURE_STORAGE_BUCKET,accessKeyId:env.SMILE_CAPTURE_STORAGE_ACCESS_KEY_ID,secretAccessKey:env.SMILE_CAPTURE_STORAGE_SECRET_ACCESS_KEY,prefix:env.SMILE_CAPTURE_STORAGE_PREFIX||'capture'});
}