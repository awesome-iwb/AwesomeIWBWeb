import { describe, expect, mock, test } from "bun:test";
import { evaluateStatusFromPush, parseGithubRepoUrl, syncProjectFromGithub } from "./githubProjectSync";

mock.module("./projects", () => ({
  markProjectGithubSyncAttempt: mock(async () => {}),
  updateProjectGithubMetadata: mock(async () => ({})),
}));

const projectsModule = await import("./projects");

describe("githubProjectSync", () => {
  test("parseGithubRepoUrl", () => {
    expect(parseGithubRepoUrl("https://github.com/foo/bar")).toEqual({ owner: "foo", repo: "bar" });
    expect(parseGithubRepoUrl("https://github.com/foo/bar.git")).toEqual({ owner: "foo", repo: "bar" });
    expect(parseGithubRepoUrl("https://github.com/foo/bar/issues/1")).toEqual({ owner: "foo", repo: "bar" });
    expect(parseGithubRepoUrl("")).toBeNull();
    expect(parseGithubRepoUrl("https://github.com/foo")).toBeNull();
    expect(parseGithubRepoUrl("https://github.com/foo/.git")).toBeNull();
    expect(parseGithubRepoUrl("https://github.com/settings/profile")).toBeNull();
    expect(parseGithubRepoUrl("https://github.com/foo/bar baz")).toBeNull();
    expect(parseGithubRepoUrl("https://github.com/foo/bar.git.git")).toBeNull();
    expect(parseGithubRepoUrl("https://evil.example/foo/bar")).toBeNull();
  });

  test("evaluateStatusFromPush", () => {
    const recent = new Date(Date.now() - 30 * 86400000).toISOString();
    expect(evaluateStatusFromPush(recent)).toBe("活跃");
    const old = new Date(Date.now() - 400 * 86400000).toISOString();
    expect(evaluateStatusFromPush(old)).toBe("可能停更");
  });

  test("syncProjectFromGithub reuses release list and falls back to tags", async () => {
    const calls = { get: 0, listReleases: 0, getLatestRelease: 0, listTags: 0 };
    const fakeClient = {
      repos: {
        async get() {
          calls.get++;
          return {
            data: {
              stargazers_count: 42,
              language: "TypeScript",
              pushed_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              fork: false,
            },
          };
        },
        async listReleases() {
          calls.listReleases++;
          return { data: [] };
        },
        async getLatestRelease() {
          calls.getLatestRelease++;
          throw new Error("no latest release");
        },
        async listTags() {
          calls.listTags++;
          return { data: [{ name: "v1.0.0" }] };
        },
      },
    };

    const result = await syncProjectFromGithub(
      { id: "p1", github_url: "https://github.com/foo/bar", status: "活跃", extra: {} } as any,
      { dryRun: true, octokitClient: fakeClient as any }
    );

    expect(result).toEqual({ id: "p1", updated: true });
    expect(calls).toEqual({ get: 1, listReleases: 1, getLatestRelease: 1, listTags: 1 });
  });

  test("syncProjectFromGithub sanitizes persisted GitHub metadata", async () => {
    const update = projectsModule.updateProjectGithubMetadata as any;
    update.mockClear();
    const longTag = "v" + "1".repeat(200);
    const longBody = "release notes\n".repeat(500);
    const fakeClient = {
      repos: {
        async get() {
          return {
            data: {
              stargazers_count: 12.8,
              language: "TypeScript",
              pushed_at: "not-a-date",
              updated_at: "2026-06-01T00:00:00.000Z",
              fork: true,
              parent: { html_url: "https://github.com/settings/profile" },
              source: { html_url: "https://github.com/Upstream/Repo/issues/1" },
            },
          };
        },
        async listReleases() {
          return {
            data: [
              {
                tag_name: longTag,
                published_at: "also-not-a-date",
                body: longBody,
                html_url: "javascript:alert(1)",
                assets: [{ download_count: 2.9 }, { download_count: -10 }],
              },
            ],
          };
        },
        async getLatestRelease() {
          return { data: { tag_name: "latest" } };
        },
      },
    };

    const result = await syncProjectFromGithub(
      { id: "p2", github_url: "https://github.com/foo/bar", status: "活跃", extra: {} } as any,
      { octokitClient: fakeClient as any }
    );

    expect(result).toEqual({ id: "p2", updated: true });
    expect(update).toHaveBeenCalledTimes(1);
    const patch = update.mock.calls[0][1];
    expect(patch.stars).toBe(12);
    expect(patch.version).toBe("latest");
    expect(patch.last_update).toBe("2026-06-01T00:00:00.000Z");
    expect(patch.github_parent_url).toBe("");
    expect(patch.github_source_url).toBe("https://github.com/Upstream/Repo");
    expect(patch.extra.github_release_downloads).toBe(2);
    expect(patch.extra.releases[0].tag_name).toHaveLength(160);
    expect(patch.extra.releases[0].published_at).toBeNull();
    expect(patch.extra.releases[0].body).toHaveLength(4000);
    expect(patch.extra.releases[0].html_url).toBe(
      `https://github.com/foo/bar/releases/tag/${encodeURIComponent(longTag.slice(0, 160))}`
    );
  });

  test("syncProjectFromGithub marks invalid repository URLs outside dry runs", async () => {
    const markAttempt = projectsModule.markProjectGithubSyncAttempt as any;
    markAttempt.mockClear();

    const result = await syncProjectFromGithub(
      { id: "bad1", github_url: "https://github.com/settings/profile", status: "active", extra: {} } as any
    );

    expect(result).toEqual({ id: "bad1", updated: false, skipped: "invalid_github_url" });
    expect(markAttempt).toHaveBeenCalledWith("bad1", "invalid_github_url");

    markAttempt.mockClear();
    await syncProjectFromGithub(
      { id: "bad2", github_url: "https://github.com/settings/profile", status: "active", extra: {} } as any,
      { dryRun: true }
    );
    expect(markAttempt).not.toHaveBeenCalled();
  });
});
