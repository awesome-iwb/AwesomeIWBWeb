import { describe, expect, test } from "bun:test";
import { parseWikilinks } from "./articleLinks";

describe("parseWikilinks", () => {
  test("parses simple wikilink", () => {
    expect(parseWikilinks("See [[my-article]] here")).toEqual(["my-article"]);
  });

  test("parses wikilink with label", () => {
    expect(parseWikilinks("[[my-article|Custom Label]]")).toEqual(["my-article"]);
  });

  test("deduplicates slugs", () => {
    expect(parseWikilinks("[[a]] and [[a]]")).toEqual(["a"]);
  });

  test("normalizes slug casing", () => {
    expect(parseWikilinks("[[My-Article]]")).toEqual(["my-article"]);
  });

  test("returns empty for no wikilinks", () => {
    expect(parseWikilinks("# Hello\n\nNo links")).toEqual([]);
  });
});
