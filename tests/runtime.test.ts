import { spawn } from "node:child_process";
import { expect, it } from "vitest";
it("starts loopback runtime, protects catalog and stops", async () => {
  const port = 18878;
  const child = spawn(process.execPath, ["dist/index.js"], {
    env: {
      ...process.env,
      PORT: String(port),
      PUBLIC_BASE_URL: "https://opds.example",
      CACHE_PATH: ":memory:",
      OPDS_USERNAME: "local-reader",
      OPDS_PASSWORD: "local-test-only",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let log = "";
  child.stdout.on("data", (b) => (log += b.toString()));
  child.stderr.on("data", (b) => (log += b.toString()));
  try {
    for (let n = 0; n < 50 && !log.includes("listening"); n++)
      await new Promise((r) => setTimeout(r, 50));
    expect(log).toContain("listening");
    const base = `http://127.0.0.1:${port}`;
    expect((await fetch(base + "/health")).status).toBe(200);
    expect((await fetch(base + "/opds")).status).toBe(401);
    expect(
      (
        await fetch(base + "/opds", {
          headers: {
            authorization:
              "Basic " +
              Buffer.from("local-reader:local-test-only").toString("base64"),
          },
        })
      ).status,
    ).toBe(200);
    expect(log).not.toContain("local-test-only");
  } finally {
    child.kill("SIGTERM");
    await new Promise<void>((r) => child.once("exit", () => r()));
    if (process.platform !== "win32") expect(log).toContain("stopped");
  }
});
