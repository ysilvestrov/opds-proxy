import { Hono } from "hono";
import type { Logger } from "pino";
import type { Config } from "../config.js";
import type { Catalog } from "../catalog.js";
import {
  renderFeed,
  renderRoot,
  renderSourceRoot,
  NAV,
  ACQ,
  ENTRY, renderBookEntry,
  renderRelatedFeed,
} from "../opds/feed.js";
import { renderOpenSearch } from "../opds/search.js";
import { privateAuth } from "./auth.js";
import { accessLog } from "./access-log.js";
import { createBookCardSigner, isSignedBookCardRequest } from './card-grant.js';
import { SourceError } from "../sources/searchfloor/client.js";
import { decodeRelatedKey } from '../domain/related.js';
import { CATALOG_ICON_PATH, catalogIconBytes } from '../opds/catalog-icon.js';
interface Deps {
  catalog: Pick<Catalog, "page" | "book"> & Partial<Pick<Catalog,'details'|'cover'|'related'>>;
  config: Config;
  log: Logger;
  download?: (id: string, signal: AbortSignal) => Promise<Response>;
  ready?: () => boolean;
}
export function createApp(d: Deps): Hono {
  const app = new Hono();
  const signer = createBookCardSigner(d.config.OPDS_PASSWORD);
  const authorizeCard = (request: Request) => isSignedBookCardRequest(request, signer);
  app.use('*', accessLog(d.log));
  app.get("/health", (c) =>
    c.json(
      { ready: d.ready?.() ?? true, sha: d.config.RELEASE_SHA },
      d.ready?.() === false ? 503 : 200,
    ),
  );
  app.get(CATALOG_ICON_PATH, () => new Response(new Uint8Array(catalogIconBytes()), {headers: {
    'Content-Type': 'image/png', 'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'public, max-age=86400',
  }}));
  app.use("/opds", privateAuth(d.config.OPDS_USERNAME, d.config.OPDS_PASSWORD, authorizeCard));
  app.use(
    "/opds/*",
    privateAuth(d.config.OPDS_USERNAME, d.config.OPDS_PASSWORD, authorizeCard),
  );
  const response = (xml: string, type: string) =>
    new Response(xml, {
      headers: {
        "Content-Type": type + ";charset=utf-8",
        "Cache-Control": "private, no-store",
      },
    });
  app.get("/opds", () =>
    response(
      renderRoot(d.config.PUBLIC_BASE_URL, [
        { name: "searchfloor", title: "Searchfloor" },
      ]),
      NAV,
    ),
  );
  app.use("/opds/:name/*", async (c, next) => {
    if (c.req.param("name") !== "searchfloor") return c.notFound();
    await next();
  });
  app.get("/opds/:name", (c) =>
    c.req.param("name") === "searchfloor"
      ? response(renderSourceRoot(d.config.PUBLIC_BASE_URL, "searchfloor"), NAV)
      : c.notFound(),
  );
  app.get("/opds/:name/opensearch.xml", () =>
    response(
      renderOpenSearch(d.config.PUBLIC_BASE_URL, "searchfloor"),
      "application/opensearchdescription+xml",
    ),
  );
  for (const route of ["completed", "search"])
    app.get(`/opds/:name/${route}`, async (c) => {
      const raw = c.req.query("page") ?? "1";
      const page = Number(raw);
      const q =
        route === "search"
          ? (c.req.query("q") ?? "").trim().normalize("NFC")
          : null;
      if (
        !/^\d+$/.test(raw) ||
        !Number.isInteger(page) ||
        page < 1 ||
        page > 10000 ||
        (q !== null && (!q || [...q].length > 200))
      )
        return c.text("Invalid query or page", 400);
      const data = await d.catalog.page(q, page, c.req.raw.signal);
      return response(
        renderFeed(data, {
          baseUrl: d.config.PUBLIC_BASE_URL,
          sourceName: "searchfloor",
          query: q,
          page,
          updated: data.observedAt,
          stale: data.stale,
        }),
        ACQ,
      );
    });
  for (const route of ['authors', 'series'] as const) {
    app.get(`/opds/:name/${route}/:key`, async c => {
      const target = decodeRelatedKey(c.req.param('key'), route === 'authors' ? 'author' : 'series');
      const raw = c.req.query('page') ?? '1';
      const page = Number(raw);
      if (!target || !/^\d+$/.test(raw) || !Number.isInteger(page) || page < 1 || page > 10000)
        return c.text('Invalid related key or page', 400);
      if (!d.catalog.related) return c.notFound();
      const data = await d.catalog.related(target, page, c.req.raw.signal);
      return response(renderRelatedFeed(data, target, d.config.PUBLIC_BASE_URL, page), ACQ);
    });
  }
  app.get("/opds/:name/books/:id/download.fb2.zip", (c) => {
    const id = c.req.param("id");
    if (!/^\d+$/.test(id) || !d.download) return c.notFound();
    return d.download(id, c.req.raw.signal);
  });
  app.get('/opds/:name/books/:id',async c=>{
    const id=c.req.param('id');if(!/^\d+$/.test(id))return c.text('Invalid book ID',400);
    if(!d.catalog.details)return c.notFound();
    const value=await d.catalog.details(id,c.req.raw.signal);if(!value)return c.notFound();
    const b = value.book;
    const links = b.sourceName === 'searchfloor' && /^[1-9][0-9]{0,19}$/.test(b.id)
      ? { self: `${d.config.PUBLIC_BASE_URL}/opds/searchfloor/books/${b.id}?sig=${signer.sign(b.sourceName,b.id)}`,
          cover: `${d.config.PUBLIC_BASE_URL}/opds/searchfloor/books/${b.id}/cover?sig=${signer.sign(b.sourceName,b.id)}` }
      : undefined;
    const result = response(renderBookEntry(b,value.details,d.config.PUBLIC_BASE_URL,value.stale,links),ENTRY);
    result.headers.set('Referrer-Policy','no-referrer');
    return result;
  });
  app.get('/opds/:name/books/:id/cover',async c=>{
    const id=c.req.param('id');if(!/^\d+$/.test(id))return c.text('Invalid book ID',400);
    if(!d.catalog.cover)return c.notFound();
    const value=await d.catalog.cover(id,c.req.raw.signal);if(!value)return c.notFound();
    return new Response(new Uint8Array(value.bytes),{headers:{'Content-Type':value.mime,'X-Content-Type-Options':'nosniff','Cache-Control':'private, max-age=0, must-revalidate'}});
  });
  app.onError((error, c) => {
    const status = error instanceof SourceError ? error.status : 500;
    d.log.warn({ status, event: "request_failed" }, "Request failed");
    return new Response(
      status === 500 ? "Internal error" : "Source unavailable",
      { status },
    );
  });
  return app;
}
