# READ-01 deployment observation — 2026-11-17

Status: **observation partially blocked; expected release not installed**.
This executes [the handoff](search-deploy-observation-handoff.md) within its
read-only authority. Relevant requirements: DEPLOY-001/002, OPS-001/002,
ARCH-001, AUTH-001, OPDS-001/002 and ACCEPT-001. No requirements changed.

## Observed result

Observation began at 09:21:50 UTC. The persisted snapshot covers
09:24:21–09:24:38 UTC; see
[sanitized evidence](search-deploy-observation-20261117.json).

- Local and public `/health` both returned HTTP 200, `ready=true`, SHA
  `23603bb9e7c431e577dabf940442c0ca125f79c5` at 09:24:21–09:24:22 UTC.
  `/opt/searchfloor-opds/current` resolves to that same release. There is no
  local/public SHA discrepancy in these observations.
- Expected main remains `6b8021670a92ff9f1c2b6ecd240ef8bc9cdd98fb`.
- Deploy timer is `active/waiting`, `enabled`, `Result=success`. Its last trigger
  was 09:21:50 UTC; `NextElapseUSecRealtime` is empty and the monotonic next
  deadline is present in the JSON. This is not an inactive timer incident.
- Deploy service is `failed/failed`, `static`, `Result=exit-code`,
  `ExecMainCode=1`, `ExecMainStatus=1`, start 09:21:50 UTC, exit 09:21:53 UTC.
  An earlier snapshot showed the same failure at 09:16:32–09:16:35 UTC.
- Runtime remains `active/running`, PID 1247317, `NRestarts=0`, started
  2026-11-15 06:19:31 UTC. This does not prove the desired release was activated.

## Retained journal evidence

The requested 08:55:00–09:15:00 UTC window is readable: 20 records examined,
four allowlisted deploy events returned, no event-limit truncation.
Arbitrary systemd messages and headers were omitted.

| UTC | Structured event |
| --- | --- |
| 08:55:35.633996 | `deploy_failed` |
| 09:00:50.058485 | `deploy_failed` |
| 09:06:05.638057 | `deploy_failed` |
| 09:11:15.651674 | `deploy_failed` |

The installed entry point catches errors and emits only `deploy_failed`, with
no failing stage or reason class. These events therefore cannot establish
GitHub denial, artifact download/extraction failure, or a state/filesystem error.
The short service duration is not proof of any one cause. A held candidate or
busy lock alone would normally return a successful held/noop or fail before
Node, respectively; these structured events demonstrate execution reached the
entry point's catch. Exact failing boundary remains unknown.

## Installed identity and GitHub evidence

The effective deploy service has no drop-ins and runs as `searchfloor-deploy`.
Its reviewed fixed command is flock on the dedicated OPDS deploy lock followed
by `/usr/bin/node /usr/local/lib/searchfloor-opds/run-deploy.mjs`.
No Environment values or token-bearing command lines were requested.

All five installed files (`run-deploy.mjs`, `artifact.mjs`, `autodeploy.mjs`,
`observe.mjs`, `safe-extract.py`) byte-match main `6b80216`; their content hashes
are in the JSON. They identify code, not credentials. Ownership reported inside
the sandbox is mapped to nobody/nogroup; root ownership is not independently
verified by that view.

Existing GitHub CLI access independently confirms:

- [main run 44051945006](https://github.com/ysilvestrov/opds-proxy/actions/runs/44051945006):
  pinned expected workflow 374905819, push/main, exact desired SHA, originating
  repository `ysilvestrov/opds-proxy`, completed/success.
- `test`, `typecheck`, `build`, `package`: each completed/success.
- Artifact 14313269541: `opds-release-6b8021670a92ff9f1c2b6ecd240ef8bc9cdd98fb`,
  unexpired, 7,365,500 bytes, digest
  `sha256:d8d1ac4e007de395aff4c0c98a7f2bbf9f1cfb710b80d92501448c07943412ff`,
  attached to that exact main run/SHA.

CLI success does **not** verify the deploy-service token, its effective workflow
pin, or artifact read permissions. No artifact was downloaded, no candidate
native module was loaded, and ABI/glibc admission remains unverified.

## Access blocker and remaining observation

The deployment state and lock directory and `/etc/searchfloor-opds` are not
readable by this session. Outside-sandbox `sudo -n` also requires an operator
password. Available NOPASSWD rules provide no authorized OPDS observation route.
No password was requested in chat and no bot account/credential fallback was used.

Consequently settled/previous/failed/candidate/baseline SHA, phase, PAUSED,
lock ownership/holder, deployed workflow pin, and deploy-token API status remain
unverified. An unprivileged `lslocks` attempt produced no usable data; it is not
evidence that the lock is free. Root access, rather than missing observation
authorization, blocks these checks.

An operator with private root access should continue the existing handoff:

1. Read only the validated SHA fields and `idle/activating/rollback` phase from
   `/var/lib/searchfloor-opds-deploy/state/deployment.json`, plus PAUSED presence.
   Inspect the dedicated lock's stat and matching `/proc/locks` holder without
   acquiring, releasing or removing it. Do not print full state or process argv.
2. Privately load the existing OPDS deploy environment. Validate the configured
   workflow ID against 374905819. With that token, make bounded read requests for
   main, the exact workflow run/jobs and its artifact metadata; report only
   HTTP status/reason class and validated identity fields. CLI-token substitution
   would not test the failing identity.
3. If these pass, inspect the next boundary indicated by state and installed
   code: staging/extraction permissions, artifact compatibility, or activation/
   health. Do not run the deploy entry point as a diagnostic: it mutates state.

## Proposed fix and acceptance

No production fix is justified until the failing boundary is established.
In particular, a deploy-token rotation, timer restart, manual build or state
rearm is not supported by these observations. If a deploy-token denial or pin
mismatch is subsequently proven, prepare a narrowly reviewed operator update
of only that OPDS setting under OPS-002; preserve all artifact gates.

A concrete follow-up code improvement is to attach an allowlisted `stage` and
`reasonClass` to `deploy_failed`, without exception messages, URLs, headers or
credentials, and test redaction using fixtures. This would close the observed
diagnostic gap; it is a proposal, not an implemented repair or a proven solution
to the current deployment failure. Installing a changed deployer is a separate
reviewed operator action because application artifacts do not update it.

Authenticated root/OpenSearch checks were not run: the expected release is not
installed and existing OPDS credentials are inaccessible. Once installation is
proven, perform the bounded local/public discovery checks from step 6 of the
handoff, without contacting Searchfloor. Then owner phone acceptance still needs
`Catalogue: Searchfloor`, search results and next-page results.

No units, secrets, deployment state, locks, current pointer, runtime cache or bot
resources were changed. No source queries or book downloads were made. No cleanup
of unrelated worktrees/branches applies: this observation did not deploy anything.
Application tests were not rerun for this evidence-only change; historical CI is
identified separately above. Only documentation/evidence is delivered through Git;
no message was sent to another chat/operator.
