import { sql } from "../db/client";

export type NotificationType = "moderation_approved" | "moderation_rejected";

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

export async function createNotification(input: {
  user_name: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, any>;
}) {
  const [row] = await sql()<Notification[]>`
    insert into notifications (user_name, type, title, body, data)
    values (${input.user_name}, ${input.type}, ${input.title}, ${input.body}, ${input.data ?? {}})
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

  const conditions: string[] = [`user_name = $1`];
  const queryParams: any[] = [params.user_name];

  if (params.unreadOnly) {
    conditions.push(`is_read = false`);
  }

  const whereClause = `where ${conditions.join(" and ")}`;

  const countQuery = `select count(*)::text as count from notifications ${whereClause}`;
  const itemsQuery = `
    select id, user_name, type, title, body, data, is_read, created_at
    from notifications ${whereClause}
    order by created_at desc
    limit ${pageSize} offset ${offset}
  `;

  const items = await sql().unsafe(itemsQuery, queryParams) as Notification[];
  const [{ count }] = await sql().unsafe(countQuery, queryParams) as Array<{ count: string }>;

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
