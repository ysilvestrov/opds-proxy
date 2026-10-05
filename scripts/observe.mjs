/** Initial startup is bounded separately from the continuous healthy window. */
export async function observeReadiness({
  probe,
  restarts,
  now = Date.now,
  sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
  startupMs = 15000,
  stableMs = 60000,
  intervalMs = 2000,
}) {
  const initial = await restarts();
  const startDeadline = now() + startupMs;
  const healthy = async () => {
    try {
      return await probe();
    } catch {
      return false;
    }
  };
  while (true) {
    if ((await restarts()) !== initial) return false;
    if (await healthy()) break;
    if (now() >= startDeadline) return false;
    await sleep(Math.min(intervalMs, startDeadline - now()));
  }
  const stableStart = now();
  while (true) {
    if (!(await healthy()) || (await restarts()) !== initial) return false;
    if (now() - stableStart >= stableMs) return true;
    await sleep(Math.min(intervalMs, stableMs - (now() - stableStart)));
  }
}
