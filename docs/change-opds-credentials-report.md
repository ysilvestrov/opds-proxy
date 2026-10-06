# OPDS credential change — server preparation, 2026-10-06

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
no source/book requests. Actual rotation and device login remain pending.

Operator command in a private interactive terminal, without sudo prefix:

```bash
bash /home/ysi/opds/production-rollout/deploy/change-opds-credentials.sh
```

Enter new OPDS username/password only there. Return sanitized result JSON;
never credentials, env or private backup. After success restart FBReader and
enter the new pair, including the username. Record actual OPDS/timer/bot status
and owner device-login result after the operator runs the command.
