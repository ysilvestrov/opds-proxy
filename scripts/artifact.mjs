export const REPO = "ysilvestrov/opds-proxy";
export const validSHA = (sha) =>
  typeof sha === "string" && /^[a-f0-9]{40}$/.test(sha);
export function trustedRun(run, jobs, sha, workflowId) {
  if (
    !validSHA(sha) ||
    run.workflow_id !== workflowId ||
    run.head_sha !== sha ||
    run.head_branch !== "main" ||
    run.event !== "push" ||
    run.status !== "completed" ||
    run.conclusion !== "success" ||
    run.head_repository?.full_name !== REPO
  )
    return false;
  return ["test", "typecheck", "build", "package"].every((name) => {
    const matches = jobs.filter((j) => j.name === name);
    return (
      matches.length === 1 &&
      matches[0].status === "completed" &&
      matches[0].conclusion === "success"
    );
  });
}
export function compatibleManifest(m, sha, host) {
  const version = (v) =>
    typeof v === "string" && /^\d+\.\d+$/.test(v)
      ? v.split(".").map(Number)
      : null;
  const built = version(m.glibcVersion),
    runtime = version(host.glibcVersion);
  return validSHA(sha) &&
    m.sha === sha &&
    m.platform === "linux" &&
    m.nodeMajor === 24 &&
    m.arch === host.arch &&
    m.nodeAbi === host.nodeAbi &&
    m.libc === "glibc" &&
    m.cacheSchemaVersion === 1 &&
    built &&
    runtime &&
    (built[0] < runtime[0] ||
      (built[0] === runtime[0] && built[1] <= runtime[1]))
    ? true
    : false;
}
