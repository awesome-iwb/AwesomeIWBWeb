import { describe, expect, test } from "bun:test";
import { sql } from "../db/client";
import {
  createNotificationCampaign,
  normalizeNotificationAudience,
  normalizeNotificationCampaignInput,
  sendNotificationCampaign,
  updateNotificationCampaign,
} from "./notifications";

const runDbTests = Boolean(process.env.DATABASE_URL) && process.env.RUN_NOTIFICATION_DB_TESTS === "true";

describe("notification campaign normalization", () => {
  test("normalizes text, level and all audience", () => {
    const input = normalizeNotificationCampaignInput({
      title: `  ${"A".repeat(100)}  `,
      body: `  ${"B".repeat(900)}  `,
      level: "bad",
      audience: { kind: "all", userNames: ["alice"] },
    });

    expect(input.title.length).toBe(80);
    expect(input.body.length).toBe(800);
    expect(input.level).toBe("info");
    expect(input.audience_kind).toBe("all");
    expect(input.target_user_names).toEqual([]);
  });

  test("deduplicates specified user audience", () => {
    const audience = normalizeNotificationAudience({
      kind: "users",
      userNames: ["Alice", "alice", " Bob ", "", "BOB"],
    });

    expect(audience.audience_kind).toBe("users");
    expect(audience.target_user_names).toEqual(["Alice", "Bob"]);
  });

  test("requires title, body and specified users", () => {
    expect(() => normalizeNotificationCampaignInput({ title: "", body: "x" })).toThrow("TITLE_REQUIRED");
    expect(() => normalizeNotificationCampaignInput({ title: "x", body: "" })).toThrow("BODY_REQUIRED");
    expect(() => normalizeNotificationCampaignInput({ title: "x", body: "y", audience: { kind: "users" } })).toThrow("TARGET_USERS_REQUIRED");
  });
});

describe.skipIf(!runDbTests)("notification campaign sending", () => {
  test("sends to deduplicated specified users and blocks duplicate send", async () => {
    const suffix = crypto.randomUUID().slice(0, 8);
    const alice = `notice-alice-${suffix}`;
    const bob = `notice-bob-${suffix}`;
    const db = sql();

    try {
      await db`
        insert into users (casdoor_id, name, avatar_url, is_active)
        values (${`notice-casdoor-a-${suffix}`}, ${alice}, '', true),
               (${`notice-casdoor-b-${suffix}`}, ${bob}, '', true)
      `;

      const campaign = await createNotificationCampaign({
        title: "指定用户通知",
        body: "hello",
        audience: { kind: "users", userNames: [alice, alice.toUpperCase(), bob] },
      }, "tester");

      const sent = await sendNotificationCampaign(campaign!.id, "tester");
      expect(sent.status).toBe("sent");
      expect(sent.sent_count).toBe(2);

      const duplicate = await sendNotificationCampaign(campaign!.id, "tester");
      expect(duplicate.status).toBe("already_sent");

      const rows = await db<Array<{ user_name: string }>>`
        select user_name from notifications
        where data->>'campaign_id' = ${campaign!.id}
        order by user_name
      `;
      expect(rows.map(r => r.user_name)).toEqual([alice, bob].sort());
    } finally {
      await db`delete from notifications where user_name = any(${[alice, bob]}::text[])`;
      await db`delete from notification_campaigns where created_by = 'tester'`;
      await db`delete from users where name = any(${[alice, bob]}::text[])`;
    }
  });

  test("sends all audience only to active users", async () => {
    const suffix = crypto.randomUUID().slice(0, 8);
    const active = `notice-active-${suffix}`;
    const inactive = `notice-inactive-${suffix}`;
    const db = sql();

    try {
      await db`
        insert into users (casdoor_id, name, avatar_url, is_active)
        values (${`notice-casdoor-active-${suffix}`}, ${active}, '', true),
               (${`notice-casdoor-inactive-${suffix}`}, ${inactive}, '', false)
      `;

      const campaign = await createNotificationCampaign({
        title: "全站通知",
        body: "hello",
        audience: { kind: "all" },
      }, "tester");

      const sent = await sendNotificationCampaign(campaign!.id, "tester");
      expect(sent.status).toBe("sent");

      const activeRows = await db<Array<{ count: string }>>`
        select count(*)::text as count from notifications
        where data->>'campaign_id' = ${campaign!.id} and user_name = ${active}
      `;
      const inactiveRows = await db<Array<{ count: string }>>`
        select count(*)::text as count from notifications
        where data->>'campaign_id' = ${campaign!.id} and user_name = ${inactive}
      `;
      expect(Number(activeRows[0].count)).toBe(1);
      expect(Number(inactiveRows[0].count)).toBe(0);
    } finally {
      await db`delete from notifications where user_name = any(${[active, inactive]}::text[])`;
      await db`delete from notification_campaigns where created_by = 'tester'`;
      await db`delete from users where name = any(${[active, inactive]}::text[])`;
    }
  });

  test("rejects missing specified users and sent campaign edits", async () => {
    const campaign = await createNotificationCampaign({
      title: "缺失用户",
      body: "hello",
      audience: { kind: "users", userNames: [`missing-${crypto.randomUUID()}`] },
    }, "tester");

    try {
      const result = await sendNotificationCampaign(campaign!.id, "tester");
      expect(result.status).toBe("missing_users");

      const all = await createNotificationCampaign({
        title: "锁定编辑",
        body: "hello",
        audience: { kind: "all" },
      }, "tester");
      await sendNotificationCampaign(all!.id, "tester");
      const updated = await updateNotificationCampaign(all!.id, {
        title: "改标题",
        body: "hello",
        audience: { kind: "all" },
      }, "tester");
      expect(updated).toBeNull();
    } finally {
      await sql()`delete from notification_campaigns where created_by = 'tester'`;
    }
  });
});
