# Independent source proxy: exact-SHA Linux evidence

Application SHA: **e57f0a6d33799593afc594a8adefabfa46ee6341**.
This includes both final review fixes. Subsequent documentation commits are not
the installed artifact identity. Do not use earlier d889aee artifact for acceptance.

| Evidence | Observed value |
|---|---|
| Repository | https://github.com/ysilvestrov/opds-proxy |
| Workflow | OPDS CI, .github/workflows/ci.yml, ID374905819 |
| Exact push run | https://github.com/ysilvestrov/opds-proxy/actions/runs/37311541114 |
| Branch / event | feat/opds-v1 / push |
| test/typecheck/build/package | completed/success |
| Artifact ID | 11346670844 |
| Artifact name | opds-prototype-e57f0a6d33799593afc594a8adefabfa46ee6341 |
| Wrapper bytes | 7,360,797 |
| GitHub wrapper SHA256 | 0c43c34457c1b583413fded05cb1aedd77d080f52ead21e333f40f102eac255b |
| Internal tar SHA256 | 980a6fd419aab2bc914cf208f8492b12301e7972b1487cfbed56ddfe8a011870 |
| Manifest | Exact SHA above; Linux/x64, Node24, ABI137, glibc2.39, cache schema1 |

Linux test job passed70 Node tests (14 files),11 Python tests, Bash syntax and
systemd unit validation. Runtime stalled CONNECT/SIGTERM test passed on Linux;
Windows skips only that platform-specific signal case. Packaging installs ready
production dependencies and runs an in-memory native better-sqlite3 query before
upload. No source/live requests are part of CI.

Downloaded wrapper digest and external release.tgz checksum matched; reviewed
safe extractor accepted wrapper/tar paths/types/size and manifest identity.
No Linux binary ran on Windows, and this does not install/update the server.
Prototype artifact retention14 days: operator rechecks expiry, workflow/SHA/jobs,
digests and actual host compatibility before staging. Production requires its
separate green-main artifact and all acceptance gates.

Fresh review had two Important findings, both RED→GREEN fixed in this exact SHA;
no Critical/deferred Minor findings. Details in source-proxy-review.md.
Dedicated provider credentials, server source/download/resources, FBReader and
operator rollback acceptance remain pending. Existing stopped prototype and
production/timer configuration were not changed from the desktop.
