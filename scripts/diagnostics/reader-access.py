"""Read-only journal sanitizer and coordinated operator observation; no capture."""
import datetime
import importlib.util
import json
import math
import os
from pathlib import Path
import re
import select
import subprocess
import sys
import threading
import time

REPO = Path(__file__).resolve().parents[2]
SHA = 'f76bfac8b64a602f3d0a61df89da93b3d313297f'
UNIT = 'searchfloor-opds.service'
BOT = 'warsaw-beer-bot.service'
IDS = {'27223', '27505'}
METHODS = {'GET','HEAD','POST','PUT','PATCH','DELETE','OPTIONS','OTHER'}
ROUTES = {'root','source_root','completed','search','opensearch','authors','genres','entry','cover','download','unknown'}


def utc():
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


def emit(stage, **values):
    print(json.dumps({'stage':stage, 'utc':utc(), **values}), flush=True)


def sanitize(value, books_only=True):
    if not isinstance(value, dict) or value.get('event') != 'access':
        return None
    if any(type(value.get(key)) is not str for key in ['method','route','outcome']):
        return None
    if value.get('method') not in METHODS or value.get('route') not in ROUTES:
        return None
    if value.get('msg') != 'OPDS request' or type(value.get('level')) is not int or value['level'] != 30:
        return None
    if type(value.get('status')) is not int or not 100 <= value['status'] <= 599:
        return None
    if type(value.get('time')) is not int or not 0 < value['time'] < 4102444800000:
        return None
    duration = value.get('durationMs')
    if type(duration) not in [int,float] or not math.isfinite(duration) or not 0 <= duration <= 3600000:
        return None
    if value.get('outcome') not in ['response_created','aborted']:
        return None
    book = value.get('bookId')
    if book is not None and (not isinstance(book,str) or not re.fullmatch(r'\d{1,20}',book)):
        return None
    if value['route'] in ['entry','cover','download'] and book is None:
        return None
    if books_only and (book not in IDS or value['route'] not in ['entry','cover']):
        return None
    result = {key:value[key] for key in ['event','time','level','msg','method','route','status','durationMs','outcome']}
    result['utc'] = datetime.datetime.fromtimestamp(value['time']/1000,datetime.timezone.utc).isoformat()
    if book is not None:
        result['bookId'] = book
    return result


def extract(lines, books_only=True):
    events = []
    counters = {'rowsSeen':0,'matchedEvents':0,'invalidAccessEvents':0,'oversizedRows':0,'rateLimitNotices':0,'abortedEvents':0}
    for line in lines:
        counters['rowsSeen'] += 1
        if len(line.encode('utf8')) > 32768:
            counters['oversizedRows'] += 1
            continue
        try:
            envelope = json.loads(line)
            message = envelope.get('MESSAGE','')
            if not isinstance(message,str):
                continue
            if UNIT in message and re.search(r'Suppressed\s+\d+\s+messages',message):
                counters['rateLimitNotices'] += 1
            if envelope.get('_SYSTEMD_UNIT') != UNIT:
                continue
            value = json.loads(message)
            result = sanitize(value,books_only)
            if result is not None:
                counters['matchedEvents'] += 1
                if result['outcome'] == 'aborted':
                    counters['abortedEvents'] += 1
                if len(events) < 200:
                    events.append(result)
            elif isinstance(value,dict) and value.get('event') == 'access':
                if not books_only or (value.get('route') in ['entry','cover'] and value.get('bookId') in IDS):
                    counters['invalidAccessEvents'] += 1
        except (ValueError,TypeError,AttributeError,OverflowError):
            continue
    counters['truncated'] = counters['matchedEvents'] > 200 or counters['rowsSeen'] >= 1001
    return events,counters


def journal(start, end, books_only=True):
    args = ['journalctl','-u',UNIT,'-u','systemd-journald.service','--since','@'+str(start),
            '--until','@'+str(end),'-n','1001','-o','json','--no-pager']
    process = subprocess.Popen(args,stdin=subprocess.DEVNULL,stdout=subprocess.PIPE,stderr=subprocess.DEVNULL)
    timer = threading.Timer(10,process.kill)
    timer.start()
    oversized = 0
    def lines():
        nonlocal oversized
        while True:
            raw = process.stdout.readline(32769)
            if not raw:
                break
            if len(raw) > 32768:
                oversized += 1
                while raw and not raw.endswith(b'\n'):
                    raw = process.stdout.readline(32769)
                continue
            yield raw.decode('utf8',errors='replace')
    try:
        events,counters = extract(lines(),books_only)
        counters['journalReadOk'] = process.wait(timeout=2) == 0
        counters['oversizedRows'] += oversized
        return events,counters
    finally:
        timer.cancel()
        process.stdout.close()
        if process.poll() is None:
            process.kill()
        process.wait()


def main():
    assert not sys.argv[1:] and os.geteuid()==0 and sys.stdin.isatty()
    module_spec = importlib.util.spec_from_file_location('infra',REPO/'scripts/production-rollout.py')
    infra = importlib.util.module_from_spec(module_spec)
    module_spec.loader.exec_module(infra)
    config_path = Path('/etc/searchfloor-opds/runtime.env')
    infra.safe_file(config_path,mode=0o600)
    config = infra.verifier.load_private_config(config_path)
    def audit(label):
        units = {unit:infra.show(unit) for unit in [UNIT,BOT,'systemd-journald.service']}
        status,_,body = infra.verifier.request_curl('http://127.0.0.1:8787/health',None,limit=4096)
        health = json.loads(body)
        assert status == 200 and health == {'ready':True,'sha':SHA}
        assert all(value['ActiveState'] == 'active' for value in units.values())
        status,_,body = infra.verifier.request_curl('http://127.0.0.1:3000/health',None,limit=4096)
        assert status == 200 and json.loads(body).get('ok') is True
        emit(label,sha=SHA,units=units)
        return units
    before = audit('before')
    import base64
    authorization = 'Basic '+base64.b64encode((config['OPDS_USERNAME']+':'+config['OPDS_PASSWORD']).encode()).decode()
    started = time.time()
    for origin,base in [('local','http://127.0.0.1:8787'),('https',config['PUBLIC_BASE_URL'].rstrip('/'))]:
        for auth,expected in [(None,401),(authorization,200)]:
            status,_,_ = infra.verifier.request_curl(base+'/opds',auth)
            assert status == expected
            emit('static-auth-check',origin=origin,status=status,valid=True)
    time.sleep(1)
    records,counters = journal(started,time.time(),False)
    roots = [row for row in records if row['route'] == 'root']
    assert counters['journalReadOk'] and sum(row['status']==401 for row in roots)>=2 and sum(row['status']==200 for row in roots)>=2
    emit('access-log-auth-check',valid=True,events=roots,counters=counters)
    emit('owner-ready',instruction='When ready, press Enter; then reopen 27223 followed by 27505 in FBReader. No other probes or book downloads. Window 180s.')
    input()
    start = time.time()
    end = start+180
    deadline = time.monotonic()+180
    emit('window-start',startUTC=utc(),seconds=180,ownerActions='Protocol supplied; actual card actions require owner confirmation.')
    restart_advised = False
    restart_reported = False
    while time.monotonic() < deadline:
        time.sleep(min(30,max(0,deadline-time.monotonic())))
        records,counters = journal(start,min(time.time(),end))
        entries = sum(row['route']=='entry' for row in records)
        covers = sum(row['route']=='cover' for row in records)
        emit('window-progress',elapsedSeconds=min(180,round(180-(deadline-time.monotonic()))),entries=entries,covers=covers)
        if not entries and not restart_advised and deadline-time.monotonic() <= 120:
            restart_advised = True
            emit('owner-restart-advice',instruction='No matching entry observed yet. Restart FBReader and reopen one card once within window; type r then Enter only if you did so.')
        if select.select([sys.stdin],[],[],0)[0]:
            action = sys.stdin.readline().strip()
            if action == 'r' and not restart_reported:
                restart_reported = True
                emit('owner-restart-reported',action='Owner reported restart and one card reopen.')
    emit('window-end',endUTC=datetime.datetime.fromtimestamp(end,datetime.timezone.utc).isoformat(),restartReported=restart_reported)
    records,counters = journal(start,end)
    after = audit('after')
    stable = all(before[unit][key]==after[unit][key] for unit in before for key in ['MainPID','NRestarts','ActiveState'])
    reliable = stable and counters['journalReadOk'] and not any(counters[key] for key in ['truncated','invalidAccessEvents','oversizedRows','rateLimitNotices','abortedEvents'])
    for row in records:
        emit('reader-access',**row)
    entry_observed = any(row['route']=='entry' for row in records)
    emit('observation-summary',reliable=reliable,entryObserved=entry_observed,inconclusive=not reliable or not entry_observed,
         counters=counters,stableProcesses=stable,phoneAttribution='Controlled owner-only window; no client identity logged.',bodyDeliveryProven=False)


if __name__ == '__main__':
    try:
        main()
    except BaseException as error:
        emit('observation-failed',valid=False,failure=type(error).__name__,inconclusive=True)
        raise SystemExit(1) from None
