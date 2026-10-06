import {it,expect} from 'vitest';
// @ts-expect-error Operator ESM diagnostic, outside application release.
import {diagnoseMetadata} from '../scripts/diagnostics/metadata.mjs';
it('separates optional failures from successful metadata and never prints secrets or content',async()=>{
 const rows:unknown[]=[];
 const client={getCard:async()=>({book:{complete:true},annotation:{api:true}}),getAnnotation:async()=> 'private synopsis',getCover:async()=>{throw Object.assign(Error('proxy://secret-password'),{status:503});}};
 const fetch=async(input:string,init:RequestInit)=>{
  expect(init.headers).toMatchObject({authorization:'Basic '+Buffer.from('user:secret-password').toString('base64')});
  if(input.endsWith('/cover'))return new Response('proxy://secret-password',{status:503});
  return new Response('<entry><summary>private synopsis</summary><content>Збережені metadata (stale)</content></entry>',{headers:{'content-type':'application/atom+xml'}});
 };
 await diagnoseMetadata({client,fetch,username:'user',password:'secret-password',publicBaseUrl:'https://opds.example',ids:['27223'],emit:(row:unknown)=>rows.push(row)});
 const serialized=JSON.stringify(rows);expect(serialized).not.toContain('secret-password');expect(serialized).not.toContain('private synopsis');
 expect(rows).toContainEqual(expect.objectContaining({stage:'source_annotation',id:'27223',ok:true,bytes:16}));
 expect(rows).toContainEqual(expect.objectContaining({stage:'source_cover',ok:false,status:503}));
 expect(rows).toContainEqual(expect.objectContaining({stage:'entry_https',summary:true,imageLinks:0,stale:true}));
});
it('rejects invalid IDs before using credentials or network',async()=>{
 let used=false;
 await expect(diagnoseMetadata({client:{getCard:async()=>{used=true;}},fetch:async()=>{used=true;},ids:['../secret'],emit:()=>{},username:'u',password:'p',publicBaseUrl:'https://opds.example'})).rejects.toThrow();
 expect(used).toBe(false);
});
it('cancels a stalled private response at the overall diagnostic deadline',async()=>{
 let canceled=false;const rows:unknown[]=[];
 const client={getCard:async()=>null,getAnnotation:async()=>null,getCover:async()=>null};
 const signal=AbortSignal.timeout(20);const start=performance.now();
 const work=diagnoseMetadata({client,fetch:async()=>new Response(new ReadableStream({start(c){c.enqueue(new Uint8Array([1]));},cancel(){canceled=true;}})),username:'u',password:'p',publicBaseUrl:'https://opds.example',ids:['27223'],signal,emit:(r:unknown)=>rows.push(r)});
 const outcome=await Promise.race([work.then(()=>true),new Promise<boolean>(r=>setTimeout(()=>r(false),100))]);
 expect(outcome).toBe(true);expect(canceled).toBe(true);expect(performance.now()-start).toBeLessThan(500);
 expect(rows).toContainEqual(expect.objectContaining({stage:'entry_local',ok:false,aborted:true}));
});
