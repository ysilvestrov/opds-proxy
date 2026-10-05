"""Diagnostic spike: one request, no raw HTML/cookies persisted or printed."""
import datetime, json, os, re, subprocess, sys, urllib.request, urllib.error
URL='https://searchfloor.org/?page=1&status=is_finished'
HEADERS={'User-Agent':'opds-proxy/0.1','Accept':'text/html,application/zip'}
ALLOW=('server','content-type','cf-ray','cf-mitigated','retry-after')
result={'time':datetime.datetime.now(datetime.timezone.utc).isoformat(),
        'platform':sys.platform,'mode':sys.argv[1] if len(sys.argv)>1 else 'urllib'}
try:
    proxy_mode=result['mode'].endswith('-proxy')
    result['proxyUsed']=proxy_mode
    if result['mode'].startswith('curl'):
        version=subprocess.run(['curl','--version'],capture_output=True,text=True,check=True).stdout.splitlines()[0]
        args=['curl','--silent','--noproxy','' if proxy_mode else '*','--proto','=https','--max-time','15','--max-filesize','2097152','--dump-header','-',
              '--header','User-Agent: opds-proxy/0.1','--header','Accept: text/html,application/zip']
        if result['mode'].removesuffix('-proxy')=='curl-h1': args+=['--http1.1']
        elif result['mode'].removesuffix('-proxy')=='curl-h2': args+=['--http2']
        else: raise ValueError('Unknown curl mode')
        cp=subprocess.run(args+['--url',URL],capture_output=True,timeout=18)
        result.update(client=version,exitCode=cp.returncode)
        header,body=cp.stdout.split(b'\r\n\r\n',1)
        # CONNECT/interim blocks are not the source response.
        while (b'connection established' in header.split(b'\r\n',1)[0].lower()
               or (header.startswith(b'HTTP/') and 100 <= int(header.split()[1]) < 200)):
            header,body=body.split(b'\r\n\r\n',1)
        lines=header.decode('latin1').splitlines();result['status']=int(lines[0].split()[1]);result['protocol']=lines[0].split()[0]
        headers={k.strip().lower():v.strip() for line in lines[1:] if ':' in line for k,v in [line.split(':',1)]}
    else:
        class NoRedirect(urllib.request.HTTPRedirectHandler):
            def redirect_request(self,*args): return None
        proxies={'https':os.environ['HTTPS_PROXY']} if proxy_mode else {}
        opener=urllib.request.build_opener(urllib.request.ProxyHandler(proxies),NoRedirect())
        try: response=opener.open(urllib.request.Request(URL,headers=HEADERS),timeout=15)
        except urllib.error.HTTPError as e: response=e
        with response:
            result['status']=response.status;headers={k.lower():v for k,v in response.headers.items()}
            body=response.read(2097153)
    if len(body)>2097152: raise ValueError('Body cap')
    text=body.decode('utf8',errors='replace')
    result.update(headers={k:headers.get(k) for k in ALLOW},bytes=len(body),
                  challengeTitle=bool(re.search(r'<title[^>]*>\s*(?:Just a moment|Attention Required)',text,re.I)),
                  cardCount=len(re.findall(r'''id=["']book\d+["']''',text)))
except Exception as e: result['failure']=type(e).__name__
print(json.dumps(result))
