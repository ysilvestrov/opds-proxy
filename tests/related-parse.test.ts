import {readFileSync} from 'node:fs';
import {it,expect} from 'vitest';
import {parseReferences} from '../src/sources/searchfloor/references.js';
import {parsePage} from '../src/sources/searchfloor/parse.js';
import {parseRelatedPage} from '../src/sources/searchfloor/related.js';
import {load} from 'cheerio';
const at='2026-10-07T00:00:00Z';
const card=(refs:string)=>`<div id="book1"><p class="fw-medium">Title</p><span data-bs-title="Статус книги">весь текст</span><button class="download-btn" data-url="/book/1"></button>${refs}</div>`;
it('extracts source references from the known ordinary card without fetching',()=>{
 const html=readFileSync(new URL('fixtures/searchfloor/book.html',import.meta.url),'utf8');
 const refs={authorRefs:[{id:'Алексей Котов',name:'Алексей Котов'}],seriesRef:{name:'Асмодей',authors:'Алексей Котов'}};
 expect(parseReferences(html,'27047')).toEqual(refs);
 expect(parsePage(html,1,at).books[0]).toMatchObject(refs);
});
const target={kind:'series' as const,name:'Асмодей',authors:'Алексей Котов'};
const series=readFileSync(new URL('fixtures/searchfloor/related-series.html',import.meta.url),'utf8');
const author=readFileSync(new URL('fixtures/searchfloor/related-author.html',import.meta.url),'utf8');
it('parses real compact series and author pages including standalone books',()=>{
 const s=parseRelatedPage(series,target,at);
 expect(s.books.map(b=>b.id)).toEqual(['27047']);
 expect(s.books[0]).toMatchObject({authors:['Алексей Котов'],series:'Асмодей',seriesPosition:1,characterCount:511195,authorSheets:12.78});
 const a=parseRelatedPage(author,{kind:'author',slug:'Алексей Котов'},at);
 expect(a.books).toHaveLength(46);
 expect(a.books.slice(0,2).map(b=>b.id)).toEqual(['11834','27047']);
 expect(a.books[0].series).toBeUndefined();
 expect(a.books[0].characterCount).toBeUndefined();
 expect(a.books.every(b=>b.id!=='27484')).toBe(true);
});
const changed=(modify:($:ReturnType<typeof load>)=>void)=>{const $=load(series);modify($);return $.html();};
it('rejects statuses and mismatching Download without poisoning valid empty',()=>{
 for(const status of ['в процессе','unknown','']){
  const html=changed($=>$('.series-content').first().append(`<span data-bs-title="Статус книги">${status}</span>`));
  expect(parseRelatedPage(html,target,at).books).toEqual([]);
 }
 expect(parseRelatedPage(changed($=>$('.download-btn').remove()),target,at).books).toEqual([]);
 expect(parseRelatedPage(changed($=>$('.download-btn').attr('data-url','/book/999')),target,at).books).toEqual([]);
 expect(parseRelatedPage(changed($=>$('.series-content').first().append('<span data-bs-title="Статус книги">весь текст</span>')),target,at).books).toHaveLength(1);
 expect(parseRelatedPage(changed($=>$('.series-content').first().append('<span data-bs-title="Статус книги">весь текст</span><span data-bs-title="Статус книги">весь текст</span>')),target,at).books).toEqual([]);
});
it('isolates nested rows, conflicts, foreign links and unsupported layouts',()=>{
 const nested=changed($=>$('.series-content').first().append($('.series-item').last().clone()));
 expect(parseRelatedPage(nested,target,at).books.map(b=>b.id)).toEqual(['27047']);
 const conflict=changed($=>{const row=$('.series-item').first().clone();row.find('.series-content').append('<span data-bs-title="Статус книги">в процессе</span>');$('.card-body').append(row);});
 expect(parseRelatedPage(conflict,target,at).books).toEqual([]);
 const foreign=changed($=>$('a[href="/b/27047"]').attr('href','https://bad.example/b/27047'));
 expect(parseRelatedPage(foreign,target,at).books).toEqual([]);
 for(const html of ['<div>challenge</div>',changed($=>$('.card-body').append('<button id="btn-next-page" data-page="2">more</button>')),changed($=>$('title').text('wrong'))])expect(()=>parseRelatedPage(html,target,at)).toThrow();
 const empty=changed($=>{$('.series-item').remove();$('.card-body').append('<p>Ничего не найдено 😔</p>');});
 expect(parseRelatedPage(empty,target,at).books).toEqual([]);
 expect(()=>parseRelatedPage(changed($=>$('.series-item').remove()),target,at)).toThrow();
});
it('keeps coauthors and unrelated section volume isolated',()=>{
 const html=changed($=>$('.card-body > p.mb-2').first().append('<a href="/a/Coauthor">Coauthor</a>'));
 expect(parseRelatedPage(html,target,at).books[0].authors).toEqual(['Алексей Котов','Coauthor']);
 expect(parsePage(card(''),1,at).books[0].complete).toBe(true);
 expect(()=>parsePage(card('').replace('весь текст',''),1,at).books[0].complete).toThrow();
});
it('isolates refs, deduplicates coauthors and omits ambiguous/foreign links',()=>{
 const refs='<a href="/a/A">A</a><a href="/a/B">B</a><a href="/a/A">Again</a><a href="https://bad.example/a/C">C</a><a href="/a/%FF">bad</a><a href="/a/C?q=x">bad</a><a href="/a/D#x">bad</a><a data-bs-title="Серия" href="/s/S?authors=A">S</a>';
 expect(parseReferences(card(refs+'<div id="book2"><a href="/a/OTHER">other</a></div>'),'1')).toEqual({authorRefs:[{id:'A',name:'A'},{id:'B',name:'B'}],seriesRef:{name:'S',authors:'A'}});
 expect(parseReferences(card(refs+'<a href="/s/S?authors=B">S</a>'),'1').seriesRef).toBeUndefined();
 expect(parseReferences(card('<a href="/s/S?authors=A&authors=B">S</a>'),'1')).toEqual({});
 expect(parseReferences(card(''),'1')).toEqual({});
});
