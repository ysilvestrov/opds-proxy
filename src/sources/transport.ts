import { Agent, ProxyAgent, type Dispatcher } from "undici";
import { SourceError } from "./searchfloor/client.js";

export type SourceFetch = (input: string | URL, init?: RequestInit) => Promise<Response>;

export function createSourceTransport(proxyUrl?: string): {
  fetch: SourceFetch;
  close(): Promise<void>;
} {
  let dispatcher: Dispatcher;
  try {
    dispatcher = proxyUrl === undefined ? new Agent() : new ProxyAgent(proxyUrl);
  } catch {
    throw new Error("Invalid configuration: OPDS_SOURCE_PROXY_URL");
  }
  let closing: Promise<void> | undefined;
  return {
    async fetch(input, init) {
      if (closing) throw new SourceError("Source transport closed");
      try {
        // Explicit per-request dispatcher avoids process-wide proxy settings.
        const options = { ...init, dispatcher };
        const response = await globalThis.fetch(input, options);
        if (!response.body) return response;
        const reader = response.body.getReader();
        // Native stream failures contain proxy socket details too. Sanitize at
        // this boundary while retaining pull-based backpressure/cancellation.
        const body = new ReadableStream<Uint8Array>({
          async pull(controller) {
            try {
              const item = await reader.read();
              if (item.done) {
                controller.close();
                reader.releaseLock();
              } else controller.enqueue(item.value);
            } catch {
              controller.error(new SourceError("Source stream unavailable"));
              reader.releaseLock();
            }
          },
          async cancel() {
            try { await reader.cancel(); } catch { /* No native cause escapes. */ }
            finally { reader.releaseLock(); }
          },
        });
        return new Response(body, {
          status: response.status, statusText: response.statusText,
          headers: response.headers,
        });
      } catch {
        // Native errors can contain proxy URI/authentication; never retain causes.
        throw new SourceError("Source transport unavailable");
      }
    },
    close() {
      closing ??= dispatcher.destroy().then(() => undefined);
      return closing;
    },
  };
}
