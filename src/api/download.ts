import type { Book } from "../domain/book.js";
import { SourceError, abortable } from "../sources/searchfloor/client.js";
interface Deps {
  catalog: { book(id: string, signal?: AbortSignal): Promise<Book | null> };
  client: { openDownload(book: Book, signal: AbortSignal): Promise<Response> };
}
export class Downloads {
  private slots = new Set<AbortController>();
  get active() {
    return this.slots.size;
  }
  constructor(
    private deps: Deps,
    private options: { maxBytes?: number; deadlineMs?: number } = {},
  ) {}
  abortAll() {
    for (const slot of this.slots)
      slot.abort(new Error("Service shutting down"));
  }
  async streamBook(id: string, caller: AbortSignal): Promise<Response> {
    if (this.active) throw new SourceError("Download busy", 429);
    if (!/^\d+$/.test(id)) throw new SourceError("Missing book", 404);
    const slot = new AbortController();
    this.slots.add(slot);
    const signal = AbortSignal.any([caller, slot.signal]);
    let timer: ReturnType<typeof setTimeout> | undefined;
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
    let output: ReadableStreamDefaultController<Uint8Array> | undefined;
    let finished = false;
    const finish = (error?: unknown) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      signal.removeEventListener("abort", onAbort);
      this.slots.delete(slot);
      if (error) {
        void reader?.cancel(error).catch(() => {});
        output?.error(error);
      }
      if (!slot.signal.aborted) slot.abort();
    };
    const onAbort = () =>
      finish(signal.reason ?? new Error("Download aborted"));
    signal.addEventListener("abort", onAbort, { once: true });
    try {
      signal.throwIfAborted();
      const book = await this.deps.catalog.book(id, signal);
      if (!book || !book.complete) throw new SourceError("Missing book", 404);
      timer = setTimeout(
        () => slot.abort(new SourceError("Download timeout")),
        this.options.deadlineMs ?? 60000,
      );
      const upstream = await abortable(
        this.deps.client.openDownload(book, signal),
        signal,
      );
      if (upstream.status === 404) {
        void upstream.body?.cancel();
        throw new SourceError("Missing file", 404);
      }
      if (!upstream.ok) {
        void upstream.body?.cancel();
        throw new SourceError("Download unavailable");
      }
      const mime = (upstream.headers.get("content-type") ?? "")
        .split(";")[0]
        .trim()
        .toLowerCase();
      const max = this.options.maxBytes ?? 20 * 1024 * 1024;
      if (
        !["application/zip", "application/octet-stream"].includes(mime) ||
        Number(upstream.headers.get("content-length")) > max
      ) {
        void upstream.body?.cancel();
        throw new SourceError("Invalid file response", 502);
      }
      reader = upstream.body?.getReader();
      if (!reader) throw new SourceError("Empty file", 502);
      const prefix = new Uint8Array(4);
      let prefixSize = 0;
      let remainder: Uint8Array | undefined;
      let size = 0;
      while (prefixSize < 4) {
        const item = await abortable(reader.read(), signal);
        if (item.done) throw new SourceError("Empty or short ZIP", 502);
        size += item.value.length;
        if (size > max) throw new SourceError("File too large", 502);
        const take = Math.min(4 - prefixSize, item.value.length);
        prefix.set(item.value.subarray(0, take), prefixSize);
        prefixSize += take;
        if (take < item.value.length) remainder = item.value.subarray(take);
      }
      if (
        prefix[0] !== 80 ||
        prefix[1] !== 75 ||
        prefix[2] !== 3 ||
        prefix[3] !== 4
      )
        throw new SourceError("Invalid ZIP signature", 502);
      let first = true;
      const body = new ReadableStream<Uint8Array>({
        start(c) {
          output = c;
        },
        pull: async (c) => {
          try {
            signal.throwIfAborted();
            if (first) {
              first = false;
              c.enqueue(prefix);
              return;
            }
            if (remainder) {
              const data = remainder;
              remainder = undefined;
              c.enqueue(data);
              return;
            }
            const next = await abortable(reader!.read(), signal);
            if (next.done) {
              finish();
              c.close();
              reader!.releaseLock();
              return;
            }
            size += next.value.length;
            if (size > max) throw new SourceError("File too large", 502);
            c.enqueue(next.value);
          } catch (e) {
            finish(e);
          }
        },
        cancel(reason) {
          finish(reason ?? new Error("Reader disconnected"));
        },
      });
      const title =
        book.title.replace(/[\r\n\u0000-\u001f\u007f]/g, "").slice(0, 100) ||
        "book";
      const filename = title + ".fb2.zip";
      return new Response(body, {
        headers: {
          "Content-Type": "application/zip",
          "Content-Disposition": `attachment; filename="book-${id}.fb2.zip"; filename*=UTF-8''${encodeURIComponent(filename).replace(/[!'()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase())}`,
          "Cache-Control": "private, no-store",
        },
      });
    } catch (e) {
      finish(e);
      throw e;
    }
  }
}
