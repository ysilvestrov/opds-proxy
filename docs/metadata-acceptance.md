# META-01 acceptance — deployed, device check failed

Spec: OPDS-005/SOURCE-004/CACHE-003, AUTH-001, SOURCE-001/002/003,
CACHE-001/002, ARCH-001, ACCEPT-001. Local implementation is in
PR6/main a553346; production HTTPS health reports that SHA and ready=true,
new routes return401 without Basic. Owner device check failed2026-10-06:
slow cards, partial annotations, no covers in10 cards. Screenshots for27223
and27505 show stale warning. See docs/metadata-diagnostics-handoff.md;
Original source failure remains unconfirmed. Server probe on2026-10-06 passed
for27223/27505; owner follow-up confirms fast cards and annotations, but covers
still absent. Actual reader cover request/status is unknown. META-01 is not
accepted. See docs/metadata-server-diagnostics.md and the next bounded check
in docs/reader-cover-observation-handoff.md.

## Server Claude brief

Work from the reviewed merged Git revision, not transferred archives. Existing
production timer installs green-main exact-SHA app artifacts. Do not reinstall
bootstrap, change units/credentials/Cloudflare, touch bot secrets or run npm
build on production. Record current OPDS release and bot PID/NRestarts first.
Wait for deployment state settled at expected SHA; health alone is insufficient.
If that does not happen, diagnose existing timer/artifact mechanism without
claiming deployment. Never print environment contents, auth or proxy details.

From a private root terminal, run this single bounded source probe after the
active release contains the new methods. Node reads existing OPDS-only secrets
from the root env; argv contains only its filename, never credentials.

```bash
sudo /usr/bin/node --env-file=/etc/searchfloor-opds/runtime.env --input-type=module <<'NODE'
import {createSourceTransport} from '/opt/searchfloor-opds/current/dist/sources/transport.js';
import {SearchfloorClient} from '/opt/searchfloor-opds/current/dist/sources/searchfloor/client.js';
const transport=createSourceTransport(process.env.OPDS_SOURCE_PROXY_URL);
const client=new SearchfloorClient({fetch:transport.fetch});
try {
  if(!process.env.OPDS_SOURCE_PROXY_URL) throw Error('Proxy required');
  const book=await client.getBook('27047');
  if(!book?.complete) throw Error('Book unavailable');
  const annotation=await client.getAnnotation('27047');
  const cover=await client.getCover('27047');
  console.log(JSON.stringify({event:'metadata_probe',ok:true,id:'27047',annotationBytes:annotation?Buffer.byteLength(annotation):0,coverBytes:cover?.bytes.length??0,coverMime:cover?.mime??null}));
} catch {
  console.log(JSON.stringify({event:'metadata_probe',ok:false}));process.exitCode=1;
} finally {client.close();await transport.close();}
NODE
```

Fixed source URLs: `https://searchfloor.org/b/27047`,
`https://searchfloor.org/api/annotation/27047`, `https://searchfloor.org/cover/27047`.
At most three logical calls plus existing bounded retry/redirect policy;
no challenge workaround, book download, crawl or raw content output.
Absence is recorded honestly; one ID does not prove every book has optional fields.

Then use existing private HTTP verification tooling to check local8787 and
`https://opds.ysilvestrov-ai.uk`:

- `/health` active SHA, Basic401 on full entry and cover without auth.
- `/opds/searchfloor/books/27047` with privately loaded Basic: standalone
  Atom MIME, same urn, escaped summary/content, private cover/acquisition links.
- `/opds/searchfloor/books/27047/cover`: actual image MIME/signature, <=2MiB,
  nosniff/private cache headers. Retain counts/status only, not image/content.
- Repeat the same card once: optional resources should be served from cache.
  Record cache DB+WAL footprint and RSS; compare shared/sub-user dashboard
  usage if available, never equate payload bytes to provider billing.
- Bot PID/NRestarts unchanged; OPDS manual deployment restart is expected.

Return sanitized receipts and active SHA through Git. If deployment breaks
baseline, use the existing reviewed rollback mechanism and record the actual
result. Cache schema1 remains compatible with the previous runtime; artwork
membership is auxiliary and recoverable, with orphan cleanup after legacy eviction.
No readiness/liveness probe performs live source fetching.

## Owner device check

Target FBReader Android3.8.31, existing URL/login/password:
1. Open completed list and select a book. Verify full annotation and cover appear.
2. Reopen the same card. Record missing fields, auth prompts or unexpected delay.
3. Check Download still works. Download completion checks remain15min independent
   of detail TTL24h; no claim of file opening unless separately observed.
4. Check a known book without annotation/cover if one is available. Otherwise use
   a local protected mock fixture, not a public production test endpoint.

If reader ignores Atom alternate or fails to authenticate artwork, keep META-01
pending and return evidence to design. Do not weaken auth, expose images publicly,
or fetch every book card eagerly. Search/next/interruption gates are separate;
mark them passed only if actually tested.

## Results

- Local after review fixes: Node build/typecheck and91 tests passed,2 skipped;
  Python57 offline tests passed. Review Important schema mismatch and Minor
  cover-first inline synopsis loss reproduced RED and fixed GREEN. Schema1
  original writes/read interoperate with the extended artwork bookkeeping.
- Linux CI/native artifact: passed for main a553346, run37461983210.
- Actual deployed SHA/server source+private HTTP checks: passed2026-10-06
  for27223/27505;20 sanitized rows in docs/metadata-server-diagnostics.jsonl.
  OPDS and bot PIDs/restart counts unchanged. Not a controlled cold/warm test.
- Device follow-up: cards fast, annotation present, cover still absent (FAILED).
  Actual reader image request/status, optional absence/repeat/Download remain
  unverified for META-01; baseline Download acceptance is separate.
