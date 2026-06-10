import { describe, expect, test } from "bun:test";
import {
  normalizeGithubRepoUrl,
  normalizeInternalUploadUrl,
  normalizePublicWebsiteUrl,
  parseGithubRepoUrl,
} from "./urlSafety";

describe("urlSafety", () => {
  test("parses and canonicalizes GitHub repository URLs", () => {
    expect(parseGithubRepoUrl("https://github.com/Owner/Repo/issues/1")).toEqual({ owner: "Owner", repo: "Repo" });
    expect(normalizeGithubRepoUrl("https://github.com/Owner/Repo.git?tab=readme"))
      .toBe("https://github.com/Owner/Repo");
  });

  test("rejects non-repository GitHub and malformed URLs", () => {
    expect(parseGithubRepoUrl("https://github.com/settings/profile")).toBeNull();
    expect(parseGithubRepoUrl("https://github.com/foo")).toBeNull();
    expect(parseGithubRepoUrl("https://github.com/foo/.git")).toBeNull();
    expect(parseGithubRepoUrl("https://github.com/foo/bar.git.git")).toBeNull();
    expect(parseGithubRepoUrl("https://evil.example/foo/bar")).toBeNull();
  });

  test("keeps only clean site upload URLs", () => {
    expect(normalizeInternalUploadUrl("/api/uploads/icons/app.webp")).toBe("/api/uploads/icons/app.webp");
    expect(normalizeInternalUploadUrl("/api/uploads/icons/app.webp?x=1")).toBe("");
    expect(normalizeInternalUploadUrl("/api/uploads/%2e%2e/secret.webp")).toBe("");
    expect(normalizeInternalUploadUrl("https://example.com/api/uploads/app.webp")).toBe("");
    expect(normalizeInternalUploadUrl("data:image/svg+xml,<svg></svg>")).toBe("");
  });

  test("keeps only absolute public http URLs", () => {
    expect(normalizePublicWebsiteUrl("https://example.com/about")).toBe("https://example.com/about");
    expect(normalizePublicWebsiteUrl("http://example.com")).toBe("http://example.com/");
    expect(normalizePublicWebsiteUrl("javascript:alert(1)")).toBe("");
    expect(normalizePublicWebsiteUrl("https://user:pass@example.com")).toBe("");
    expect(normalizePublicWebsiteUrl("/relative")).toBe("");
  });
});
