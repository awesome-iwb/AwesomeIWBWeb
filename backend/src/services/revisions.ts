import { sql } from "../db/client";

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

  const [row] = await sql()<Array<any>>`
    update projects
    set
      name = ${snapshot.name ?? ""},
      category_id = ${snapshot.category_id ?? null},
      developer = ${snapshot.developer ?? ""},
      status = ${snapshot.status ?? ""},
      version = ${snapshot.version ?? ""},
      ai_usage_state = ${snapshot.ai_usage_state ?? "unknown"},
      description = ${snapshot.description ?? ""},
      keywords = ${snapshot.keywords ?? []},
      recommendation = ${snapshot.recommendation ?? []},
      github_url = ${snapshot.github_url ?? ""},
      avatar = ${snapshot.avatar ?? ""},
      icon = ${snapshot.icon ?? ""},
      banner = ${snapshot.banner ?? ""},
      stars = ${snapshot.stars ?? 0},
      language = ${snapshot.language ?? ""},
      last_update = ${snapshot.last_update ?? null},
      github_is_fork = ${snapshot.github_is_fork ?? false},
      github_parent_url = ${snapshot.github_parent_url ?? ""},
      github_source_url = ${snapshot.github_source_url ?? ""},
      extra = ${snapshot.extra ?? {}},
      updated_at = now()
    where id = ${projectId}
    returning *
  `;
  return row ?? null;
}
