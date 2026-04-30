import { describe, expect, test } from "bun:test";
import { normalizeAiUsageState, parseAiUsageState, readAiUsageStateField } from "./aiUsage";

describe("ai usage state", () => {
  test("parseAiUsageState: unknown by default", () => {
    expect(parseAiUsageState(undefined)).toBe("unknown");
    expect(parseAiUsageState(null)).toBe("unknown");
    expect(parseAiUsageState("")).toBe("unknown");
    expect(parseAiUsageState("something")).toBe("unknown");
  });

  test("parseAiUsageState: accepts known values", () => {
    expect(parseAiUsageState("unknown")).toBe("unknown");
    expect(parseAiUsageState("over50")).toBe("over50");
    expect(parseAiUsageState("under50")).toBe("under50");
  });

  test("normalizeAiUsageState: prefers explicit ai_usage_state", () => {
    expect(normalizeAiUsageState({ ai_usage_state: "over50", ai_generated: false, human_verified: true })).toBe("over50");
    expect(normalizeAiUsageState({ ai_usage_state: "under50", ai_generated: true, human_verified: false })).toBe("under50");
    expect(normalizeAiUsageState({ ai_usage_state: "unknown", ai_generated: true, human_verified: true })).toBe("unknown");
  });

  test("normalizeAiUsageState: falls back to legacy flags", () => {
    expect(normalizeAiUsageState({ ai_generated: true })).toBe("over50");
    expect(normalizeAiUsageState({ human_verified: true })).toBe("under50");
    expect(normalizeAiUsageState({})).toBe("unknown");
  });

  test("readAiUsageStateField: undefined when missing, otherwise parsed", () => {
    expect(readAiUsageStateField({})).toBeUndefined();
    expect(readAiUsageStateField({ ai_generated: true })).toBeUndefined();
    expect(readAiUsageStateField({ ai_usage_state: "under50" })).toBe("under50");
    expect(readAiUsageStateField({ ai_usage_state: "bad" })).toBe("unknown");
  });
});
