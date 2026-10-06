# Server Claude — META-01 failure diagnostics

Read root spec.md first: OPDS-005/SOURCE-004/CACHE-003, SOURCE-002/003,
AUTH-001, ARCH-001, ACCEPT-001. This is a read-only diagnostic continuation,
not permission to change production behavior. Expected active release: main
a55334694d3eff8fcac6a489d965c5fe3de05ab3 (PR6).

## Owner evidence and local comparison

FBReader Android3.8.31: card opening takes several dozen seconds;
no cover in10 tested cards. Screenshots show our `stale` marker in both:
-27223, «Без страха и упрека – 5»: real annotation appears, no cover.
-27505, «Вам Песец!»: only stale warning, no annotation or cover.

This confirms full-entry navigation for those cards, but not cover HTTP/auth.
The renderer emits stale when Catalog swallows an optional source error.
Source failure type/status is currently lost at that boundary; do not infer
absence from the UI or assume FBReader failed to parse an image link.

Bounded PC direct probes2026-10-06 using actual current adapter:

| ID | Card | Annotation | Cover |
|---|---|---|---|
|27223|200, completed, API hint;133ms|550B;926ms|JPEG70852B;1056ms|
|27505|200, completed, API hint;955ms|764B;1001ms|JPEG29334B;1051ms|

Times include source1s request spacing. Bodies pass current MIME/signature/size
validation. No book downloads or content persisted. These results establish
that both resources exist locally, not that production proxy can fetch them.

Code evidence: details awaits annotation then cover. Each optional operation
has15s source timeout; two failures can hold a card for about30s, then emit
stale with omitted fields. Production timeouts are a hypothesis until measured.
Local stalled-response reproduction took30031ms, second request started15017ms
after the first; result stale=true, summary=false, cover=false. No live traffic
in this reproduction. This confirms the mechanism, not the production cause.

## Run once on server, without deployment or file shuttling

Fetch `codex/metadata-diagnostics` from the existing repository. Do not reset
an existing dirty server checkout or rerun bootstrap. Use `git show` to extract
the probe; it imports modules from the actual installed release, not this branch.
Replace the repository working directory below with the known operator checkout:

```bash
git fetch origin codex/metadata-diagnostics
umask 077
git show FETCH_HEAD:scripts/diagnostics/metadata.mjs > /tmp/searchfloor-metadata-diagnostics.mjs
sudo /usr/bin/node --env-file=/etc/searchfloor-opds/runtime.env /tmp/searchfloor-metadata-diagnostics.mjs
```

Capture the JSONL privately, inspect before adding sanitized receipts to Git.
Only two fixed IDs, max4min total budget. Do not run concurrently with further
phone experiments. Env contains only independent OPDS credentials; never print
env/proxy URL/userinfo/Basic headers. No bot env, WebShare management API key,
rotation, direct fallback, cookies, browser challenge solving, config/unit edits,
book downloads, cache reset or mass crawl. This probe does not change services;
ordinary authenticated card reads may fill the existing disposable cache.

It reports for each ID:
- Actual source response status/MIME/time-to-headers, before parser interpretation.
- Separate card/annotation/cover duration, successful byte count/MIME or a fixed
  failure code; no response contents or arbitrary exception messages.
- Loopback private Atom response, then HTTPS Atom response, then HTTPS cover:
  status/MIME/bytes/duration; summary presence, image-link count, stale flag.
- The private pair is read in memory from root-only OPDS env; never in argv/Git.

The probe's per-resource client retains existing caps/retry/cooldown/proxy policy.
Private requests use manual redirects,2MiB read cap and65s deadline bounded by
the global4min signal. Any emitted `ok:true` describes a completed measurement,
not feature acceptance: inspect actual status and fields.

## Interpret evidence before another change

1. Source headers never arrive / stage~15s -> transport/connect/read path;
   compare headers-time vs complete-stage-time to distinguish connection vs body.
2. Source403/407/429/5xx -> denial/auth/quota/cooldown. Record the actual code;
   do not rotate or weaken auth. Check independent OPDS sub-user dashboard scope
   and quota using approved operator access, without buying/upgrading anything.
3. Source200 plus `invalid_artwork` -> MIME/signature issue. Record MIME and
   byte count, not bytes. Do not accept HTML/SVG/unknown bytes as JPEG to hide it.
4. Source resources succeed but loopback entry fails/omits image links ->
   Catalog/cache/composition. Inspect only relevant cache keys privately and
   emit state/expiry/length, never annotation/base64 or secrets; no DB writes.
5. Loopback and HTTPS Atom have image links, private HTTPS image is200 but phone
   shows none -> reader image parsing/fetch/auth. Then inspect actual image-route
   access statuses; existing app logs may not identify successful requests.
   Do not guess from HTTP401 without proving that the reader made that request.
6. Loopback fast, HTTPS slow -> tunnel/client segment; both slow -> app/source.

If a cold request fails, repeat only the same one after a documented cooldown;
do not start a matrix of speculative headers or parallel proxy traffic.
No application fix until the failing boundary is identified. Propose a bounded
fix with requirement IDs and a reproducing test; latency improvement may need
spec review because current serial source concurrency1 is an invariant.

Return results via Git: `docs/metadata-server-diagnostics.jsonl` and concise
`docs/metadata-server-diagnostics.md`, on a separate operator evidence branch.
Include active SHA, OPDS/bot PID/NRestarts read-only observations, stage timings,
root cause or precise remaining unknown. Never claim reader acceptance from
server tests; do not commit images, content, credentials or raw native errors.
