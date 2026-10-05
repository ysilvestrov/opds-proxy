import { it, expect, vi } from "vitest";
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import type { Server } from "node:http";
import { inspect } from "node:util";
import { Downloads } from "../src/api/download.js";
import type { Book } from "../src/domain/book.js";
import { SearchfloorClient } from "../src/sources/searchfloor/client.js";
import { createSourceTransport } from "../src/sources/transport.js";
import { createConnectProxyFixture } from "./helpers/connect-proxy.js";
const book: Book = {
  sourceName: "searchfloor",
  id: "1",
  title: 'Тест "\r\n',
  authors: [],
  complete: true,
  sourceUrl: "https://searchfloor.org/b/1",
  downloadPath: "/book/1",
  observedAt: new Date().toISOString(),
};
const zip = Uint8Array.from([80, 75, 3, 4, 1, 2, 3]);
it("post-header proxy disconnect never exposes native socket details in Hono stderr",async()=>{
  const fixture=await createConnectProxyFixture();const transport=createSourceTransport(fixture.proxyUrl);
  fixture.respond=(_q,r)=>{r.writeHead(200,{"content-type":"application/zip","content-length":"100"});r.write(zip);setTimeout(()=>r.destroy(),100);};
  const downloads=new Downloads({catalog:{book:async()=>book},client:{openDownload:(_b,signal)=>transport.fetch(fixture.upstreamUrl,{signal})}});
  const app=new Hono();app.get("/",c=>downloads.streamBook("1",c.req.raw.signal));
  const errors:unknown[]=[];const spy=vi.spyOn(console,"error").mockImplementation((...args)=>{errors.push(...args);});
  let server:Server|undefined;
  try{
    server=await new Promise<Server>(resolve=>{const s=serve({fetch:app.fetch,hostname:"127.0.0.1",port:0},()=>resolve(s as Server));});
    const address=server.address();if(!address||typeof address==="string")throw Error("Fixture address");
    const response=await fetch(`http://127.0.0.1:${address.port}`);
    await expect(response.arrayBuffer()).rejects.toThrow();
    expect(downloads.active).toBe(0);expect(errors.length).toBeGreaterThan(0);
    const stderr=inspect(errors,{depth:10});
    expect(stderr).not.toContain("remoteAddress");expect(stderr).not.toContain("remotePort");
    expect(stderr).not.toContain("private-fixture");
  }finally{spy.mockRestore();downloads.abortAll();server?.closeAllConnections();if(server)await new Promise<void>(r=>server!.close(()=>r()));await transport.close();await fixture.close();}
});
it("real proxy replays ZIP, limits bytes, backpressures and aborts on disconnect/shutdown/deadline",async()=>{
  const fixture=await createConnectProxyFixture();const transport=createSourceTransport(fixture.proxyUrl);
  const client=new SearchfloorClient({spacingMs:0,fetch:(input,init)=>transport.fetch(fixture.upstreamUrl+new URL(input).pathname,init)});
  const downloads=new Downloads({catalog:{book:async()=>book},client});
  const waitAborted=async(count:number)=>{for(let n=0;n<100&&fixture.abortedUpstreams<count;n++)await new Promise(r=>setTimeout(r,10));expect(fixture.abortedUpstreams).toBeGreaterThanOrEqual(count);};
  try{
    fixture.respond=(_q,r)=>{r.writeHead(200,{"content-type":"application/zip"});r.write(zip.subarray(0,2));r.end(zip.subarray(2));};
    expect(new Uint8Array(await(await downloads.streamBook("1",new AbortController().signal)).arrayBuffer())).toEqual(zip);
    fixture.respond=(_q,r)=>{r.writeHead(200,{"content-type":"application/zip","content-length":String(20*1024*1024+1)});r.write(zip);};
    await expect(downloads.streamBook("1",new AbortController().signal)).rejects.toMatchObject({status:502});
    await waitAborted(1);
    let sent=0;const total=32*1024*1024;const chunk=Buffer.alloc(64*1024);
    fixture.respond=(_q,r)=>{
      r.writeHead(200,{"content-type":"application/zip"});r.write(zip);sent=0;
      const pump=()=>{while(!r.destroyed&&sent<total){sent+=chunk.length;if(!r.write(chunk)){r.once("drain",pump);return;}}if(sent>=total)r.end();};pump();
    };
    const slow=await downloads.streamBook("1",new AbortController().signal);
    await new Promise(r=>setTimeout(r,100));expect(sent).toBeLessThan(total);
    await slow.body!.cancel();expect(downloads.active).toBe(0);await waitAborted(2);
    fixture.respond=(_q,r)=>{r.writeHead(200,{"content-type":"application/zip"});r.write(zip);};
    const active=await downloads.streamBook("1",new AbortController().signal);downloads.abortAll();
    await expect(active.arrayBuffer()).rejects.toThrow();expect(downloads.active).toBe(0);await waitAborted(3);
    const bounded=new Downloads({catalog:{book:async()=>book},client},{deadlineMs:40});
    const timed=await bounded.streamBook("1",new AbortController().signal);
    await expect(timed.arrayBuffer()).rejects.toThrow();expect(bounded.active).toBe(0);await waitAborted(4);
    // Unknown Content-Length must also hit the default20MiB cap while reading.
    fixture.respond=(_q,r)=>{r.writeHead(200,{"content-type":"application/zip"});r.write(zip);for(let i=0;i<321;i++)r.write(chunk);r.end();};
    const oversized=await downloads.streamBook("1",new AbortController().signal);
    await expect(oversized.arrayBuffer()).rejects.toThrow();expect(downloads.active).toBe(0);
  }finally{downloads.abortAll();client.close();await transport.close();await fixture.close();}
});
const setup = (response: () => Promise<Response>, options = {}) =>
  new Downloads(
    { catalog: { book: async () => book }, client: { openDownload: response } },
    options,
  );
it("streams byte-for-byte ZIP with safe headers and rejects HTML or missing book", async () => {
  const d = setup(
    async () =>
      new Response(zip, { headers: { "content-type": "application/zip" } }),
  );
  const r = await d.streamBook("1", new AbortController().signal);
  expect(r.headers.get("content-disposition")).toContain("filename*=UTF-8");
  expect(r.headers.get("content-disposition")).not.toMatch(/[\r\n]/);
  expect(new Uint8Array(await r.arrayBuffer())).toEqual(zip);
  const bad = setup(
    async () =>
      new Response("<html>challenge</html>", {
        headers: { "content-type": "text/html" },
      }),
  );
  await expect(
    bad.streamBook("1", new AbortController().signal),
  ).rejects.toMatchObject({ status: 502 });
  const unknown = new Downloads({
    catalog: { book: async () => null },
    client: {
      openDownload: async () => {
        throw Error("must not fetch");
      },
    },
  });
  await expect(
    unknown.streamBook("1", new AbortController().signal),
  ).rejects.toMatchObject({ status: 404 });
});
it("releases the single slot and cancels upstream on reader cancellation", async () => {
  let cancelled = false;
  const body = () =>
    new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(zip);
      },
      cancel() {
        cancelled = true;
      },
    });
  const d = setup(
    async () =>
      new Response(body(), { headers: { "content-type": "application/zip" } }),
  );
  const signal = new AbortController();
  const r = await d.streamBook("1", signal.signal);
  await expect(
    d.streamBook("1", new AbortController().signal),
  ).rejects.toMatchObject({ status: 429 });
  await r.body!.cancel();
  expect(cancelled).toBe(true);
  const again = await d.streamBook("1", new AbortController().signal);
  await again.body!.cancel();
});
it("enforces known and unknown size limits", async () => {
  const d = setup(
    async () =>
      new Response(zip, {
        headers: { "content-type": "application/zip", "content-length": "100" },
      }),
    { maxBytes: 6 },
  );
  await expect(
    d.streamBook("1", new AbortController().signal),
  ).rejects.toMatchObject({ status: 502 });
  const late = setup(
    async () =>
      new Response(
        new ReadableStream({
          start(c) {
            c.enqueue(zip.slice(0, 4));
            c.enqueue(new Uint8Array(8));
            c.close();
          },
        }),
        { headers: { "content-type": "application/zip" } },
      ),
    { maxBytes: 10 },
  );
  const r = await late.streamBook("1", new AbortController().signal);
  await expect(r.arrayBuffer()).rejects.toThrow();
});
it("aborts stalled prefix and releases slot at total deadline", async () => {
  let cancelled = false;
  const d = setup(
    async () =>
      new Response(
        new ReadableStream({
          cancel() {
            cancelled = true;
          },
        }),
        { headers: { "content-type": "application/zip" } },
      ),
    { deadlineMs: 15 },
  );
  await expect(
    d.streamBook("1", new AbortController().signal),
  ).rejects.toThrow();
  expect(cancelled).toBe(true);
  expect(d.active).toBe(0);
});
it("handles split signature and idle disconnected client", async () => {
  const d = setup(
    async () =>
      new Response(
        new ReadableStream({
          start(c) {
            for (const byte of zip) c.enqueue(Uint8Array.of(byte));
            c.close();
          },
        }),
        { headers: { "content-type": "application/octet-stream" } },
      ),
  );
  const r = await d.streamBook("1", new AbortController().signal);
  expect(new Uint8Array(await r.arrayBuffer())).toEqual(zip);
  const idle = setup(
    async () =>
      new Response(
        new ReadableStream({
          start(c) {
            c.enqueue(zip);
          },
        }),
        { headers: { "content-type": "application/zip" } },
      ),
  );
  const abort = new AbortController();
  await idle.streamBook("1", abort.signal);
  abort.abort();
  expect(idle.active).toBe(0);
});
