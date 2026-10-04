import { it, expect } from "vitest";
// @ts-expect-error Installed deployment ESM.
import { trustedRun, compatibleManifest } from "../scripts/artifact.mjs";
const sha = "a".repeat(40);
const run = {
  id: 1,
  workflow_id: 7,
  head_sha: sha,
  head_branch: "main",
  event: "push",
  status: "completed",
  conclusion: "success",
  head_repository: { full_name: "ysilvestrov/opds-proxy" },
};
it("requires pinned workflow, exact SHA, main push and every required job", () => {
  const jobs = ["test", "typecheck", "build", "package"].map((name) => ({
    name,
    status: "completed",
    conclusion: "success",
  }));
  expect(trustedRun(run, jobs, sha, 7)).toBe(true);
  for (const variant of [
    { ...run, workflow_id: 8 },
    { ...run, head_sha: "b".repeat(40) },
    { ...run, status: "pending" },
    { ...run, event: "pull_request" },
  ])
    expect(trustedRun(variant, jobs, sha, 7)).toBe(false);
  expect(trustedRun(run, jobs.slice(1), sha, 7)).toBe(false);
  expect(
    trustedRun(run, [...jobs, { name: "test", conclusion: "failure" }], sha, 7),
  ).toBe(false);
});
it("requires SHA/platform/CPU/ABI/glibc/schema agreement", () => {
  const manifest = {
    sha,
    platform: "linux",
    nodeMajor: 24,
    arch: "x64",
    nodeAbi: "137",
    libc: "glibc",
    glibcVersion: "2.39",
    cacheSchemaVersion: 1,
  };
  const host = { arch: "x64", nodeAbi: "137", glibcVersion: "2.39" };
  expect(compatibleManifest(manifest, sha, host)).toBe(true);
  for (const mismatch of [
    { sha: "b".repeat(40) },
    { platform: "win32" },
    { arch: "arm64" },
    { nodeAbi: "138" },
    { glibcVersion: "2.40" },
    { cacheSchemaVersion: 2 },
  ])
    expect(compatibleManifest({ ...manifest, ...mismatch }, sha, host)).toBe(
      false,
    );
});
