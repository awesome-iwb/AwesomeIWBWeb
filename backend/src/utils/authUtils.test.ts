import { describe, expect, test } from "bun:test";
import { appConfig } from "../config";
import { parseCookieHeader } from "./cookies";
import { signJwt, verifyJwt } from "./jwt";

describe("auth utilities", () => {
  test("parseCookieHeader tolerates malformed percent encoding", () => {
    expect(parseCookieHeader("session=%E0%A4%A; theme=dark")).toEqual({
      session: "%E0%A4%A",
      theme: "dark",
    });
  });

  test("signJwt uses configured default expiration and verifies issuer/audience", () => {
    const before = Math.floor(Date.now() / 1000);
    const token = signJwt({ sub: "u1", name: "alice", role: "user", tv: 0 });
    const payload = verifyJwt(token);
    expect(payload?.sub).toBe("u1");
    expect(payload?.iss).toBe(appConfig.jwtIssuer);
    expect(payload?.aud).toBe(appConfig.jwtAudience);
    expect((payload?.exp ?? 0) - before).toBeGreaterThanOrEqual(appConfig.jwtExpiresInSeconds - 1);
    expect((payload?.exp ?? 0) - before).toBeLessThanOrEqual(appConfig.jwtExpiresInSeconds + 1);
    expect(verifyJwt(token, { iss: "other" })).toBeNull();
  });
});
