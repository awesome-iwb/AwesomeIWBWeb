import { describe, expect, test } from "bun:test";
import { createUser, findUserById, normalizeUserAvatarUrl, updateUserAvatarPreference, updateUserLogin } from "./users";

const skipPg = Boolean(process.env.DATABASE_URL);

describe("avatar preference (memory store)", () => {
  test.skipIf(skipPg)("login sync refreshes external URL without overwriting upload display", async () => {
    const u = await createUser({
      casdoor_id: `id-${crypto.randomUUID()}`,
      name: `u-${crypto.randomUUID().slice(0, 8)}`,
      avatar_url: "https://idp/x.png",
      avatar_source: "casdoor",
      external_avatar_url: "https://idp/x.png",
      upload_avatar_url: "",
    });
    await updateUserLogin(u.id, {
      avatar_url: "/api/uploads/avatars/y.webp",
      avatar_source: "upload",
      upload_avatar_url: "/api/uploads/avatars/y.webp",
    });
    const mid = await findUserById(u.id);
    expect(mid?.avatar_url).toBe("/api/uploads/avatars/y.webp");
    await updateUserLogin(u.id, {
      name: mid!.name,
      external_avatar_url: "https://idp/z.png",
    });
    const after = await findUserById(u.id);
    expect(after?.avatar_url).toBe("/api/uploads/avatars/y.webp");
    expect(after?.external_avatar_url).toBe("https://idp/z.png");
  });

  test.skipIf(skipPg)("updateUserAvatarPreference toggles display URL", async () => {
    const u = await createUser({
      casdoor_id: `id-${crypto.randomUUID()}`,
      name: `v-${crypto.randomUUID().slice(0, 8)}`,
      avatar_url: "https://idp/a.png",
      avatar_source: "casdoor",
      external_avatar_url: "https://idp/a.png",
      upload_avatar_url: "/api/uploads/avatars/b.webp",
    });
    await updateUserLogin(u.id, {
      avatar_url: "/api/uploads/avatars/b.webp",
      avatar_source: "upload",
      upload_avatar_url: "/api/uploads/avatars/b.webp",
      external_avatar_url: "https://idp/a.png",
    });
    const switched = await updateUserAvatarPreference(u.id, "casdoor");
    expect(switched.avatar_source).toBe("casdoor");
    expect(switched.avatar_url).toBe("https://idp/a.png");
    const back = await updateUserAvatarPreference(u.id, "upload");
    expect(back.avatar_source).toBe("upload");
    expect(back.avatar_url).toBe("/api/uploads/avatars/b.webp");
  });

  test.skipIf(skipPg)("rejects unsafe avatar URLs at the service layer", async () => {
    const u = await createUser({
      casdoor_id: `id-${crypto.randomUUID()}`,
      name: `w-${crypto.randomUUID().slice(0, 8)}`,
      avatar_url: "javascript:alert(1)",
      avatar_source: "casdoor",
      external_avatar_url: "data:image/svg+xml,<svg></svg>",
      upload_avatar_url: "https://example.com/upload.webp",
    });

    expect(u.avatar_url).toBe("");
    expect(u.external_avatar_url).toBe("");
    expect(u.upload_avatar_url).toBe("");

    await updateUserLogin(u.id, {
      avatar_url: "data:image/svg+xml,<svg></svg>",
      external_avatar_url: "javascript:alert(1)",
      upload_avatar_url: "/api/uploads/avatars/ok.webp?x=1",
    });
    const after = await findUserById(u.id);
    expect(after?.avatar_url).toBe("");
    expect(after?.external_avatar_url).toBe("");
    expect(after?.upload_avatar_url).toBe("");
  });

  test("normalizes public and internal avatar URLs", () => {
    expect(normalizeUserAvatarUrl("https://example.com/a.png")).toBe("https://example.com/a.png");
    expect(normalizeUserAvatarUrl("/api/uploads/avatars/a.webp")).toBe("/api/uploads/avatars/a.webp");
    expect(normalizeUserAvatarUrl("javascript:alert(1)")).toBe("");
  });
});
