import { describe, expect, test } from "bun:test";
import {
  assertFreshBackup,
  parseBackupMarker,
  parsePurgeOptions,
} from "./purge-orphan-media";

describe("local media purge safety gates", () => {
  test("defaults to dry-run and requires explicit enablement in addition to --apply", () => {
    const defaults = parsePurgeOptions([], {});
    expect(defaults.apply).toBe(false);
    expect(defaults.enabled).toBe(false);
    expect(defaults.minDays).toBe(30);
    expect(defaults.requireRemoteBackup).toBe(true);

    const apply = parsePurgeOptions(["--apply"], {
      MEDIA_PURGE_ENABLED: "true",
      PURGE_MIN_DAYS: "45",
      PURGE_REQUIRE_REMOTE_BACKUP: "false",
    });
    expect(apply.apply).toBe(true);
    expect(apply.enabled).toBe(true);
    expect(apply.minDays).toBe(45);
    expect(apply.requireRemoteBackup).toBe(false);
    expect(() => parsePurgeOptions(["--apply", "--dry-run"], {})).toThrow("PURGE_MODE_CONFLICT");
  });

  test("parses and accepts a fresh verified local and remote backup", () => {
    const marker = parseBackupMarker([
      "version=1",
      "backup_id=20260714T030000Z",
      "completed_at_epoch=1783998000",
      "local_verified=true",
      "remote_verified=true",
      "",
    ].join("\n"));
    expect(() => assertFreshBackup(marker, {
      backupMaxAgeHours: 36,
      requireRemoteBackup: true,
    }, 1783998000 + 35 * 3600)).not.toThrow();
  });

  test("blocks stale, unverified, future, or local-only backup markers", () => {
    const base = {
      backupId: "backup-1",
      completedAtEpoch: 1_000_000,
      localVerified: true,
      remoteVerified: true,
    };
    const options = { backupMaxAgeHours: 36, requireRemoteBackup: true };
    expect(() => assertFreshBackup(base, options, base.completedAtEpoch + 37 * 3600)).toThrow("MEDIA_BACKUP_STALE");
    expect(() => assertFreshBackup({ ...base, localVerified: false }, options, base.completedAtEpoch)).toThrow("MEDIA_BACKUP_NOT_VERIFIED");
    expect(() => assertFreshBackup({ ...base, remoteVerified: false }, options, base.completedAtEpoch)).toThrow("MEDIA_REMOTE_BACKUP_NOT_VERIFIED");
    expect(() => assertFreshBackup(base, options, base.completedAtEpoch - 301)).toThrow("MEDIA_BACKUP_MARKER_FROM_FUTURE");
  });

  test("rejects malformed marker and numeric settings", () => {
    expect(() => parseBackupMarker("backup_id=x\ncompleted_at_epoch=nope\n")).toThrow("MEDIA_BACKUP_MARKER_INVALID");
    expect(() => parsePurgeOptions([], { PURGE_MIN_DAYS: "0" })).toThrow("PURGE_MIN_DAYS_INVALID");
    expect(() => parsePurgeOptions([], { PURGE_BACKUP_MAX_AGE_HOURS: "NaN" })).toThrow("PURGE_BACKUP_MAX_AGE_HOURS_INVALID");
  });
});
