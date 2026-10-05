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
        return await globalThis.fetch(input, options);
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
