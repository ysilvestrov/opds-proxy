/** DEPLOY-001/002: effects are injected; tests never install units or fetch CI. */
export async function deployCandidate(d) {
  if (!(await d.lock())) return "noop";
  try {
    const s = await d.readState();
    const rollback = async () => {
      s.phase = "rollback";
      s.failedSHA = s.candidateSHA;
      await d.saveState(s);
      await d.stop();
      await d.resetCache();
      await d.switchCurrent(s.baselineSHA ?? null);
      if (s.baselineSHA) {
        await d.restart();
        if (!(await d.observe(s.baselineSHA)))
          throw Error("Rollback readiness failed");
      }
      s.settledSHA = s.baselineSHA ?? null;
      s.phase = "idle";
      delete s.candidateSHA;
      delete s.baselineSHA;
      await d.saveState(s);
      return "rolled-back";
    };
    if (s.phase === "activating" || s.phase === "rollback")
      return await rollback();
    if (await d.paused()) return "noop";
    const sha = await d.main();
    if (sha === s.settledSHA) return "noop";
    if (sha === s.failedSHA) return "held";
    if (!(await d.approved(sha))) return "held";
    try {
      await d.stage(sha);
    } catch (error) {
      if (error.permanent) {
        s.failedSHA = sha;
        await d.saveState(s);
      }
      throw error;
    }
    if ((await d.main()) !== sha) {
      await d.prune([s.settledSHA, s.previousSHA].filter(Boolean));
      return "held";
    }
    s.candidateSHA = sha;
    s.baselineSHA = s.settledSHA;
    s.phase = "activating";
    await d.saveState(s);
    try {
      await d.switchCurrent(sha);
      await d.restart();
      if (!(await d.observe(sha))) throw Error("Readiness failed");
    } catch {
      return await rollback();
    }
    s.previousSHA = s.baselineSHA;
    s.settledSHA = sha;
    s.failedSHA = null;
    s.phase = "idle";
    delete s.candidateSHA;
    delete s.baselineSHA;
    await d.saveState(s);
    await d.prune([s.settledSHA, s.previousSHA].filter(Boolean));
    return "deployed";
  } finally {
    await d.unlock();
  }
}
