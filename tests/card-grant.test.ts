import { it, expect } from 'vitest';
import { createHmac } from 'node:crypto';
import { createBookCardSigner, isSignedBookCardRequest } from '../src/api/card-grant.js';

const password = 'fixture-password';
it('signs a scoped deterministic grant until password changes', () => {
  const s = createBookCardSigner(password);
  const key = createHmac('sha256', password).update('opds-book-card-key-v1').digest();
  const expected = createHmac('sha256', key).update(JSON.stringify([1, 'book-card', 'searchfloor', '27223'])).digest('base64url');
  const sig = s.sign('searchfloor', '27223');
  expect(sig).toBe(expected);
  expect(sig).toHaveLength(43);
  expect(createBookCardSigner(password).verify('searchfloor', '27223', sig)).toBe(true);
  expect(createBookCardSigner('changed').verify('searchfloor', '27223', sig)).toBe(false);
  expect(s.verify('searchfloor', '27505', sig)).toBe(false);
  expect(s.verify('other', '27223', sig)).toBe(false);
});

it('rejects invalid identity and noncanonical signature bytes', () => {
  const s = createBookCardSigner(password), sig = s.sign('searchfloor', '1');
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  const alias = sig.slice(0, -1) + alphabet[alphabet.indexOf(sig.at(-1)!) | 1];
  expect(Buffer.from(alias, 'base64url')).toEqual(Buffer.from(sig, 'base64url'));
  for (const bad of ['', sig + '=', sig.slice(1), 'x'.repeat(1000), '!'.repeat(43), alias]) expect(s.verify('searchfloor', '1', bad)).toBe(false);
  for (const id of ['0', '01', '-1', '1'.repeat(21), 'bad']) {
    expect(s.verify('searchfloor', id, sig)).toBe(false);
    expect(() => s.sign('searchfloor', id)).toThrow();
  }
  expect(() => s.sign('other', '1')).toThrow();
});

it('authorizes only exact entry/cover GET/HEAD with one sig query', () => {
  const s = createBookCardSigner(password), sig = s.sign('searchfloor', '27223');
  const base = '/opds/searchfloor/books/27223';
  const check = (path: string, method = 'GET') => isSignedBookCardRequest(new Request('https://opds.example' + path, { method }), s);
  for (const method of ['GET', 'HEAD']) for (const p of [base, base + '/cover']) expect(check(p + '?sig=' + sig, method)).toBe(true);
  for (const p of ['/opds', '/opds/searchfloor/search', '/opds/searchfloor/completed', '/opds/searchfloor/opensearch.xml', '/opds/searchfloor/authors', '/opds/searchfloor/genres', base + '/download.fb2.zip', base + '/', base + '/cover/extra', '/opds/other/books/27223', '/opds/searchfloor/books/27505', '/opds/searchfloor/books/%32%37%32%32%33', '/opds/searchfloor/books/027223']) expect(check(p + '?sig=' + sig)).toBe(false);
  expect(check(base + '?sig=' + sig, 'POST')).toBe(false);
  expect(check(base)).toBe(false);
  expect(check(base + '?sig=' + sig + '&sig=' + sig)).toBe(false);
  expect(check(base + '?sig=' + sig + '&%73ig=' + sig)).toBe(false);
});
