// Diagnostic spike only; not the production transport. One upstream request.
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
const mode = process.argv[2] || 'fetch';
const base = resolve(process.argv[3] || 'dist');
const target = 'https://searchfloor.org/?page=1&status=is_finished';
const result = {time:new Date().toISOString(), platform:process.platform,
  node:process.version, mode, responses:[]};
let calls=0;
async function transport(url, init) {
  if (calls >= 1) throw new Error('Diagnostic request budget exhausted');
  calls++;
  const response = mode==='mock403'
    ? new Response('<title>Just a moment...</title>',{status:403,headers:{'cf-mitigated':'challenge','content-type':'text/html'}})
    : await fetch(url, {...init, redirect:'manual'});
  result.responses.push({status:response.status, headers:Object.fromEntries(
    ['server','content-type','cf-ray','cf-mitigated','retry-after'].map(k=>[k,response.headers.get(k)]))});
  return response;
}
let client;
try {
  if (mode === 'app' || mode === 'mock403') {
    const {SearchfloorClient} = await import(pathToFileURL(resolve(base,'sources/searchfloor/client.js')));
    client = new SearchfloorClient({fetch:transport});
    const page = await client.list(null,1);
    result.parsed={books:page.books.length,nextPage:page.nextPage};
  } else if (mode === 'fetch') {
    const response = await transport(target,{signal:AbortSignal.timeout(15000),
      headers:{'User-Agent':'opds-proxy/0.1',Accept:'text/html,application/zip'}});
    const reader=response.body?.getReader(); let size=0;const parts=[];
    try { while(reader) { const {done,value}=await reader.read();if(done)break;
      size+=value.length;if(size>2097152)throw new Error('Body cap');parts.push(value); }}
    finally {await reader?.cancel().catch(()=>{});reader?.releaseLock();}
    const body=Buffer.concat(parts).toString('utf8');
    result.bytes=size;
    result.markers={challengeTitle:/<title[^>]*>\s*(?:Just a moment|Attention Required)/i.test(body),
      challengeHeader:response.headers.get('cf-mitigated')==='challenge'};
    result.cardCount=(body.match(/id=["']book\d+["']/g)||[]).length;
    if(response.status===200&&!result.markers.challengeTitle&&!result.markers.challengeHeader) {
      try { const {parsePage}=await import(pathToFileURL(resolve(base,'sources/searchfloor/parse.js')));
        const page=parsePage(body,1,result.time);result.parsed={books:page.books.length,nextPage:page.nextPage};
      } catch(e) {result.parseFailure=e.name;}
    }
  } else throw new Error('Unknown mode');
} catch(e) {result.failure={name:e.name,status:e.status??null,code:e.cause?.code??null};}
finally {client?.close();}
result.requests=calls;
console.log(JSON.stringify(result));
