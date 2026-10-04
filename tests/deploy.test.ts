import { it, expect, vi } from "vitest";
// @ts-expect-error Deployment is installed as dependency-free ESM outside dist.
import { deployCandidate } from "../scripts/autodeploy.mjs";
const sha = "a".repeat(40),
  old = "b".repeat(40);
const baseline = () => ({
  settledSHA: old,
  previousSHA: null,
  failedSHA: null,
  phase: "idle",
});
const deps = () => {
  let state: any = baseline();
  return {
    lock: async () => true,
    unlock: async () => {},
    paused: async () => false,
    readState: async () => structuredClone(state),
    saveState: async (s: any) => {
      state = structuredClone(s);
    },
    main: async () => sha,
    approved: async () => true,
    stage: async () => {},
    switchCurrent: vi.fn(async () => {}),
    restart: vi.fn(async () => {}),
    stop: vi.fn(async () => {}),
    resetCache: vi.fn(async () => {}),
    observe: async (_candidate: string) => true,
    prune: async (_keep: string[]) => {},
    readCurrent: async () => old,
  };
};
it("blocks missing checks/artifact failures and changed main before activation", async () => {
  const d = deps();
  d.approved = async () => false;
  expect(await deployCandidate(d)).toBe("held");
  expect(d.switchCurrent).not.toHaveBeenCalled();
  d.approved = async () => true;
  d.stage = async () => {
    throw Error("wrong checksum/identity");
  };
  await expect(deployCandidate(d)).rejects.toThrow();
  expect(d.switchCurrent).not.toHaveBeenCalled();
  const e = deps();
  let calls = 0;
  e.main = async () => (++calls === 1 ? sha : old);
  expect(await deployCandidate(e)).toBe("held");
  expect(e.switchCurrent).not.toHaveBeenCalled();
});
it("serializes pause/lock and settles only observed exact candidate", async () => {
  const d = deps();
  d.lock = async () => false;
  expect(await deployCandidate(d)).toBe("noop");
  d.lock = async () => true;
  d.paused = async () => true;
  expect(await deployCandidate(d)).toBe("noop");
  d.paused = async () => false;
  expect(await deployCandidate(d)).toBe("deployed");
  expect((await d.readState()).settledSHA).toBe(sha);
  expect((await d.readState()).previousSHA).toBe(old);
});
it("rolls back failed candidate and requires explicit rearm/new SHA", async () => {
  const d = deps();
  d.observe = async (candidate) => candidate === old;
  expect(await deployCandidate(d)).toBe("rolled-back");
  expect(d.switchCurrent).toHaveBeenLastCalledWith(old);
  const state = await d.readState();
  expect(state.settledSHA).toBe(old);
  expect(state.failedSHA).toBe(sha);
  expect(d.stop).toHaveBeenCalled();
  expect(d.resetCache).toHaveBeenCalled();
  expect(await deployCandidate(d)).toBe("held");
});
it("recovers crash even if paused, never assumes candidate settled", async () => {
  const d = deps();
  await d.saveState({
    ...baseline(),
    phase: "activating",
    candidateSHA: sha,
    baselineSHA: old,
  });
  d.paused = async () => true;
  expect(await deployCandidate(d)).toBe("rolled-back");
  expect((await d.readState()).settledSHA).toBe(old);
  expect((await d.readState()).failedSHA).toBe(sha);
});
it("stops a failed first release without healthy baseline", async () => {
  const d = deps();
  await d.saveState({ ...baseline(), settledSHA: null });
  d.observe = async () => false;
  expect(await deployCandidate(d)).toBe("rolled-back");
  expect(d.switchCurrent).toHaveBeenLastCalledWith(null);
  expect((await d.readState()).settledSHA).toBeNull();
});
it("prunes failed/orphaned releases, preserving settled and previous", async () => {
  const d = deps();
  const previous = "c".repeat(40);
  await d.saveState({ ...baseline(), previousSHA: previous });
  const kept: string[][] = [];
  d.prune = async (values: string[]) => {
    kept.push(values);
  };
  d.observe = async (candidate) => candidate === old;
  expect(await deployCandidate(d)).toBe("rolled-back");
  expect(kept.at(-1)).toEqual([old, previous]);
});
it("reconciles orphan releases on an otherwise no-op tick", async () => {
  const d = deps();
  d.main = async () => old;
  let calls = 0;
  d.prune = async () => {
    calls++;
  };
  expect(await deployCandidate(d)).toBe("noop");
  expect(calls).toBe(1);
});
