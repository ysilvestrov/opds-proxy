"""Read-only, bounded verification. Never installs, starts or changes a service."""
import argparse
import base64
import json
import os
from pathlib import Path
import re
import signal
import stat
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET


class VerificationError(Exception):
    pass


def emit(row):
    print(json.dumps(row), flush=True)


def parse_systemd_env(text):
    """EnvironmentFile values: no shell evaluation/interpolation of secrets."""
    if '\0' in text or '\ufeff' in text: raise VerificationError('Invalid OPDS env encoding')
    config = {}
    position = 0
    while position < len(text):
        end = text.find('\n', position)
        if end < 0: end = len(text)
        line = text[position:end].lstrip(' \t\r')
        if not line or line.startswith(('#', ';')) or '=' not in line:
            position = end + 1
            continue
        equal = text.index('=', position, end)
        key = text[position:equal].strip(' \t\r')
        position = equal + 1
        while position < len(text) and text[position] in ' \t\r': position += 1
        quote = text[position] if position < len(text) and text[position] in "'\"" else None
        if quote: position += 1
        chars = []  # (character, protected against exterior whitespace trimming)
        while position < len(text):
            char = text[position]
            position += 1
            if quote:
                if char == quote:
                    quote = None
                    continue
                if char == '\\' and quote == '"' and position < len(text):
                    following = text[position]
                    if following in '\\"`$\n':
                        position += 1
                        if following != '\n': chars.append((following, True))
                        continue
                chars.append((char, True))
            else:
                if char == '\n': break
                if char == '\\' and position < len(text):
                    following = text[position]
                    position += 1
                    if following != '\n': chars.append((following, True))
                else: chars.append((char, False))
        if quote: raise VerificationError('Unclosed OPDS env quote')
        while chars and not chars[-1][1] and chars[-1][0] in ' \t\r': chars.pop()
        if re.fullmatch(r'[A-Za-z_][A-Za-z_0-9]*', key):
            config[key] = ''.join(char for char, _ in chars)
    return config


def load_private_config(path=Path('/etc/searchfloor-opds/prototype.env')):
    info = path.lstat()
    if not stat.S_ISREG(info.st_mode) or info.st_uid != 0 or stat.S_IMODE(info.st_mode) != 0o600:
        raise VerificationError('Unsafe OPDS configuration permissions')
    return parse_systemd_env(path.read_bytes().decode('utf8'))


def request(url, authorization):
    class NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, *args): return None
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect())
    headers = {'Accept': 'application/atom+xml,application/json,application/opensearchdescription+xml'}
    if authorization: headers['Authorization'] = authorization
    # Total deadline, rather than just a per-socket timeout. CLI is Linux/root only.
    previous = signal.signal(signal.SIGALRM, lambda *_: (_ for _ in ()).throw(VerificationError('HTTP deadline')))
    signal.setitimer(signal.ITIMER_REAL, 15)
    try:
        try: response = opener.open(urllib.request.Request(url, headers=headers), timeout=15)
        except urllib.error.HTTPError as error: response = error
        with response:
            body = response.read(2 * 1024 * 1024 + 1)
            if len(body) > 2 * 1024 * 1024: raise VerificationError('HTTP body limit')
            return response.status, {k.lower(): v for k, v in response.headers.items()}, body
    finally:
        signal.setitimer(signal.ITIMER_REAL, 0)
        signal.signal(signal.SIGALRM, previous)


def request_curl(url, authorization, *, timeout=15, limit=2*1024*1024,
                 accept='application/atom+xml,application/json,application/opensearchdescription+xml'):
    """Explicit genuine curl transport for operator checks, never a 403 fallback."""
    config='header = "Authorization: '+authorization+'"\n' if authorization else ''
    args=['/usr/bin/curl','--disable','--noproxy','*','--silent','--show-error',
          '--max-time',str(timeout),'--max-filesize',str(limit),'--include',
          '--header','Accept: '+accept,'--config','-','--url',url]
    try:
        result=subprocess.run(args,input=config.encode(),capture_output=True,
                              env={'PATH':'/usr/bin:/bin'},timeout=timeout+1)
        if result.returncode:raise VerificationError('HTTP transport failed')
        header,body=result.stdout.split(b'\r\n\r\n',1)
        while 100<=int(header.split()[1])<200:
            header,body=body.split(b'\r\n\r\n',1)
        if len(header)>65536 or len(body)>limit:raise VerificationError('HTTP body limit')
        lines=header.decode('latin1').splitlines()
        headers={key.lower():value.strip() for line in lines[1:] if ':' in line for key,value in [line.split(':',1)]}
        return int(lines[0].split()[1]),headers,body
    except Exception:
        raise VerificationError('HTTP transport failed') from None


def verify(config, expected_sha, *, live=False, fetch=request):
    if not re.fullmatch(r'[0-9a-f]{40}', expected_sha): raise VerificationError('Invalid expected SHA')
    base = config['PUBLIC_BASE_URL'].rstrip('/')
    parsed = urllib.parse.urlsplit(base)
    if parsed.scheme != 'https' or not parsed.netloc or parsed.username or parsed.password or parsed.query or parsed.fragment:
        raise VerificationError('Invalid PUBLIC_BASE_URL')
    port = int(config.get('PORT', '8787'))
    if not 1 <= port <= 65535: raise VerificationError('Invalid PORT')
    credentials = config['OPDS_USERNAME'] + ':' + config['OPDS_PASSWORD']
    auth = 'Basic ' + base64.b64encode(credentials.encode()).decode()
    local = f'http://127.0.0.1:{port}'
    def check(origin, path, kind, *, authenticated=True):
        label = 'local' if origin == local else 'https'
        row = {'origin': label, 'path': path.split('?')[0], 'check': kind}
        try: status, headers, body = fetch(origin + path, auth if authenticated else None)
        except Exception:
            emit(dict(row, failure='transport'))
            raise VerificationError('HTTP transport failed') from None
        row.update(status=status, bytes=len(body))
        mime = headers.get('content-type', '').split(';')[0].strip().lower()
        valid = False
        xml = None
        if kind == 'health':
            try:
                data = json.loads(body)
                valid = status == 200 and mime == 'application/json' and data.get('ready') is True and data.get('sha') == expected_sha
            except (ValueError, AttributeError): pass
        elif kind == 'basic':
            valid = status == 401 and headers.get('www-authenticate', '').lower().startswith('basic ')
        else:
            expected_mime, tag = ('application/opensearchdescription+xml', '{http://a9.com/-/spec/opensearch/1.1/}OpenSearchDescription') if kind == 'opensearch' else ('application/atom+xml', '{http://www.w3.org/2005/Atom}feed')
            if status == 200 and mime == expected_mime and b'<!DOCTYPE' not in body.upper() and b'<!ENTITY' not in body.upper():
                try:
                    xml = ET.fromstring(body)
                    valid = xml.tag == tag
                except ET.ParseError: pass
        emit(dict(row, valid=valid))
        if not valid: raise VerificationError('Prototype check failed')
        return xml
    check(local, '/health', 'health', authenticated=False)
    for origin in (local, base):
        for path in ('/opds', '/opds/searchfloor', '/opds/searchfloor/completed', '/opds/searchfloor/search?q=test', '/opds/searchfloor/books/1/download.fb2.zip', '/opds/searchfloor/opensearch.xml'):
            check(origin, path, 'basic', authenticated=False)
        check(origin, '/opds', 'feed')
        check(origin, '/opds/searchfloor', 'feed')
        check(origin, '/opds/searchfloor/opensearch.xml', 'opensearch')
    if live:
        feed = check(base, '/opds/searchfloor/completed?page=1', 'feed')
        check(base, '/opds/searchfloor/search?q=test&page=1', 'feed')
        for link in feed.findall('{http://www.w3.org/2005/Atom}link'):
            if link.get('rel') != 'next': continue
            target = urllib.parse.urlsplit(link.get('href', ''))
            query = urllib.parse.parse_qs(target.query)
            expected_path = parsed.path + '/opds/searchfloor/completed'
            page = query.get('page', [''])[0]
            if target.scheme != parsed.scheme or target.netloc != parsed.netloc or target.path != expected_path or target.fragment or set(query) != {'page'} or not page.isdecimal() or not 2 <= int(page) <= 10000:
                raise VerificationError('Invalid next link')
            check(base, '/opds/searchfloor/completed?page=' + page, 'feed')
            break


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--expect-sha', required=True)
    parser.add_argument('--live', action='store_true')
    parser.add_argument('--transport', choices=['urllib','curl'], default='urllib')
    args = parser.parse_args()
    try:
        if not hasattr(os, 'geteuid') or os.geteuid() != 0: raise VerificationError('Root is required for private OPDS config')
        installed = json.loads(Path('/opt/searchfloor-opds/prototype/current/release.json').read_text(encoding='utf8'))
        if installed.get('sha') != args.expect_sha: raise VerificationError('Installed SHA mismatch')
        verify(load_private_config(), args.expect_sha, live=args.live,
               fetch=request_curl if args.transport=='curl' else request)
        return 0
    except Exception:
        emit({'check': 'summary', 'valid': False, 'failure': 'verification'})
        return 1


if __name__ == '__main__': sys.exit(main())
