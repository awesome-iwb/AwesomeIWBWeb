import { sql } from "../db/client";

export interface EditingPresenceRow {
  id: string;
  article_id: string;
  user_id: string;
  user_name: string;
  user_avatar_url: string;
  last_heartbeat: string;
}

const STALE_SECONDS = 60;

export async function heartbeat(
  articleId: string,
  userId: string,
  userName: string,
  userAvatarUrl: string,
) {
  await sql()`
    insert into article_editing_presence (article_id, user_id, user_name, user_avatar_url, last_heartbeat)
    values (${articleId}, ${userId}, ${userName}, ${userAvatarUrl}, now())
    on conflict (article_id, user_id)
    do update set user_name = ${userName}, user_avatar_url = ${userAvatarUrl}, last_heartbeat = now()
  `;
  await cleanStalePresence();
}

export async function getActiveEditors(articleId: string) {
  const rows = await sql()<Array<EditingPresenceRow>>`
    select id, article_id, user_id, user_name, user_avatar_url, last_heartbeat
    from article_editing_presence
    where article_id = ${articleId}
      and last_heartbeat > now() - interval '60 seconds'
    order by last_heartbeat desc
  `;
  return rows;
}

export async function removePresence(articleId: string, userId: string) {
  await sql()`
    delete from article_editing_presence
    where article_id = ${articleId} and user_id = ${userId}
  `;
}

async function cleanStalePresence() {
  await sql()`
    delete from article_editing_presence
    where last_heartbeat < now() - interval '120 seconds'
  `;
}
