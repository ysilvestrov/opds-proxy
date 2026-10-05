import { execFileSync } from "node:child_process";
import {
  cpSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  rmSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { resolve, join } from "node:path";
if (
  process.platform !== "linux" ||
  process.versions.node.split(".")[0] !== "24"
)
  throw Error("Package on compatible Linux Node 24 runner only");
const sha = process.env.GITHUB_SHA;
if (!/^[a-f0-9]{40}$/.test(sha ?? "")) throw Error("Exact GitHub SHA required");
const stage = resolve(".superpowers/release");
mkdirSync(stage, { recursive: true });
for (const item of ["dist", "package.json", "package-lock.json"])
  cpSync(item, join(stage, item), { recursive: true });
execFileSync("npm", ["ci", "--omit=dev", "--no-audit", "--no-fund"], {
  cwd: stage,
  stdio: "inherit",
});
// npm .bin links are not needed at runtime; release archives forbid every link.
rmSync(join(stage, "node_modules", ".bin"), { recursive: true, force: true });
execFileSync(
  process.execPath,
  [
    "--input-type=module",
    "-e",
    "import Database from 'better-sqlite3';const db=new Database(':memory:');db.prepare('select 1').get();db.close();",
  ],
  { cwd: stage, stdio: "inherit" },
);
const header = process.report.getReport().header;
const manifest = {
  sha,
  nodeMajor: 24,
  platform: "linux",
  arch: process.arch,
  libc: "glibc",
  glibcVersion: header.glibcVersionRuntime,
  nodeAbi: process.versions.modules,
  cacheSchemaVersion: 1,
};
if (!manifest.glibcVersion) throw Error("glibc runner required");
writeFileSync(
  join(stage, "release.json"),
  JSON.stringify(manifest, null, 2) + "\n",
);
mkdirSync("releases", { recursive: true });
const archive = resolve("releases/release.tgz");
execFileSync("tar", ["-czf", archive, "-C", stage, "."]);
const hash = createHash("sha256").update(readFileSync(archive)).digest("hex");
writeFileSync("releases/release.tgz.sha256", hash + "  release.tgz\n");
