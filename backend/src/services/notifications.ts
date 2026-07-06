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
  is_read: boolean;
  created_at: string;
};

export type NotificationCampaignLevel = "info" | "success" | "warning" | "danger";
export type NotificationCampaignAudienceKind = "all" | "users";
export type NotificationCampaignStatus = "draft" | "sent";

export type NotificationCampaign = {
  id: string;
  title: string;
  body: string;
  level: NotificationCampaignLevel;
  audience_kind: NotificationCampaignAudienceKind;
  target_user_names: string[];
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

function boundedText(value: unknown, limit: number): string {
  return String(value ?? "")
    .replace(/\u0000/g, "")
    .trim()
    .slice(0, limit);
}

export function normalizeNotificationCampaignLevel(value: unknown): NotificationCampaignLevel {
  return value === "success" || value === "warning" || value === "danger" ? value : "info";
}

export function normalizeNotificationAudience(input: unknown): {
  audience_kind: NotificationCampaignAudienceKind;
  target_user_names: string[];
} {
  const raw = input as any;
  const kind = raw?.kind === "users" || raw?.audience_kind === "users" ? "users" : "all";
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
} {
  const raw = input as any;
  const title = boundedText(raw?.title, TITLE_LIMIT);
  const body = boundedText(raw?.body, BODY_LIMIT);
  const audience = normalizeNotificationAudience(raw?.audience ?? raw);
  if (!title) throw new Error("TITLE_REQUIRED");
  if (!body) throw new Error("BODY_REQUIRED");
  if (audience.audience_kind === "users" && audience.target_user_names.length === 0) {
    throw new Error("TARGET_USERS_REQUIRED");
  }
  return {
    title,
    body,
    level: normalizeNotificationCampaignLevel(raw?.level),
    ...audience,
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
    returning id, user_name, type, title, body, data, is_read, created_at
  `;
  return row ?? null;
}

export async function listNotifications(params: {
  user_name: string;
  unreadOnly?: boolean;
  page?: number;
  pageSize?: number;
}) {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 20));
  const offset = (page - 1) * pageSize;

  const db = sql();
  const unreadFilter = params.unreadOnly ? db`and is_read = false` : db``;

  const items = await db<Notification[]>`
    select id, user_name, type, title, body, data, is_read, created_at
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
    returning id, user_name, type, title, body, data, is_read, created_at
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
    select id, title, body, level, audience_kind, target_user_names, status, sent_count,
           created_by, updated_by, sent_by, sent_at, created_at, updated_at
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
      title, body, level, audience_kind, target_user_names, created_by, updated_by
    )
    values (
      ${safe.title}, ${safe.body}, ${safe.level}, ${safe.audience_kind},
      ${safe.target_user_names}, ${actor}, ${actor}
    )
    returning id, title, body, level, audience_kind, target_user_names, status, sent_count,
              created_by, updated_by, sent_by, sent_at, created_at, updated_at
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
        updated_by = ${actor}
    where id = ${id} and status = 'draft'
    returning id, title, body, level, audience_kind, target_user_names, status, sent_count,
              created_by, updated_by, sent_by, sent_at, created_at, updated_at
  `;
  return row ?? null;
}

export async function getNotificationCampaign(id: string) {
  const [row] = await sql()<NotificationCampaign[]>`
    select id, title, body, level, audience_kind, target_user_names, status, sent_count,
           created_by, updated_by, sent_by, sent_at, created_at, updated_at
    from notification_campaigns
    where id = ${id}
    limit 1
  `;
  return row ?? null;
}

async function resolveCampaignRecipientsWithClient(db: any, campaign: NotificationCampaign) {
  if (campaign.audience_kind === "all") {
    const rows: Array<{ name: string }> = await db`
      select name
      from users
      where is_active = true
      order by created_at asc
    `;
    return { names: rows.map(r => r.name), missing: [] as string[] };
  }

  const requested = campaign.target_user_names;
  const rows: Array<{ name: string }> = await db`
    select name
    from users
    where is_active = true and lower(name) = any(${requested.map(name => name.toLowerCase())}::text[])
  `;
  const foundByLower = new Map(rows.map(row => [row.name.toLowerCase(), row.name]));
  const missing = requested.filter(name => !foundByLower.has(name.toLowerCase()));
  return {
    names: requested.map(name => foundByLower.get(name.toLowerCase())).filter(Boolean) as string[],
    missing,
  };
}

export async function sendNotificationCampaign(id: string, actor: string) {
  return await sql().begin(async db => {
    const [campaign] = await db<NotificationCampaign[]>`
      select id, title, body, level, audience_kind, target_user_names, status, sent_count,
             created_by, updated_by, sent_by, sent_at, created_at, updated_at
      from notification_campaigns
      where id = ${id}
      for update
    `;
    if (!campaign) return { status: "not_found" as const };
    if (campaign.status !== "draft") return { status: "already_sent" as const, campaign };

    const recipients = await resolveCampaignRecipientsWithClient(db, campaign);
    if (recipients.missing.length) {
      return { status: "missing_users" as const, missing: recipients.missing, campaign };
    }
    if (campaign.audience_kind === "users" && recipients.names.length === 0) {
      return { status: "missing_users" as const, missing: campaign.target_user_names, campaign };
    }

    if (recipients.names.length > 0) {
      await db`
        insert into notifications (user_name, type, title, body, data)
        select unnest(${recipients.names}::text[]), 'ops_notice', ${campaign.title}, ${campaign.body},
               jsonb_build_object(
                 'campaign_id', ${campaign.id},
                 'level', ${campaign.level},
                 'audience_kind', ${campaign.audience_kind}
               )
      `;
    }

    const [updated] = await db<NotificationCampaign[]>`
      update notification_campaigns
      set status = 'sent',
          sent_count = ${recipients.names.length},
          sent_by = ${actor},
          sent_at = now(),
          updated_by = ${actor}
      where id = ${id}
      returning id, title, body, level, audience_kind, target_user_names, status, sent_count,
                created_by, updated_by, sent_by, sent_at, created_at, updated_at
    `;
    return { status: "sent" as const, campaign: updated, sent_count: recipients.names.length };
  });
}
