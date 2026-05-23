import { describe, expect, test } from "bun:test";
import { evaluateStatusFromPush, parseGithubRepoUrl } from "./githubProjectSync";

describe("githubProjectSync", () => {
  test("parseGithubRepoUrl", () => {
    expect(parseGithubRepoUrl("https://github.com/foo/bar")).toEqual({ owner: "foo", repo: "bar" });
    expect(parseGithubRepoUrl("https://github.com/foo/bar.git")).toEqual({ owner: "foo", repo: "bar" });
    expect(parseGithubRepoUrl("")).toBeNull();
  });

  test("evaluateStatusFromPush", () => {
    const recent = new Date(Date.now() - 30 * 86400000).toISOString();
    expect(evaluateStatusFromPush(recent)).toBe("活跃");
    const old = new Date(Date.now() - 400 * 86400000).toISOString();
    expect(evaluateStatusFromPush(old)).toBe("可能停更");
  });
});
