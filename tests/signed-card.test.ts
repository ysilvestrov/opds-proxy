import { it, expect, vi } from 'vitest';
import { load } from 'cheerio';
import pino from 'pino';
import { createApp } from '../src/api/app.js';
import { createBookCardSigner } from '../src/api/card-grant.js';
import { loadConfig } from '../src/config.js';
import { Catalog } from '../src/catalog.js';
import { Cache } from '../src/storage/cache.js';
import { SourceError } from '../src/sources/searchfloor/client.js';

const password = 'fixture-card-secret';
const book = { sourceName: 'searchfloor', id: '27223', title: 'Title', authors: ['Author'], complete: true, sourceUrl: 'https://searchfloor.org/b/27223', downloadPath: '/book/27223', observedAt: new Date(0).toISOString() };
const details = { sourceName: 'searchfloor', id: book.id, summary: 'Description', cover: { mime: 'image/jpeg' as const }, observedAt: book.observedAt };
function setup(pass = password, username = 'reader') {
  const rows: unknown[] = [];
  const catalog = { page: vi.fn(async () => ({ books: [book], nextPage: null, observedAt: book.observedAt, stale: false })), book: vi.fn(async () => book), details: vi.fn(async () => ({ book, details, stale: false })), cover: vi.fn(async () => ({ mime: 'image/jpeg' as const, bytes: Buffer.from([255, 216, 255, 224]), observedAt: book.observedAt })) };
  const download = vi.fn(async () => new Response('private download'));
  const config = loadConfig({ PUBLIC_BASE_URL: 'https://opds.example', CACHE_PATH: ':memory:', OPDS_USERNAME: username, OPDS_PASSWORD: pass });
  const app = createApp({ config, catalog, download, log: pino({ base: null }, { write: (line: string) => { rows.push(JSON.parse(line)); } }) });
  const authorization = 'Basic ' + Buffer.from(username + ':' + pass).toString('base64');
  return { app, catalog, download, rows, authorization, config };
}
const path = '/opds/searchfloor/books/27223';
const sig = createBookCardSigner(password).sign('searchfloor', book.id);

it('emits signed self and image links and authorizes them without Basic', async () => {
  const s = setup();
  const res = await s.app.request(path, { headers: { authorization: s.authorization, host: 'evil.example' } });
  expect(res.headers.get('referrer-policy')).toBe('no-referrer');
  expect(res.headers.get('cache-control')).toBe('private, no-store');
  const $ = load(await res.text(), { xmlMode: true });
  expect($('summary').text()).toBe(details.summary);
  for (const rel of ['self', 'http://opds-spec.org/image', 'http://opds-spec.org/image/thumbnail']) {
    const href = $('link[rel="' + rel + '"]').attr('href')!;
    const url = new URL(href);
    expect(url.origin).toBe('https://opds.example');
    expect([...url.searchParams]).toEqual([['sig', sig]]);
    const signed = await s.app.request(href);
    expect(signed.status).toBe(200);
    expect(signed.headers.has('www-authenticate')).toBe(false);
    if (rel !== 'self') {
      expect(signed.headers.get('content-type')).toBe('image/jpeg');
      expect(signed.headers.get('x-content-type-options')).toBe('nosniff');
      expect([...new Uint8Array(await signed.arrayBuffer())]).toEqual([255, 216, 255, 224]);
    }
    expect((await s.app.request(href, { method: 'HEAD' })).status).toBe(200);
  }
  for (const rel of ['start', 'alternate', 'http://opds-spec.org/acquisition']) expect($('link[rel="' + rel + '"]').attr('href')).not.toContain('sig=');
  const listing = load(await (await s.app.request('/opds/searchfloor/completed', { headers: { authorization: s.authorization } })).text(), { xmlMode: true });
  expect(listing('link[type*="type=entry"]').attr('href')).not.toContain('sig=');
  expect(listing('link[rel="http://opds-spec.org/image"]').length).toBe(0);
  expect(JSON.stringify(s.rows)).not.toContain(sig);
  expect(JSON.stringify(s.rows)).not.toContain(password);
});

it('does not authorize other routes or malformed scope before Catalog calls', async () => {
  const s = setup();
  for (const p of ['/opds', '/opds/searchfloor/completed', '/opds/searchfloor/search?q=x', '/opds/searchfloor/opensearch.xml', path + '/download.fb2.zip', '/opds/other/books/27223', path + '/', path + '/cover/extra', '/opds/searchfloor/books/%32%37%32%32%33', '/opds/searchfloor/books/027223', '/opds/searchfloor/books/27505']) {
    expect((await s.app.request(p + (p.includes('?') ? '&' : '?') + 'sig=' + sig)).status).toBe(401);
  }
  for (const query of ['sig=bad', 'sig=' + sig + '&%73ig=' + sig]) expect((await s.app.request(path + '?' + query)).status).toBe(401);
  expect((await s.app.request(path + '?sig=' + sig, { method: 'POST' })).status).toBe(401);
  expect(s.catalog.details).not.toHaveBeenCalled();
  expect(s.catalog.cover).not.toHaveBeenCalled();
  expect(s.catalog.page).not.toHaveBeenCalled();
  expect(s.download).not.toHaveBeenCalled();
});

it('preserves Basic priority and password-based revocation across app instances', async () => {
  const s = setup();
  expect((await s.app.request(path + '?sig=bad', { headers: { authorization: s.authorization } })).status).toBe(200);
  expect((await s.app.request(path + '?sig=' + sig, { headers: { authorization: 'Basic !!!' } })).status).toBe(200);
  expect((await setup(password, 'renamed').app.request(path + '?sig=' + sig)).status).toBe(200);
  expect((await setup('changed').app.request(path + '?sig=' + sig)).status).toBe(401);
  expect((await setup().app.request(path + '?sig=' + sig)).status).toBe(200);
  s.catalog.details.mockRejectedValue(new SourceError('fake-error-' + sig, 503));
  const failure = await s.app.request(path + '?sig=' + sig);
  expect(failure.status).toBe(503);
  expect(await failure.text()).not.toContain(sig);
  expect(JSON.stringify(s.rows)).not.toContain(sig);
});

it('uses the same Catalog on cold, warm, expired and recreated caches', async () => {
  let now = 0;
  const client = {
    list: vi.fn(async () => ({ books: [], nextPage: null, observedAt: new Date(now).toISOString() })),
    getBook: vi.fn(async () => ({ ...book, observedAt: new Date(now).toISOString() })),
    getCard: vi.fn(async () => ({ book: { ...book, observedAt: new Date(now).toISOString() }, annotation: { api: true } })),
    getAnnotation: vi.fn(async () => 'Description'),
    getCover: vi.fn(async () => ({ mime: 'image/jpeg' as const, bytes: Buffer.from([255, 216, 255, 224]), observedAt: new Date(now).toISOString() })),
  };
  const s = setup();
  for (let restart = 0; restart < 2; restart++) {
    const cache = new Cache(':memory:');
    try {
      const catalog = new Catalog({ cache, client, now: () => now });
      const app = createApp({ config: s.config, catalog, log: pino({ enabled: false }) });
      const before = client.getCard.mock.calls.length;
      expect((await app.request(path + '?sig=' + sig)).status).toBe(200);
      expect(client.getCard.mock.calls.length).toBe(before + 1);
      expect((await app.request(path + '/cover?sig=' + sig)).status).toBe(200);
      expect(client.getCard.mock.calls.length).toBe(before + 1);
      now += 25 * 3600000;
      expect((await app.request(path + '?sig=' + sig)).status).toBe(200);
      expect(client.getCard.mock.calls.length).toBe(before + 2);
      expect((await app.request(path + '/download.fb2.zip?sig=' + sig)).status).toBe(401);
    } finally { cache.close(); }
  }
  expect(client.list).not.toHaveBeenCalled();
});

it('preserves missing book and artwork errors for signed requests', async () => {
  const s = setup();
  let status = 0;
  const app = createApp({ config: s.config, log: pino({ enabled: false }), catalog: {
    page: s.catalog.page, book: s.catalog.book, details: async () => null,
    cover: async () => { if (status) throw new SourceError('private-error', status); return null; },
  } });
  expect((await app.request(path + '?sig=' + sig)).status).toBe(404);
  for (const code of [404, 502, 503]) {
    status = code === 404 ? 0 : code;
    const res = await app.request(path + '/cover?sig=' + sig);
    expect(res.status).toBe(code);
    expect(await res.text()).not.toContain('private-error');
  }
});
