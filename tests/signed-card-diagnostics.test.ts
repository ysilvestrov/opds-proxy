import { it, expect, vi } from 'vitest';
// @ts-expect-error Operator ESM script is outside application compilation.
import { diagnoseSignedCard } from '../scripts/diagnostics/signed-card.mjs';
const sig = 'A'.repeat(43);
const base = 'https://opds.example';
const path = '/opds/searchfloor/books/27223';
const links = { self: base + path + '?sig=' + sig, cover: base + path + '/cover?sig=' + sig, summary: true };
const options = { username: 'fixture-user', password: 'fixture-secret', publicBaseUrl: base, ids: ['27223'] };

it('follows emitted signed resources without Basic and emits no secrets or bodies', async () => {
  const rows: unknown[] = [], calls: { input: string; init: RequestInit }[] = [];
  await diagnoseSignedCard({ ...options, parseEntry: () => links, emit: (r: unknown) => rows.push(r), fetch: async (input: string, init: RequestInit) => {
    calls.push({ input, init });
    return new Response('fixture-body-secret', { headers: { 'content-type': input.includes('/cover') ? 'image/jpeg' : 'application/atom+xml' } });
  } });
  expect(calls).toHaveLength(3);
  expect(calls[0]!.init.headers).toHaveProperty('authorization');
  expect(calls[1]!.init.headers).toEqual({});
  expect(calls[2]!.init.headers).toEqual({});
  expect(rows).toContainEqual(expect.objectContaining({ stage: 'cover_signed', id: '27223', status: 200, mime: 'image/jpeg' }));
  for (const value of [sig, 'fixture-secret', 'fixture-body-secret', base]) expect(JSON.stringify(rows)).not.toContain(value);
});

it('rejects untrusted link targets, redirects and missing covers without following them', async () => {
  const badLinks = [
    ...['https://evil.example' + path + '?sig=' + sig, base + '/opds/searchfloor/books/27505?sig=' + sig, base + path + '?sig=' + sig + '&sig=' + sig, base + path + '?sig=' + sig + '#fragment'].map(self => ({ ...links, self })),
    ...['https://evil.example' + path + '/cover?sig=' + sig, base + path + '/download.fb2.zip?sig=' + sig, 'https://user:secret@opds.example' + path + '/cover?sig=' + sig, base + '/opds/other/books/27223/cover?sig=' + sig, base + '/opds/searchfloor/books/%32%37%32%32%33/cover?sig=' + sig].map(cover => ({ ...links, cover })),
  ];
  for (const wrong of badLinks) {
    let calls = 0, parsed = false; const rows: unknown[] = [];
    await diagnoseSignedCard({ ...options, parseEntry: () => { parsed = true; return wrong; }, emit: (r: unknown) => rows.push(r), fetch: async () => { calls++; return new Response('private', { headers: { 'content-type': 'application/atom+xml' } }); } });
    expect(calls).toBe(1);
    expect(parsed).toBe(true);
    expect(JSON.stringify(rows)).not.toContain(sig);
    expect(rows).toContainEqual(expect.objectContaining({ stage: 'entry_basic', ok: false }));
  }
  let calls = 0;
  await diagnoseSignedCard({ ...options, parseEntry: () => links, emit: () => {}, fetch: async () => { calls++; return new Response('', { status: 302, headers: { location: 'https://evil.example' } }); } });
  expect(calls).toBe(1);
  const rows: unknown[] = []; calls = 0;
  await diagnoseSignedCard({ ...options, parseEntry: () => ({ ...links, cover: null }), emit: (r: unknown) => rows.push(r), fetch: async () => { calls++; return new Response('private', { headers: { 'content-type': 'application/atom+xml' } }); } });
  expect(calls).toBe(2);
  expect(rows).toContainEqual({ id: '27223', stage: 'cover_signed', ok: false, code: 'cover_not_advertised' });
});

it('bounds output and cancels stalled or oversized response bodies', async () => {
  for (const large of [false, true]) {
    let canceled = false; const rows: unknown[] = [];
    await diagnoseSignedCard({ ...options, parseEntry: () => links, signal: AbortSignal.timeout(30), emit: (r: unknown) => rows.push(r), fetch: async () => new Response(new ReadableStream({ start(c) { c.enqueue(new Uint8Array(large ? 2 * 1024 * 1024 + 1 : 1)); }, cancel() { canceled = true; } })) });
    expect(canceled).toBe(true);
    expect(rows).toContainEqual(expect.objectContaining({ stage: 'entry_basic', ok: false }));
  }
});

it('validates fixed IDs before networking and hides exception text', async () => {
  let called = false; const rows: unknown[] = [];
  await expect(diagnoseSignedCard({ ...options, ids: ['other'], parseEntry: () => links, emit: () => {}, fetch: async () => { called = true; } })).rejects.toThrow();
  expect(called).toBe(false);
  await diagnoseSignedCard({ ...options, parseEntry: () => links, emit: (r: unknown) => rows.push(r), fetch: async () => { throw Error('fixture-secret ' + sig); } });
  expect(JSON.stringify(rows)).not.toContain('fixture-secret');
  expect(JSON.stringify(rows)).not.toContain(sig);
});

it('keeps the global deadline even with a nonexpiring caller signal', async () => {
  const original = AbortSignal.timeout.bind(AbortSignal);
  const timer = vi.spyOn(AbortSignal, 'timeout').mockImplementation(ms => original(ms === 240000 ? 20 : ms));
  const caller = new AbortController(); let canceled = false;
  const work = diagnoseSignedCard({ ...options, signal: caller.signal, parseEntry: () => links, emit: () => {}, fetch: async () => new Response(new ReadableStream({ start(c) { c.enqueue(new Uint8Array([1])); }, cancel() { canceled = true; } })) });
  try {
    const completed = await Promise.race([work.then(() => true), new Promise<boolean>(resolve => setTimeout(() => resolve(false), 100))]);
    expect(completed).toBe(true);
    expect(timer).toHaveBeenCalledWith(240000);
    expect(canceled).toBe(true);
  } finally { caller.abort(); await work; timer.mockRestore(); }
});
