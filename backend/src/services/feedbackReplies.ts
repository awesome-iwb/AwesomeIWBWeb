import { sql } from "../db/client";

export type FeedbackReply = {
  id: string;
  feedback_id: string;
  body: string;
  actor_username: string;
  actor_role: string;
  created_at: string;
  updated_at: string;
};

export async function listReplies(feedbackId: string) {
  const rows = await sql()`
    select id, feedback_id, body, actor_username, actor_role, created_at, updated_at
    from feedback_replies
    where feedback_id = ${feedbackId}
    order by created_at desc
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
  return row ?? null;
}
