import {readFileSync} from 'node:fs';
import {it,expect} from 'vitest';
import {SearchfloorClient} from '../src/sources/searchfloor/client.js';
const series=readFileSync(new URL('fixtures/searchfloor/related-series.html',import.meta.url),'utf8');
const author=readFileSync(new URL('fixtures/searchfloor/related-author.html',import.meta.url),'utf8');
const target={kind:'series' as const,name:'Асмодей',authors:'Алексей Котов'};
it('requests one fixed entity path, with no per-book enrichment',async()=>{
 const calls:string[]=[];
 const c=new SearchfloorClient({spacingMs:0,fetch:async input=>{calls.push(String(input));return new Response(calls.length===1?series:author);}});
 expect((await c.listRelated(target)).books.map(b=>b.id)).toEqual(['27047']);
 await c.listRelated({kind:'author',slug:'Алексей Котов'});
 expect(calls).toHaveLength(2);
 expect(new URL(calls[0]).pathname).toBe('/s/'+encodeURIComponent(target.name));
 expect(new URL(calls[0]).searchParams.get('authors')).toBe(target.authors);
 expect(new URL(calls[1]).pathname).toBe('/a/'+encodeURIComponent('Алексей Котов'));
});
it('rejects unexpected 404, missing layout, foreign redirect and HTML overflow',async()=>{
 for(const response of [new Response(series,{status:404}),new Response('<p>Ничего не найдено</p>',{status:404}),new Response('bad'),new Response(null,{status:302,headers:{location:'https://bad.example/'}}),new Response('x'.repeat(2*1024*1024+1))]){
  const c=new SearchfloorClient({spacingMs:0,fetch:async()=>response});
  await expect(c.listRelated(target)).rejects.toMatchObject({status:502});c.close();
 }
});
it('accepts a recognized empty 404 and enforces timeout and cancellation',async()=>{
 // Use DOM to remove rows without changing verified page context.
 const {load}=await import('cheerio');const $=load(series);$('.series-item').remove();$('.card-body').append('<p>Ничего не найдено 😔</p>');
 const c=new SearchfloorClient({spacingMs:0,fetch:async()=>new Response($.html(),{status:404})});
 expect((await c.listRelated(target)).books).toEqual([]);
 const timed=new SearchfloorClient({spacingMs:0,timeoutMs:20,fetch:async()=>new Promise(()=>{})});
 await expect(timed.listRelated(target)).rejects.toMatchObject({status:503});
 const abort=new AbortController();abort.abort();await expect(c.listRelated(target,abort.signal)).rejects.toMatchObject({status:503});
 c.close();timed.close();
});
