import { describe, expect, test } from "bun:test";
import { normalizeMediaTags } from "./media";

describe("media service normalization", () => {
  test("dedupes, cleans, and bounds media tags", () => {
    const tags = normalizeMediaTags([
      "  alpha  ",
      "alpha",
      "\u0000beta\u0007",
      "",
      ...Array.from({ length: 80 }, (_, i) => `tag-${i}`),
      "x".repeat(100),
    ]);

    expect(tags[0]).toBe("alpha");
    expect(tags[1]).toBe("beta");
    expect(tags).toHaveLength(50);
    expect(tags.every((tag) => tag.length <= 64)).toBe(true);
  });

  test("rejects non-array tag payloads", () => {
    expect(normalizeMediaTags("alpha")).toEqual([]);
    expect(normalizeMediaTags(null)).toEqual([]);
  });
});
