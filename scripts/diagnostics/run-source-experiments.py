"""Reusable spike runner. Append each sanitized result immediately; never raw HTML.

Run on the VPS: python3 scripts/diagnostics/run-source-experiments.py --dist /opt/.../dist
Browser is opt-in: --browser /path/to/chrome. No installations or service changes.
"""
import argparse, datetime, json, os, pathlib, shutil, subprocess, time, urllib.parse

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--dist', default='dist')
    parser.add_argument('--node', default='node')
    parser.add_argument('--browser')
    parser.add_argument('--proxy-env', metavar='NAME', help='Use only the existing operator-approved proxy URL from this environment variable; never print it')
    parser.add_argument('--out', default='docs/source-experiments-server.jsonl')
    args=parser.parse_args()
    root=pathlib.Path(__file__).resolve().parent
    out=pathlib.Path(args.out).resolve();out.parent.mkdir(parents=True,exist_ok=True)
    if out.exists(): raise SystemExit('Output exists; choose a fresh output path to preserve prior evidence')
    cases=[]
    env={k:v for k,v in os.environ.items() if k.lower() not in
         ('http_proxy','https_proxy','all_proxy','no_proxy','node_use_env_proxy')}
    proxy=False;http_proxy=True
    if args.proxy_env:
        value=os.environ.get(args.proxy_env)
        if not value: raise SystemExit('Approved proxy environment variable is missing; do not substitute another proxy')
        scheme=urllib.parse.urlsplit(value).scheme.lower()
        if scheme not in ('http','https','socks5','socks5h'): raise SystemExit('Proxy protocol is not supported by this diagnostic')
        proxy=True;http_proxy=scheme in ('http','https')
        env.update(HTTPS_PROXY=value,https_proxy=value,HTTP_PROXY=value,http_proxy=value,NO_PROXY='',no_proxy='')
    node=[args.node]+(['--use-env-proxy'] if proxy else [])
    if shutil.which(args.node) and http_proxy:
        cases.append(('node-fetch',node+[str(root/'source-node.mjs'),'fetch',args.dist]))
        if (pathlib.Path(args.dist)/'sources/searchfloor/client.js').is_file():
            cases.append(('node-app',node+[str(root/'source-node.mjs'),'app',args.dist]))
            if not proxy: cases.append(('offline-mock403',[args.node,str(root/'source-node.mjs'),'mock403',args.dist]))
    if http_proxy: cases.append(('python-urllib',[os.sys.executable,str(root/'source-python.py'),'urllib-proxy' if proxy else 'urllib']))
    if shutil.which('curl'):
        cases.append(('curl-h1',[os.sys.executable,str(root/'source-python.py'),'curl-h1-proxy' if proxy else 'curl-h1']))
        version=subprocess.run(['curl','--version'],capture_output=True,text=True).stdout
        if 'HTTP2' in version: cases.append(('curl-h2',[os.sys.executable,str(root/'source-python.py'),'curl-h2-proxy' if proxy else 'curl-h2']))
    if args.browser and proxy: raise SystemExit('Proxy browser testing is not part of this approved matrix')
    if args.browser and shutil.which(args.node):
        cases.append(('browser',[args.node,str(root/'source-browser.mjs'),args.browser]))
    with out.open('x',encoding='utf8') as evidence:
        for label,cmd in cases:
            row={'experiment':label,'proxyUsed':proxy,'started':datetime.datetime.now(datetime.timezone.utc).isoformat()}
            try:
                # No credentials passed. Probe subprocess output is sanitized JSON only.
                cp=subprocess.run(cmd,capture_output=True,text=True,timeout=35,env=env)
                row.update(exitCode=cp.returncode,result=json.loads(cp.stdout))
            except Exception as e: row['failure']=type(e).__name__
            evidence.write(json.dumps(row)+'\n');evidence.flush();os.fsync(evidence.fileno())
            print(json.dumps(row),flush=True)
            result=row.get('result',{})
            if result.get('status')==429 or any(r.get('status')==429 for r in result.get('responses',[])):
                print('Stopped matrix on upstream429; honor Retry-After before any future source request.',flush=True)
                break
            time.sleep(1.1)
    return out

if __name__=='__main__': main()
