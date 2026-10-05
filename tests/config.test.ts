import { expect, it } from "vitest";
import { loadConfig } from "../src/config.js";
const env = { PUBLIC_BASE_URL: "https://opds.example", CACHE_PATH: ":memory:",
  OPDS_USERNAME: "fixture", OPDS_PASSWORD: "fixture-only" };
it("preserves direct config when source proxy is absent", () => {
  expect(loadConfig(env).OPDS_SOURCE_PROXY_URL).toBeUndefined();
});
it.each(["http://reader:private-fixture@127.0.0.1:8080", "https://127.0.0.1:8080/"])(
  "accepts explicit HTTP(S) source proxy", (url) => {
    expect(loadConfig({ ...env, OPDS_SOURCE_PROXY_URL: url }).OPDS_SOURCE_PROXY_URL).toBe(url);
  });
it.each(["", "socks5://reader:private-fixture@localhost:8080", "file:///tmp/proxy",
  "http://reader:private-fixture@localhost:8080/path", "http://localhost/?token=private-fixture",
  "http://localhost/#private-fixture", "invalid-private-fixture"])("rejects invalid proxy without disclosing its value", (url) => {
  let message = "";
  try { loadConfig({ ...env, OPDS_SOURCE_PROXY_URL: url }); } catch(e) { message = (e as Error).message; }
  expect(message).toContain("OPDS_SOURCE_PROXY_URL");
  expect(message).not.toContain("private-fixture");
  expect(message).not.toContain("localhost");
});
