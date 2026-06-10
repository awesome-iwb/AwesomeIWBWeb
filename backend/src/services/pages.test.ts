import { describe, expect, test } from "bun:test";
import { normalizePageCapability, normalizePageInput, normalizePagePatch, normalizePagePath } from "./pages";

describe("pages service normalization", () => {
  test("accepts only known first-party route paths", () => {
    expect(normalizePagePath("/admin/routes")).toBe("/admin/routes");
    expect(normalizePagePath("https://evil.example/admin/routes")).toBe("");
    expect(normalizePagePath("//evil.example/path")).toBe("");
    expect(normalizePagePath("/unknown")).toBe("");
  });

  test("accepts only registered capability ids", () => {
    expect(normalizePageCapability("route:manage")).toBe("route:manage");
    expect(normalizePageCapability("")).toBe("");
    expect(normalizePageCapability("route:manage\u0000")).toBe("route:manage");
    expect(normalizePageCapability("route:manage:evil")).toBeNull();
  });

  test("normalizes route metadata and clamps sort order", () => {
    const page = normalizePageInput({
      path: "/about",
      title: ` About\u0000${"x".repeat(200)}`,
      description: "d".repeat(800),
      group: "public",
      icon: "Info",
      required_capability: "",
      sort_index: Number.POSITIVE_INFINITY,
    } as any);

    expect(page.path).toBe("/about");
    expect(page.title.length).toBe(120);
    expect(page.description.length).toBe(500);
    expect(page.sort_index).toBe(0);
  });

  test("rejects unknown paths and unknown capabilities on writes", () => {
    expect(() => normalizePageInput({ path: "/evil", title: "x" } as any)).toThrow("invalid page path");
    expect(() => normalizePagePatch({ required_capability: "unknown:cap" } as any)).toThrow("invalid page capability");
  });
});
