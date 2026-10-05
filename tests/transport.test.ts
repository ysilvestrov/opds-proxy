import { expect, it } from "vitest";
import { createSourceTransport } from "../src/sources/transport.js";
import { createConnectProxyFixture } from "./helpers/connect-proxy.js";
it("routes two requests through one isolated reusable source transport", async () => {
  const fixture=await createConnectProxyFixture();const original=globalThis.fetch;
  const transport=createSourceTransport(fixture.proxyUrl);
  try {
    for(let n=0;n<2;n++)expect(await (await transport.fetch(fixture.upstreamUrl)).text()).toBe("fixture");
    expect(fixture.upstreamRequests).toBe(2);
    expect(fixture.proxyConnects).toBeGreaterThan(0);
    expect(fixture.authenticatedConnects).toBe(fixture.proxyConnects);
    expect(globalThis.fetch).toBe(original);
  } finally {await transport.close();await fixture.close();}
});
it("closing the dispatcher aborts an active proxied response and is idempotent",async()=>{
  const fixture=await createConnectProxyFixture();
  fixture.respond=(_req,res)=>{res.writeHead(200);res.write("prefix");};
  const transport=createSourceTransport(fixture.proxyUrl);
  try{
    const response=await transport.fetch(fixture.upstreamUrl);
    const reader=response.body!.getReader();await reader.read();
    await transport.close();await transport.close();
    await expect(reader.read()).rejects.toThrow();
    await expect(transport.fetch(fixture.upstreamUrl)).rejects.toMatchObject({status:503});
  }finally{await transport.close();await fixture.close();}
});
it("proxy407 fails503 without a direct request or secret-bearing error", async () => {
  const fixture=await createConnectProxyFixture();fixture.proxyStatus=407;
  const transport=createSourceTransport(fixture.proxyUrl);
  try {
    await expect(transport.fetch(fixture.upstreamUrl)).rejects.toMatchObject({status:503});
    try{await transport.fetch(fixture.upstreamUrl);}catch(e){
      expect(JSON.stringify(e)).not.toContain("private-fixture");
      expect((e as Error).message).not.toContain(fixture.proxyUrl);
    }
    expect(fixture.upstreamRequests).toBe(0);
  } finally {await transport.close();await fixture.close();}
});
it("connection failure fails503 without direct fallback", async () => {
  const fixture=await createConnectProxyFixture();const transport=createSourceTransport("http://127.0.0.1:1");
  try{await expect(transport.fetch(fixture.upstreamUrl)).rejects.toMatchObject({status:503});
    expect(fixture.upstreamRequests).toBe(0);
  }finally{await transport.close();await fixture.close();}
});
it("absent config is direct and ignores ambient proxy environment", async () => {
  const fixture=await createConnectProxyFixture();const old=process.env.HTTPS_PROXY;
  process.env.HTTPS_PROXY="http://127.0.0.1:1";
  const transport=createSourceTransport();
  try{expect(await(await transport.fetch(fixture.upstreamUrl)).text()).toBe("fixture");
    expect(fixture.proxyConnects).toBe(0);
  }finally{if(old===undefined)delete process.env.HTTPS_PROXY;else process.env.HTTPS_PROXY=old;
    await transport.close();await fixture.close();}
});
