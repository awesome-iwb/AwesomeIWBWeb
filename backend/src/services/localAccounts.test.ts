import { describe, expect, test } from "bun:test";
import { setLocalAccountPassword, validateSuperadminPassword } from "./localAccounts";

describe("superadmin local account policy", () => {
  test("allows password writes for any username", async () => {
    // Should not throw LOCAL_ACCOUNT_WRITE_FORBIDDEN anymore
    // In JSON mode, it will create the account if not exists
    await expect(setLocalAccountPassword("any-username", "aiwb1246790")).resolves.toBeUndefined();
  });

  test("enforces password policy", () => {
    expect(validateSuperadminPassword("weak")).toBe(false);
    expect(validateSuperadminPassword("short1")).toBe(false);
    expect(validateSuperadminPassword("aiwb1246790")).toBe(true);
    expect(validateSuperadminPassword("Strong!Password1")).toBe(true);
  });
});
