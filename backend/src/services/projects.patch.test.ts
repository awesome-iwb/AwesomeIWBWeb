import { describe, expect, test } from "bun:test";
import {
  createCategory,
  createProject,
  deleteCategory,
  deleteProject,
  extractDevProjectBaselinePatch,
  extractDevProjectOwnerAdminPatch,
  getProjectById,
  UNCATEGORIZED_CATEGORY_ID,
  updateProject,
} from "./projects";

const skipPg = !process.env.DATABASE_URL;

describe("extractDevProjectBaselinePatch", () => {
  test("picks only baseline keys present in payload", () => {
    const p = {
      name: " App ",
      description: "d",
      github_url: "https://github.com/x/y",
      language: "TS",
      status: "active",
      version: "1",
      keywords: "a, b",
    };
    const out = extractDevProjectBaselinePatch(p);
    expect(out.name).toBe("App");
    expect(out.keywords).toEqual(["a", "b"]);
    expect((out as any).icon).toBeUndefined();
  });

  test("rejects unsafe baseline GitHub URLs", () => {
    expect(extractDevProjectBaselinePatch({ github_url: "javascript:alert(1)" }).github_url).toBe("");
    expect(extractDevProjectBaselinePatch({ github_url: "https://evil.example/x/y" }).github_url).toBe("");
    expect(extractDevProjectBaselinePatch({ github_url: "https://github.com/settings/profile" }).github_url).toBe("");
    expect(extractDevProjectBaselinePatch({ github_url: "https://github.com/x/y" }).github_url).toBe("https://github.com/x/y");
    expect(extractDevProjectBaselinePatch({ github_url: "https://github.com/x/y/pull/1" }).github_url).toBe("https://github.com/x/y");
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
      recommendation: "stable",
    });
    expect(out.icon).toBe("/api/uploads/i.webp");
    expect(out.banner).toBe("/api/uploads/b.webp");
    expect(out.extra).toEqual({ filing_image: "/api/uploads/f.webp" });
    expect(out.stars).toBe(42);
    expect(out.ai_usage_state).toBe("under50");
    expect(out.recommendation).toEqual(["stable"]);
  });

  test("limits developer extra fields to safe media metadata", () => {
    const out = extractDevProjectOwnerAdminPatch({
      extra: {
        filing_image: "/api/uploads/f.webp",
        filing_image_url: "https://example.com/f.webp",
        is_editors_choice: true,
        releases: [{ tag_name: "v9" }],
        reviews: [{ author: "me", content: "great" }],
      },
    });

    expect(out.extra).toEqual({ filing_image: "/api/uploads/f.webp", filing_image_url: "" });
  });

  test("rejects unsafe owner media URLs", () => {
    const out = extractDevProjectOwnerAdminPatch({
      icon: "https://example.com/icon.webp",
      banner: "javascript:alert(1)",
      avatar: "/api/uploads/avatar.webp",
    });

    expect(out.icon).toBe("");
    expect(out.banner).toBe("");
    expect(out.avatar).toBe("/api/uploads/avatar.webp");
  });
});

describe("project service storage normalization", () => {
  test.skipIf(skipPg)("normalizes unsafe project URLs and media before insert/update", async () => {
    const created = await createProject({
      name: `unsafe-${crypto.randomUUID()}`,
      github_url: "https://github.com/owner/repo/issues/1",
      icon: "javascript:alert(1)",
      banner: "/api/uploads/banners/a.webp?x=1",
    } as any);

    expect(created.github_url).toBe("https://github.com/owner/repo");
    expect(created.icon).toBe("");
    expect(created.banner).toBe("");

    const updated = await updateProject(created.id, {
      github_url: "https://github.com/settings/profile",
      icon: "/api/uploads/icons/a.webp",
    });

    expect(updated?.github_url).toBe("");
    expect(updated?.icon).toBe("/api/uploads/icons/a.webp");
  });

  test.skipIf(skipPg)("assigns uncategorized fallback when creating without category", async () => {
    const created = await createProject({
      name: `uncategorized-create-${crypto.randomUUID()}`,
    } as any);

    try {
      expect(created.category_id).toBe(UNCATEGORIZED_CATEGORY_ID);
    } finally {
      await deleteProject(created.id);
    }
  });

  test.skipIf(skipPg)("moves project to uncategorized when category is cleared", async () => {
    const category = await createCategory({ name: `category-clear-${crypto.randomUUID()}` });
    const created = await createProject({
      name: `uncategorized-update-${crypto.randomUUID()}`,
      category_id: category.id,
    } as any);

    try {
      const updated = await updateProject(created.id, { category_id: null });
      expect(updated?.category_id).toBe(UNCATEGORIZED_CATEGORY_ID);
    } finally {
      await deleteProject(created.id);
      await deleteCategory(category.id);
    }
  });

  test.skipIf(skipPg)("reassigns projects when deleting a category", async () => {
    const category = await createCategory({ name: `category-delete-${crypto.randomUUID()}` });
    const created = await createProject({
      name: `uncategorized-delete-${crypto.randomUUID()}`,
      category_id: category.id,
    } as any);

    try {
      const deleted = await deleteCategory(category.id);
      const moved = await getProjectById(created.id);

      expect(deleted?.success).toBe(true);
      expect(deleted?.moved_projects).toBe(1);
      expect(moved?.category_id).toBe(UNCATEGORIZED_CATEGORY_ID);
    } finally {
      await deleteProject(created.id);
    }
  });

  test.skipIf(skipPg)("prevents deleting uncategorized category", async () => {
    await expect(deleteCategory(UNCATEGORIZED_CATEGORY_ID)).rejects.toThrow("CANNOT_DELETE_UNCATEGORIZED_CATEGORY");
  });
});
