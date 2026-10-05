import { it, expect } from "vitest";
import { mkdtemp, cp, symlink, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
// @ts-expect-error Operator-only dependency-free deployment verifier.
import { verifyDeploymentIsolation } from "../scripts/verify-deploy-isolation.mjs";

it.skipIf(process.platform === "win32")("deploys a real runtime, rolls back a failed process and holds its SHA in isolated filesystem",async()=>{
  const artifact=await mkdtemp(join(tmpdir(),"opds-artifact-fixture-"));
  try{
    await cp("dist",join(artifact,"dist"),{recursive:true});
    await symlink(resolve("node_modules"),join(artifact,"node_modules"),"dir");
    await writeFile(join(artifact,"package.json"),'{"type":"module"}');
    await writeFile(join(artifact,"release.json"),JSON.stringify({sha:"b".repeat(40)}));
    const result=await verifyDeploymentIsolation(artifact);
    expect(result.successfulRelease).toBe("deployed");
    expect(result.failedRelease).toBe("rolled-back");
    expect(result.failedRetry).toBe("held");
    expect(result.rollbackHealth).toBe(true);
    expect(result.noop).toBe("noop");
  }finally{await rm(artifact,{recursive:true,force:true});}
},30000);
