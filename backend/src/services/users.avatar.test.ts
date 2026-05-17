import { describe, expect, test } from "bun:test";
import { createUser, findUserById, updateUserAvatarPreference, updateUserLogin } from "./users";

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
      avatar_url: "https://cdn/y.webp",
      avatar_source: "upload",
      upload_avatar_url: "https://cdn/y.webp",
    });
    const mid = await findUserById(u.id);
    expect(mid?.avatar_url).toBe("https://cdn/y.webp");
    await updateUserLogin(u.id, {
      name: mid!.name,
      external_avatar_url: "https://idp/z.png",
    });
    const after = await findUserById(u.id);
    expect(after?.avatar_url).toBe("https://cdn/y.webp");
    expect(after?.external_avatar_url).toBe("https://idp/z.png");
  });

  test.skipIf(skipPg)("updateUserAvatarPreference toggles display URL", async () => {
    const u = await createUser({
      casdoor_id: `id-${crypto.randomUUID()}`,
      name: `v-${crypto.randomUUID().slice(0, 8)}`,
      avatar_url: "https://idp/a.png",
      avatar_source: "casdoor",
      external_avatar_url: "https://idp/a.png",
      upload_avatar_url: "https://cdn/b.webp",
    });
    await updateUserLogin(u.id, {
      avatar_url: "https://cdn/b.webp",
      avatar_source: "upload",
      upload_avatar_url: "https://cdn/b.webp",
      external_avatar_url: "https://idp/a.png",
    });
    const switched = await updateUserAvatarPreference(u.id, "casdoor");
    expect(switched.avatar_source).toBe("casdoor");
    expect(switched.avatar_url).toBe("https://idp/a.png");
    const back = await updateUserAvatarPreference(u.id, "upload");
    expect(back.avatar_source).toBe("upload");
    expect(back.avatar_url).toBe("https://cdn/b.webp");
  });
});
