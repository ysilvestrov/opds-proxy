# Permanent access logging — server continuation

Main f76bfac8b64a602f3d0a61df89da93b3d313297f; OPDS-005, OPS-001,
AUTH-001, ARCH-001, DEPLOY-001, ACCEPT-001. Owner-approved permanent logging
supersedes the old default-off proposal. Production already reached this SHA
through the existing timer before this task's first observation. Exact-main
push workflow374905819/run37482560755 completed all4 required jobs successfully.
Artifact11421816711/opds-release-f76bfac8…, digest9b4e46b4…, unexpired.
Receipt: `access-log-rollout-preflight.json`.

Local readiness confirms main. Current baseline OPDS PID3970253/NRestarts0,
bot PID3963165/NRestarts0, both active. These are current observations, not the
earlier metadata-window PIDs. The pre-rollout-before baseline was not captured
because ordinary autodeploy had already occurred; no claim that the bot PID
was held constant across that earlier cutover. No agent unit/env/bootstrap/
runtime build or manual deploy action. Operator pre/post checks will use fresh
baseline identity and existing HTTPS.

## Journal retention/storage

Read effective journald.conf and merged drop-ins via systemd-analyze cat-config.
Only explicit allowed assignment: ForwardToSyslog=yes in the distro syslog
drop-in. Retention/size/rate settings are unset, so report documented systemd255
defaults as defaults, not explicit overrides or a runtime API measurement.
Config files predate the running journald start2026-10-01. OPDS stdout=journal,
stderr=inherit, no unit drop-ins; shown per-unit rate fields0/0 are not treated
as proof that global rate limiting is disabled. Shared journald defaults are
30s/10000 messages per-service, potentially multiplied by free-space factor.
Receipt: `access-log-journal-settings.json`.

Persistence observed:101 persistent .journal files, no runtime journal files;
allocated3505225728B (~3.26GiB), logical4269801472B; journalctl reports3.2G.
Filesystem80307429376B, free34374344704B. Default SystemMaxUse=min(10%,4GiB)
therefore4GiB; SystemKeepFree=min(15%,4GiB)=4GiB. RuntimeMaxUse is similarly
10% of its812777472B runtime filesystem, capped4GiB. MaxFiles default100;
active files may exceed count/storage limits. Individual files rotate by size
(1/8 configured use, cap depends on compact mode), and MaxFileSec defaults
one month. MaxRetentionSec0 means no time-based deletion; this is size-bounded
rolling retention, not a days-of-history guarantee. Persistent files and these
configuration/default bounds are confirmed; an exact live daemon allocation
limit is inferred, not exposed by systemctl. No change/vacuum/restart of shared
journald, bot logging or syslog. Other forwarded syslog retention is not audited.
Defaults: [systemd255 journald documentation](https://github.com/systemd/systemd/blob/v255/man/journald.conf.xml).

## Prepared operator check and coordinated window

Root is required only to load the independent OPDS runtime Basic pair privately;
sudo -n still needs operator password. No credentials requested in chat.
Prepared command:

```bash
bash /home/ysi/opds/production-rollout/deploy/observe-reader-access.sh
```

It verifies main readiness, bot health and authenticated/local/public static
401 then200 without source/book requests; reads allowlisted access events to
verify the statuses were logged. It then emits owner-ready instructions and
**waits for Enter** before starting180s. Owner alone reopens27223 then27505;
no concurrent manual probes/downloads. If no matching entry appears, it advises
one restart/reopen during the window; type r then Enter only if that action was
actually performed. Other owner card actions need confirmation after the run.

Journal JSON stays only in bounded process memory. Output includes only
validated access schema and fixed progress/audit/counter fields. Max200 returned
events; raw query capped1001 rows/32KiB per row, read subprocess has10s kill
deadline and is reaped. Truncation, oversized/invalid rows, reported suppression,
aborted events, read failure or service identity interruption mark the result
unreliable. No client identity is logged: attribution remains conditional on
the owner-only window. No entry means inconclusive, even with a healthy service.
Cover200 proves handler response creation, not full delivery or image decoding.

Six synthetic sanitizer tests passed: entry/cover401→200, unrelated records,
fake credentials/query/image/native error exclusion, malformed inputs, event
cap, suppression/oversized rows and aborted outcome. Shell syntax/help and
diff checks passed. No raw packet capture, new packages or production edits.
The following operator receipt supersedes the prepared-only status above.

## Completed operator observation — 2026-10-06

Receipt: `access-log-reader-observation.jsonl` (40 sanitized rows). Operator
executed the helper; local and HTTPS static checks returned 401 then 200.
All four corresponding root access events were found, without truncation or
suppression evidence. No credentials, headers, raw journal or payload exported.

Owner-coordinated window: 15:22:47.729247–15:25:47.729247 UTC, exactly 180s.
No operator/source probes or book download were performed by this helper during
the window. Attribution depends on the instructed owner-only window: the log
contains neither client identity nor credentials. After completion, owner
confirmed restarting FBReader, opening both cards and artwork still absent.
The helper advised one restart/reopen after 60s with no entry event, but no
`r` action was recorded (`restartReported=false`). The later explicit owner
confirmation supplies the action evidence; its exact time was not supplied.

| Book | Entry responses | Cover responses |
| --- | --- | --- |
| 27223 | 401, then 200 | 8 × 401; no 200 |
| 27505 | 401, then 200 | 10 × 401; no 200 |

First ten cover requests occurred before any entry request. At
15:24:04.127/04.249 UTC, entry 27505 received 401/200; at
15:24:07.046/07.162 UTC, entry 27223 received 401/200. Eight more cover requests
then received 401. All 22 target events have outcome=response_created;
cover-handler elapsed times were 0.166–0.478ms. No cover success, aborted event,
404/502/503, malformed event, oversized row, truncation or reported journal
rate-limit suppression appeared. Final summary: journalReadOk=true,
entryObserved=true, reliable=true, stableProcesses=true. There were 29 journal
rows in the window, of which 22 matched the allowlist.

Before/after OPDS remained on f76bfac8, PID3970253/NRestarts0; bot remained
PID3963165/NRestarts0; journald remained PID1186518/NRestarts0. All three
remained active. No production, bot, configuration, journal or timer mutation.

**Verified failure boundary:** artwork requests reached the OPDS application,
but every observed cover request failed Basic authentication. Entry requests
successfully retried the challenge, whereas no successful cover retry reached
the application during this complete window. The installed `privateAuth`
middleware returns 401 before the cover/source handler executes. Thus these
requests were rejected before source retrieval or image rendering could be
tested. They do not establish a source outage or a decoding failure.

**Remaining uncertainty:** absent, malformed and incorrect credentials all
produce the same safe 401 event. These logs cannot distinguish which happened,
whether the reader reused old credentials for artwork, or whether an
intermediary changed a header. Do not claim headers were absent. The concrete
compatibility blocker is successful Basic authentication for FBReader artwork
requests; current AUTH-001 requires private cover access and forbids credentials
in URLs. Do not make covers public or add an auth fallback as an unreviewed fix.
Return this receipt for a separately reviewed reader/auth compatibility decision;
any remedy needs a new coordinated phone test showing cover 200 and owner
confirmation that artwork is visible. Reader artwork acceptance remains open.
