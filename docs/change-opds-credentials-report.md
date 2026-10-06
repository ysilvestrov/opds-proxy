# OPDS credential change — server result, 2026-10-06

Status: operator rotation and owner-confirmed FBReader login passed.

AUTH-001/002, CONFIG-001, DEPLOY-002, OPS-002.
Reviewed main: b15970c6843d3a335cabdd0ee4a3ee32e6561bdb, merged PR4.
Clean isolated checkout prepared on branch `codex/opds-credentials`, preserving
the prior rollout branch and other dirty/unmerged checkouts.

Wrapper/helper and their production-rollout/verifier dependencies exactly match
PR4 head bf6f7168c1a3fc30d3de0a433fc8950f5d1470f8. Source SHA256:
wrapper e30b1ab53110c18feefbc8d50f7bea1eeb3ef199e6c78cbff0ea59e6c69e41f3;
helper 7e23c85af6e74769abcca0085d8ad6cf1b135bbfd748b4b52d34eb8d01fcda54.
Shell syntax/help and10 existing offline rotation tests passed.

Read-only pre-operation checks: production active/enabled, ready on main b15970c,
PID3023171/NRestarts0; deploy-service inactive; timer active/waiting/enabled.
Bot healthy/PID2320493/NRestarts0. No private env read or changed by the agent;
no source/book requests. These are the pre-operation measurements.

Operator command in a private interactive terminal, without sudo prefix:

```bash
bash /home/ysi/opds/production-rollout/deploy/change-opds-credentials.sh
```

Enter new OPDS username/password only there. Return sanitized result JSON;
never credentials, env or private backup. After success restart FBReader and
enter the new pair, including the username. Record actual OPDS/timer/bot status
and owner device-login result after the operator runs the command.

## Actual operator result

Owner returned sanitized JSON:

```json
{"changed":true,"sha":"b15970c6843d3a335cabdd0ee4a3ee32e6561bdb","timerRestored":true}
```

Returned checks passed health200, unauthenticated Basic401 on all private static,
search/completed/acquisition paths, authenticated root/source feeds200 and
OpenSearch200, locally and through existing HTTPS. Reviewed helper emits success
only after separately checking that the old pair returns401 locally/HTTPS.
No old/new username, password or credential fingerprint was received or recorded.
No extra source/book probe. Runtime/deploy pair was changed through the locked
operator procedure, preserving other config and deployment state/current/cache.

Independent read-only checks after the operator run confirmed main b15970c ready,
production active/running/enabled/PID3025110/NRestarts0, deploy-service inactive,
timer active/waiting/enabled with a finite next event. Bot remained healthy,
PID2320493/NRestarts0, unchanged from preparation. OPDS PID changed as expected
for the explicit credential restart, not a crash loop.

Server-side AUTH-001/002 rotation acceptance passed. On2026-10-06 the owner
confirmed "все працює" in response to the request to log into FBReader with
the new pair. Device login is accepted; no claim of credential persistence
across future restarts or additional edge-case tests. Private backups
remain root-only outside Git. No task-specific temporary files or merged clean
worktrees require deletion; dirty/unmerged work remains preserved.
