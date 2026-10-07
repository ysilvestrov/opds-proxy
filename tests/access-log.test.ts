import { expect, it } from 'vitest';
import pino from 'pino';
import { createApp } from '../src/api/app.js';
import { loadConfig } from '../src/config.js';
import { SourceError } from '../src/sources/searchfloor/client.js';

function setup(failure?: Error) {
  const rows: Record<string, unknown>[] = [];
  const log = pino({ base: null }, { write: (line: string) => { rows.push(JSON.parse(line)); } });
  const app = createApp({
    config: loadConfig({ PUBLIC_BASE_URL: 'https://opds.example', CACHE_PATH: ':memory:', OPDS_USERNAME: 'reader', OPDS_PASSWORD: 'fake-password-secret' }),
    log,
    catalog: {
      page: async () => { if (failure) throw failure; return { books: [], nextPage: null, observedAt: '2026-10-06T00:00:00Z', stale: false }; },
      book: async () => null,
      details: async () => null,
      cover: async () => ({ mime: 'image/jpeg', bytes: Buffer.from('fake-image-secret'), observedAt: '2026-10-06T00:00:00Z' }),
    },
  });
  const auth = 'Basic ' + Buffer.from('reader:fake-password-secret').toString('base64');
  const access = () => rows.filter(r => r.event === 'access');
  return { app, rows, access, auth };
}

it('logs the static catalogue icon without query, credentials or image data',async()=>{
 const {app,access}=setup();const r=await app.request('/opds/searchfloor/icon.png?token=private-query',{headers:{authorization:'Basic private-header'}});
 expect(r.status).toBe(200);expect(access()).toHaveLength(1);expect(access()[0]).toMatchObject({route:'catalog_icon',method:'GET',status:200});
 expect(JSON.stringify(access())).not.toMatch(/private-query|private-header|icon\.png|token|bookId/);
});
it('logs each challenge/retry and entry response once without credentials or image data', async () => {
  const { app, rows, access, auth } = setup();
  const path = '/opds/searchfloor/books/27223/cover';
  expect((await app.request(path)).status).toBe(401);
  expect((await app.request(path, { headers: { authorization: auth, cookie: 'fake-cookie-secret' } })).status).toBe(200);
  expect((await app.request('/opds/searchfloor/books/27505', { headers: { authorization: auth } })).status).toBe(404);
  expect(access()).toHaveLength(3);
  expect(access().map(r => [r.route, r.bookId, r.status, r.outcome])).toEqual([
    ['cover', '27223', 401, 'response_created'], ['cover', '27223', 200, 'response_created'], ['entry', '27505', 404, 'response_created'],
  ]);
  for (const row of access()) {
    expect(Object.keys(row).sort()).toEqual(['bookId', 'durationMs', 'event', 'level', 'method', 'msg', 'outcome', 'route', 'status', 'time'].sort());
    expect(row.durationMs).toEqual(expect.any(Number));
    expect(row.durationMs as number).toBeGreaterThanOrEqual(0);
  }
  for (const secret of [auth, 'fake-password-secret', 'fake-cookie-secret', 'fake-image-secret']) expect(JSON.stringify(rows)).not.toContain(secret);
});

it('logs safe route labels for search, invalid paths/methods, errors and ignores health', async () => {
  const { app, rows, access, auth } = setup(new SourceError('unavailable', 503));
  await app.request('/health');
  await app.request('/outside/fake-path-secret');
  expect(access()).toHaveLength(0);
  expect((await app.request('/opds/searchfloor/search?q=fake-query-secret', { headers: { authorization: auth } })).status).toBe(503);
  await app.request('/opds/searchfloor/books/fake-path-secret/cover', { headers: { authorization: auth, 'user-agent': 'fake-agent-secret' } });
  await app.request('/opds/fake-source-secret/search', { method: 'FAKESECRET' });
  expect(access().map(r => [r.route, r.method, r.status])).toEqual([['search', 'GET', 503], ['unknown', 'GET', 400], ['unknown', 'OTHER', 401]]);
  for (const secret of ['fake-query-secret', 'fake-path-secret', 'fake-source-secret', 'FAKESECRET', 'fake-agent-secret']) expect(JSON.stringify(rows)).not.toContain(secret);
});

it('logs generic failures, HEAD and bounded IDs without raw exception text', async () => {
  const { app, rows, access, auth } = setup(new Error('fake-error-secret'));
  await app.request('/opds/searchfloor/completed', { headers: { authorization: auth } });
  await app.request('/opds/searchfloor/books/1/cover', { method: 'HEAD', headers: { authorization: auth } });
  await app.request('/opds/searchfloor/books/' + '9'.repeat(100) + '/cover');
  expect(access().map(r => [r.route, r.method, r.status])).toEqual([['completed', 'GET', 500], ['cover', 'HEAD', 200], ['unknown', 'GET', 401]]);
  expect(JSON.stringify(rows)).not.toContain('fake-error-secret');
  expect(JSON.stringify(rows)).not.toContain('9'.repeat(100));
});

it('keeps concurrent request statuses separate and marks an aborted handler response', async () => {
  const { app, access, auth } = setup();
  const signal = new AbortController();
  signal.abort();
  await Promise.all([
    app.request('/opds/searchfloor/books/1/cover', { signal: signal.signal, headers: { authorization: auth } }),
    app.request('/opds/searchfloor/books/2/cover'),
  ]);
  expect(access()).toHaveLength(2);
  expect(access().find(r => r.bookId === '1')).toMatchObject({ status: 200, outcome: 'aborted' });
  expect(access().find(r => r.bookId === '2')).toMatchObject({ status: 401, outcome: 'response_created' });
});
