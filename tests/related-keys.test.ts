import {it,expect} from 'vitest';
import {encodeRelatedKey,decodeRelatedKey} from '../src/domain/related.js';
const raw=(v:unknown)=>Buffer.from(JSON.stringify(v)).toString('base64url');
it('round-trips source targets with distinct series author selectors',()=>{
 const a={kind:'author' as const,slug:'Алексей Котов'};
 expect(decodeRelatedKey(encodeRelatedKey(a),'author')).toEqual(a);
 const s={kind:'series' as const,name:'Асмодей',authors:a.slug};
 expect(decodeRelatedKey(encodeRelatedKey(s),'series')).toEqual(s);
 expect(encodeRelatedKey(s)).not.toBe(encodeRelatedKey({...s,authors:'Другой'}));
});
it('rejects invalid UTF-8, shapes, aliases and bounded strings',()=>{
 for(const key of [raw([2,'author','a']),raw([1,'series','a','b']),raw([1,'author','']),raw([1,'author',' a']),raw([1,'author','a\n']),raw([1,'author','a'.repeat(201)]),raw([1,'author','e\u0301']),raw([1,'author','a','extra']),raw({kind:'author'}),'?','a'.repeat(4097),Buffer.from([255]).toString('base64url'),Buffer.from('[1, "author", "a"]').toString('base64url'),raw([1,'author','a'])+'=']) expect(decodeRelatedKey(key,'author')).toBeNull();
 expect(()=>encodeRelatedKey({kind:'author',slug:'a'.repeat(201)})).toThrow();
 expect(decodeRelatedKey(raw([1,'author','😀'.repeat(200)]),'author')).not.toBeNull();
});
