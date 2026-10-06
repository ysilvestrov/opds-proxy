# META-01 server diagnostics — operator results

Status: bounded production probe passed; original intermittent failure did not
reproduce. No application/config/deployment changes. Historical preparation
below is followed by actual measurements and the precise remaining unknown.
Handoff branch codex/metadata-diagnostics at a5fb02116666940b2fd17c03b669dbfbda3b95fa.
Evidence branch: codex/metadata-server-evidence. Requirements OPDS-005,
SOURCE-004/CACHE-003, SOURCE-002/003, AUTH-001, ARCH-001, ACCEPT-001.

Read-only host checks confirmed expected production a55334694d3eff8fcac6a489d965c5fe3de05ab3,
ready=true, PID3711018/NRestarts0/active; bot PID2320493/NRestarts0/active.
The reported30s serial optional-resource timeout mechanism is only a hypothesis
for production. No authenticated metadata/source probe has been run by agent.

Outside-sandbox sudo -n returned "a password is required". Root-only OPDS env
cannot be passed to the installed adapter probe without operator sudo. No env,
credentials, raw errors or image/content were read or copied. No production
config/unit/cache reset/deployment/parallel source experiments performed.

Prepared `deploy/run-metadata-diagnostics.sh` extracts the exact reviewed probe
via git show, imports actual installed release modules, and captures JSONL in a
fresh mode0700 workspace directory. It audits active SHA and OPDS/bot PID/restarts
before/after. Existing probe limits two IDs/global240s; root timeout250s plus5s
kill bounds cleanup. Private stderr is retained outside Git, never printed.
No phone experiments should run concurrently. Ordinary authenticated reads may
fill disposable metadata cache, as expressly allowed by handoff.

Operator command:

```bash
bash /home/ysi/opds/production-rollout/deploy/run-metadata-diagnostics.sh
```

After execution, inspect shared JSONL and return sanitized receipts as
docs/metadata-server-diagnostics.jsonl. Separate headers/resource/private-route
timings will identify the failing boundary before any proposed application fix.
Device image acceptance remains unverified. Wrapper shell syntax/help and
reviewed probe JavaScript syntax were checked; no live success claimed.

## Actual run, 2026-10-06 13:02:58–13:03:14 UTC

Operator executed once. Sanitized receipt: `metadata-server-diagnostics.jsonl`
(20 rows, before/probe/after combined in order). Private stderr was empty;
not copied into Git. Probe used modules of installed a553346 and independent
production proxy. No direct fallback, token/provider change, image/content
persistence, book download, cache reset or service restart.

| ID | Resource | HTTP/MIME | Whole stage ms | Headers ms | Bytes |
|---|---|---|---:|---:|---:|
|27223|card|200 text/html|1072|979|not emitted|
|27223|annotation|200 text/plain|181|172|550|
|27223|cover|200 image/jpeg|9806|185|70852|
|27505|card|200 text/html|206|182|not emitted|
|27505|annotation|200 text/plain|970|172|764|
|27505|cover|200 image/jpeg|1143|244|29334|

Both cards complete, API annotation hint present, no inline annotation.
Both annotations and covers nonempty and accepted by installed adapter's
current MIME/signature/UTF-8/cap validation. No denial/407/429/5xx, redirect,
invalid artwork or15s timeout occurred in this sample. No provider-dashboard
quota claim is inferred from a successful request or payload bytes.

| ID | Private stage | Status/MIME | ms | Bytes | Summary / image links / stale |
|---|---|---|---:|---:|---|
|27223|loopback entry|200 Atom|1101|2402|yes /2 /false|
|27223|HTTPS entry|200 Atom|137|2402|yes /2 /false|
|27223|HTTPS cover|200 JPEG|116|70852|not applicable|
|27505|loopback entry|200 Atom|211|2859|yes /2 /false|
|27505|HTTPS entry|200 Atom|59|2859|yes /2 /false|
|27505|HTTPS cover|200 JPEG|44|29334|not applicable|

HTTPS matched local Atom byte counts and fields. Authenticated image routes
worked using the separate configured OPDS pair; this is not evidence that
FBReader actually fetched an image or forwarded Basic for it. Cache state
before the run was not inspected: do not call these a controlled cold/warm
comparison. Direct adapter measurements use a separate client; private route
reads may fill ordinary disposable production metadata cache.

Before/after SHA a55334694d3eff8fcac6a489d965c5fe3de05ab3 unchanged;
OPDS PID3711018/NRestarts0/active, bot PID2320493/NRestarts0/active unchanged.
Total audit window15.626s, within240s. These rows establish actual successful
measurements, not full META-01 reader acceptance.

## Diagnosis and limits

Observed slow boundary: source cover27223 completed in9.806s although its
response headers arrived in185ms. The difference includes source spacing,
body consumption and validation; headers timing excludes preceding queue/
spacing. This points to substantial post-header time, but is not an isolated
body-duration measurement or proof of previous timeouts. Cover27505 was fast.
None of the measured local/public entry requests reproduced several-dozen-second
latency, lost summary, lost image links or stale warning.

Verified mechanism from `src/catalog.ts:185`–203: annotation and cover are
awaited serially; each optional exception is swallowed and sets stale=true.
The exception status/code is not retained at that boundary. Thus the owner's
earlier stale screenshots establish an optional-resource error, not genuine
absence or solely an image-rendering issue. `SearchfloorClient` retains15s
per-operation deadlines and serial concurrency1; the handoff's local stalled
fixture proves a roughly30s two-timeout mechanism. Production timing here
does not establish that either earlier exception was a timeout.

**Precise remaining unknown:** the original annotation/cover exception and
source HTTP/body state were not captured at the time of the phone failure;
this run succeeded. A transport timeout is plausible, not confirmed. Persistent
server-route/MIME/resource-absence problems are not reproduced. A phone-specific
image fetch/auth/parsing issue is also not established because no actual reader
image request was observed. It would be incorrect to identify proxy quota,
Cloudflare denial, invalid MIME or FBReader as the root cause from this receipt.

Next bounded check: owner reopens these same two cards in FBReader and reports
annotation/cover/latency, without book downloads or more-ID crawl. If missing
images persist with the server-success evidence, next measure actual reader
image-route accesses/statuses; a manually authenticated200 cannot replace it.
If stale/latency recurs, capture per-resource fixed error/status/timings during
that event. Existing Catalog swallowing prevents historical recovery of the
specific exception. No repeat source probe is needed now; no failed cold
request/cooldown was observed.

A bounded prospective fix, only after identifying that failing boundary, is
sanitized optional-resource diagnostics (fixed resource/error/status/timing,
no annotation/bytes/URLs/auth) with a local stalled/denied-response regression.
Any latency fix must preserve SOURCE-002 serial concurrency/limits or first
review a spec change. No timeout increase, parallel fetching, direct fallback,
auth weakening or speculative production patch was applied.

Results returned on `codex/metadata-server-evidence`. Root source/reader cause
remains explicitly unconfirmed; production service health is not confused with
metadata feature acceptance. Probe already removed its extracted temporary
script. Sanitized receipts retained; no raw native errors/images/content/secrets
committed. Result worktree/branch remain unmerged and are preserved.
