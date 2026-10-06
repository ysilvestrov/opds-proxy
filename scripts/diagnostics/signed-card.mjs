// Bounded operator check. URLs, credentials and payloads never enter receipts.
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

async function readBody(response, signal) {
  const reader = response.body?.getReader();
  if (!reader) return new Uint8Array();
  let size = 0; const parts = [];
  const cancel = () => { void reader.cancel().catch(() => {}); };
  signal.addEventListener('abort', cancel, { once: true });
  try {
    while (true) {
      signal.throwIfAborted(); const item = await reader.read(); signal.throwIfAborted();
      if (item.done) break;
      size += item.value.length; if (size > 2 * 1024 * 1024) throw Error('Limit');
      parts.push(item.value);
    }
    return Buffer.concat(parts, size);
  } catch { await reader.cancel().catch(() => {}); throw Error('Read failed'); }
  finally { signal.removeEventListener('abort', cancel); reader.releaseLock(); }
}
const safeMime = value => {
  const mime = (value ?? '').split(';')[0].trim().toLowerCase();
  return ['application/atom+xml', 'image/jpeg', 'image/png', 'image/gif'].includes(mime) ? mime : 'other';
};

export async function diagnoseSignedCard({ fetch: request = fetch, parseEntry, username, password, publicBaseUrl,
  ids = ['27223', '27505'], emit = console.log, signal }) {
  const deadline = AbortSignal.timeout(240000);
  signal = signal ? AbortSignal.any([signal, deadline]) : deadline;
  const origin = new URL(publicBaseUrl);
  if (origin.protocol !== 'https:' || origin.username || origin.password || origin.search || origin.hash || origin.pathname !== '/' ||
      !username || !password || typeof parseEntry !== 'function' || !ids.length || ids.length > 2 || new Set(ids).size !== ids.length || ids.some(id => !['27223', '27505'].includes(id))) throw Error('Invalid probe configuration');
  const auth = 'Basic ' + Buffer.from(username + ':' + password).toString('base64');
  function validLink(value, path) {
    if (typeof value !== 'string' || value.length > 2048) throw Error('Invalid link');
    const u = new URL(value);
    const params = [...u.searchParams];
    if (u.origin !== origin.origin || u.username || u.password || u.hash || u.pathname !== path || params.length !== 1 || params[0][0] !== 'sig' || !/^[A-Za-z0-9_-]{43}$/.test(params[0][1])) throw Error('Invalid link');
    const bytes = Buffer.from(params[0][1], 'base64url');
    if (bytes.length !== 32 || bytes.toString('base64url') !== params[0][1]) throw Error('Invalid signature encoding');
    return u.href;
  }
  async function measure(id, stage, url, authenticated, inspect) {
    const started = performance.now();
    try {
      signal.throwIfAborted();
      const joined = AbortSignal.any([signal, AbortSignal.timeout(65000)]);
      const response = await request(url, { headers: authenticated ? { authorization: auth } : {}, redirect: 'manual', signal: joined });
      const body = await readBody(response, joined);
      const fields = { status: response.status, mime: safeMime(response.headers.get('content-type')), bytes: body.length };
      const extra = response.status === 200 && inspect ? inspect(body, fields.mime) : null;
      emit({ id, stage, ok: response.status === 200, ...fields, elapsedMs: Math.round(performance.now() - started), ...(extra ? { summary: extra.summary, hasCover: !!extra.cover } : {}) });
      return response.status === 200 ? (extra ?? true) : null;
    } catch {
      emit({ id, stage, ok: false, code: 'request_or_validation_failed', elapsedMs: Math.round(performance.now() - started), aborted: signal.aborted });
      return null;
    }
  }
  for (const id of ids) {
    if (signal.aborted) break;
    const path = `/opds/searchfloor/books/${id}`;
    const inspect = (bytes, mime) => {
      if (mime !== 'application/atom+xml') throw Error('Invalid entry MIME');
      const result = parseEntry(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
      return { self: validLink(result.self, path), cover: result.cover ? validLink(result.cover, path + '/cover') : null, summary: result.summary === true };
    };
    const links = await measure(id, 'entry_basic', origin.origin + path, true, inspect);
    if (!links) continue;
    await measure(id, 'entry_signed', links.self, false, inspect);
    if (links.cover) await measure(id, 'cover_signed', links.cover, false);
    else emit({ id, stage: 'cover_signed', ok: false, code: 'cover_not_advertised' });
  }
}

async function main() {
  try {
    const installed = '/opt/searchfloor-opds/current';
    const { loadConfig } = await import(pathToFileURL(resolve(installed, 'dist/config.js')));
    const { load } = createRequire(resolve(installed, 'package.json'))('cheerio');
    const config = loadConfig(process.env);
    const parseEntry = xml => {
      const $ = load(xml, { xmlMode: true });
      return { self: $('entry > link[rel="self"]').attr('href'), cover: $('entry > link[rel="http://opds-spec.org/image"]').attr('href'), summary: $('entry > summary').length > 0 };
    };
    await diagnoseSignedCard({ parseEntry, username: config.OPDS_USERNAME, password: config.OPDS_PASSWORD,
      publicBaseUrl: config.PUBLIC_BASE_URL, emit: row => console.log(JSON.stringify(row)) });
  } catch { console.log(JSON.stringify({ stage: 'probe_failed', ok: false })); process.exitCode = 1; }
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) await main();
