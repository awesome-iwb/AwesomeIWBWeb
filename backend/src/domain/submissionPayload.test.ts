import { describe, expect, test } from "bun:test";
import { normalizeProjectSubmissionPayload, validateProjectSubmissionPayload } from "./submissionPayload";

describe("project submission payload", () => {
  test("keeps only whitelisted fields", () => {
    const payload = normalizeProjectSubmissionPayload({
      name: " App ",
      developer: " Dev ",
      github_url: "https://github.com/owner/repo",
      description: "desc",
      keywords: "whiteboard, math",
      category: "tools",
      ai_usage_state: "under50",
      icon: "/api/uploads/icons/a.webp",
      banner_url: "https://example.com/banner.webp",
      extra: { unexpected: true },
      nested: Array.from({ length: 100 }, (_, i) => ({ i })),
    });

    expect(payload).toEqual({
      name: "App",
      developer: "Dev",
      github_url: "https://github.com/owner/repo",
      description: "desc",
      keywords: "whiteboard, math",
      category: "tools",
      ai_usage_state: "under50",
      icon: "/api/uploads/icons/a.webp",
    });
  });

  test("accepts only site-managed upload URLs for media fields", () => {
    const payload = normalizeProjectSubmissionPayload({
      name: "App",
      developer: "Dev",
      github_url: "https://github.com/owner/repo",
      icon: "https://example.com/icon.webp",
      banner: "/api/uploads/banners/a.webp",
    });

    expect(payload.icon).toBeUndefined();
    expect(payload.banner).toBe("/api/uploads/banners/a.webp");
  });

  test("rejects missing or non-GitHub repository URLs", () => {
    const payload = normalizeProjectSubmissionPayload({
      name: "App",
      developer: "Dev",
      github_url: "https://evil.example/owner/repo",
    });
    expect(payload.github_url).toBe("");
    expect(validateProjectSubmissionPayload(payload)).toBe("name, developer, github_url are required");
  });

  test("normalizes GitHub URLs to canonical repository URLs", () => {
    const payload = normalizeProjectSubmissionPayload({
      name: "App",
      developer: "Dev",
      github_url: "https://github.com/Owner/Repo/issues/1",
    });

    expect(payload.github_url).toBe("https://github.com/Owner/Repo");
  });

  test("bounds long public text fields", () => {
    const payload = normalizeProjectSubmissionPayload({
      name: "x".repeat(200),
      developer: "d".repeat(200),
      github_url: "https://github.com/owner/repo",
      description: "a".repeat(6000),
      keywords: "b".repeat(1200),
    });

    expect(payload.name.length).toBe(120);
    expect(payload.developer.length).toBe(120);
    expect(payload.description.length).toBe(5000);
    expect(payload.keywords.length).toBe(1000);
  });
});
