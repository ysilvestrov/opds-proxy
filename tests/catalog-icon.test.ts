import {expect,it,vi} from 'vitest';
import pino from 'pino';
import {createApp} from '../src/api/app.js';
import {loadConfig} from '../src/config.js';
import {createHash} from 'node:crypto';
import {inflateSync} from 'node:zlib';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';

function validPng(bytes:Uint8Array){
 const b=Buffer.from(bytes);expect(b.length).toBeLessThanOrEqual(65536);
 expect([...b.subarray(0,8)]).toEqual([137,80,78,71,13,10,26,10]);
 let offset=8;const types:string[]=[];const data:Buffer[]=[];let width=0,height=0,color=0;
 while(offset<b.length){
  expect(offset+12).toBeLessThanOrEqual(b.length);const size=b.readUInt32BE(offset);expect(offset+12+size).toBeLessThanOrEqual(b.length);
  const type=b.toString('ascii',offset+4,offset+8);const payload=b.subarray(offset+8,offset+8+size);
  let crc=0xffffffff;for(const byte of b.subarray(offset+4,offset+8+size)){crc^=byte;for(let bit=0;bit<8;bit++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}
  expect((crc^0xffffffff)>>>0).toBe(b.readUInt32BE(offset+8+size));
  if(type==='IHDR'){expect(types).toHaveLength(0);expect(size).toBe(13);width=payload.readUInt32BE(0);height=payload.readUInt32BE(4);color=payload[9];expect(payload[8]).toBe(8);expect(payload[10]).toBe(0);expect(payload[11]).toBe(0);expect(payload[12]).toBe(0);}
  if(type==='IDAT')data.push(payload);
  if(type==='IEND')expect(size).toBe(0);
  types.push(type);offset+=12+size;
 }
 expect(types[0]).toBe('IHDR');expect(types.filter(t=>t==='IHDR')).toHaveLength(1);expect(types.at(-1)).toBe('IEND');expect(types.filter(t=>t==='IEND')).toHaveLength(1);
 expect(width).toBeGreaterThan(0);expect(height).toBe(width);expect(data.length).toBeGreaterThan(0);
 const channels=({0:1,2:3,3:1,4:2,6:4} as Record<number,number>)[color];expect(channels).toBeDefined();
 const raw=inflateSync(Buffer.concat(data));expect(raw.length).toBe((1+width*channels)*height);
 for(let y=0;y<height;y++)expect(raw[y*(1+width*channels)]).toBeLessThanOrEqual(4);
}

it('bundles a valid PNG with provenance and defensive copies',async()=>{
 const {catalogIconBytes,CATALOG_ICON_PROVENANCE}=await import('../src/opds/catalog-icon.js');
 const b=catalogIconBytes();validPng(b);expect(CATALOG_ICON_PROVENANCE.sourceUrl).toBe('https://searchfloor.org/static/favicon.png');
 expect(Number.isNaN(Date.parse(CATALOG_ICON_PROVENANCE.retrievedAt))).toBe(false);
 expect(createHash('sha256').update(b).digest('hex')).toBe(CATALOG_ICON_PROVENANCE.sha256);
 expect(()=>validPng(b.slice(0,-1))).toThrow();const corrupt=b.slice();corrupt[50]^=1;expect(()=>validPng(corrupt)).toThrow();
 b[0]=0;expect(catalogIconBytes()[0]).toBe(137);
});
it('compiled asset loads from another cwd without files, cache or fetch',async()=>{
 const {CATALOG_ICON_PROVENANCE}=await import('../src/opds/catalog-icon.js');
 const moduleUrl=new URL('../dist/opds/catalog-icon.js',import.meta.url).href;
 const output=execFileSync(process.execPath,['--input-type=module','-e',`globalThis.fetch=()=>{throw Error('No network');};const m=await import(${JSON.stringify(moduleUrl)});const {createHash}=await import('node:crypto');console.log(createHash('sha256').update(m.catalogIconBytes()).digest('hex'));`],{cwd:tmpdir(),encoding:'utf8'});
 expect(output.trim()).toBe(CATALOG_ICON_PROVENANCE.sha256);
});
const path='/opds/searchfloor/icon.png';
const config=loadConfig({PUBLIC_BASE_URL:'https://opds.example/proxy',CACHE_PATH:':memory:',OPDS_USERNAME:'reader',OPDS_PASSWORD:'testing-only'});
const authorization='Basic '+Buffer.from('reader:testing-only').toString('base64');
function setup(){
 const page=vi.fn(),book=vi.fn(),details=vi.fn(),cover=vi.fn(),download=vi.fn();
 const app=createApp({config,catalog:{page,book,details,cover},download,log:pino({enabled:false})});
 return {app,calls:[page,book,details,cover,download]};
}
it('serves a public static PNG for GET/HEAD despite bad Basic without catalogue access',async()=>{
 const {app,calls}=setup();let expected:ArrayBuffer|undefined;
 for(const method of ['GET','HEAD'])for(const headers of [new Headers(),new Headers({authorization:'Basic YmFk'})]){
  const r=await app.request(path,{method,headers});expect(r.status).toBe(200);
  expect(r.headers.get('content-type')).toBe('image/png');expect(r.headers.get('x-content-type-options')).toBe('nosniff');
  expect(r.headers.get('cache-control')).toBe('public, max-age=86400');
  expect(r.headers.get('location')).toBeNull();expect(r.headers.get('www-authenticate')).toBeNull();
  const bytes=await r.arrayBuffer();if(method==='HEAD')expect(bytes.byteLength).toBe(0);
  else {expect(new Uint8Array(bytes).slice(0,8)).toEqual(new Uint8Array([137,80,78,71,13,10,26,10]));if(expected)expect(bytes).toEqual(expected);expected=bytes;}
 }
 for(const call of calls)expect(call).not.toHaveBeenCalled();
});
it('keeps the public exception limited to this route and methods',async()=>{
 const {app,calls}=setup();
 for(const p of ['/opds','/opds/searchfloor','/opds/searchfloor/search?q=x','/opds/searchfloor/books/1/download.fb2.zip'])expect((await app.request(p)).status).toBe(401);
 for(const p of ['/opds/unknown/icon.png',path+'/',path+'/other','/opds/searchfloor/other.png']){
  expect((await app.request(p)).status).toBe(401);expect((await app.request(p,{headers:{authorization}})).status).toBe(404);
 }
 expect((await app.request(path,{method:'POST'})).status).toBe(401);
 for(const call of calls)expect(call).not.toHaveBeenCalled();
});
it('advertises config base URL rather than a spoofed Host',async()=>{
 const {app}=setup();const r=await app.request('/opds',{headers:{authorization,host:'attacker.example'}});
 expect(r.status).toBe(200);const xml=await r.text();expect(xml).toContain('<icon>https://opds.example/proxy/opds/searchfloor/icon.png</icon>');expect(xml).not.toContain('attacker.example');
});
