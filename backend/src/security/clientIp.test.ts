import { describe, expect, test } from "bun:test";
import { getClientIp } from "./clientIp";

describe("getClientIp", () => {
  test("does not trust forwarded headers by default", () => {
    expect(getClientIp({
      "x-forwarded-for": "203.0.113.8, 10.0.0.1",
      "x-real-ip": "203.0.113.9",
    })).toBe("direct");
  });

  test("uses proxy headers only when explicitly trusted", () => {
    expect(getClientIp({
      "x-forwarded-for": "203.0.113.8, 10.0.0.1",
      "x-real-ip": "203.0.113.9",
    }, { trustProxy: true })).toBe("203.0.113.8");
  });
});
