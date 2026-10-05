import { it, expect } from "vitest";
// @ts-expect-error Installed deployment ESM.
import { observeReadiness } from "../scripts/observe.mjs";
it("allows delayed listening then requires continuous healthy window", async () => {
  let time = 0,
    calls = 0;
  const result = await observeReadiness({
    probe: async () => {
      calls++;
      if (time < 20) throw Error("connection refused");
      return true;
    },
    restarts: async () => 0,
    now: () => time,
    sleep: async (ms: number) => {
      time += ms;
    },
    startupMs: 30,
    stableMs: 60,
    intervalMs: 10,
  });
  expect(result).toBe(true);
  expect(time).toBeGreaterThanOrEqual(80);
  expect(calls).toBeGreaterThan(6);
});
it("rejects startup timeout, late outage and restart during startup", async () => {
  for (const variant of ["timeout", "outage", "restart"]) {
    let time = 0;
    expect(
      await observeReadiness({
        probe: async () =>
          variant === "timeout"
            ? false
            : time < 20
              ? false
              : variant === "outage" && time >= 40
                ? false
                : true,
        restarts: async () => (variant === "restart" && time >= 10 ? 1 : 0),
        now: () => time,
        sleep: async (ms: number) => {
          time += ms;
        },
        startupMs: 30,
        stableMs: 60,
        intervalMs: 10,
      }),
    ).toBe(false);
  }
});
