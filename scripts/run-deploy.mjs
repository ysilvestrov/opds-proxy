/** Operator-installed, root-owned entry point. Never updated by an app artifact. */
import {
  access,
  mkdir,
  readFile,
  writeFile,
  rename,
  rm,
  lstat,
  readdir,
  symlink,
  open,
} from "node:fs/promises";
import { createReadStream, createWriteStream } from "node:fs";
import { createHash } from "node:crypto";
import { pipeline } from "node:stream/promises";
import { Readable, Transform } from "node:stream";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { deployCandidate } from "./autodeploy.mjs";
import { observeReadiness } from "./observe.mjs";
import { trustedRun, compatibleManifest, validSHA, REPO } from "./artifact.mjs";
const exec = promisify(execFile),
  here = dirname(fileURLToPath(import.meta.url));
const root = "/opt/searchfloor-opds",
  stateDir = "/var/lib/searchfloor-opds-deploy/state",
  staging = join(root, "staging"),
  releases = join(root, "releases");
if (
  process.platform !== "linux" ||
  process.versions.node.split(".")[0] !== "24"
)
  throw Error("Linux Node 24 required");
const workflowId = Number(process.env.OPDS_WORKFLOW_ID);
if (!Number.isSafeInteger(workflowId) || workflowId < 1)
  throw Error("Pinned workflow ID required");
const credentials =
  process.env.OPDS_USERNAME && process.env.OPDS_PASSWORD
    ? Buffer.from(
        process.env.OPDS_USERNAME + ":" + process.env.OPDS_PASSWORD,
      ).toString("base64")
    : null;
if (!credentials) throw Error("Dedicated OPDS health credentials required");
for (const path of [root, stateDir, staging, releases]) {
  const info = await lstat(path);
  if (!info.isDirectory() || info.isSymbolicLink())
    throw Error("Unsafe deployment root");
}
const host = {
  arch: process.arch,
  nodeAbi: process.versions.modules,
  glibcVersion: process.report.getReport().header.glibcVersionRuntime,
};
const exists = async (path) => {
  try {
    await access(path);
    return true;
  } catch (e) {
    if (e.code === "ENOENT") return false;
    throw e;
  }
};
const syncDir = async (path) => {
  const handle = await open(path, "r");
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
};
const releasePath = (sha) => {
  if (!validSHA(sha)) throw Error("Invalid release SHA");
  return join(releases, sha);
};
const permanent = (message) =>
  Object.assign(Error(message), { permanent: true });
const stateFile = join(stateDir, "deployment.json");
async function api(path) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(
        "https://api.github.com/repos/" + REPO + path,
        {
          signal: AbortSignal.timeout(15000),
          headers: {
            Accept: "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "opds-proxy-deployer",
            ...(process.env.OPDS_GITHUB_TOKEN
              ? { Authorization: "Bearer " + process.env.OPDS_GITHUB_TOKEN }
              : {}),
          },
        },
      );
      if (response.status === 429 || response.status >= 500) {
        await response.body?.cancel();
        throw Error("GitHub temporarily unavailable");
      }
      if (!response.ok) {
        await response.body?.cancel();
        throw Error("GitHub request denied");
      }
      return await response.json();
    } catch (error) {
      if (attempt === 2) throw error;
      await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
    }
  }
}
let approvedArtifact;
async function approved(sha) {
  const data = await api(
    `/actions/workflows/${workflowId}/runs?branch=main&event=push&status=success&head_sha=${sha}&per_page=10`,
  );
  for (const run of data.workflow_runs ?? []) {
    if (run.head_sha !== sha) continue;
    const jobs = await api(`/actions/runs/${run.id}/jobs?per_page=100`);
    if (!trustedRun(run, jobs.jobs ?? [], sha, workflowId)) continue;
    const artifacts = await api(
      `/actions/runs/${run.id}/artifacts?per_page=100`,
    );
    const matches = (artifacts.artifacts ?? []).filter(
      (a) =>
        a.name === `opds-release-${sha}` &&
        !a.expired &&
        a.workflow_run?.head_sha === sha,
    );
    if (matches.length !== 1) return false;
    approvedArtifact = { sha, id: matches[0].id };
    return true;
  }
  return false;
}
async function downloadArtifact(path) {
  const url = `https://api.github.com/repos/${REPO}/actions/artifacts/${approvedArtifact.id}/zip`;
  const response = await fetch(url, {
    redirect: "manual",
    signal: AbortSignal.timeout(15000),
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "opds-proxy-deployer",
      ...(process.env.OPDS_GITHUB_TOKEN
        ? { Authorization: "Bearer " + process.env.OPDS_GITHUB_TOKEN }
        : {}),
    },
  });
  let data = response;
  if (response.status === 302) {
    await response.body?.cancel();
    const location = new URL(response.headers.get("location") ?? "");
    if (
      location.protocol !== "https:" ||
      location.username ||
      location.password
    )
      throw Error("Invalid artifact redirect");
    data = await fetch(location, { signal: AbortSignal.timeout(120000) });
  }
  if (!data.ok || !data.body) throw Error("Artifact download failed");
  let bytes = 0;
  const limit = new Transform({
    transform(chunk, encoding, done) {
      bytes += chunk.length;
      done(
        bytes > 256 * 1024 * 1024 ? Error("Artifact size limit") : null,
        chunk,
      );
    },
  });
  await pipeline(
    Readable.fromWeb(data.body),
    limit,
    createWriteStream(path, { flags: "wx", mode: 0o600 }),
  );
}
async function checkRelease(path, sha) {
  const info = await lstat(path);
  if (!info.isDirectory() || info.isSymbolicLink())
    throw permanent("Unsafe release directory");
  let manifest;
  try {
    manifest = JSON.parse(await readFile(join(path, "release.json"), "utf8"));
  } catch {
    throw permanent("Invalid manifest");
  }
  if (!compatibleManifest(manifest, sha, host))
    throw permanent("Incompatible release");
  try {
    await exec(
      "/usr/bin/node",
      [
        "--input-type=module",
        "-e",
        "import Database from 'better-sqlite3';const db=new Database(':memory:');db.prepare('SELECT 1').get();db.close();",
      ],
      { cwd: path, timeout: 15000, maxBuffer: 1024 * 1024 },
    );
  } catch {
    throw permanent("Native module failed");
  }
}
async function stage(sha) {
  if (approvedArtifact?.sha !== sha) throw Error("Artifact not authorized");
  const scratch = join(staging, "candidate");
  await rm(scratch, { recursive: true, force: true });
  await mkdir(scratch, { mode: 0o700 });
  try {
    const archive = join(scratch, "artifact.zip");
    await downloadArtifact(archive);
    const wrapper = join(scratch, "wrapper");
    try {
      await exec(
        "/usr/bin/python3",
        [join(here, "safe-extract.py"), "zip", archive, wrapper],
        { timeout: 30000 },
      );
    } catch {
      throw permanent("Invalid artifact wrapper");
    }
    const tar = join(wrapper, "release.tgz");
    const expected = (
      await readFile(join(wrapper, "release.tgz.sha256"), "utf8")
    ).trim();
    if (!/^[a-f0-9]{64}  release\.tgz$/.test(expected))
      throw permanent("Invalid checksum document");
    const hash = createHash("sha256");
    for await (const chunk of createReadStream(tar)) hash.update(chunk);
    if (hash.digest("hex") !== expected.slice(0, 64))
      throw permanent("Checksum mismatch");
    const extracted = join(scratch, "extracted");
    try {
      await exec(
        "/usr/bin/python3",
        [join(here, "safe-extract.py"), "tar", tar, extracted],
        { timeout: 30000 },
      );
    } catch {
      throw permanent("Invalid release archive");
    }
    await checkRelease(extracted, sha);
    const dest = releasePath(sha);
    if (await exists(dest)) await checkRelease(dest, sha);
    else {
      await rename(extracted, dest);
      await syncDir(releases);
    }
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
}
async function switchCurrent(sha) {
  const current = join(root, "current");
  if (sha === null) {
    if (await exists(current)) await rm(current);
    await syncDir(root);
    return;
  }
  const target = releasePath(sha);
  await checkRelease(target, sha);
  const temp = join(root, ".current.next");
  await rm(temp, { force: true });
  await symlink(target, temp);
  await rename(temp, current);
  await syncDir(root);
}
const helper = (action) =>
  exec(
    "/usr/bin/sudo",
    ["-n", "/usr/local/sbin/searchfloor-opds-control", action],
    { timeout: 35000, maxBuffer: 1024 * 1024 },
  );
async function observe(sha) {
  const count = async () => {
    const result = await exec(
      "/usr/bin/systemctl",
      ["show", "searchfloor-opds.service", "-p", "NRestarts", "--value"],
      { timeout: 5000 },
    );
    return result.stdout.trim();
  };
  return observeReadiness({
    restarts: count,
    probe: async () => {
      const health = await fetch("http://127.0.0.1:8787/health", {
        signal: AbortSignal.timeout(5000),
      });
      if (!health.ok) return false;
      const body = await health.json();
      if (!body.ready || body.sha !== sha) return false;
      const rootResponse = await fetch("http://127.0.0.1:8787/opds", {
        signal: AbortSignal.timeout(5000),
        headers: { Authorization: "Basic " + credentials },
      });
      if (
        !rootResponse.ok ||
        !(await rootResponse.text()).includes(
          '<feed xmlns="http://www.w3.org/2005/Atom"',
        )
      )
        return false;
      return true;
    },
  });
}
const deps = {
  lock: async () => true,
  unlock: async () => {},
  paused: () => exists(join(stateDir, "PAUSED")),
  readState: async () => {
    if (!(await exists(stateFile)))
      return {
        settledSHA: null,
        previousSHA: null,
        failedSHA: null,
        phase: "idle",
      };
    const state = JSON.parse(await readFile(stateFile, "utf8"));
    if (!["idle", "activating", "rollback"].includes(state.phase))
      throw Error("Invalid state phase");
    for (const key of [
      "settledSHA",
      "previousSHA",
      "failedSHA",
      "candidateSHA",
      "baselineSHA",
    ])
      if (state[key] != null && !validSHA(state[key]))
        throw Error("Invalid state identity");
    return state;
  },
  saveState: async (state) => {
    const tmp = stateFile + ".next";
    const file = await open(tmp, "w", 0o600);
    try {
      await file.writeFile(JSON.stringify(state) + "\n");
      await file.sync();
    } finally {
      await file.close();
    }
    await rename(tmp, stateFile);
    await syncDir(stateDir);
  },
  main: async () => {
    const ref = await api("/git/ref/heads/main");
    const sha = ref.object?.sha;
    if (!validSHA(sha)) throw Error("Invalid main SHA");
    return sha;
  },
  approved,
  stage,
  switchCurrent,
  restart: () => helper("restart"),
  stop: () => helper("stop"),
  resetCache: () => helper("reset-cache"),
  observe,
  prune: async (keep) => {
    await rm(join(staging, "candidate"), { recursive: true, force: true });
    for (const entry of await readdir(releases)) {
      if (validSHA(entry) && !keep.includes(entry)) {
        const path = releasePath(entry);
        const info = await lstat(path);
        if (!info.isDirectory() || info.isSymbolicLink())
          throw Error("Unsafe release cleanup");
        await rm(path, { recursive: true });
      }
    }
  },
};
try {
  console.log(
    JSON.stringify({
      event: "deploy_result",
      result: await deployCandidate(deps),
    }),
  );
} catch {
  console.error(JSON.stringify({ event: "deploy_failed" }));
  process.exitCode = 1;
}
