import { describe, expect, test } from "bun:test";
import { inferDisplayRole, displayRoleLabel, displayRoleMatchesFilter } from "./displayRole";
import { ROLE_TEMPLATES } from "../services/capabilities";

describe("displayRole", () => {
  test("editor template infers as editor", () => {
    expect(inferDisplayRole(ROLE_TEMPLATES.editor.capabilityIds)).toBe("editor");
    expect(displayRoleLabel("editor")).toBe("编者");
  });

  test("developer template infers as dev", () => {
    expect(inferDisplayRole(ROLE_TEMPLATES.developer.capabilityIds)).toBe("dev");
  });

  test("user template infers as user", () => {
    expect(inferDisplayRole(ROLE_TEMPLATES.user.capabilityIds)).toBe("user");
  });

  test("ops system markers infer as ops even with story:manage", () => {
    expect(inferDisplayRole(["admin_panel_access", "story:manage", "user:manage"])).toBe("ops");
  });

  test("admin_panel with story only is editor", () => {
    expect(inferDisplayRole(["admin_panel_access", "story:manage", "project:read"])).toBe("editor");
  });

  test("bare admin_panel_access is ops", () => {
    expect(inferDisplayRole(["admin_panel_access"])).toBe("ops");
  });

  test("superadmin username overrides capabilities", () => {
    expect(inferDisplayRole([], "lincube")).toBe("superadmin");
  });

  test("ops filter includes superadmin display role", () => {
    expect(displayRoleMatchesFilter("superadmin", "ops")).toBe(true);
    expect(displayRoleMatchesFilter("editor", "ops")).toBe(false);
  });
});
