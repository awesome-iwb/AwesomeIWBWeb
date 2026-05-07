import { describe, expect, test } from "bun:test";
import { setLocalAccountPassword, validateSuperadminPassword } from "./localAccounts";

describe("superadmin local account policy", () => {
  test("rejects password writes for non-lincube", async () => {
    await expect(setLocalAccountPassword("someone-else", "Abcd!2345678")).rejects.toThrow(
      "LOCAL_ACCOUNT_WRITE_FORBIDDEN"
    );
  });

  test("enforces strong password policy", () => {
    expect(validateSuperadminPassword("weak")).toBe(false);
    expect(validateSuperadminPassword("Strong!Password1")).toBe(true);
  });
});

