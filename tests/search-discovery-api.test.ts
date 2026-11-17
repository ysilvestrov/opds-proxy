import {expect,it,vi} from 'vitest';
import pino from 'pino';
import {readFileSync} from 'node:fs';
import {XMLParser} from 'fast-xml-parser';
import {createApp} from '../src/api/app.js';
import {createBookCardSigner} from '../src/api/card-grant.js';
import {loadConfig} from '../src/config.js';
import {Catalog} from '../src/catalog.js';
import {Cache} from '../src/storage/cache.js';
import {SearchfloorClient} from '../src/sources/searchfloor/client.js';

const base='https://opds.example/proxy';
const config=loadConfig({PUBLIC_BASE_URL:base,CACHE_PATH:':memory:',OPDS_USERNAME:'reader',OPDS_PASSWORD:'testing-only'});
const authorization='Basic '+Buffer.from('reader:testing-only').toString('base64');
const headers={authorization,host:'attacker.example'};
const parser=new XMLParser({ignoreAttributes:false});
const html=(name:string)=>readFileSync(new URL('fixtures/searchfloor/'+name+'.html',import.meta.url),'utf8');
const internal=(url:string)=>{const u=new URL(url);expect(u.origin).toBe(new URL(base).origin);expect(u.pathname.startsWith('/proxy/')).toBe(true);return u.pathname.slice('/proxy'.length)+u.search;};
const links=(feed:any):Record<string,string>[]=>Array.isArray(feed.link)?feed.link:[feed.link];
const entries=(feed:any)=>feed.entry?(Array.isArray(feed.entry)?feed.entry:[feed.entry]):[];
const completedFixtureIds=['25463','25466','25974','12791','7654','5063','26307','7411','15888','5604','5603','5574'];
it('rejects discovered URLs outside configured HTTPS origin or base path',()=>{
 for(const url of ['https://attacker.example/proxy/opds/searchfloor/search','http://opds.example/proxy/opds/searchfloor/search','https://opds.example/proxy-wrong/opds/searchfloor/search','https://opds.example/opds/searchfloor/search'])expect(()=>internal(url)).toThrow();
 expect(internal(base+'/opds/searchfloor/search?q=x&page=1')).toBe('/opds/searchfloor/search?q=x&page=1');
});

for(const query of ['стоев','за последним порогом','  А & Б 100% е\u0308  '])it('follows discovered search and next preserving query: '+query,async()=>{
 const calls:URL[]=[];
 const client=new SearchfloorClient({spacingMs:0,fetch:async input=>{const u=new URL(input);calls.push(u);return new Response(u.searchParams.get('page')==='1'?html('mixed-search')+'<button id="btn-next-page" data-page="2"></button>':html('fragment'));}});
 const cache=new Cache(':memory:');const catalog=new Catalog({cache,client});const app=createApp({config,catalog,log:pino({enabled:false})});
 try{
  const root=parser.parse(await (await app.request('/opds',{headers})).text()).feed;
  const discovery=links(root).find(l=>l['@_rel']==='search')!;expect(discovery).toBeDefined();
  expect(discovery['@_href']).toBe(base+'/opds/searchfloor/opensearch.xml');
  const description=await app.request(internal(discovery['@_href']),{headers});expect(description.status).toBe(200);
  expect(description.headers.get('content-type')).toContain('application/opensearchdescription+xml');expect(calls).toHaveLength(0);
  const template=parser.parse(await description.text()).OpenSearchDescription.Url['@_template'];
  const url=template.replace('{searchTerms}',encodeURIComponent(query));expect(url).not.toContain('{');
  const response=await app.request(internal(url),{headers});expect(response.status).toBe(200);
  const feed=parser.parse(await response.text()).feed;
  expect(entries(feed).map((b:any)=>b.id)).toEqual(completedFixtureIds.map(id=>'urn:opds:searchfloor:book:'+id));
  expect(calls).toHaveLength(1);expect(calls[0].pathname).toBe('/search');expect(calls[0].searchParams.get('q')).toBe(query.trim().normalize('NFC'));expect(calls[0].searchParams.get('page')).toBe('1');
  const next=links(feed).find(l=>l['@_rel']==='next')!['@_href'];expect(new URL(next).searchParams.get('q')).toBe(query.trim().normalize('NFC'));
  expect((await app.request(internal(next),{headers})).status).toBe(200);expect(calls).toHaveLength(2);expect(calls[1].searchParams.get('q')).toBe(query.trim().normalize('NFC'));expect(calls[1].searchParams.get('page')).toBe('2');
 }finally{client.close();cache.close();}
});

it('keeps discovery local, Basic mandatory and page validation unchanged',async()=>{
 const page=vi.fn(async()=>({books:[],nextPage:null,observedAt:new Date(0).toISOString(),stale:false}));
 const app=createApp({config,catalog:{page,book:async()=>null},log:pino({enabled:false})});
 const sig=createBookCardSigner(config.OPDS_PASSWORD).sign('searchfloor','1');
 for(const path of ['/opds','/opds/searchfloor/opensearch.xml','/opds/searchfloor/search?q=x']){
  expect((await app.request(path)).status).toBe(401);expect((await app.request(path+(path.includes('?')?'&':'?')+'sig='+sig)).status).toBe(401);
 }
 for(const path of ['/opds','/opds/searchfloor','/opds/searchfloor/opensearch.xml'])expect((await app.request(path,{headers})).status).toBe(200);
 expect(page).not.toHaveBeenCalled();
 for(const raw of ['','0','1.5','10001'])expect((await app.request('/opds/searchfloor/search?q=x&page='+raw,{headers})).status).toBe(400);
 expect(page).not.toHaveBeenCalled();expect((await app.request('/opds/searchfloor/search?q=x',{headers})).status).toBe(200);
 expect(page).toHaveBeenCalledWith('x',1,expect.any(AbortSignal));
});

it('retains next for an empty filtered page without crawling to fill it',async()=>{
 const calls:URL[]=[];const client=new SearchfloorClient({spacingMs:0,fetch:async input=>{const u=new URL(input);calls.push(u);return new Response(u.searchParams.get('page')==='1'?html('completed').replaceAll('весь текст','в процессе'):html('fragment'));}});
 const cache=new Cache(':memory:');const app=createApp({config,catalog:new Catalog({cache,client}),log:pino({enabled:false})});
 try{
  const r=await app.request('/opds/searchfloor/search?q='+encodeURIComponent('за последним порогом')+'&page=1',{headers});expect(r.status).toBe(200);
  const feed=parser.parse(await r.text()).feed;expect(entries(feed)).toHaveLength(0);expect(calls).toHaveLength(1);
  const next=links(feed).find(l=>l['@_rel']==='next')!['@_href'];expect(new URL(next).searchParams.get('q')).toBe('за последним порогом');
  const r2=await app.request(internal(next),{headers});expect(r2.status).toBe(200);expect(entries(parser.parse(await r2.text()).feed).length).toBeGreaterThan(0);expect(calls).toHaveLength(2);
 }finally{client.close();cache.close();}
});
