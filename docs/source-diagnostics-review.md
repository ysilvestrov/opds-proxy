# Desktop review of source-diagnostics handoff

Reviewed 2026-10-05. Requirements: SOURCE-002, AUTH-001, ARCH-001, ACCEPT-001,
COST-001. No application behavior or Cloudflare/server configuration changed.

## Evidence and scope

Archive SHA256: `c341ce1d2251eedf013dbc80f5a9762b2c01ff6530c3c7fcdd68559dbb1e3cb5`.
All 13 manifest file hashes match. The bundled report is byte-for-byte identical
to the separately submitted `prototype-report (1).md`. This verifies internal
integrity; the companion checksum was not supplied for an independent comparison.
The canonical report is now `prototype-report.md`.

One upstream GET at 2026-10-05 09:08:00.785 UTC returned HTTP 403,
`CF-Mitigated: challenge`, CF-Ray `a45b47809a219ea9-CDG`.
This confirms an upstream challenge, not its exact rule or a permanent access ban.
The operator report records no restart, credentials read, book download or
Cloudflare configuration operation. Bot remained healthy; prototype/production/
timer were inactive. These are operator evidence, not fresh desktop live checks.

## Helper findings and integration gate

Returned helper: `deploy/start-prototype.sh`, SHA256
`c78b12caf4cc1ad4537da9102ad2ccd01bb135ef0c9c2dd03abb68324105dc69`.
It installs the pinned Linux artifact and stops the manually started prototype
on HTTP failure. It is not a resume tool: an existing code/current installation
is deliberately rejected. Do not run --apply again on the existing installation.

Its embedded HTTP verifier prints results only after every assertion succeeds.
A live-feed 503 therefore loses earlier successful checks. The returned tests
cover help/collisions, not this failure. Before reuse, require regression coverage
for partial evidence and save sanitized results incrementally, including failure.
Preserve credential secrecy and stop-on-failure behavior. Tests were read, not
executed here; no Linux/systemd installation validation is claimed by this review.

The patch is based on `66f6d4785bc1341b84f6c6cb86eac365b3d5d9a1` and predates
local documentation updates. It was not applied. Helper/tests/README are retained
in the original supplied archive for selective integration after their fixes and
review. Root installation must use the final reviewed files.

## Next steps

1. Owner declined contacting Searchfloor. Request stays an unsent draft.
   One desktop comparative GET at 09:26 UTC returned 200 without challenge markers
   within 16 KiB. Owner rejected PC-dependent deployment; ARCH-001 requires a
   server-only solution. Evaluate the bounded browser probe in
   `codex-cli-server-browser-feasibility.md`; parsing/Download still need validation.
2. Independently fix helper evidence and prepare existing-installation validation,
   with fixture/mock tests. Update spec/plan with any changed behavior.
3. When access is available, resume bounded catalog/search checks, record actual
   HTTP results and resource measurements, then run FBReader 3.8.31 acceptance.

Our inbound tunnel/WAF cannot change Searchfloor protection. SOURCE-002 remains
in effect. Production activation and timer enablement remain gated by ACCEPT-001.
