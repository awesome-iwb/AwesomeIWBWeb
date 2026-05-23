import { describe, expect, test } from "bun:test";
import { matchTagsFromKeywordLabels } from "./tags";

describe("matchTagsFromKeywordLabels", () => {
  const tags = [
    { id: "1", label: "白板", slug: "whiteboard" },
    { id: "2", label: "批注", slug: "annotation" },
    { id: "3", label: "C#", slug: "csharp" },
  ];

  test("matches exact label", () => {
    expect(matchTagsFromKeywordLabels(["白板"], tags)).toEqual(["1"]);
  });

  test("matches slug", () => {
    expect(matchTagsFromKeywordLabels(["csharp"], tags)).toEqual(["3"]);
  });

  test("returns unique ids for multiple keywords", () => {
    const ids = matchTagsFromKeywordLabels(["白板", "批注"], tags);
    expect(ids.sort()).toEqual(["1", "2"]);
  });

  test("ignores empty keywords", () => {
    expect(matchTagsFromKeywordLabels(["", "  "], tags)).toEqual([]);
  });
});
