import type {Book,CatalogPage,SourcePage} from './domain/book.js';import {Cache} from './storage/cache.js';import {abortable} from './sources/searchfloor/client.js';
export const cacheKey=(source:string,query:string|null,page:number)=>JSON.stringify([1,source,query?.trim().normalize('NFC')??null,page,'complete']);
interface Client {list(q:string|null,p:number):Promise<SourcePage>;getBook(id:string):Promise<Book|null>}
interface Deps {cache:Cache;client:Client;now?:()=>number;sourceName?:string}
export class Catalog {
 private pending=new Map<string,Promise<unknown>>();private now:()=>number;private source:string;
 constructor(private deps:Deps){this.now=deps.now??Date.now;this.source=deps.sourceName??'searchfloor'}
 private share<T>(key:string,action:()=>Promise<T>,signal?:AbortSignal):Promise<T>{
  signal?.throwIfAborted();let op=this.pending.get(key) as Promise<T>|undefined;
  if(!op){op=action();this.pending.set(key,op);const clear=()=>this.pending.delete(key);void op.then(clear,clear)}
  return signal?abortable(op,signal):op;
 }
 async page(query:string|null,page:number,signal?:AbortSignal):Promise<CatalogPage>{
  signal?.throwIfAborted();query=query?.trim().normalize('NFC')??null;const key=cacheKey(this.source,query,page);const cached=this.deps.cache.get<SourcePage>(key,this.now());
  if(cached)return {...cached.value,stale:false};
  return this.share(key,async()=>{
   try{const value=await this.deps.client.list(query,page);this.deps.cache.set(key,value,this.now()+15*60000);
    for(const book of value.books)this.deps.cache.set(`book:${this.source}:${book.id}`,book,this.now()+24*3600000);return {...value,stale:false};
   }catch(e){const old=this.deps.cache.get<SourcePage>(key,this.now(),true);if(old&&this.now()-Date.parse(old.value.observedAt)<=24*3600000)return {...old.value,stale:true};throw e}
  },signal);
 }
 async book(id:string,signal?:AbortSignal):Promise<Book|null>{
  if(!/^\d+$/.test(id))return null;signal?.throwIfAborted();const key=`book:${this.source}:${id}`;const hit=this.deps.cache.get<Book>(key,this.now());
  if(hit&&hit.value.complete&&hit.value.sourceName===this.source&&this.now()-Date.parse(hit.value.observedAt)<15*60000)return hit.value;
  return this.share(key,async()=>{const book=await this.deps.client.getBook(id);if(book&&book.complete&&book.sourceName===this.source){this.deps.cache.set(key,book,this.now()+24*3600000);return book}return null},signal);
 }
}
