import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';
import {SearchfloorClient,SourceError} from '../src/sources/searchfloor/client.js';
const html=readFileSync(new URL('fixtures/searchfloor/completed.html',import.meta.url),'utf8');
const empty=readFileSync(new URL('fixtures/searchfloor/empty-search.html',import.meta.url),'utf8');
it('encodes source query/page and returns filtered typed books',async()=>{
 let url=''; const fragment=readFileSync(new URL('fixtures/searchfloor/fragment.html',import.meta.url),'utf8');const c=new SearchfloorClient({spacingMs:0,fetch:async input=>{url=String(input);return new Response(fragment)}});
 expect((await c.list('А & Б',2)).books).toHaveLength(20); const u=new URL(url);expect(u.searchParams.get('q')).toBe('А & Б');expect(u.searchParams.get('page')).toBe('2');
});
it('recognizes source 404 only when empty marker exists',async()=>{
 const c=new SearchfloorClient({spacingMs:0,fetch:async()=>new Response(empty,{status:404})});expect((await c.list('unknown',1)).books).toEqual([]);
 const bad=new SearchfloorClient({spacingMs:0,fetch:async()=>new Response('404',{status:404})});await expect(bad.list('unknown',1)).rejects.toThrow();
});
it('rejects hostile redirects and challenges without retry',async()=>{
 const c=new SearchfloorClient({spacingMs:0,fetch:async()=>new Response(null,{status:302,headers:{location:'https://evil.example'}})});await expect(c.list(null,1)).rejects.toThrow('redirect');
 const b=new SearchfloorClient({spacingMs:0,fetch:async()=>new Response('challenge',{status:403})});await expect(b.list(null,1)).rejects.toThrow(SourceError);
});
it('honors long Retry-After cooldown without early retry',async()=>{
 let now=0,attempts=0;const c=new SearchfloorClient({spacingMs:0,now:()=>now,fetch:async()=>{attempts++;return new Response('',{status:429,headers:{'retry-after':'60'}})}});
 await expect(c.list(null,1)).rejects.toThrow();await expect(c.list(null,1)).rejects.toThrow('cooldown');expect(attempts).toBe(1);now=61000;await expect(c.list(null,1)).rejects.toThrow();expect(attempts).toBe(2);
});
it('retries transient failures only once',async()=>{
 let attempts=0; const c=new SearchfloorClient({spacingMs:0,retryMs:0,fetch:async()=>{attempts++;return new Response('',{status:503})}});await expect(c.list(null,1)).rejects.toThrow();expect(attempts).toBe(2);
});
it('caps source response and bounds queue waiting',async()=>{
 const large=new SearchfloorClient({spacingMs:0,htmlLimit:4,fetch:async()=>new Response('too large')});await expect(large.list(null,1)).rejects.toThrow('limit');
 const c=new SearchfloorClient({spacingMs:0,queueWaitMs:10,fetch:async()=>new Promise(()=>{})});const a=c.list(null,1); const b=c.list(null,2);await expect(b).rejects.toThrow('queue');c.close();await expect(a).rejects.toThrow();
});
it('times out a source fetch even when injected transport ignores signal',async()=>{const c=new SearchfloorClient({spacingMs:0,timeoutMs:10,fetch:async()=>new Promise(()=>{})});await expect(c.list(null,1)).rejects.toThrow();c.close();});
it('validates card completion and refuses arbitrary IDs',async()=>{const book=readFileSync(new URL('fixtures/searchfloor/book.html',import.meta.url),'utf8');const c=new SearchfloorClient({spacingMs:0,fetch:async()=>new Response(book)});expect((await c.getBook('27047'))?.complete).toBe(true);expect(await c.getBook('../evil')).toBeNull();const incomplete=new SearchfloorClient({spacingMs:0,fetch:async()=>new Response(book.replace('весь текст','в процессе'))});expect(await incomplete.getBook('27047')).toBeNull();});

it('maps changed HTML structure to 502',async()=>{const client=new SearchfloorClient({spacingMs:0,fetch:async()=>new Response('<html>changed</html>')});await expect(client.list(null,1)).rejects.toMatchObject({status:502});client.close();});
