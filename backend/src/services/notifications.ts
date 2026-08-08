import { sql } from "../db/client";

export type NotificationType =
  | "moderation_approved"
  | "moderation_rejected"
  | "role_promoted"
  | "role_demoted"
  | "org_approved"
  | "org_rejected"
  | "claim_approved"
  | "claim_rejected"
  | "article_edited"
  | "article_comment"
  | "article_annotation"
  | "article_conflict"
  | "ops_notice";

export type Notification = {
  id: string;
  user_name: string;
  type: NotificationType;
  title: string;
  body: string;
  data: Record<string, any>;
  campaign_id: string | null;
  is_read: boolean;
  created_at: string;
};

export type NotificationCampaignLevel = "info" | "success" | "warning" | "danger";
export type NotificationCampaignAudienceKind = "all" | "users" | "developers";
export type NotificationCampaignDeliveryMode = "snapshot" | "persistent";
export type NotificationCampaignStatus = "draft" | "sent" | "active" | "archived";

export type NotificationCampaign = {
  id: string;
  title: string;
  body: string;
  level: NotificationCampaignLevel;
  audience_kind: NotificationCampaignAudienceKind;
  target_user_names: string[];
  delivery_mode: NotificationCampaignDeliveryMode;
  action_url: string;
  action_label: string;
  status: NotificationCampaignStatus;
  sent_count: number;
  created_by: string;
  updated_by: string;
  sent_by: string;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
};

const TITLE_LIMIT = 80;
const BODY_LIMIT = 800;
const TARGET_LIMIT = 200;
const ACTION_URL_LIMIT = 500;
const ACTION_LABEL_LIMIT = 30;

function boundedText(value: unknown, limit: number): string {
  return String(value ?? "")
    .replace(/\u0000/g, "")
    .trim()
    .slice(0, limit);
}

export function normalizeNotificationCampaignLevel(value: unknown): NotificationCampaignLevel {
  return value === "success" || value === "warning" || value === "danger" ? value : "info";
}

export function normalizeNotificationDeliveryMode(value: unknown): NotificationCampaignDeliveryMode {
  return value === "persistent" ? "persistent" : "snapshot";
}

export function normalizeNotificationAction(input: unknown): { action_url: string; action_label: string } {
  const raw = input as any;
  const action_url = boundedText(raw?.action_url ?? raw?.actionUrl, ACTION_URL_LIMIT);
  const requestedLabel = boundedText(raw?.action_label ?? raw?.actionLabel, ACTION_LABEL_LIMIT);
  if (!action_url) {
    if (requestedLabel) throw new Error("ACTION_URL_REQUIRED");
    return { action_url: "", action_label: "" };
  }

  let parsed: URL;
  try {
    parsed = new URL(action_url);
  } catch {
    throw new Error("ACTION_URL_INVALID");
  }
  if (parsed.protocol !== "https:" || parsed.username || parsed.password) {
    throw new Error("ACTION_URL_INVALID");
  }
  return {
    action_url: parsed.toString().slice(0, ACTION_URL_LIMIT),
    action_label: requestedLabel || "查看详情",
  };
}

export function normalizeNotificationAudience(input: unknown): {
  audience_kind: NotificationCampaignAudienceKind;
  target_user_names: string[];
} {
  const raw = input as any;
  const requestedKind = raw?.kind ?? raw?.audience_kind;
  const kind: NotificationCampaignAudienceKind =
    requestedKind === "users" || requestedKind === "developers" ? requestedKind : "all";
  const source = Array.isArray(raw?.target_user_names)
    ? raw.target_user_names
    : Array.isArray(raw?.userNames)
      ? raw.userNames
      : typeof raw?.target_user_names === "string"
        ? raw.target_user_names.split(/[\n,，]/)
        : typeof raw?.userNames === "string"
          ? raw.userNames.split(/[\n,，]/)
          : [];
  const seen = new Set<string>();
  const target_user_names = source
    .map((v: unknown) => boundedText(v, 60))
    .filter(Boolean)
    .filter((name: string) => {
      const key = name.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, TARGET_LIMIT);
  return {
    audience_kind: kind,
    target_user_names: kind === "users" ? target_user_names : [],
  };
}

export function normalizeNotificationCampaignInput(input: unknown): {
  title: string;
  body: string;
  level: NotificationCampaignLevel;
  audience_kind: NotificationCampaignAudienceKind;
  target_user_names: string[];
  delivery_mode: NotificationCampaignDeliveryMode;
  action_url: string;
  action_label: string;
} {
  const raw = input as any;
  const title = boundedText(raw?.title, TITLE_LIMIT);
  const body = boundedText(raw?.body, BODY_LIMIT);
  const audience = normalizeNotificationAudience(raw?.audience ?? raw);
  const action = normalizeNotificationAction(raw);
  if (!title) throw new Error("TITLE_REQUIRED");
  if (!body) throw new Error("BODY_REQUIRED");
  if (audience.audience_kind === "users" && audience.target_user_names.length === 0) {
    throw new Error("TARGET_USERS_REQUIRED");
  }
  return {
    title,
    body,
    level: normalizeNotificationCampaignLevel(raw?.level),
    delivery_mode: normalizeNotificationDeliveryMode(raw?.delivery_mode ?? raw?.deliveryMode),
    ...audience,
    ...action,
  };
}

export async function createNotification(input: {
  user_name: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, any>;
}) {
  const [row] = await sql()<Notification[]>`
    insert into notifications (user_name, type, title, body, data)
    values (${input.user_name}, ${input.type}, ${input.title}, ${input.body}, ${JSON.stringify(input.data ?? {})}::jsonb)
    returning id, user_name, type, title, body, data, campaign_id, is_read, created_at
  `;
  return row ?? null;
}

async function materializePersistentNotifications(userName: string) {
  const db = sql();
  const inserted = await db<Array<{ campaign_id: string }>>`
    insert into notifications (user_name, type, title, body, data, campaign_id)
    select u.name,
           'ops_notice',
           c.title,
           c.body,
           jsonb_strip_nulls(jsonb_build_object(
             'campaign_id', c.id::text,
             'level', c.level,
             'audience_kind', c.audience_kind,
             'delivery_mode', c.delivery_mode,
             'action_url', nullif(c.action_url, ''),
             'action_label', nullif(c.action_label, '')
           )),
           c.id
    from users u
    cross join notification_campaigns c
    where lower(u.name) = lower(${userName})
      and u.is_active = true
      and c.delivery_mode = 'persistent'
      and c.status = 'active'
      and (
        c.audience_kind = 'all'
        or (
          c.audience_kind = 'developers'
          and exists (
            select 1
            from user_capabilities uc
            where uc.user_id = u.id
              and uc.capability_id = 'dev_panel_access'
          )
        )
        or (
          c.audience_kind = 'users'
          and exists (
            select 1
            from unnest(c.target_user_names) target_name
            where lower(target_name) = lower(u.name)
          )
        )
      )
    on conflict do nothing
    returning campaign_id
  `;

  if (inserted.length > 0) {
    const campaignIds = [...new Set(inserted.map(row => row.campaign_id))];
    await db`
      update notification_campaigns c
      set sent_count = (
        select count(*)::integer
        from notifications n
        where n.campaign_id = c.id
      )
      where c.id = any(${campaignIds}::uuid[])
    `;
  }
}

export async function listNotifications(params: {
  user_name: string;
  unreadOnly?: boolean;
  page?: number;
  pageSize?: number;
}) {
  await materializePersistentNotifications(params.user_name);

  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 20));
  const offset = (page - 1) * pageSize;

  const db = sql();
  const unreadFilter = params.unreadOnly ? db`and is_read = false` : db``;

  const items = await db<Notification[]>`
    select id, user_name, type, title, body, data, campaign_id, is_read, created_at
    from notifications
    where user_name = ${params.user_name} ${unreadFilter}
    order by created_at desc
    limit ${pageSize} offset ${offset}
  `;

  const [{ count }] = await db<Array<{ count: string }>>`
    select count(*)::text as count
    from notifications
    where user_name = ${params.user_name} ${unreadFilter}
  `;

  return { items, page, pageSize, total: Number(count) };
}

export async function markNotificationRead(id: string, userName: string) {
  const [row] = await sql()<Notification[]>`
    update notifications
    set is_read = true
    where id = ${id} and user_name = ${userName}
    returning id, user_name, type, title, body, data, campaign_id, is_read, created_at
  `;
  return row ?? null;
}

export async function markAllNotificationsRead(userName: string) {
  await sql()`
    update notifications
    set is_read = true
    where user_name = ${userName} and is_read = false
  `;
}

export async function listNotificationCampaigns(params: {
  status?: NotificationCampaignStatus;
  page?: number;
  pageSize?: number;
}) {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 20));
  const offset = (page - 1) * pageSize;
  const db = sql();
  const statusFilter = params.status ? db`where status = ${params.status}` : db``;

  const items = await db<NotificationCampaign[]>`
    select id, title, body, level, audience_kind, target_user_names, delivery_mode,
           action_url, action_label, status, sent_count, created_by, updated_by,
           sent_by, sent_at, created_at, updated_at
    from notification_campaigns
    ${statusFilter}
    order by created_at desc
    limit ${pageSize} offset ${offset}
  `;
  const [{ count }] = await db<Array<{ count: string }>>`
    select count(*)::text as count
    from notification_campaigns
    ${statusFilter}
  `;
  return { items, page, pageSize, total: Number(count) };
}

export async function createNotificationCampaign(input: unknown, actor: string) {
  const safe = normalizeNotificationCampaignInput(input);
  const [row] = await sql()<NotificationCampaign[]>`
    insert into notification_campaigns (
      title, body, level, audience_kind, target_user_names, delivery_mode,
      action_url, action_label, created_by, updated_by
    )
    values (
      ${safe.title}, ${safe.body}, ${safe.level}, ${safe.audience_kind},
      ${safe.target_user_names}, ${safe.delivery_mode}, ${safe.action_url},
      ${safe.action_label}, ${actor}, ${actor}
    )
    returning id, title, body, level, audience_kind, target_user_names, delivery_mode,
              action_url, action_label, status, sent_count, created_by, updated_by,
              sent_by, sent_at, created_at, updated_at
  `;
  return row ?? null;
}

export async function updateNotificationCampaign(id: string, input: unknown, actor: string) {
  const safe = normalizeNotificationCampaignInput(input);
  const [row] = await sql()<NotificationCampaign[]>`
    update notification_campaigns
    set title = ${safe.title},
        body = ${safe.body},
        level = ${safe.level},
        audience_kind = ${safe.audience_kind},
        target_user_names = ${safe.target_user_names},
        delivery_mode = ${safe.delivery_mode},
        action_url = ${safe.action_url},
        action_label = ${safe.action_label},
        updated_by = ${actor}
    where id = ${id} and status = 'draft'
    returning id, title, body, level, audience_kind, target_user_names, delivery_mode,
              action_url, action_label, status, sent_count, created_by, updated_by,
              sent_by, sent_at, created_at, updated_at
  `;
  return row ?? null;
}

export async function getNotificationCampaign(id: string) {
  const [row] = await sql()<NotificationCampaign[]>`
    select id, title, body, level, audience_kind, target_user_names, delivery_mode,
           action_url, action_label, status, sent_count, created_by, updated_by,
           sent_by, sent_at, created_at, updated_at
    from notification_campaigns
    where id = ${id}
    limit 1
  `;
  return row ?? null;
}

async function findMissingTargetUsers(db: any, campaign: NotificationCampaign) {
  if (campaign.audience_kind !== "users") return [] as string[];
  const rows: Array<{ name: string }> = await db`
    select name
    from users
    where is_active = true
      and lower(name) = any(${campaign.target_user_names.map(name => name.toLowerCase())}::text[])
  `;
  const found = new Set(rows.map(row => row.name.toLowerCase()));
  return campaign.target_user_names.filter(name => !found.has(name.toLowerCase()));
}

async function insertCampaignRecipients(db: any, campaignId: string) {
  return await db<Array<{ user_name: string }>>`
    insert into notifications (user_name, type, title, body, data, campaign_id)
    select u.name,
           'ops_notice',
           c.title,
           c.body,
           jsonb_strip_nulls(jsonb_build_object(
             'campaign_id', c.id::text,
             'level', c.level,
             'audience_kind', c.audience_kind,
             'delivery_mode', c.delivery_mode,
             'action_url', nullif(c.action_url, ''),
             'action_label', nullif(c.action_label, '')
           )),
           c.id
    from notification_campaigns c
    join users u on u.is_active = true
    where c.id = ${campaignId}
      and (
        c.audience_kind = 'all'
        or (
          c.audience_kind = 'developers'
          and exists (
            select 1
            from user_capabilities uc
            where uc.user_id = u.id
              and uc.capability_id = 'dev_panel_access'
          )
        )
        or (
          c.audience_kind = 'users'
          and exists (
            select 1
            from unnest(c.target_user_names) target_name
            where lower(target_name) = lower(u.name)
          )
        )
      )
    on conflict do nothing
    returning user_name
  `;
}

export async function sendNotificationCampaign(id: string, actor: string) {
  return await sql().begin(async db => {
    const [campaign] = await db<NotificationCampaign[]>`
      select id, title, body, level, audience_kind, target_user_names, delivery_mode,
             action_url, action_label, status, sent_count, created_by, updated_by,
             sent_by, sent_at, created_at, updated_at
      from notification_campaigns
      where id = ${id}
      for update
    `;
    if (!campaign) return { status: "not_found" as const };
    if (campaign.status !== "draft") return { status: "already_sent" as const, campaign };

    const missing = await findMissingTargetUsers(db, campaign);
    if (missing.length > 0) {
      return { status: "missing_users" as const, missing, campaign };
    }

    const recipients = await insertCampaignRecipients(db, campaign.id);
    const nextStatus: NotificationCampaignStatus = campaign.delivery_mode === "persistent" ? "active" : "sent";
    const [updated] = await db<NotificationCampaign[]>`
      update notification_campaigns
      set status = ${nextStatus},
          sent_count = ${recipients.length},
          sent_by = ${actor},
          sent_at = now(),
          updated_by = ${actor}
      where id = ${id}
      returning id, title, body, level, audience_kind, target_user_names, delivery_mode,
                action_url, action_label, status, sent_count, created_by, updated_by,
                sent_by, sent_at, created_at, updated_at
    `;
    return { status: "sent" as const, campaign: updated, sent_count: recipients.length };
  });
}

export async function archiveNotificationCampaign(id: string, actor: string) {
  return await sql().begin(async db => {
    const [campaign] = await db<NotificationCampaign[]>`
      select id, title, body, level, audience_kind, target_user_names, delivery_mode,
             action_url, action_label, status, sent_count, created_by, updated_by,
             sent_by, sent_at, created_at, updated_at
      from notification_campaigns
      where id = ${id}
      for update
    `;
    if (!campaign) return { status: "not_found" as const };
    if (campaign.delivery_mode !== "persistent" || campaign.status !== "active") {
      return { status: "not_active" as const, campaign };
    }
    const [updated] = await db<NotificationCampaign[]>`
      update notification_campaigns
      set status = 'archived', updated_by = ${actor}
      where id = ${id}
      returning id, title, body, level, audience_kind, target_user_names, delivery_mode,
                action_url, action_label, status, sent_count, created_by, updated_by,
                sent_by, sent_at, created_at, updated_at
    `;
    return { status: "archived" as const, campaign: updated };
  });
}
