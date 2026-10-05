> Update completed: operator installed c22ac2e on 2026-10-05 at15:38UTC;
> private HTTPS acquisition links passed; owner reported “Спрацювало” after the
> FBReader retest. Download visibility blocker resolved. Prototype is active,
> ready with exact corrected SHA; production/timer remain inactive/disabled.
> Earlier operator-password blocker below is historical.

# FBReader MIME update — 2026-10-05

Owner approved the proposed specification delta and plan. OPDS-001/spec0.4.7 now
requires `application/fb2+zip` on acquisition links, retaining raw HTTP ZIP,
filename, streaming bounds and private Basic. No conversion or source change.

Application correction: `f327d649ce06dc897d3be2cef6df8da3d61707d9`.
Merged into `feat/opds-v1` via [PR2](https://github.com/ysilvestrov/opds-proxy/pull/2);
application artifact SHA **c22ac2e6edafeba1563d88363326b2bd19cbb097**.
Original dirty checkout and unrelated server work were preserved.

Synthetic renderer regression failed on old generic ZIP, passed on corrected
TypeScript source and on the verified compiled artifact. Existing renderer test
expectation updated; full tests/typecheck/build/package passed in exact feature
push CI [run37331575252](https://github.com/ysilvestrov/opds-proxy/actions/runs/37331575252),
attempt2. Attempt1 was cancelled; it is not acceptance evidence. Pull-request
CI run37331585297 also passed; no PR artifact was used. Application diff reviewed
locally against approved OPDS-001; no independent reviewer or device retest claimed.

Verified workflow374905819, exact push/branch/SHA/repository and all four jobs,
artifact11354194358/name `opds-prototype-c22ac2e6edafeba1563d88363326b2bd19cbb097`,
expiry2026-10-19T15:19:21Z. Wrapper size/digest, external tar digest, safe ZIP/tar
extraction and manifest passed. Node24/Linux/x64/ABI137/glibc2.39/schema1;
agent-user SQLite in-memory query and synthetic MIME check passed. Runtime-user
native check is prepared in the operator helper, not yet run.
Receipt: `fbreader-mime-ci-evidence.json`.

## Operator handoff

Run from your existing private SSH terminal:

```bash
bash /home/ysi/opds/diagnostics-20261005/deploy/update-fbreader-prototype.sh
```

The wrapper stops only the prototype, downloads/rechecks pinned CI bytes,
installs a new immutable SHA directory, validates native loading as the runtime
user and synthetic MIME, then verifies Basic/static HTTPS and one completed feed.
Every listed acquisition must advertise FB2 ZIP and stay on the configured origin.
No book is downloaded. Config is copied into a fresh root-only rollback backup
and preserved, including the independent OPDS proxy. Failure stops the prototype
and validation failure restores e57f0a6/current config. Production/timer untouched.
Successful validation stops the service, then the wrapper starts the corrected
prototype for the reader and checks exact-SHA readiness. A failure at this final
restart leaves the corrected pointer selected and prototype stopped. Root-only rollback
backup and both releases are retained. Staging failure leaves old pointer stopped.
An already existing candidate directory is refused; do not rerun unchanged after
partial staging without examining sanitized failure evidence.

Checks written below `/home/ysi/opds/fbreader-stage-checks-*` and
`/home/ysi/opds/fbreader-acceptance-checks-*`; do not send credentials/config.
Offline helper suite:30 tests passed, including actual temporary filesystem
pointer rollback that retains the independent proxy, rejection of generic ZIP
and off-origin links, and rejection of untrusted artifact bytes. Shell syntax
checks passed. Full helper tests do not prove installation or device acceptance.

## Concrete remaining blocker

Outside-sandbox `sudo -n true` returned “a password is required”; agent cannot
perform root installation unattended. No root deployment/config/unit mutation was
attempted. Read-only state before handoff: old prototype active, production timer
inactive/disabled. This report does not claim the corrected artifact is installed.
Run the script, refresh/re-add catalog if FBReader cached entries, check Download
visibility and open at most one FB2 ZIP. Actual device Download/auth/open and
interrupted download remain pending; production activation stays deferred.

After successful operator installation/runtime verification, clean only this
task's staging and clean merged worktree/branch per AGENTS.md. Preserve dirty,
unmerged and unrelated worktrees, raw sanitized evidence and rollback releases.

## Verified operator result and owner feedback

Staging runtime-user native query and synthetic MIME passed. HTTPS completed
feed200,12863bytes,20 FB2 ZIP acquisition links passed; Basic/static checks
passed, config preserved, no book downloaded by the automated verifier. Bot
health200/NRestarts0 before/after. Raw sanitized receipts are
`fbreader-mime-stage-passed.jsonl` and `fbreader-mime-acceptance-passed.jsonl`.
The verifier stopped the prototype; the wrapper then started it for reader use.
Agent subsequently checked `/health`: ready=true, SHA=c22ac2e; current pointer
matches, prototype active, production service inactive/disabled and timer
inactive/disabled. No service change by agent.

Owner said “Спрацювало” in response to the corrected update and FBReader retest.
This resolves the reported missing Download. The reply does not separately
state file-open, separate credential forwarding or interruption results; those
individual device observations are not invented. Protected empty-page fixture,
query-preserving next and provider sub-user usage-after still need their own
acceptance evidence. No production activation is inferred from this success.

Task staging and downloaded wrapper removed after verified runtime success; raw
sanitary JSONL retained. Clean PR2 merged worktree/local branch removed after
checking clean state, MERGED status and ancestry. Dirty/unmerged checkouts and
immutable releases/private backups retained. Receipt: `fbreader-mime-cleanup.json`.
