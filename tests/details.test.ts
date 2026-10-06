import { it, expect } from 'vitest';
import { Cache } from '../src/storage/cache.js';
import { Catalog } from '../src/catalog.js';
import type { Book } from '../src/domain/book.js';
const base: Book = { sourceName: 'searchfloor', id: '1', title: 'Book', authors: ['Author'], sourceUrl: 'https://searchfloor.org/b/1', downloadPath: '/book/1', complete: true, observedAt: new Date(0).toISOString() };
it('retains inline synopsis when cover loads the source card first', async () => {
    const s = setup();
    s.client.getCard = async () => ({ book: base, annotation: { api: false, inline: 'Inline synopsis' } });
    await s.c.cover('1');
    expect((await s.c.details('1'))?.details.summary).toBe('Inline synopsis');
    expect(s.counts()).toEqual([0, 1]);
    s.cache.close();
});
function setup() {
    let now = 0, annotations = 0, covers = 0, fail = false, absent = false, incomplete = false;
    const cache = new Cache(':memory:');
    const client = { list: async () => ({ books: incomplete ? [] : [{ ...base, observedAt: new Date(now).toISOString() }], rejectedIds: incomplete ? ['1'] : [], nextPage: null, observedAt: new Date(now).toISOString() }),
        getBook: async () => {
            if (fail)
                throw Error('offline');
            return incomplete ? null : { ...base, observedAt: new Date(now).toISOString() };
        },
        getCard: async () => {
            if (fail)
                throw Error('offline');
            return incomplete ? null : { book: { ...base, observedAt: new Date(now).toISOString() }, annotation: { api: true } };
        },
        getAnnotation: async (): Promise<string | null> => {
            annotations++;
            if (fail)
                throw Error('offline');
            return absent ? null : 'Synopsis';
        },
        getCover: async () => {
            covers++;
            if (fail)
                throw Error('offline');
            return absent ? null : { mime: 'image/jpeg' as const, bytes: new Uint8Array([255, 216, 255, 224]), observedAt: new Date(now).toISOString() };
        } };
    const c = new Catalog({ cache, client, now: () => now });
    return { c, cache, client, setTime: (n: number) => now = n, setFail: (v: boolean) => fail = v, setAbsent: (v: boolean) => absent = v, setIncomplete: () => incomplete = true, counts: () => [annotations, covers] };
}
it('lists without upstream details and preserves enrichment after list refresh', async () => {
    const s = setup();
    await s.c.page(null, 1);
    expect(s.counts()).toEqual([0, 0]);
    expect((await s.c.details('1'))?.details.summary).toBe('Synopsis');
    expect(s.counts()).toEqual([1, 1]);
    s.setTime(16 * 60000);
    await s.c.page(null, 1);
    expect((await s.c.details('1'))?.details.summary).toBe('Synopsis');
    expect(s.counts()).toEqual([1, 1]);
    s.cache.close();
});
it('optional refresh does not extend download completion freshness', async () => {
    const s = setup();
    await s.c.page(null, 1);
    s.setTime(16 * 60000);
    await s.c.details('1');
    s.setFail(true);
    await expect(s.c.book('1')).rejects.toThrow('offline');
    s.cache.close();
});
it('absence expires at 15min but errors are retried rather than cached', async () => {
    const s = setup();
    s.setAbsent(true);
    await s.c.details('1');
    await s.c.details('1');
    expect(s.counts()).toEqual([1, 1]);
    s.setTime(15 * 60000);
    s.setAbsent(false);
    expect((await s.c.details('1'))?.details.summary).toBe('Synopsis');
    expect(s.counts()).toEqual([2, 2]);
    s.cache.close();
    const e = setup();
    await e.c.page(null, 1);
    e.setFail(true);
    expect((await e.c.details('1'))?.details.summary).toBeUndefined();
    expect((await e.c.details('1'))?.details.summary).toBeUndefined();
    expect(e.counts()).toEqual([2, 2]);
    e.cache.close();
});
it('does not serve expired details during outage or fetch optional resources for incomplete IDs', async () => {
    const s = setup();
    await s.c.details('1');
    s.setTime(24 * 3600000 + 1);
    s.setFail(true);
    await expect(s.c.details('1')).rejects.toThrow();
    s.cache.close();
    const n = setup();
    n.setIncomplete();
    expect(await n.c.details('1')).toBeNull();
    expect(await n.c.cover('1')).toBeNull();
    expect(n.counts()).toEqual([0, 0]);
    n.cache.close();
});
it('invalidates enriched book on observed incomplete status', async () => {
    const s = setup();
    await s.c.details('1');
    s.setIncomplete();
    await s.c.page('new-query', 1);
    expect(await s.c.details('1')).toBeNull();
    expect(await s.c.cover('1')).toBeNull();
    s.cache.close();
});
it('coalesces details and lets another caller survive cancellation', async () => {
    const s = setup();
    let release!: (v: string) => void;
    s.client.getAnnotation = () => new Promise(r => release = r);
    await s.c.page(null, 1);
    const controller = new AbortController();
    const a = s.c.details('1', controller.signal);
    const b = s.c.details('1');
    await new Promise(r => setTimeout(r, 0));
    controller.abort();
    await expect(a).rejects.toThrow();
    release('Shared');
    expect((await b)?.details.summary).toBe('Shared');
    expect(s.counts()[1]).toBe(1);
    s.cache.close();
});
it('refills evicted cover without requesting annotation again', async () => {
    const s = setup();
    await s.c.details('1');
    s.cache.delete('details:v1:searchfloor:1:cover');
    expect((await s.c.cover('1'))?.mime).toBe('image/jpeg');
    expect(s.counts()).toEqual([1, 2]);
    s.cache.close();
});
it('does not resurrect optional data when completion changes during enrichment', async () => {
    const s = setup();
    let release!: (v: string) => void;
    s.client.getAnnotation = () => new Promise(r => release = r);
    await s.c.page(null, 1);
    const pending = s.c.details('1');
    await new Promise(r => setTimeout(r, 0));
    s.setIncomplete();
    await s.c.page('changed', 1);
    release('Late');
    expect(await pending).toBeNull();
    expect(s.cache.get('details:v1:searchfloor:1:annotation', 0)).toBeNull();
    s.cache.close();
});
