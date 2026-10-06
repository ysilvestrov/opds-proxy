# Server Claude: observe the actual FBReader cover request

Read root spec.md first. This continues META-01 Task 5 diagnostics under
OPDS-005, AUTH-001, SOURCE-002/003, ARCH-001 and ACCEPT-001. It authorizes
bounded read-only observation, not an application fix or deployment change.

## Established evidence

Evidence branch codex/metadata-server-evidence, commit
966be1f51fa9f68f60cd839305e9c59036a1e89f, is preserved in
docs/metadata-server-diagnostics.md and .jsonl. Installed release a553346
served authenticated HTTPS Atom entries with two image links and JPEG covers
for both IDs. Owner now reports fast cards and annotations, but no covers.
META-01 remains unaccepted. Existing app logs cannot establish reader requests.
Do not repeat source probes or infer that operator-authenticated 200 proves
the phone sends credentials. Do not change Basic, renderer or listing hydration.

## Prepare one bounded observation

1. Fetch this brief from codex/metadata-diagnostics in the existing operator
   repository; preserve dirty work. Read the evidence before preparing tools.
   Record active SHA and OPDS/bot PID, restart count and active state.
2. Check for an already installed HTTP-aware passive capture tool, such as
   tshark. Observe only loopback TCP port 8787, with a hard 180-second window.
   Use HTTP reassembly and an explicit allowlist of emitted fields, never raw
   tcpdump output or a pcap file. Capture necessarily processes traffic in
   memory; Basic credentials and payloads MUST NOT appear in terminal output,
   stderr, files or Git. Do not install packages or change units/config here.
3. Prepare a small sanitizer/correlator before the live window. It may inspect
   request paths in memory, but emit only book ID 27223 or 27505, resource
   entry/cover, method from a fixed allowlist, HTTP status, UTC time and elapsed
   time. Correlate responses to requests using the decoder's request reference
   or a correctly bounded per-connection queue, including unrelated requests
   when maintaining that queue. Never attribute a response by timing alone.
   Handle reused connections, split headers, unrelated requests and 401 then
   retry; mark ambiguous/incomplete correlation explicitly. Response-header
   timing is not evidence of a fully delivered or decoded image.
4. Verify the sanitizer with local synthetic input before root execution:
   successful entry/cover, 401 then 200, unrelated request between matching
   ones, split/reassembled messages, incomplete request, and a fake Basic secret
   plus fake image/body text that must never appear in output. Bound memory and
   event count; ensure the timeout terminates capture and children. Use no real
   secrets in fixtures. Return the tested observer and a concrete root command
   through Git if an operator must run it. Do not claim prepared means executed.

If the available tool cannot safely provide this evidence, report the exact
limitation. Propose a separately reviewed minimal logging change rather than
running a raw packet capture or modifying production opportunistically.

## Coordinate with the owner, then run once

Do not start the 180-second window before the owner is ready. During the window,
only the owner performs private OPDS reads; pause manual HTTP/source probes.
Capture does not identify a phone on its own: attribution relies on this
controlled window and observed matching entry requests. Root/operator access
is needed; do not read or request bot or OPDS credentials to provide it.

Owner steps: return to the catalogue, reopen 27223 then 27505, and note whether
annotation and cover appear. Do not download a book. If the observer sees no
entry request, restart FBReader and reopen one card once within the window;
record that action. Do not clear application data, remove the catalogue or
reset production cache. If entry still comes from the phone cache, the result
cannot establish that the current entry's image links were ignored.

Stop capture at the deadline, record dropped packets/decoder limitations as
sanitized counters if available, and check SHA/PIDs/restarts again. Inspect
sanitized receipts before Git. No payloads, credentials, raw headers or packet
files may be retained. Normal reader requests can populate disposable caches.

## Interpret without guessing

- Matching entry observed, cover 401: investigate image-request authentication;
  distinguish an initial challenge followed by 200 from a final failure.
- Cover 404/502/503: investigate the corresponding app/cache/source boundary.
- Cover 200: request/status succeeds at loopback; delivery through the tunnel,
  full-body reception and reader decoding are still unproven. This alone does
  not establish a renderer defect.
- Entry observed, no cover request: report only that no matching request reached
  loopback in this window. Reader caching, link selection and failure before
  origin remain possible. It is not proof that FBReader made no network request.
- No entry observed, dropped traffic or ambiguous correlation: inconclusive;
  do not infer anything from absence. Explain the missing evidence precisely.

Return observer/fixture validation plus sanitized observation report via Git,
with timestamps, release, before/after service state, owner actions and the
next single hypothesis. No production fix until evidence identifies its target;
any behavior change requires aligned spec, reviewed plan and regression test.
