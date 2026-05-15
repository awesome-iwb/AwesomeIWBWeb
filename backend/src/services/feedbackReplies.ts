import { sql } from "../db/client";

export type FeedbackReply = {
  id: string;
  feedback_id: string;
  body: string;
  actor_username: string;
  actor_role: string;
  actor_avatar_url: string;
  created_at: string;
  updated_at: string;
};

export async function listReplies(feedbackId: string) {
  const rows = await sql()`
    select fr.id, fr.feedback_id, fr.body, fr.actor_username, fr.actor_role,
           coalesce(u.avatar_url, '') as actor_avatar_url,
           fr.created_at, fr.updated_at
    from feedback_replies fr
    left join users u on u.name = fr.actor_username
    where fr.feedback_id = ${feedbackId}
    order by fr.created_at desc
  `;
  return rows as FeedbackReply[];
}

export async function createReply(input: {
  feedback_id: string;
  body: string;
  actor_username: string;
  actor_role: string;
}) {
  const [row] = await sql()`
    insert into feedback_replies (feedback_id, body, actor_username, actor_role)
    values (${input.feedback_id}, ${input.body}, ${input.actor_username}, ${input.actor_role})
    returning id, feedback_id, body, actor_username, actor_role, created_at, updated_at
  `;
  if (row) {
    const avatarRow = await sql()<Array<{ avatar_url: string }>>`select coalesce(avatar_url, '') as avatar_url from users where name = ${input.actor_username} limit 1`;
    (row as any).actor_avatar_url = avatarRow[0]?.avatar_url ?? '';
  }
  return row ?? null;
}
