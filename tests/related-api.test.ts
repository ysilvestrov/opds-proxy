import {it,expect,vi} from 'vitest';
import pino from 'pino';
import {createApp} from '../src/api/app.js';
import {loadConfig} from '../src/config.js';
import {encodeRelatedKey} from '../src/domain/related.js';
import {createBookCardSigner} from '../src/api/card-grant.js';
import {SourceError} from '../src/sources/searchfloor/client.js';
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
