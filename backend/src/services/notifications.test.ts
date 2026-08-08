import { describe, expect, test } from "bun:test";
import { sql } from "../db/client";
import {
  createNotificationCampaign,
  archiveNotificationCampaign,
  listNotifications,
  normalizeNotificationAudience,
  normalizeNotificationAction,
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

  test("supports developer persistent campaigns with safe HTTPS actions", () => {
    const input = normalizeNotificationCampaignInput({
      title: "开发者群",
      body: "加入官方交流群",
      audience: { kind: "developers" },
      delivery_mode: "persistent",
      action_url: "https://qm.qq.com/example",
      action_label: "加入 QQ 群",
    });

    expect(input.audience_kind).toBe("developers");
    expect(input.target_user_names).toEqual([]);
    expect(input.delivery_mode).toBe("persistent");
    expect(input.action_url).toBe("https://qm.qq.com/example");
    expect(input.action_label).toBe("加入 QQ 群");
  });

  test("rejects unsafe or incomplete action links", () => {
    expect(() => normalizeNotificationAction({ action_url: "javascript:alert(1)" })).toThrow("ACTION_URL_INVALID");
    expect(() => normalizeNotificationAction({ action_url: "http://qm.qq.com/example" })).toThrow("ACTION_URL_INVALID");
    expect(() => normalizeNotificationAction({ action_label: "加入群聊" })).toThrow("ACTION_URL_REQUIRED");
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
    let campaignId = "";

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
      campaignId = campaign!.id;

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
      if (campaignId) await db`delete from notifications where data->>'campaign_id' = ${campaignId}`;
      await db`delete from notifications where user_name = any(${[active, inactive]}::text[])`;
      await db`delete from notification_campaigns where created_by = 'tester'`;
      await db`delete from users where name = any(${[active, inactive]}::text[])`;
    }
  });

  test("rejects missing specified users and sent campaign edits", async () => {
    let sentCampaignId = "";
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
      sentCampaignId = all!.id;
      await sendNotificationCampaign(all!.id, "tester");
      const updated = await updateNotificationCampaign(all!.id, {
        title: "改标题",
        body: "hello",
        audience: { kind: "all" },
      }, "tester");
      expect(updated).toBeNull();
    } finally {
      if (sentCampaignId) await sql()`delete from notifications where data->>'campaign_id' = ${sentCampaignId}`;
      await sql()`delete from notification_campaigns where created_by = 'tester'`;
    }
  });

  test("keeps a developer campaign active and materializes future developers once", async () => {
    const suffix = crypto.randomUUID().slice(0, 8);
    const current = `notice-dev-current-${suffix}`;
    const future = `notice-dev-future-${suffix}`;
    const db = sql();
    let campaignId = "";

    try {
      const [currentUser] = await db<Array<{ id: string }>>`
        insert into users (casdoor_id, name, avatar_url, is_active)
        values (${`notice-casdoor-current-${suffix}`}, ${current}, '', true)
        returning id
      `;
      await db`
        insert into user_capabilities (user_id, capability_id)
        values (${currentUser.id}, 'dev_panel_access')
      `;

      const campaign = await createNotificationCampaign({
        title: "开发者常驻通知",
        body: "hello",
        audience: { kind: "developers" },
        delivery_mode: "persistent",
        action_url: "https://qm.qq.com/example",
        action_label: "加入 QQ 群",
      }, "tester");
      campaignId = campaign!.id;

      const activated = await sendNotificationCampaign(campaignId, "tester");
      expect(activated.status).toBe("sent");
      expect(activated.campaign?.status).toBe("active");

      const [futureUser] = await db<Array<{ id: string }>>`
        insert into users (casdoor_id, name, avatar_url, is_active)
        values (${`notice-casdoor-future-${suffix}`}, ${future}, '', true)
        returning id
      `;
      await db`
        insert into user_capabilities (user_id, capability_id)
        values (${futureUser.id}, 'dev_panel_access')
      `;

      await listNotifications({ user_name: future, unreadOnly: true });
      await listNotifications({ user_name: future, unreadOnly: true });
      const [{ count }] = await db<Array<{ count: string }>>`
        select count(*)::text as count
        from notifications
        where user_name = ${future} and campaign_id = ${campaignId}
      `;
      expect(Number(count)).toBe(1);

      const archived = await archiveNotificationCampaign(campaignId, "tester");
      expect(archived.status).toBe("archived");
      expect(archived.campaign?.status).toBe("archived");
    } finally {
      if (campaignId) await db`delete from notifications where campaign_id = ${campaignId}`;
      await db`delete from notifications where user_name = any(${[current, future]}::text[])`;
      await db`delete from notification_campaigns where created_by = 'tester'`;
      await db`delete from users where name = any(${[current, future]}::text[])`;
      await db`
        update notification_campaigns c
        set sent_count = (
          select count(*)::integer from notifications n where n.campaign_id = c.id
        )
        where c.delivery_mode = 'persistent' and c.status = 'active'
      `;
    }
  });
});
