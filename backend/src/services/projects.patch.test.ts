import { describe, expect, test } from "bun:test";
import { extractDevProjectBaselinePatch, extractDevProjectOwnerAdminPatch } from "./projects";

describe("extractDevProjectBaselinePatch", () => {
  test("picks only baseline keys present in payload", () => {
    const p = {
      name: " App ",
      description: "d",
      github_url: "https://github.com/x/y",
      language: "TS",
      status: "活跃",
      version: "1",
      keywords: "a, b",
    };
    const out = extractDevProjectBaselinePatch(p);
    expect(out.name).toBe("App");
    expect(out.keywords).toEqual(["a", "b"]);
    expect((out as any).icon).toBeUndefined();
  });

  test("ignores icon when only icon is sent", () => {
    const out = extractDevProjectBaselinePatch({ icon: "/api/uploads/x.webp" });
    expect(Object.keys(out)).toHaveLength(0);
  });
});

describe("extractDevProjectOwnerAdminPatch", () => {
  test("extracts media and extra when present", () => {
    const out = extractDevProjectOwnerAdminPatch({
      icon: "/api/uploads/i.webp",
      banner: "/api/uploads/b.webp",
      extra: { filing_image: "/api/uploads/f.webp" },
      stars: 42,
      ai_usage_state: "under50",
      recommendation: "稳定",
    });
    expect(out.icon).toBe("/api/uploads/i.webp");
    expect(out.banner).toBe("/api/uploads/b.webp");
    expect(out.extra).toEqual({ filing_image: "/api/uploads/f.webp" });
    expect(out.stars).toBe(42);
    expect(out.ai_usage_state).toBe("under50");
    expect(out.recommendation).toEqual(["稳定"]);
  });
});
