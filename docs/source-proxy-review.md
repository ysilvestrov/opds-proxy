# Independent proxy implementation review

Authority: root spec.md0.4.6, SOURCE-002/003, ARCH-001, CONFIG-001,
DOWNLOAD-001/002, OPS-001/002, ACCEPT-001. Approved incremental range
9bbe3e1..d889aee received one fresh read-only review, followed by one TDD fix pass
in e57f0a6. No merge or server operation is claimed.

Two Important findings were fixed:

1. Native post-header stream errors exposed proxy socket address/port through
Hono stderr. Real CONNECT/Downloads/Hono regression observed RED, then GREEN
after pull-based transport body sanitization. Cancellation/backpressure retained.
2. Verifier stripped a valid trailing quote from systemd credentials, producing
false401. Private-config regression observed `abc' -> abc` RED, then GREEN;
EnvironmentFile parser covers semicolon comments, unquoted interior quotes,
single/double quotes, escapes, continuation and duplicate assignments.

Local final tests:69 passed + one Windows-skipped Linux SIGTERM case;
typecheck/build green. WSL Python11/11. Final exact-SHA Linux results are recorded
separately in source-proxy-ci-evidence.md. No Critical or deferred Minor findings.

Execution rulings (no design change):

- Normalize plan Task headings for native brief extraction; risk if wrong is
bookkeeping only, no application behavior.
- Current-folder feature branch preserves owner's earlier no-worktree choice;
inline execution and one final reviewer preserve approved workflow. Risk is
shared local working state; only owned paths staged, user reports preserved.
- Pin undici7.30 because actual Node24 fetch rejects undici8 dispatcher handlers;
correct tsc path/use production build config. Compatibility risk is covered by
real CONNECT tests. Graceful SIGTERM runs on Linux, Windows cannot deliver it.
- Create recorder0600 atomically rather than chmod after creation; only selected
server diagnostic changes imported. Risk is limited platform permission semantics;
Linux regression verifies0600/fsync and no overwrite.
- External VPS/provider/device/host rollback observations remain pending;
unchanged previously reviewed baseline architecture is outside this increment.
Later artifact evidence is checked independently. Risk is incomplete acceptance,
so production/timer gates stay off and no deployment claim is made.

Reviewer declined only those external/baseline/later-document observations, not
an observed defect. No second reviewer or per-task implementer agents used.
Keep this plan's ignored ledger/workspace until external Task4 acceptance is
finished. Do not delete sibling plan workspaces or untracked owner evidence.
