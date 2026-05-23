import { describe, expect, test } from "bun:test";
import {
  ALLOWED_INTERVAL_HOURS,
  computeNextRunAt,
  deriveRunStatus,
  isAllowedIntervalHours,
  isSyncDue,
} from "./githubSyncJob";

describe("githubSyncJob", () => {
  test("computeNextRunAt adds interval hours", () => {
    const last = new Date("2026-01-01T00:00:00.000Z");
    const next = computeNextRunAt(last, 24);
    expect(next?.toISOString()).toBe("2026-01-02T00:00:00.000Z");
  });

  test("computeNextRunAt returns null when never run", () => {
    expect(computeNextRunAt(null, 24)).toBeNull();
  });

  test("isSyncDue respects enabled flag", () => {
    const now = new Date("2026-01-03T00:00:00.000Z");
    expect(
      isSyncDue(
        {
          enabled: false,
          last_run_at: "2026-01-01T00:00:00.000Z",
          interval_hours: 24,
          next_run_at: "2026-01-02T00:00:00.000Z",
        },
        now
      )
    ).toBe(false);
  });

  test("isSyncDue when never run", () => {
    expect(
      isSyncDue(
        { enabled: true, last_run_at: null, interval_hours: 24, next_run_at: null },
        new Date()
      )
    ).toBe(true);
  });

  test("isSyncDue when next_run_at elapsed", () => {
    const now = new Date("2026-01-03T00:00:00.000Z");
    expect(
      isSyncDue(
        {
          enabled: true,
          last_run_at: "2026-01-01T00:00:00.000Z",
          interval_hours: 24,
          next_run_at: "2026-01-02T00:00:00.000Z",
        },
        now
      )
    ).toBe(true);
  });

  test("deriveRunStatus", () => {
    expect(deriveRunStatus({ total: 10, updated: 10, failed: 0 })).toBe("success");
    expect(deriveRunStatus({ total: 10, updated: 5, failed: 5 })).toBe("partial");
    expect(deriveRunStatus({ total: 10, updated: 0, failed: 10 })).toBe("failed");
  });

  test("allowed interval hours", () => {
    for (const h of ALLOWED_INTERVAL_HOURS) {
      expect(isAllowedIntervalHours(h)).toBe(true);
    }
    expect(isAllowedIntervalHours(7)).toBe(false);
  });
});
