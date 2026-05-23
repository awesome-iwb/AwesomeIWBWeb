import { describe, expect, test } from "bun:test";
import { createUser, findUserById, issueUserAuthToken, renameUser, updateUserLogin } from "./users";
import { verifyJwt } from "../utils/jwt";

const skipPg = Boolean(process.env.DATABASE_URL);

describe("renameUser (memory store)", () => {
  test.skipIf(skipPg)("renames user and bumps token version", async () => {
    const u = await createUser({ name: "oldname", casdoor_id: "cd-rename-1" });
    const updated = await renameUser({ userId: u.id, newName: "newname", source: "admin" });
    expect(updated.name).toBe("newname");
    expect(updated.token_version).toBe(1);
    const fresh = await findUserById(u.id);
    expect(fresh?.name).toBe("newname");
  });

  test.skipIf(skipPg)("rejects invalid names", async () => {
    const u = await createUser({ name: "valid1", casdoor_id: "cd-rename-2" });
    await expect(renameUser({ userId: u.id, newName: "a", source: "admin" })).rejects.toThrow("INVALID_NAME_FORMAT");
  });

  test.skipIf(skipPg)("rejects duplicate names", async () => {
    await createUser({ name: "taken", casdoor_id: "cd-rename-3" });
    const u = await createUser({ name: "other", casdoor_id: "cd-rename-4" });
    await expect(renameUser({ userId: u.id, newName: "taken", source: "admin" })).rejects.toThrow("NAME_ALREADY_TAKEN");
  });

  test.skipIf(skipPg)("issueUserAuthToken reflects renamed name and token version", async () => {
    const u = await createUser({ name: "before", casdoor_id: "cd-rename-5" });
    await renameUser({ userId: u.id, newName: "after", source: "admin" });
    const session = await issueUserAuthToken(u.id);
    expect(session?.user.name).toBe("after");
    const payload = verifyJwt(session!.token);
    expect(payload?.name).toBe("after");
    expect(payload?.tv).toBe(1);
  });

  test.skipIf(skipPg)("login sync without name does not revert rename", async () => {
    const u = await createUser({ name: "site-name", casdoor_id: "cd-rename-6" });
    await renameUser({ userId: u.id, newName: "renamed", source: "admin" });
    await updateUserLogin(u.id, {
      email: "x@example.com",
      external_avatar_url: "https://idp/new.png",
    });
    const after = await findUserById(u.id);
    expect(after?.name).toBe("renamed");
  });
});
