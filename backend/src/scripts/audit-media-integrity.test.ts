import { expect, spyOn, test } from "bun:test";
import fs from "fs/promises";
import { walk } from "./audit-media-integrity";

test("media audit treats ENOENT as absent but propagates filesystem access failures", async () => {
  const missing = spyOn(fs, "readdir").mockRejectedValueOnce(
    Object.assign(new Error("missing"), { code: "ENOENT" }),
  );
  await expect(walk("/missing-media-root")).resolves.toEqual([]);
  missing.mockRestore();

  const denied = spyOn(fs, "readdir").mockRejectedValueOnce(
    Object.assign(new Error("denied"), { code: "EACCES" }),
  );
  await expect(walk("/unreadable-media-root")).rejects.toMatchObject({ code: "EACCES" });
  denied.mockRestore();
});
