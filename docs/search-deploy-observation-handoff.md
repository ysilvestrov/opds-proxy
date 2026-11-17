# READ-01: investigate pending automatic deployment — 2026-11-17

Read root spec.md first: DEPLOY-001, OPS-001, ARCH-001, AUTH-001 and OPDS-001/002.
This is read-only observation, not permission to restart services, alter units,
rotate secrets or bypass artifact gates. Bot resources remain isolated.

## Known evidence

PR13 merged: https://github.com/ysilvestrov/opds-proxy/pull/13.
Expected main6b8021670a92ff9f1c2b6ecd240ef8bc9cdd98fb; all exact-head and main
CI jobs passed. Main run44051945006, workflow374905819, artifact14313269541:
opds-release-6b8021670a92ff9f1c2b6ecd240ef8bc9cdd98fb,7365500B,
digest sha256:d8d1ac4e007de395aff4c0c98a7f2bbf9f1cfb710b80d92501448c07943412ff.
Public health200/ready=true at09:04:01.116Z through09:09:59.416Z still reported
23603bb9e7c431e577dabf940442c0ca125f79c5. Desired code is not yet confirmed installed.
Timer nominally checks every5min plus up to15s delay; actual host state unknown.
Full local172 Node tests pass/2 skips,57 deployment Python pass; review complete.

## Observe on the current host

1. Record UTC window and local http://127.0.0.1:8787/health, public
   https://opds.ysilvestrov-ai.uk/health, installed release pointer/SHA. Different
   local/public results require mapping evidence, not an assumed timer failure.
2. Read selected systemctl fields for searchfloor-opds-deploy.timer and
   searchfloor-opds-deploy.service: ActiveState/SubState/UnitFileState,
   LastTriggerUSec/NextElapseUSecRealtime/NextElapseUSecMonotonic where available,
   Result/ExecMainCode/ExecMainStatus/ExecMainStartTimestamp/ExecMainExitTimestamp.
   Do not print Environment, token-bearing argv or raw config/secrets.
3. Inspect existing deploy journal over2026-11-17T08:55:00Z–09:15:00Z (or a
   later bounded10min window if this one is no longer retained). Return only
   known structured deploy events/state labels plus time/exit status, at most100
   events. No raw arbitrary journal messages/headers/credentials. Report gaps.
4. Read allowlisted deployment state: only valid SHA/status/event fields from
   /var/lib/searchfloor-opds-deploy/state/deployment.json; inspect lock ownership
   and effective installed deploy-script identity without killing/releasing locks.
   Do not dump full state/config or the runtime cache.
5. If a failing boundary is established, inspect it narrowly: GitHub API status
   via existing privately loaded deploy token, pinned workflow ID, desired main
   SHA, trusted artifact selection, ABI/glibc compatibility or health gate.
   Report only status/reason class. No secret values, raw request headers,
   credential fingerprints, fallback to bot credentials or manual npm builds.
6. If current installation already reached expected SHA, record the timestamp
   and bounded authenticated local/public root/OpenSearch checks using existing
   OPDS credentials privately. Assert root search link and template page=1;
   discovery must not access Searchfloor. No book download is needed.

Return sanitized evidence and a concrete proposed fix if one is needed through
Git. Prepared brief is not delivered to another chat/operator automatically.
Do not claim rollout success from CI/artifact alone. After installation is proven,
owner phone acceptance still needs Catalogue: Searchfloor and search/next results.
