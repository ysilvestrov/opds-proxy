# META-01 server diagnostics — preparation

Status: live source boundary still unknown; operator root execution required.
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
