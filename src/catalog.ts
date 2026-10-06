import type { Book, BookDetails, Artwork, ArtworkMime, SourceCard, CatalogPage, SourcePage } from "./domain/book.js";
import { Cache } from "./storage/cache.js";
import { abortable } from "./sources/searchfloor/client.js";
export const cacheKey = (source: string, query: string | null, page: number) =>
  JSON.stringify([
    1,
    source,
    query?.trim().normalize("NFC") ?? null,
    page,
    "complete",
  ]);
interface Client {
  list(q: string | null, p: number): Promise<SourcePage>;
  getBook(id: string): Promise<Book | null>;
  getCard?(id: string): Promise<SourceCard|null>;
  getAnnotation?(id:string): Promise<string|null>;
  getCover?(id:string): Promise<Artwork|null>;
}
type RecordValue<T> = {state:'present'; observedAt:string; value:T} | {state:'absent'; observedAt:string};
interface StoredArtwork {mime:ArtworkMime; base64:string; observedAt:string}
const day = 24*3600000;
interface Deps {
  cache: Cache;
  client: Client;
  now?: () => number;
  sourceName?: string;
}
export class Catalog {
  private pending = new Map<string, Promise<unknown>>();
  private now: () => number;
  private source: string;
  private active = new Map<string, Set<{invalidated:boolean}>>();
  constructor(private deps: Deps) {
    this.now = deps.now ?? Date.now;
    this.source = deps.sourceName ?? "searchfloor";
  }
  private share<T>(
    key: string,
    action: () => Promise<T>,
    signal?: AbortSignal,
  ): Promise<T> {
    signal?.throwIfAborted();
    let op = this.pending.get(key) as Promise<T> | undefined;
    if (!op) {
      op = action();
      this.pending.set(key, op);
      const clear = () => this.pending.delete(key);
      void op.then(clear, clear);
    }
    return signal ? abortable(op, signal) : op;
  }
  async page(
    query: string | null,
    page: number,
    signal?: AbortSignal,
  ): Promise<CatalogPage> {
    signal?.throwIfAborted();
    query = query?.trim().normalize("NFC") ?? null;
    const key = cacheKey(this.source, query, page);
    const cached = this.deps.cache.get<SourcePage>(key, this.now());
    if (cached) return { ...cached.value, stale: false };
    return this.share(
      key,
      async () => {
        try {
          const observed = await this.deps.client.list(query, page);
          for (const id of (observed as SourcePage & {rejectedIds?:string[]}).rejectedIds ?? []) this.invalidate(id);
          const value:SourcePage = {books:observed.books,nextPage:observed.nextPage,observedAt:observed.observedAt};
          this.deps.cache.set(key, value, this.now() + 15 * 60000);
          for (const book of value.books)
            this.deps.cache.set(
              `book:${this.source}:${book.id}`,
              book,
              this.now() + 24 * 3600000,
            );
          return { ...value, stale: false };
        } catch (e) {
          const old = this.deps.cache.get<SourcePage>(key, this.now(), true);
          if (
            old &&
            this.now() - Date.parse(old.value.observedAt) <= 24 * 3600000
          )
            return { ...old.value, stale: true };
          throw e;
        }
      },
      signal,
    );
  }
  async book(id: string, signal?: AbortSignal): Promise<Book | null> {
    if (!/^\d+$/.test(id)) return null;
    signal?.throwIfAborted();
    const key = `book:${this.source}:${id}`;
    const hit = this.deps.cache.get<Book>(key, this.now());
    if (
      hit &&
      hit.value.complete &&
      hit.value.sourceName === this.source &&
      this.now() - Date.parse(hit.value.observedAt) < 15 * 60000
    )
      return hit.value;
    return this.share(
      key,
      async () => {
        const book = await this.deps.client.getBook(id);
        if (book && book.complete && book.sourceName === this.source) {
          this.deps.cache.set(key, book, this.now() + 24 * 3600000);
          return book;
        }
        this.invalidate(id);
        return null;
      },
      signal,
    );
  }
  private resourceKey(id:string, resource:string) { return `details:v1:${this.source}:${id}:${resource}`; }
  private invalidate(id:string) {
    this.deps.cache.delete(`book:${this.source}:${id}`);
    for (const resource of ['annotation','cover']) this.deps.cache.delete(this.resourceKey(id,resource));
    for (const token of this.active.get(id) ?? []) token.invalidated=true;
  }
  private async guarded<T>(id:string, action:(token:{invalidated:boolean})=>Promise<T>):Promise<T> {
    const token={invalidated:false}; const set=this.active.get(id) ?? new Set();
    this.active.set(id,set);set.add(token);
    try{return await action(token);}finally{set.delete(token);if(!set.size)this.active.delete(id);}
  }
  private async displayBook(id:string):Promise<SourceCard|null> {
    const cached=this.deps.cache.get<Book>(`book:${this.source}:${id}`,this.now());
    if(cached && cached.value.complete && cached.value.sourceName===this.source && this.now()-Date.parse(cached.value.observedAt)<day)
      return {book:cached.value,annotation:{api:true}};
    return this.share(`card:${this.source}:${id}`,async()=>{
      const card=this.deps.client.getCard ? await this.deps.client.getCard(id) : null;
      if(!card || !card.book.complete || card.book.sourceName!==this.source){this.invalidate(id);return null;}
      this.deps.cache.set(`book:${this.source}:${id}`,card.book,this.now()+day);return card;
    });
  }
  private async resource<T>(id:string,kind:'annotation'|'cover',load:()=>Promise<T|null>,token:{invalidated:boolean}):Promise<RecordValue<T>|null> {
    const key=this.resourceKey(id,kind);
    const cached=this.deps.cache.get<RecordValue<T>>(key,this.now());
    if(cached && this.now()-Date.parse(cached.value.observedAt)<day) return cached.value;
    return this.share(key,async()=>{
      const value=await load(); const observedAt=new Date(this.now()).toISOString();
      if(token.invalidated)return null;
      const record:RecordValue<T>=value===null?{state:'absent',observedAt}:{state:'present',observedAt,value};
      this.deps.cache.set(key,record,this.now()+(value===null?15*60000:day),kind==='cover'?'artwork':undefined);
      return record;
    });
  }
  async details(id:string,signal?:AbortSignal):Promise<{book:Book;details:BookDetails;stale:boolean}|null> {
    if(!/^\d+$/.test(id))return null;
    return this.share(`details:${this.source}:${id}`,()=>this.guarded(id,async token=>{
      const card=await this.displayBook(id);if(!card || token.invalidated)return null;
      const details:BookDetails={sourceName:this.source,id,observedAt:card.book.observedAt};let stale=false;
      try{
        if(!card.annotation.invalid){
          const annotation=await this.resource(id,'annotation',async()=>card.annotation.inline ?? (card.annotation.api && this.deps.client.getAnnotation ? await this.deps.client.getAnnotation(id):null),token);
          if(annotation?.state==='present'){details.summary=annotation.value;details.observedAt=annotation.observedAt;}
        }
      }catch{stale=true;}
      try{
        const cover=await this.loadCover(id,token);
        if(cover)details.cover={mime:cover.mime};
      }catch{stale=true;}
      if(token.invalidated)return null;
      return {book:card.book,details,stale};
    }),signal);
  }
  private async loadCover(id:string,token:{invalidated:boolean}):Promise<Artwork|null> {
    const result=await this.resource<StoredArtwork>(id,'cover',async()=>{
      const artwork=await this.deps.client.getCover?.(id);if(!artwork)return null;
      if(artwork.bytes.length>2*1024*1024)throw Error('Artwork limit exceeded');
      return {mime:artwork.mime,base64:Buffer.from(artwork.bytes).toString('base64'),observedAt:artwork.observedAt};
    },token);
    return result?.state==='present' ? {mime:result.value.mime,bytes:Buffer.from(result.value.base64,'base64'),observedAt:result.value.observedAt}:null;
  }
  async cover(id:string,signal?:AbortSignal):Promise<Artwork|null>{
    if(!/^\d+$/.test(id))return null;
    return this.share(`cover:${this.source}:${id}`,()=>this.guarded(id,async token=>{
      if(!await this.displayBook(id) || token.invalidated)return null;
      const value=await this.loadCover(id,token);return token.invalidated?null:value;
    }),signal);
  }
}
