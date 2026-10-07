import {readFileSync} from 'node:fs';
import {it,expect} from 'vitest';
import {parseReferences} from '../src/sources/searchfloor/references.js';
import {parsePage} from '../src/sources/searchfloor/parse.js';
const at='2026-10-07T00:00:00Z';
const card=(refs:string)=>`<div id="book1"><p class="fw-medium">Title</p><span data-bs-title="Статус книги">весь текст</span><button class="download-btn" data-url="/book/1"></button>${refs}</div>`;
it('extracts source references from the known ordinary card without fetching',()=>{
 const html=readFileSync(new URL('fixtures/searchfloor/book.html',import.meta.url),'utf8');
 const refs={authorRefs:[{id:'Алексей Котов',name:'Алексей Котов'}],seriesRef:{name:'Асмодей',authors:'Алексей Котов'}};
 expect(parseReferences(html,'27047')).toEqual(refs);
 expect(parsePage(html,1,at).books[0]).toMatchObject(refs);
});
it('isolates refs, deduplicates coauthors and omits ambiguous/foreign links',()=>{
 const refs='<a href="/a/A">A</a><a href="/a/B">B</a><a href="/a/A">Again</a><a href="https://bad.example/a/C">C</a><a href="/a/%FF">bad</a><a href="/a/C?q=x">bad</a><a href="/a/D#x">bad</a><a data-bs-title="Серия" href="/s/S?authors=A">S</a>';
 expect(parseReferences(card(refs+'<div id="book2"><a href="/a/OTHER">other</a></div>'),'1')).toEqual({authorRefs:[{id:'A',name:'A'},{id:'B',name:'B'}],seriesRef:{name:'S',authors:'A'}});
 expect(parseReferences(card(refs+'<a href="/s/S?authors=B">S</a>'),'1').seriesRef).toBeUndefined();
 expect(parseReferences(card('<a href="/s/S?authors=A&authors=B">S</a>'),'1')).toEqual({});
 expect(parseReferences(card(''),'1')).toEqual({});
});
