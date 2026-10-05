// Disposable standard headless Chrome probe; no challenge solving/stealth.
import {spawn} from 'node:child_process';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname,basename} from 'node:path';
import {setTimeout as sleep} from 'node:timers/promises';
const executable=process.argv[2];
if(!executable)throw new Error('Pass browser executable path');
const result={time:new Date().toISOString(),platform:process.platform,mode:'headless',requests:0};
const profile=await mkdtemp(join(tmpdir(),'opds-source-probe-'));
const child=spawn(executable,['--headless=new','--remote-debugging-port=0',
  '--remote-debugging-address=127.0.0.1',`--user-data-dir=${profile}`,
  '--no-first-run','--no-default-browser-check','about:blank'],
  {stdio:'ignore',windowsHide:true});
child.on('error',()=>{result.startupFailure=true;});
let ws,timer;const pending=new Map();let seq=0;
function call(method,params={}) {
  return new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
}
try {
  let port;
  for(let i=0;i<50;i++){try{port=Number((await readFile(join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0]);break;}catch{await sleep(100);}}
  if(!port)throw new Error('Browser startup unavailable');
  const version=await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();result.browser=version.Browser;
  const tabs=await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  ws=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
  ws.onclose=()=>{for(const p of pending.values())p.reject(new Error('Browser connection closed'));pending.clear();};
  let complete;const done=new Promise(resolve=>complete=resolve);
  ws.onmessage=event=>{const m=JSON.parse(event.data);
    if(m.id){const p=pending.get(m.id);if(p){pending.delete(m.id);m.error?p.reject(new Error('CDP error')):p.resolve(m.result);}return;}
    if(m.method==='Network.requestWillBeSent')result.requests++;
    if(m.method==='Fetch.requestPaused') {
      const p=m.params;const headers=Object.fromEntries((p.responseHeaders||[]).map(h=>[h.name.toLowerCase(),h.value]));
      const challenged=p.responseStatusCode===403||p.responseStatusCode===429||headers['cf-mitigated']==='challenge';
      if(p.resourceType==='Document') {
        if(result.status){void call('Fetch.failRequest',{requestId:p.requestId,errorReason:'Aborted'}).then(()=>complete());return;}
        result.status=p.responseStatusCode;result.headers=Object.fromEntries(['server','content-type','cf-ray','cf-mitigated','retry-after'].map(k=>[k,headers[k]??null]));
        if(challenged){result.challengeStopped=true;void call('Fetch.failRequest',{requestId:p.requestId,errorReason:'Aborted'}).then(()=>complete());return;}
      }
      void call('Fetch.continueRequest',{requestId:p.requestId});
    }
    if(m.method==='Page.loadEventFired')complete();
  };
  await call('Page.enable');await call('Network.enable');
  await call('Fetch.enable',{patterns:[{urlPattern:'*',resourceType:'Document',requestStage:'Response'}]});
  timer=setTimeout(()=>{result.deadline=true;complete();},15000);
  await call('Page.navigate',{url:'https://searchfloor.org/?page=1&status=is_finished'});
  await done;
  if(result.status===200&&!result.challengeStopped) {
    const evaluated=await call('Runtime.evaluate',{expression:`JSON.stringify({cards:document.querySelectorAll('div[id^="book"]').length,downloadLinks:document.querySelectorAll('.download-btn[data-url]').length,challengeTitle:/Just a moment|Attention Required/i.test(document.title)})`,returnByValue:true});
    result.dom=JSON.parse(evaluated.result.value);
  }
}catch(e){result.failure=e.name;}
finally {
  clearTimeout(timer);
  if(ws?.readyState===WebSocket.OPEN)await Promise.race([call('Browser.close').catch(()=>{}),sleep(1000)]);
  ws?.close();
  if(child.exitCode===null){await Promise.race([new Promise(r=>child.once('exit',r)),sleep(2000)]);if(child.exitCode===null)child.kill();}
  try{if(dirname(profile)!==tmpdir()||!basename(profile).startsWith('opds-source-probe-'))throw new Error('Unexpected profile path');
    await rm(profile,{recursive:true,force:true,maxRetries:5,retryDelay:200});result.profileRemoved=true;}catch{result.profileRemoved=false;}
}
console.log(JSON.stringify(result));
