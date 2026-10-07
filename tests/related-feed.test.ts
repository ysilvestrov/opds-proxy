import {it,expect} from 'vitest';
import {XMLParser,XMLValidator} from 'fast-xml-parser';
import {renderBookEntry,renderRelatedFeed,ACQ,renderFeed} from '../src/opds/feed.js';
import {decodeRelatedKey} from '../src/domain/related.js';
const base='https://opds.example/proxy';
const book={sourceName:'searchfloor',id:'1',title:'T & <book>',authors:['A'],complete:true,sourceUrl:'https://searchfloor.org/b/1',downloadPath:'/book/1',observedAt:'2026-10-07T00:00:00Z',authorRefs:[{id:'A',name:'A & B'},{id:'B',name:'B'}],seriesRef:{name:'S & <series>',authors:'A'},characterCount:10500};
const parse=(xml:string)=>{expect(XMLValidator.validate(xml)).toBe(true);return new XMLParser({ignoreAttributes:false}).parse(xml);};
it('adds related acquisition links to full entries without card grants or hydration',()=>{
 const e=parse(renderBookEntry(book,{sourceName:'searchfloor',id:'1',observedAt:book.observedAt,summary:'Synopsis'},base,false)).entry;
 const links=e.link.filter((l:any)=>l['@_rel']==='related');
 expect(links.map((l:any)=>l['@_title'])).toEqual(['Книги автора: A & B','Книги автора: B','Книги серії: S & <series>']);
 for(const l of links){expect(l['@_type']).toBe(ACQ);expect(l['@_href']).toContain(base+'/opds/searchfloor/');expect(l['@_href']).not.toContain('sig=');}
 expect(decodeRelatedKey(new URL(links[2]['@_href']).pathname.split('/').at(-1)!,'series')).toEqual({kind:'series',name:book.seriesRef.name,authors:'A'});
 expect(e.summary['#text']).toBe('Synopsis\n\nОбсяг: 10.5К знаків');
 expect(renderBookEntry({...book,authorRefs:undefined,seriesRef:undefined},{sourceName:'searchfloor',id:'1',observedAt:book.observedAt},base,false)).not.toContain('rel="related"');
 const list=renderFeed({books:[book],nextPage:null,observedAt:book.observedAt},{baseUrl:base,query:null,sourceName:'searchfloor',page:1,updated:book.observedAt,stale:false});
 expect(list).not.toMatch(/rel="related"|opds-spec.org\/image/);
});
it('renders entity-specific pagination and stable book links with stale semantics',()=>{
 const target={kind:'series' as const,name:'S',authors:'A'};
 const data={books:[book],nextPage:2,observedAt:book.observedAt,stale:true};
 const f=parse(renderRelatedFeed(data,target,base,1)).feed;
 expect(f.title).toBe('Книги серії: S');expect(f.subtitle).toContain('stale');
 const next=f.link.find((l:any)=>l['@_rel']==='next')['@_href'];const self=f.link.find((l:any)=>l['@_rel']==='self')['@_href'];
 expect(new URL(next).pathname).toBe(new URL(self).pathname);expect(new URL(next).searchParams.get('page')).toBe('2');
 expect(f.entry.id).toBe('urn:opds:searchfloor:book:1');
 expect(f.entry.link.find((l:any)=>l['@_rel']==='http://opds-spec.org/acquisition')['@_type']).toBe('application/fb2+zip');
 const other=parse(renderRelatedFeed({...data,books:[],nextPage:null},{...target,authors:'B'},base,2)).feed;
 expect(other.id).not.toBe(f.id);expect(other.entry).toBeUndefined();expect(other.link.some((l:any)=>l['@_rel']==='next')).toBe(false);
});
