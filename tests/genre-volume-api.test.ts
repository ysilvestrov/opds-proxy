import { readFileSync } from 'node:fs';
import { load } from 'cheerio';
import { expect, it, vi } from 'vitest';
import pino from 'pino';
import { Cache } from '../src/storage/cache.js';
import { Catalog } from '../src/catalog.js';
import { parsePage } from '../src/sources/searchfloor/parse.js';
import { createApp } from '../src/api/app.js';
import { loadConfig } from '../src/config.js';

const html = readFileSync(new URL('fixtures/searchfloor/book.html', import.meta.url), 'utf8');
const day = 24 * 3600000;
const password = 'fixture-volume-password';
const config = loadConfig({ PUBLIC_BASE_URL: 'https://opds.example', CACHE_PATH: ':memory:', OPDS_USERNAME: 'reader', OPDS_PASSWORD: password });
const authorization = 'Basic ' + Buffer.from('reader:' + password).toString('base64');
const path = '/opds/searchfloor/books/27047';
const bookAt = (now: number, rich = true) => {
  const book = parsePage(html, 1, new Date(now).toISOString()).books[0];
  if (!rich) { delete book.genres; delete book.characterCount; delete book.authorSheets; }
  return book;
};
function setup(rich = true) {
  let now = 0;
  const cache = new Cache(':memory:');
  const client = {
    list: vi.fn(async () => ({ books: [bookAt(now, rich)], nextPage: null, observedAt: new Date(now).toISOString() })),
    getBook: vi.fn(async () => bookAt(now, rich)),
    getCard: vi.fn(async () => ({ book: bookAt(now, rich), annotation: { api: true } })),
    getAnnotation: vi.fn(async () => 'Original synopsis\n\nParagraph'),
    getCover: vi.fn(async () => ({ mime: 'image/jpeg' as const, bytes: Buffer.from([255, 216, 255, 224]), observedAt: new Date(now).toISOString() })),
  };
  const catalog = new Catalog({ cache, client, now: () => now });
  const app = createApp({ catalog, config, log: pino({ enabled: false }) });
  return { cache, catalog, client, app, advance: (ms: number) => { now += ms; }, counts: () => Object.values(client).map(fn => fn.mock.calls.length) };
}

it('serves a legacy cache without enrichment calls and gains fields on ordinary expiry', async () => {
  const s = setup();
  try {
    const at = new Date(0).toISOString();
    s.cache.set('book:searchfloor:27047', bookAt(0, false), day);
    s.cache.set('details:v1:searchfloor:27047:annotation', { state: 'present', value: 'Cached synopsis', observedAt: at }, day);
    s.cache.set('details:v1:searchfloor:27047:cover', { state: 'present', value: { mime: 'image/jpeg', base64: '/9j/4A==', observedAt: at }, observedAt: at }, day, 'artwork');
    const first = await s.app.request(path, { headers: { authorization } });
    expect(first.status).toBe(200);
    const legacy = load(await first.text(), { xmlMode: true });
    expect(legacy('summary').text()).toBe('Cached synopsis');
    expect(legacy('category[scheme="urn:opds:searchfloor:genre"]').length).toBe(0);
    const signed = legacy('link[rel="self"]').attr('href')!;
    expect((await s.app.request(signed)).status).toBe(200);
    expect(s.counts()).toEqual([0, 0, 0, 0, 0]);
    s.advance(25 * 3600000);
    const refreshed = await s.app.request(signed);
    expect(refreshed.status).toBe(200);
    const xml = load(await refreshed.text(), { xmlMode: true });
    expect(xml('summary').text()).toBe('Обсяг: 511.2К знаків · 12,78 авторських аркушів\n\nOriginal synopsis\n\nParagraph');
    expect(xml('category[scheme="urn:opds:searchfloor:genre"]').length).toBe(3);
    expect(s.cache.get<ReturnType<typeof bookAt>>('book:searchfloor:27047', 25 * 3600000)?.value.characterCount).toBe(511195);
    expect((await s.app.request(signed)).status).toBe(200);
    expect(s.counts()).toEqual([0, 0, 1, 1, 1]);
  } finally { s.cache.close(); }
});

it('rich metadata preserves request counts and the separate completion freshness check', async () => {
  const counts: number[][] = [];
  for (const rich of [false, true]) {
    const s = setup(rich);
    try {
      const list = await s.app.request('/opds/searchfloor/completed', { headers: { authorization } });
      expect(list.status).toBe(200);
      const listing = await list.text();
      expect(listing).not.toMatch(/Обсяг:|opds-spec.org\/image/);
      expect(s.counts()).toEqual([1, 0, 0, 0, 0]);
      const entry = await s.app.request(path, { headers: { authorization } });
      expect(entry.status).toBe(200);
      const $ = load(await entry.text(), { xmlMode: true });
      expect($('category[scheme="urn:opds:searchfloor:genre"]').length).toBe(rich ? 3 : 0);
      expect($('summary').text()).toBe((rich ? 'Обсяг: 511.2К знаків · 12,78 авторських аркушів\n\n' : '') + 'Original synopsis\n\nParagraph');
      const signed = $('link[rel="self"]').attr('href')!;
      const again = await s.app.request(signed);
      expect(again.status).toBe(200);
      expect(load(await again.text(), { xmlMode: true })('summary').text()).toBe($('summary').text());
      expect((await s.app.request($('link[rel="http://opds-spec.org/image"]').attr('href')!)).status).toBe(200);
      expect((await s.app.request('/opds/searchfloor/completed')).status).toBe(401);
      const download = new URL(signed); download.pathname += '/download.fb2.zip';
      expect((await s.app.request(download.href)).status).toBe(401);
      s.advance(16 * 60000);
      expect((await s.app.request(signed)).status).toBe(200);
      expect(s.client.getBook).not.toHaveBeenCalled();
      expect((await s.catalog.book('27047'))?.observedAt).toBe(new Date(16 * 60000).toISOString());
      expect(s.client.getBook).toHaveBeenCalledTimes(1);
      expect(s.cache.get<{ observedAt: string }>('details:v1:searchfloor:27047:annotation', 16 * 60000)?.value.observedAt).toBe(new Date(0).toISOString());
      counts.push(s.counts());
    } finally { s.cache.close(); }
  }
  expect(counts).toEqual([[1, 1, 0, 1, 1], [1, 1, 0, 1, 1]]);
});
