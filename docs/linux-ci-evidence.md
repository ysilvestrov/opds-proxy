# Linux CI and prototype artifact evidence

Repository: https://github.com/ysilvestrov/opds-proxy.
Draft PR: https://github.com/ysilvestrov/opds-proxy/pull/1.
Pinned application SHA: **16cc521448bbb792aa74594cf7c1c1def5ae16f9**.
The documentation commit containing this report is later; the verified artifact
remains pinned to this application SHA, not an inferred latest branch head.

| Evidence | Observed value |
|---|---|
| Workflow | `OPDS CI`, `.github/workflows/ci.yml`, ID `374905819` |
| Push run | https://github.com/ysilvestrov/opds-proxy/actions/runs/37238876789 |
| Branch / event | `feat/opds-v1` / `push` |
| Required jobs | `test`, `typecheck`, `build`, `package`: completed/success |
| PR run | https://github.com/ysilvestrov/opds-proxy/actions/runs/37238880497, success |
| Artifact ID | `11316800751` |
| Artifact name | `opds-prototype-16cc521448bbb792aa74594cf7c1c1def5ae16f9` |
| Wrapper size | `7,355,075` bytes |
| GitHub wrapper SHA256 | `44b0d9421087466537e7e1d73379575a0725a15f021aed833478053f490ae1de` |
| Internal `release.tgz` SHA256 | `e681894680fbc8fec0ab14b453dcce9526e856a28b5d37b06243829fcf90984c` |
| Manifest | exact SHA above, Linux x64, Node major 24, ABI 137, glibc 2.39, schema 1 |

The Linux test job passed application/runtime tests (50), Python archive tests
(3), Bash syntax and systemd unit verification. Packaging separately installed
production dependencies and loaded native better-sqlite3 with an in-memory query
before uploading the artifact. This is actual Linux CI/native-load evidence.

The initial run `37238701871` failed unit verification because setup-node placed
Node in its tool cache and `/usr/bin/node` was absent on the runner. The fix adds
a runner-only link to the selected Node executable; the audited host units and
bootstrap continue to require `/usr/bin/node` with Node 24. Re-run passed.

The downloaded wrapper matched the GitHub API digest. The reviewed safe extractor
accepted wrapper members and the tar's paths/types/size limits; the external tar
checksum matched. Internal manifest was read from the extracted artifact and
agreed with the exact SHA/platform/ABI data above. No Linux binary was executed
on Windows and nothing was installed on the server by these checks.

Artifact retention is 14 days. The operator must recheck run identity, expiry,
checksum and actual host compatibility at installation. A replacement/new SHA
requires fresh pinning, not reuse of these values. The production deployer cannot
accept this non-main prototype run/name. Actual installed permissions, HTTPS,
FBReader and server runtime/deploy/rollback remain unverified.
