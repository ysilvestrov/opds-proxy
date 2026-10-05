import { spawn } from "node:child_process";
import { expect, it } from "vitest";
import { createConnectProxyFixture } from "./helpers/connect-proxy.js";
it.skipIf(process.platform === "win32")("runtime injects source proxy and aborts stalled CONNECT during bounded shutdown",async()=>{
  const fixture=await createConnectProxyFixture();fixture.proxyStatus=0;
  const child=spawn(process.execPath,["dist/index.js"],{env:{...process.env,
    PORT:"18880",PUBLIC_BASE_URL:"https://opds.example",CACHE_PATH:":memory:",
    OPDS_USERNAME:"fixture",OPDS_PASSWORD:"fixture-only",OPDS_SOURCE_PROXY_URL:fixture.proxyUrl},stdio:["ignore","pipe","pipe"]});
  let log="";child.stdout.on("data",b=>log+=b);child.stderr.on("data",b=>log+=b);
  const exit=new Promise<void>(r=>child.once("exit",()=>r()));
  const guard=setTimeout(()=>child.kill("SIGKILL"),22000);
  try{
    for(let i=0;i<100&&!log.includes("listening");i++)await new Promise(r=>setTimeout(r,25));
    expect(log).toContain("listening");
    const pending=fetch("http://127.0.0.1:18880/opds/searchfloor/completed",{headers:{authorization:"Basic "+Buffer.from("fixture:fixture-only").toString("base64")}}).catch(()=>undefined);
    for(let i=0;i<100&&!fixture.proxyConnects;i++)await new Promise(r=>setTimeout(r,25));
    expect(fixture.authenticatedConnects).toBe(1);
    const start=Date.now();child.kill("SIGTERM");await exit;await pending;
    expect(Date.now()-start).toBeLessThan(21000);expect(log).toContain("stopped");
    expect(log).not.toContain("private-fixture");expect(log).not.toContain(fixture.proxyUrl);
  }finally{clearTimeout(guard);child.kill("SIGKILL");await exit;await fixture.close();}
},25000);
it("rejects invalid source proxy on startup without printing credentials", async () => {
  const child=spawn(process.execPath,["dist/index.js"],{env:{...process.env,
    PORT:"18879",PUBLIC_BASE_URL:"https://opds.example",CACHE_PATH:":memory:",
    OPDS_USERNAME:"fixture",OPDS_PASSWORD:"fixture-only",
    OPDS_SOURCE_PROXY_URL:"socks5://fixture:private-fixture@localhost:8080"},stdio:["ignore","pipe","pipe"]});
  let output="";let exited=false;
  child.stdout.on("data",b=>output+=b.toString());child.stderr.on("data",b=>output+=b.toString());
  child.once("exit",()=>{exited=true;});
  try {
    for(let n=0;n<50&&!exited&&!output.includes("listening");n++)await new Promise(r=>setTimeout(r,50));
    expect(exited).toBe(true);expect(output).toContain("OPDS_SOURCE_PROXY_URL");
    expect(output).not.toContain("private-fixture");expect(output).not.toContain("listening");
  } finally {if(!exited){child.kill();await new Promise(r=>child.once("exit",r));}}
});
it("starts loopback runtime, protects catalog and stops", async () => {
  const port = 18878;
  const child = spawn(process.execPath, ["dist/index.js"], {
    env: {
      ...process.env,
      PORT: String(port),
      PUBLIC_BASE_URL: "https://opds.example",
      CACHE_PATH: ":memory:",
      OPDS_USERNAME: "local-reader",
      OPDS_PASSWORD: "local-test-only",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let log = "";
  child.stdout.on("data", (b) => (log += b.toString()));
  child.stderr.on("data", (b) => (log += b.toString()));
  try {
    for (let n = 0; n < 50 && !log.includes("listening"); n++)
      await new Promise((r) => setTimeout(r, 50));
    expect(log).toContain("listening");
    const base = `http://127.0.0.1:${port}`;
    expect((await fetch(base + "/health")).status).toBe(200);
    expect((await fetch(base + "/opds")).status).toBe(401);
    expect(
      (
        await fetch(base + "/opds", {
          headers: {
            authorization:
              "Basic " +
              Buffer.from("local-reader:local-test-only").toString("base64"),
          },
        })
      ).status,
    ).toBe(200);
    expect(log).not.toContain("local-test-only");
  } finally {
    child.kill("SIGTERM");
    await new Promise<void>((r) => child.once("exit", () => r()));
    if (process.platform !== "win32") expect(log).toContain("stopped");
  }
});
