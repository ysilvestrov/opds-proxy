import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { connect, type Socket } from "node:net";
export async function createConnectProxyFixture() {
  const sockets = new Set<Socket>();
  const fixture = {
    proxyUrl: "", upstreamUrl: "", proxyConnects: 0, upstreamRequests: 0,
    abortedUpstreams: 0, proxyStatus: 200, authenticatedConnects: 0,
    respond: (_req: IncomingMessage, res: ServerResponse) => { res.end("fixture"); },
    close: async () => {
      for (const socket of sockets) socket.destroy();
      await Promise.all([new Promise<void>(r=>proxy.close(()=>r())), new Promise<void>(r=>upstream.close(()=>r()))]);
    },
  };
  const upstream = createServer((req,res) => {
    fixture.upstreamRequests++;
    res.on("close",()=>{if(!res.writableEnded)fixture.abortedUpstreams++;});
    fixture.respond(req,res);
  });
  const proxy = createServer();
  for(const server of [upstream,proxy])server.on("connection",socket=>{sockets.add(socket);socket.on("close",()=>sockets.delete(socket));});
  await new Promise<void>(r=>upstream.listen(0,"127.0.0.1",r));
  const address=upstream.address();if(!address||typeof address==="string")throw Error("Fixture address");
  fixture.upstreamUrl=`http://127.0.0.1:${address.port}`;
  proxy.on("connect",(req,client,head)=>{
    fixture.proxyConnects++;
    if(req.headers["proxy-authorization"] === "Basic " + Buffer.from("fixture:private-fixture").toString("base64"))fixture.authenticatedConnects++;
    if(fixture.proxyStatus===0)return; // Deliberately stalled CONNECT for shutdown tests.
    if(fixture.proxyStatus!==200){client.end(`HTTP/1.1 ${fixture.proxyStatus} Proxy fixture\r\nContent-Length: 0\r\n\r\n`);return;}
    const remote=connect(address.port,"127.0.0.1",()=>{
      client.write("HTTP/1.1 200 Connection Established\r\n\r\n");
      if(head.length)remote.write(head);client.pipe(remote);remote.pipe(client);
    });
    sockets.add(remote);remote.on("close",()=>sockets.delete(remote));
    remote.on("error",()=>client.destroy());client.on("error",()=>remote.destroy());
    client.on("close",()=>remote.destroy());remote.on("close",()=>client.destroy());
  });
  await new Promise<void>(r=>proxy.listen(0,"127.0.0.1",r));
  const pa=proxy.address();if(!pa||typeof pa==="string")throw Error("Proxy address");
  fixture.proxyUrl=`http://fixture:private-fixture@127.0.0.1:${pa.port}`;
  return fixture;
}
