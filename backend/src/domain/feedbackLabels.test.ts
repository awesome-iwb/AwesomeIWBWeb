import { describe, expect, test } from "bun:test";
import { sanitizeIssueLabels } from "./feedbackLabels";

describe("sanitizeIssueLabels", () => {
  test("keeps only allowed labels", () => {
    const out = sanitizeIssueLabels(["type:bug", "unknown", "area:ui", ""]);
    expect(out).toEqual(["type:bug", "area:ui"]);
  });
});

