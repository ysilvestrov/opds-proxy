# Access log release evidence — 2026-10-06

Requirements OPS-001, AUTH-001, ARCH-001, DEPLOY-001, ACCEPT-001.
PR7 merged: https://github.com/ysilvestrov/opds-proxy/pull/7.
Main SHA f76bfac8b64a602f3d0a61df89da93b3d313297f.

- Reviewed head6d82cb11f4c631e04b68115e8c1e9fa2761f1ec2:
  run37482338229 test/typecheck/build success, package skipped as expected on PR.
- Main run37482560755: test/typecheck/build/package all success.
- Artifact11421816711: opds-release-f76bfac8b64a602f3d0a61df89da93b3d313297f,
  7362535 bytes, digest
  sha256:9b4e46b43b9214343b7c9a8ea6c50f7d1699e8ce3c0b15506fd902854835b29a.
- Local full Node98 passed/2 Windows skips, build/typecheck success; independent
  review found no actionable findings. No local live source requests.
- Production active SHA after packaging, actual access events, journal
  persistence/retention and phone cover request remain pending observation.
  Prepared operator steps: docs/access-log-rollout-handoff.md (also in main).

This report supersedes the historical missing-trigger CI observation in
docs/access-log-validation.md. A transient lack of runs was not a diagnosed
workflow fault; exact-head/main success is now established.
