import { describe, expect, test } from "bun:test";
import { evaluateMutationOriginGuard } from "./requestGuards";

const base = {
  method: "POST",
  allowedOrigins: ["https://app.example.com"],
  sessionCookieName: "session",
  isProduction: true,
  requestUrl: "https://api.example.com/api/upload",
};

describe("evaluateMutationOriginGuard", () => {
  test("allows safe methods", () => {
    expect(evaluateMutationOriginGuard({
      ...base,
      method: "GET",
      headers: { cookie: "session=abc", origin: "https://evil.example" },
    })).toEqual({ allowed: true });
  });

  test("allows unsafe requests without session cookies", () => {
    expect(evaluateMutationOriginGuard({
      ...base,
      headers: { origin: "https://evil.example" },
    })).toEqual({ allowed: true });
  });

  test("allows bearer-authenticated unsafe requests", () => {
    expect(evaluateMutationOriginGuard({
      ...base,
      headers: {
        cookie: "session=abc",
        authorization: "Bearer token",
        origin: "https://evil.example",
      },
    })).toEqual({ allowed: true });
  });

  test("allows configured and same-origin cookie mutations", () => {
    expect(evaluateMutationOriginGuard({
      ...base,
      headers: { cookie: "session=abc", origin: "https://app.example.com" },
    })).toEqual({ allowed: true });

    expect(evaluateMutationOriginGuard({
      ...base,
      headers: { cookie: "session=abc", origin: "https://api.example.com" },
    })).toEqual({ allowed: true });
  });

  test("blocks hostile origin and referer on cookie mutations", () => {
    expect(evaluateMutationOriginGuard({
      ...base,
      headers: { cookie: "session=abc", origin: "https://evil.example" },
    })).toEqual({ allowed: false, reason: "origin_not_allowed" });

    expect(evaluateMutationOriginGuard({
      ...base,
      headers: { cookie: "session=abc", referer: "https://evil.example/form" },
    })).toEqual({ allowed: false, reason: "referer_not_allowed" });
  });

  test("blocks missing browser origin signals only in production", () => {
    expect(evaluateMutationOriginGuard({
      ...base,
      headers: { cookie: "session=abc" },
    })).toEqual({ allowed: false, reason: "missing_origin" });

    expect(evaluateMutationOriginGuard({
      ...base,
      isProduction: false,
      headers: { cookie: "session=abc" },
    })).toEqual({ allowed: true });
  });
});
