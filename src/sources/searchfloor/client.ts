import PQueue from "p-queue";
import { setTimeout as delay } from "node:timers/promises";
import type { Book, SourceObservation, SourceCard, Artwork } from "../../domain/book.js";
import { parseAnnotationCard, parseAnnotation, validateArtwork } from './metadata.js';
import { parsePage, parseObservedPage, ParseError, hasEmptyResult } from "./parse.js";
import { parseRelatedPage } from './related.js';
import { encodeRelatedKey, type RelatedTarget, type RelatedSnapshot } from '../../domain/related.js';
export class SourceError extends Error {
  constructor(
    message: string,
    public status = 503,
  ) {
    super(message);
  }
}
type Transport = (input: string | URL, init?: RequestInit) => Promise<Response>;
interface Options {
  fetch?: Transport;
  now?: () => number;
  spacingMs?: number;
  timeoutMs?: number;
  queueWaitMs?: number;
  htmlLimit?: number;
  retryMs?: number;
}
export async function abortable<T>(
  promise: Promise<T>,
  signal: AbortSignal,
): Promise<T> {
  signal.throwIfAborted();
  let rejectAbort: () => void = () => {};
  const cancellation = new Promise<never>((_, reject) => {
    rejectAbort = () => reject(signal.reason);
    signal.addEventListener("abort", rejectAbort, { once: true });
  });
  try {
    return await Promise.race([promise, cancellation]);
  } finally {
    signal.removeEventListener("abort", rejectAbort);
  }
}
export async function readLimited(
  response: Response,
  limit: number,
  signal: AbortSignal,
): Promise<Uint8Array> {
  if (Number(response.headers.get("content-length")) > limit) {
    await response.body?.cancel();
    throw new SourceError("Response limit exceeded", 502);
  }
  const reader = response.body?.getReader();
  if (!reader) return new Uint8Array();
  const parts: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const r = await abortable(reader.read(), signal);
      if (r.done) break;
      size += r.value.length;
      if (size > limit) throw new SourceError("Response limit exceeded", 502);
      parts.push(r.value);
    }
  } catch (e) {
    void reader.cancel().catch(() => {});
    throw e;
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) {
    bytes.set(part, offset);
    offset += part.length;
  }
  return bytes;
}
export class SearchfloorClient {
  private queue = new PQueue({ concurrency: 1 });
  private stopped = new AbortController();
  private activeStopped = new AbortController();
  private cooldown = 0;
  private lastStart = -Infinity;
  private transport: Transport;
  private now: () => number;
  constructor(private options: Options = {}) {
    this.transport = options.fetch ?? fetch;
    this.now = options.now ?? Date.now;
  }
  private async run<T>(
    action: (signal: AbortSignal) => Promise<T>,
    signal?: AbortSignal,
    timeoutMs = this.options.timeoutMs ?? 15000,
  ): Promise<T> {
    if (this.queue.size >= 20) throw new SourceError("Source queue full");
    const waiting = new AbortController();
    const joined = AbortSignal.any([
      waiting.signal,
      this.stopped.signal,
      ...(signal ? [signal] : []),
    ]);
    const timer = setTimeout(
      () => waiting.abort(new SourceError("Source queue timeout")),
      this.options.queueWaitMs ?? 30000,
    );
    try {
      const result = await this.queue.add(
        async () => {
          clearTimeout(timer);
          const timed = AbortSignal.any([
            this.activeStopped.signal,
            ...(signal ? [signal] : []),
            AbortSignal.timeout(timeoutMs),
          ]);
          return await abortable(action(timed), timed);
        },
        { signal: joined },
      );
      return result as T;
    } catch (e) {
      if (e instanceof SourceError) throw e;
      if (e instanceof ParseError)
        throw new SourceError("Invalid source HTML", 502);
      throw new SourceError("Source request failed");
    } finally {
      clearTimeout(timer);
    }
  }
  private async request(path: string, signal: AbortSignal, accept = 'text/html,application/zip'): Promise<Response> {
    if (this.now() < this.cooldown) throw new SourceError("Source cooldown");
    for (let attempt = 0; attempt < 2; attempt++) {
      let url = new URL(path, "https://searchfloor.org");
      let response: Response | undefined;
      for (let hop = 0; hop <= 3; hop++) {
        const wait =
          (this.options.spacingMs ?? 1000) - (this.now() - this.lastStart);
        if (wait > 0) await delay(wait, undefined, { signal });
        this.lastStart = this.now();
        response = await abortable(
          this.transport(url, {
            signal,
            redirect: "manual",
            headers: {
              "User-Agent": "opds-proxy/0.1",
              Accept: accept,
            },
          }),
          signal,
        );
        if (![301, 302, 303, 307, 308].includes(response.status)) break;
        const location = response.headers.get("location");
        void response.body?.cancel();
        if (!location || hop === 3)
          throw new SourceError("Invalid redirect", 502);
        const next = new URL(location, url);
        if (
          next.origin !== "https://searchfloor.org" ||
          next.username ||
          next.password
        )
          throw new SourceError("Forbidden redirect", 502);
        url = next;
      }
      const res = response!;
      if (res.status === 403) {
        void res.body?.cancel();
        throw new SourceError("Source denied request");
      }
      if (res.status === 429 || res.status >= 500) {
        const raw = res.headers.get("retry-after");
        const seconds =
          raw && /^\d+$/.test(raw)
            ? Number(raw)
            : raw
              ? Math.max(0, (Date.parse(raw) - this.now()) / 1000)
              : 0;
        const wait =
          Number.isFinite(seconds) && seconds > 0
            ? seconds * 1000
            : (this.options.retryMs ?? 1000);
        void res.body?.cancel();
        if (wait > 10000) {
          this.cooldown = this.now() + wait;
          throw new SourceError("Source cooldown");
        }
        if (attempt === 1)
          throw new SourceError("Source temporarily unavailable");
        await delay(wait, undefined, { signal });
        continue;
      }
      return res;
    }
    throw new SourceError("Source temporarily unavailable");
  }
  async list(
    query: string | null,
    page: number,
    signal?: AbortSignal,
  ): Promise<SourceObservation> {
    const url = new URL(
      query === null ? "/" : "/search",
      "https://searchfloor.org",
    );
    url.searchParams.set("page", String(page));
    if (query === null) url.searchParams.set("status", "is_finished");
    else url.searchParams.set("q", query);
    return this.run(async (s) => {
      const r = await this.request(url.pathname + url.search, s);
      if (!r.ok && r.status !== 404) {
        void r.body?.cancel();
        throw new SourceError("Unexpected source response", 502);
      }
      const html = new TextDecoder().decode(
        await readLimited(r, this.options.htmlLimit ?? 2 * 1024 * 1024, s),
      );
      const parsed = parseObservedPage(html, page, new Date(this.now()).toISOString());
      if (r.status === 404 && (!hasEmptyResult(html) || parsed.books.length))
        throw new SourceError("Unexpected source 404", 502);
      return parsed;
    }, signal);
  }
  async listRelated(target: RelatedTarget, signal?: AbortSignal): Promise<RelatedSnapshot> {
    encodeRelatedKey(target);
    const path = target.kind === 'author' ? `/a/${encodeURIComponent(target.slug)}` : `/s/${encodeURIComponent(target.name)}`;
    const url = new URL(path, 'https://searchfloor.org');
    if (url.pathname !== path) throw new SourceError('Invalid entity path', 400);
    if (target.kind === 'series') url.searchParams.set('authors', target.authors);
    return this.run(async s => {
      const r = await this.request(url.pathname + url.search, s);
      if (!r.ok && r.status !== 404) {
        await r.body?.cancel(); throw new SourceError('Unexpected entity response', 502);
      }
      const html = new TextDecoder().decode(await readLimited(r, this.options.htmlLimit ?? 2 * 1024 * 1024, s));
      const parsed = parseRelatedPage(html, target, new Date(this.now()).toISOString());
      if (r.status === 404 && (!hasEmptyResult(html) || parsed.books.length))
        throw new SourceError('Unexpected entity 404', 502);
      return parsed;
    }, signal);
  }
  async getBook(id: string, signal?: AbortSignal): Promise<Book | null> {
    return (await this.getCard(id, signal))?.book ?? null;
  }
  async getCard(id: string, signal?: AbortSignal): Promise<SourceCard | null> {
    if (!/^\d+$/.test(id)) return null;
    return this.run(async (s) => {
      const r = await this.request(`/b/${id}`, s);
      if (r.status === 404) {
        void r.body?.cancel();
        return null;
      }
      if (!r.ok) throw new SourceError("Book lookup unavailable");
      const html = new TextDecoder().decode(
        await readLimited(r, this.options.htmlLimit ?? 2 * 1024 * 1024, s),
      );
      const book = parsePage(html, 1, new Date(this.now()).toISOString()).books.find(
          (b) => b.id === id,
        );
      return book ? {book, annotation:parseAnnotationCard(html,id)} : null;
    }, signal);
  }
  async getAnnotation(id: string, signal?: AbortSignal): Promise<string|null> {
    if (!/^\d+$/.test(id)) return null;
    return this.run(async s => {
      const r = await this.request(`/api/annotation/${id}`,s,'text/plain');
      if (r.status===404) { await r.body?.cancel(); return null; }
      if (!r.ok) { await r.body?.cancel(); throw new SourceError('Annotation unavailable'); }
      if (r.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'text/plain') {
        await r.body?.cancel(); throw new SourceError('Invalid annotation',502);
      }
      const bytes=await readLimited(r,65536,s);
      try { return parseAnnotation(bytes); } catch { throw new SourceError('Invalid annotation',502); }
    },signal);
  }
  async getCover(id: string, signal?: AbortSignal): Promise<Artwork|null> {
    if (!/^\d+$/.test(id)) return null;
    return this.run(async s => {
      const r=await this.request(`/cover/${id}`,s,'image/jpeg,image/png,image/gif');
      if (r.status===404) { await r.body?.cancel(); return null; }
      if (!r.ok) { await r.body?.cancel(); throw new SourceError('Artwork unavailable'); }
      const bytes=await readLimited(r,2*1024*1024,s);
      try { return {mime:validateArtwork(bytes,r.headers.get('content-type')??''),bytes,observedAt:new Date(this.now()).toISOString()}; }
      catch { throw new SourceError('Invalid artwork',502); }
    },signal);
  }
  async openDownload(book: Book, signal: AbortSignal): Promise<Response> {
    if (
      book.sourceName !== "searchfloor" ||
      !book.complete ||
      !/^\d+$/.test(book.id) ||
      book.downloadPath !== `/book/${book.id}`
    )
      throw new SourceError("Invalid download", 404);
    return this.run((s) => this.request(book.downloadPath, s), signal, 60000);
  }
  cancelQueued() {
    this.stopped.abort(new SourceError("Source client closed"));
  }
  close() {
    this.cancelQueued();
    this.activeStopped.abort(new SourceError("Source client closed"));
    this.queue.clear();
  }
}
