import {it,expect,vi} from 'vitest';
import pino from 'pino';
import {createApp} from '../src/api/app.js';
import {loadConfig} from '../src/config.js';
import {encodeRelatedKey} from '../src/domain/related.js';
import {createBookCardSigner} from '../src/api/card-grant.js';
import {SourceError} from '../src/sources/searchfloor/client.js';
import {SearchfloorClient} from '../src/sources/searchfloor/client.js';
import {Catalog} from '../src/catalog.js';
import {Cache} from '../src/storage/cache.js';
import {readFileSync} from 'node:fs';
import {XMLParser} from 'fast-xml-parser';
const config=loadConfig({PUBLIC_BASE_URL:'https://opds.example',CACHE_PATH:':memory:',OPDS_USERNAME:'reader',OPDS_PASSWORD:'testing-only'});
const authorization='Basic '+Buffer.from('reader:testing-only').toString('base64');
const target={kind:'author' as const,slug:'A'};const key=encodeRelatedKey(target);const path='/opds/searchfloor/authors/'+key;
const page=async()=>({books:[],nextPage:null,observedAt:new Date(0).toISOString(),stale:false});
it('requires Basic for related feeds and validates inputs before Catalog',async()=>{
 const related=vi.fn(page);const app=createApp({config,catalog:{page,book:async()=>null,related},log:pino({enabled:false})});
 const sig=createBookCardSigner(config.OPDS_PASSWORD).sign('searchfloor','1');
 for(const p of [path,path+'?sig='+sig])expect((await app.request(p)).status).toBe(401);
 expect(related).not.toHaveBeenCalled();
 for(const p of [path+'?page=0',path+'?page=1.5',path+'?page=10001','/opds/searchfloor/authors/bad','/opds/searchfloor/series/'+key])expect((await app.request(p,{headers:{authorization}})).status).toBe(400);
 expect((await app.request(path.replace('searchfloor','unknown'),{headers:{authorization}})).status).toBe(404);
 expect(related).not.toHaveBeenCalled();
 const r=await app.request(path+'?page=2',{headers:{authorization}});expect(r.status).toBe(200);expect(r.headers.get('content-type')).toContain('kind=acquisition');
 expect(related).toHaveBeenCalledWith(target,2,expect.any(AbortSignal));
});
it('preserves unsupported capability and controlled source-error behavior',async()=>{
 const absent=createApp({config,catalog:{page,book:async()=>null},log:pino({enabled:false})});
 expect((await absent.request(path,{headers:{authorization}})).status).toBe(404);
 const failing=createApp({config,catalog:{page,book:async()=>null,related:async()=>{throw new SourceError('private detail',502);}},log:pino({enabled:false})});
 const r=await failing.request(path,{headers:{authorization}});expect(r.status).toBe(502);expect(await r.text()).not.toContain('private detail');
});
it('logs route classes without keys, selectors, queries or credentials',async()=>{
 const logs:unknown[]=[];const log={info:(value:unknown)=>logs.push(value),warn:()=>{}} as unknown as pino.Logger;
 const app=createApp({config,catalog:{page,book:async()=>null,related:page},log});
 const s=encodeRelatedKey({kind:'series',name:'Private title',authors:'Private author'});
 for(const p of [path+'?page=1&extra=secret','/opds/searchfloor/series/'+s])await app.request(p,{headers:{authorization}});
 expect(logs).toMatchObject([{route:'author_feed',status:200},{route:'series_feed',status:200}]);
 expect(JSON.stringify(logs)).not.toMatch(new RegExp([key,s,'Private','secret','testing-only','Authorization'].join('|')));
});
it('follows real full-card links through source parser and shared local-page cache',async()=>{
 const calls:string[]=[];
 const html=(name:string)=>readFileSync(new URL('fixtures/searchfloor/'+name+'.html',import.meta.url),'utf8');
 const client=new SearchfloorClient({spacingMs:0,fetch:async input=>{const u=new URL(input);calls.push(u.pathname);
  if(u.pathname==='/b/27047')return new Response(html('book'));
  if(u.pathname.startsWith('/a/'))return new Response(html('related-author'));
  if(u.pathname.startsWith('/s/'))return new Response(html('related-series'));
  if(u.pathname.startsWith('/api/annotation/'))return new Response('Synopsis',{headers:{'content-type':'text/plain'}});
  return new Response(null,{status:404});}});
 const cache=new Cache(':memory:');const catalog=new Catalog({cache,client});
 try {
  const app=createApp({config,catalog,log:pino({enabled:false})});
  const full=await app.request('/opds/searchfloor/books/27047',{headers:{authorization}});
  expect(full.status).toBe(200);
  const parser=new XMLParser({ignoreAttributes:false});const links=parser.parse(await full.text()).entry.link.filter((l:any)=>l['@_rel']==='related');
  expect(links).toHaveLength(2);const baseline=calls.length;
  const authorUrl=links.find((l:any)=>l['@_title'].includes('автора'))['@_href'];
  const p1=await app.request(authorUrl,{headers:{authorization}});expect(p1.status).toBe(200);
  const f=parser.parse(await p1.text()).feed;expect(f.entry).toHaveLength(20);
  const next=f.link.find((l:any)=>l['@_rel']==='next')['@_href'];
  expect((await app.request(next,{headers:{authorization}})).status).toBe(200);
  expect(calls.length-baseline).toBe(1);
  const seriesUrl=links.find((l:any)=>l['@_title'].includes('серії'))['@_href'];
  const s=await app.request(seriesUrl,{headers:{authorization}});expect(s.status).toBe(200);
  expect(parser.parse(await s.text()).feed.entry.id).toBe('urn:opds:searchfloor:book:27047');
  expect(calls.length-baseline).toBe(2);
 }finally{client.close();cache.close();}
});
