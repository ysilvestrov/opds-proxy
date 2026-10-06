import { it, expect } from 'vitest';
import { load } from 'cheerio';
import pino from 'pino';
import { renderBookEntry, renderFeed } from '../src/opds/feed.js';
import { createApp } from '../src/api/app.js';
import { loadConfig } from '../src/config.js';
import { SourceError } from '../src/sources/searchfloor/client.js';
const book = { sourceName: 'searchfloor', id: '1', title: 'A & <B>', authors: ['Автор'], sourceUrl: 'https://searchfloor.org/b/1', downloadPath: '/book/1', complete: true, observedAt: '2026-10-06T00:00:00Z' };
const details = { sourceName: 'searchfloor', id: '1', summary: 'Анонс <script>literal</script> &\n\nАбзац', cover: { mime: 'image/jpeg' as const }, observedAt: book.observedAt };
it('renders a standalone entry and Atom alternate without listing images', () => {
    const $ = load(renderBookEntry(book, details, 'https://opds.example', false), { xmlMode: true });
    expect($('entry').length).toBe(1);
    expect($('entry').attr('xmlns')).toBe('http://www.w3.org/2005/Atom');
    expect($('id').text()).toBe('urn:opds:searchfloor:book:1');
    expect($('summary').text()).toBe(details.summary);
    expect($('summary').attr('type')).toBe('text');
    expect($('content').text()).toBe(details.summary);
    expect($('script').length).toBe(0);
    expect($('link[rel="http://opds-spec.org/image"]').attr('href')).toBe('https://opds.example/opds/searchfloor/books/1/cover');
    expect($('link[rel="http://opds-spec.org/image/thumbnail"]').attr('type')).toBe('image/jpeg');
    const xml = renderFeed({ books: [book], nextPage: null, observedAt: book.observedAt }, { baseUrl: 'https://opds.example', query: null, sourceName: 'searchfloor', page: 1, updated: book.observedAt, stale: false });
    const f = load(xml, { xmlMode: true });
    expect(f('entry link[rel="alternate"][type="application/atom+xml;type=entry;profile=opds-catalog"]').attr('href')).toBe('https://opds.example/opds/searchfloor/books/1');
    expect(f('entry link[type="text/html"]').attr('href')).toBe(book.sourceUrl);
    expect(f('entry link[type="application/fb2+zip"]').length).toBe(1);
    expect(f('entry link[rel="http://opds-spec.org/image"]').length).toBe(0);
    const empty = load(renderBookEntry(book, { sourceName: 'searchfloor', id: '1', observedAt: book.observedAt }, 'https://opds.example', false), { xmlMode: true });
    expect(empty('summary').length).toBe(0);
    expect(empty('link[rel="http://opds-spec.org/image"]').length).toBe(0);
    expect(renderBookEntry(book, details, 'https://opds.example', true)).toContain('stale');
});
const config = loadConfig({ PUBLIC_BASE_URL: 'https://opds.example', CACHE_PATH: ':memory:', OPDS_USERNAME: 'reader', OPDS_PASSWORD: 'fixture' });
const authorization = 'Basic ' + Buffer.from('reader:fixture').toString('base64');
it('protects entry and artwork, validates inputs before lookup and preserves bytes', async () => {
    let calls = 0;
    const app = createApp({ config, log: pino({ enabled: false }), catalog: { page: async () => ({ books: [], nextPage: null, observedAt: book.observedAt, stale: false }), book: async () => book,
            details: async () => { calls++; return { book, details, stale: false }; }, cover: async () => { calls++; return { mime: 'image/jpeg', bytes: new Uint8Array([255, 216, 255, 224]), observedAt: book.observedAt }; } } });
    for (const p of ['/opds/searchfloor/books/1', '/opds/searchfloor/books/1/cover']) {
        const r = await app.request(p);
        expect(r.status).toBe(401);
        expect(r.headers.get('www-authenticate')).toContain('Basic');
    }
    expect(calls).toBe(0);
    expect((await app.request('/opds/unknown/books/1', { headers: { authorization } })).status).toBe(404);
    expect((await app.request('/opds/searchfloor/books/bad', { headers: { authorization } })).status).toBe(400);
    expect(calls).toBe(0);
    const entry = await app.request('/opds/searchfloor/books/1', { headers: { authorization, host: 'hostile.example' } });
    expect(entry.status).toBe(200);
    expect(entry.headers.get('content-type')).toContain('type=entry');
    expect(entry.headers.get('cache-control')).toBe('private, no-store');
    expect(await entry.text()).not.toContain('hostile.example');
    const cover = await app.request('/opds/searchfloor/books/1/cover', { headers: { authorization } });
    expect(cover.status).toBe(200);
    expect(cover.headers.get('content-type')).toBe('image/jpeg');
    expect(cover.headers.get('x-content-type-options')).toBe('nosniff');
    expect(cover.headers.get('cache-control')).toBe('private, max-age=0, must-revalidate');
    expect([...new Uint8Array(await cover.arrayBuffer())]).toEqual([255, 216, 255, 224]);
});
it('returns absence and controlled optional resource failures', async () => {
    let status = 0;
    const app = createApp({ config, log: pino({ enabled: false }), catalog: { page: async () => ({ books: [], nextPage: null, observedAt: book.observedAt, stale: false }), book: async () => null, details: async () => null, cover: async () => { if (status)
                throw new SourceError('secret', status); return null; } } });
    expect((await app.request('/opds/searchfloor/books/1', { headers: { authorization } })).status).toBe(404);
    for (const expected of [404, 503, 502]) {
        status = expected === 404 ? 0 : expected;
        const r = await app.request('/opds/searchfloor/books/1/cover', { headers: { authorization } });
        expect(r.status).toBe(expected);
        expect(await r.text()).not.toContain('secret');
    }
});
