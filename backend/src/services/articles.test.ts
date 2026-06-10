import { describe, expect, test } from "bun:test";
import { normalizeArticleCoverImage, normalizeArticleInputForStorage } from "./articles";

describe("articles", () => {
  test("accepts only clean site upload cover images", () => {
    expect(normalizeArticleCoverImage("/api/uploads/content/cover.webp")).toBe("/api/uploads/content/cover.webp");
    expect(normalizeArticleCoverImage("https://example.com/cover.webp")).toBe("");
    expect(normalizeArticleCoverImage("data:image/svg+xml,<svg></svg>")).toBe("");
    expect(normalizeArticleCoverImage("/api/uploads/content/cover.webp?x=1")).toBe("");
  });

  test("normalizes public article fields before storage", () => {
    const out = normalizeArticleInputForStorage({
      title: `Title\u0000${"x".repeat(300)}`,
      subtitle: "s".repeat(800),
      category: "c".repeat(200),
      layout_type: "script" as any,
      content_format: "svg" as any,
      content: `hello\u0000\n${"a".repeat(250000)}`,
      theme: "neon" as any,
      sort_index: Number.POSITIVE_INFINITY,
      published_at: "not-a-date",
      cover_image: "https://example.com/cover.webp",
      projects: [
        { name: " Project ", slug: "../Bad Slug", icon: "/api/uploads/icons/p.webp?x=1" },
        ...Array.from({ length: 25 }, (_, i) => ({ name: `p-${i}` })),
      ],
    });

    expect(out.title.length).toBe(180);
    expect(out.subtitle.length).toBe(500);
    expect(out.category.length).toBe(80);
    expect(out.layout_type).toBe("hero");
    expect(out.content_format).toBe("markdown");
    expect(out.content.length).toBe(200000);
    expect(out.theme).toBe("dark");
    expect(out.sort_index).toBe(0);
    expect(out.published_at).toBeNull();
    expect(out.cover_image).toBe("");
    expect(out.projects).toHaveLength(20);
    expect(out.projects[0]).toEqual({ name: "Project", slug: "bad-slug" });
  });
});
