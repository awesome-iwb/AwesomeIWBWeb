import { sql } from "../db/client";
import { normalizeProjectInput } from "../domain/normalizeProjectInput";

export async function createProjectRevision(projectId: string) {
  const rows = await sql()<Array<any>>`
    select *
    from projects
    where id = ${projectId}
    limit 1
  `;
  const project = rows[0];
  if (!project) return;

  await sql()`
    insert into project_revisions (project_id, snapshot)
    values (${projectId}, ${project})
  `;

  const toDelete = await sql()<Array<{ id: string }>>`
    select id
    from project_revisions
    where project_id = ${projectId}
    order by created_at desc
    offset 20
  `;
  if (toDelete.length) {
    await sql()`delete from project_revisions where id in ${sql(toDelete.map((r) => r.id))}`;
  }
}

export async function listProjectRevisions(projectId: string) {
  return sql()<Array<any>>`
    select id, created_at, snapshot
    from project_revisions
    where project_id = ${projectId}
    order by created_at desc
    limit 20
  `;
}

export async function rollbackProject(projectId: string, revisionId: string) {
  const rows = await sql()<Array<{ snapshot: any }>>`
    select snapshot
    from project_revisions
    where id = ${revisionId} and project_id = ${projectId}
    limit 1
  `;
  const snapshot = rows[0]?.snapshot;
  if (!snapshot) return null;
  const safeSnapshot = normalizeProjectInput(snapshot);

  const [row] = await sql()<Array<any>>`
    update projects
    set
      name = ${safeSnapshot.name ?? ""},
      category_id = ${safeSnapshot.category_id ?? null},
      developer = ${safeSnapshot.developer ?? ""},
      status = ${safeSnapshot.status ?? ""},
      version = ${safeSnapshot.version ?? ""},
      ai_usage_state = ${safeSnapshot.ai_usage_state ?? "unknown"},
      description = ${safeSnapshot.description ?? ""},
      keywords = ${safeSnapshot.keywords ?? []},
      recommendation = ${safeSnapshot.recommendation ?? []},
      github_url = ${safeSnapshot.github_url ?? ""},
      avatar = ${safeSnapshot.avatar ?? ""},
      icon = ${safeSnapshot.icon ?? ""},
      banner = ${safeSnapshot.banner ?? ""},
      stars = ${safeSnapshot.stars ?? 0},
      language = ${safeSnapshot.language ?? ""},
      last_update = ${safeSnapshot.last_update ?? null},
      github_is_fork = ${safeSnapshot.github_is_fork ?? false},
      github_parent_url = ${safeSnapshot.github_parent_url ?? ""},
      github_source_url = ${safeSnapshot.github_source_url ?? ""},
      extra = ${safeSnapshot.extra ?? {}},
      updated_at = now()
    where id = ${projectId}
    returning *
  `;
  return row ?? null;
}
