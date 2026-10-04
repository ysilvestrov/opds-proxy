import type { Server } from "node:http";
import { existsSync, readFileSync } from "node:fs";
import { serve } from "@hono/node-server";
import pino from "pino";
import { loadConfig } from "./config.js";
import { Cache } from "./storage/cache.js";
import { SearchfloorClient } from "./sources/searchfloor/client.js";
import { Catalog } from "./catalog.js";
import { createApp } from "./api/app.js";
import { Downloads } from "./api/download.js";
const identity = new URL("../release.json", import.meta.url);
const releaseSHA = existsSync(identity)
  ? JSON.parse(readFileSync(identity, "utf8")).sha
  : undefined;
const config = loadConfig({
  ...process.env,
  ...(releaseSHA ? { RELEASE_SHA: releaseSHA } : {}),
});
const log = pino({
  redact: [
    "password",
    "authorization",
    "cookie",
    "headers.authorization",
    "headers.cookie",
  ],
});
const cache = new Cache(config.CACHE_PATH, {
  onReset: (reason) => log.warn({ event: "cache_reset", reason }),
});
const client = new SearchfloorClient();
const catalog = new Catalog({ cache, client });
const downloads = new Downloads({ catalog, client });
let ready = true;
const app = createApp({
  config,
  log,
  catalog,
  download: (id, signal) => downloads.streamBook(id, signal),
  ready: () => ready,
});
const server = serve(
  { fetch: app.fetch, port: config.PORT, hostname: "127.0.0.1" },
  () =>
    log.info({
      event: "listening",
      port: config.PORT,
      sha: config.RELEASE_SHA,
    }),
) as Server;
let stopping = false;
async function shutdown() {
  if (stopping) return;
  stopping = true;
  ready = false;
  client.cancelQueued();
  let closed = false;
  server.close(() => {
    closed = true;
  });
  server.closeIdleConnections();
  const until = Date.now() + 15000;
  while (!closed && Date.now() < until)
    await new Promise((r) => setTimeout(r, 50));
  downloads.abortAll();
  client.close();
  server.closeAllConnections();
  cache.close();
  log.info({ event: "stopped" });
}
process.once("SIGTERM", () => void shutdown());
process.once("SIGINT", () => void shutdown());
