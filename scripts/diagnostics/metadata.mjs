// Read-only operator probe. Not part of the application release or runtime units.
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';

const safeMime = value => {
  const mime=(value??'').split(';')[0].trim().toLowerCase();
  return ['image/jpeg','image/png','image/gif','text/plain','text/html','application/atom+xml'].includes(mime)?mime:'other';
};
const errorCode = error => ({'Invalid artwork':'invalid_artwork','Invalid annotation':'invalid_annotation',
  'Source denied request':'source_denied','Source cooldown':'cooldown','Response limit exceeded':'response_limit',
  'Source request failed':'timeout_or_transport','Source transport unavailable':'transport',
  'Source stream unavailable':'stream','Artwork unavailable':'artwork_http_error',
  'Annotation unavailable':'annotation_http_error'}[error?.message]??'other');
async function boundedBody(response, signal) {
  const reader=response.body?.getReader();if(!reader)return new Uint8Array();
  const chunks=[];let size=0;
  const cancel=()=>{void reader.cancel().catch(()=>{});};
  signal.addEventListener('abort',cancel,{once:true});
  try {
    while(true){signal.throwIfAborted();const part=await reader.read();signal.throwIfAborted();if(part.done)break;
      size+=part.value.length;if(size>2*1024*1024)throw Error('Response limit');chunks.push(part.value);}
    return Buffer.concat(chunks,size);
  } catch {await reader.cancel().catch(()=>{});throw Error('Response unavailable');}
  finally {signal.removeEventListener('abort',cancel);reader.releaseLock();}
}
export async function diagnoseMetadata({client,fetch:request=fetch,username,password,
  publicBaseUrl,localBaseUrl='http://127.0.0.1:8787',ids=['27223','27505'],emit=console.log,
  signal=AbortSignal.timeout(240000)}) {
  if(ids.length>2 || ids.length===0 || ids.some(id=>!/^\d{1,10}$/.test(id)))throw Error('Invalid probe IDs');
  const publicUrl=new URL(publicBaseUrl);const localUrl=new URL(localBaseUrl);
  if(publicUrl.protocol!=='https:'||publicUrl.username||publicUrl.password||
    localUrl.hostname!=='127.0.0.1'||localUrl.protocol!=='http:'||localUrl.username||localUrl.password)
    throw Error('Invalid probe origin');
  if(!username||!password)throw Error('Missing private configuration');
  const authorization='Basic '+Buffer.from(username+':'+password).toString('base64');
  async function measure(id,stage,operation){
    const start=performance.now();
    try {signal.throwIfAborted();const result=await operation();emit({id,stage,ok:true,elapsedMs:Math.round(performance.now()-start),...result});}
    catch(error){emit({id,stage,ok:false,elapsedMs:Math.round(performance.now()-start),
      status:[400,401,403,404,407,429,500,502,503].includes(error?.status)?error.status:null,
      code:errorCode(error),aborted:signal.aborted});}
  }
  async function privateRequest(id,stage,base,path){
    await measure(id,stage,async()=>{
      const joined=AbortSignal.any([signal,AbortSignal.timeout(65000)]);
      const r=await request(base.replace(/\/+$/,'')+path,{signal:joined,redirect:'manual',headers:{authorization}});
      const bytes=await boundedBody(r,joined);const mime=safeMime(r.headers.get('content-type'));
      const result={status:r.status,mime,bytes:bytes.length};
      if(r.ok && stage.startsWith('entry_')){
        const text=new TextDecoder().decode(bytes);
        return {...result,summary:/<summary\b/.test(text),imageLinks:(text.match(/rel="http:\/\/opds-spec\.org\/image(?:\/thumbnail)?"/g)??[]).length,
          stale:text.includes('Збережені metadata (stale)')};
      }
      return result;
    });
  }
  for(const id of ids){
    if(signal.aborted){emit({stage:'budget_exhausted'});break;}
    await measure(id,'source_card',async()=>{
      const card=await client.getCard(id,signal);
      return {complete:card?.book.complete??false,annotationApi:card?.annotation.api??false,
        inlineAnnotation:!!card?.annotation.inline};
    });
    await measure(id,'source_annotation',async()=>{const value=await client.getAnnotation(id,signal);return {bytes:value?Buffer.byteLength(value):0,absent:value===null};});
    await measure(id,'source_cover',async()=>{const value=await client.getCover(id,signal);return {bytes:value?.bytes.length??0,mime:value?.mime??null,absent:value===null};});
    const path=`/opds/searchfloor/books/${id}`;
    await privateRequest(id,'entry_local',localBaseUrl,path);
    await privateRequest(id,'entry_https',publicBaseUrl,path);
    await privateRequest(id,'cover_https',publicBaseUrl,path+'/cover');
  }
}

async function main(){
  let client,transport;
  try {
    const base='/opt/searchfloor-opds/current/dist';
    const {loadConfig}=await import(pathToFileURL(resolve(base,'config.js')));
    const {createSourceTransport}=await import(pathToFileURL(resolve(base,'sources/transport.js')));
    const {SearchfloorClient}=await import(pathToFileURL(resolve(base,'sources/searchfloor/client.js')));
    const config=loadConfig(process.env);
    if(!config.OPDS_SOURCE_PROXY_URL)throw Error('Proxy required');
    const emit=row=>console.log(JSON.stringify(row));
    transport=createSourceTransport(config.OPDS_SOURCE_PROXY_URL);
    client=new SearchfloorClient({fetch:async(input,init)=>{
      const start=performance.now();
      const r=await transport.fetch(input,init);
      const url=new URL(input);
      emit({stage:'source_http_headers',path:url.pathname,status:r.status,
        mime:safeMime(r.headers.get('content-type')),elapsedMs:Math.round(performance.now()-start),
        hasRedirect:!!r.headers.get('location')});
      return r;
    }});
    await diagnoseMetadata({client,username:config.OPDS_USERNAME,password:config.OPDS_PASSWORD,
      publicBaseUrl:config.PUBLIC_BASE_URL,localBaseUrl:`http://127.0.0.1:${config.PORT}`,emit});
  }catch {console.log(JSON.stringify({stage:'diagnostic_failed',ok:false}));process.exitCode=1;}
  finally {client?.close();await transport?.close().catch(()=>{});}
}
if(process.argv[1] && pathToFileURL(resolve(process.argv[1])).href===import.meta.url) await main();
