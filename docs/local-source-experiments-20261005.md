# Local source experiments — 2026-10-05

Approved by owner: reproduce locally first, including WSL; if not resolved,
prepare an executable experiment program for server Claude. No PC dependency
is introduced into the service. Requirements: ARCH-001, SOURCE-002, ACCEPT-001.

## Results

All live cases used the current PC network. WSL does not reproduce the VPS
network or Cloudflare policy decision. Exact client headers were used for HTTP
cases; Chrome used its genuine default headers. No cookies, retries, proxy,
stealth, challenge solving, books or raw HTML persisted.

| UTC time | Experiment | Result |
|---|---|---|
| 10:39:09 | Windows Node 24.19.0, actual SearchfloorClient | 200; parser: 20 books, next=2; CF-Ray a45bcd0019494d31-FRA |
| 10:39:15 | WSL Linux Python 3.14.4 urllib | 200; 151535 bytes, 20 cards; CF-Ray a45bcd28b81237ef-FRA |
| 10:39:19 | WSL curl 8.18.0, HTTP/1.1 | 200; 151535 bytes, 20 cards; CF-Ray a45bcd3fbec91da6-FRA |
| 10:39:22 | Same WSL curl, HTTP/2 | 200; 151535 bytes, 20 cards; CF-Ray a45bcd545ad5900f-FRA |
| 10:41:28 | WSL Linux Node 24.19.0, actual SearchfloorClient | 200; parser: 20 books, next=2; CF-Ray a45bd071bde8f47f-FRA |
| 10:41:35 | Windows headless Chrome 154.0.8037.92 | 200; 20 cards/20 Download links, 18 requests including resources; CF-Ray a45bd092ec394d85-FRA |

Every live case: cf-mitigated absent, no observed challenge title. Chrome's
fresh task-owned profile was removed. Its first run reported a 16 KiB inspection
field; that field was subsequently removed because it did not accurately express
DOM inspection. DOM counts/title were inspected; no HTML was saved or printed.
No Linux browser was installed/available; native Linux browser feasibility remains
for the server. Testing more local browsers sharing the same working network would
not reproduce the missing VPS condition.

WSL initially required sandbox escalation (E_ACCESSDENIED), then worked normally.
Linux Node was downloaded from the official v24.19.0 distribution into ignored
project scratch space, not installed system-wide. Archive SHA256 verified against
official SHASUMS256.txt:
`14b342e71204f811bde6153be8e04b62aef63c236fef92b55f9c83154b409647`.
Windows/native Linux Node versions now match the server's reported version.

## Offline reproduction and validation

Injected a synthetic upstream 403 / cf-mitigated=challenge into the actual client:
SourceError status503, one transport call. In-memory API reproduction confirmed
health200, authenticated navigation root200, completed feed503, one upstream call.
Thus the failure path is locally reproducible; the real upstream denial is not.
The application correctly maps upstream denial to source-unavailable, not an empty
catalog. This does not restore real source access on the VPS.

Existing client fixture/mock tests: **10 passed**. First sandbox attempt failed
at Vite realpath EPERM before any tests; rerun outside sandbox passed. JS syntax
checks and Python compilation/help passed. Offline runner smoke persisted all
four cases including an intermediate timeout and later results. The full runner
has not yet been run against the VPS; individual live probes were run locally.

## Conclusion and handoff

No evidence for a parser bug or intrinsic Node/Linux incompatibility. The remaining
variable includes VPS network/source-side policy and time-dependent behavior.
Neither IP blocking nor a specific WAF rule is established. A local browser200
cannot justify installing a production browser adapter on the VPS.

Run `docs/claude-server-source-experiments.md` on the actual VPS. Diagnostic tools
are committed in `scripts/diagnostics/`; the server writes incremental sanitized
JSONL and commits/pushes evidence through Git. No more archive/file relay is needed.
A successful outcome must include bounded actual source checks and prototype
acceptance evidence, not merely another 200 from a different client.

Owner steering after local experiments: a server/datacenter range might be denied;
test the existing bot proxy as a controlled network-variable comparison. No proxy
settings are available locally, so that experiment belongs to actual server Claude.
The runner supports a private --proxy-env variable and never prints its value.
Direct/proxy matrices are distinct; production integration remains unimplemented.
