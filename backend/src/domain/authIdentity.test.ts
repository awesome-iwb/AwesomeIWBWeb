import { describe, expect, test } from "bun:test";
import { apiTokenCanUseCapability, isApiTokenIdentity, userIdForForeignKey } from "./authIdentity";

describe("auth identity helpers", () => {
  test("detects API token identities without relying on username", () => {
    expect(isApiTokenIdentity({ id: "token:abc", auth_type: "api_token" })).toBe(true);
    expect(isApiTokenIdentity({ id: "user-id", auth_type: "user" })).toBe(false);
  });

  test("only real user ids are usable as database foreign keys", () => {
    expect(userIdForForeignKey({ id: "00000000-0000-0000-0000-000000000001", auth_type: "user" })).toBe("00000000-0000-0000-0000-000000000001");
    expect(userIdForForeignKey({ id: "00000000-0000-0000-0000-000000000002", auth_type: "local" })).toBe("00000000-0000-0000-0000-000000000002");
    expect(userIdForForeignKey({ id: "token:abc", auth_type: "api_token" })).toBeNull();
  });

  test("API tokens are limited to service/admin capabilities", () => {
    expect(apiTokenCanUseCapability("project:update")).toBe(true);
    expect(apiTokenCanUseCapability("project:import")).toBe(true);
    expect(apiTokenCanUseCapability("project:export")).toBe(true);
    expect(apiTokenCanUseCapability("analytics:read")).toBe(true);

    expect(apiTokenCanUseCapability("admin_panel_access")).toBe(false);
    expect(apiTokenCanUseCapability("user:manage")).toBe(false);
    expect(apiTokenCanUseCapability("user:delete")).toBe(false);
    expect(apiTokenCanUseCapability("user:avatar")).toBe(false);
    expect(apiTokenCanUseCapability("user:create_org")).toBe(false);
    expect(apiTokenCanUseCapability("dev_panel_access")).toBe(false);
    expect(apiTokenCanUseCapability("dev:project_edit")).toBe(false);
    expect(apiTokenCanUseCapability("story:manage")).toBe(false);
    expect(apiTokenCanUseCapability("route:manage")).toBe(false);
    expect(apiTokenCanUseCapability("media:manage")).toBe(false);
  });
});
