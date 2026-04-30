import { sql } from "../db/client";

export async function logAudit(input: {
  actor?: string;
  action: string;
  entity_type: string;
  entity_id?: string;
  diff?: any;
}) {
  await sql()`
    insert into audit_logs (actor, action, entity_type, entity_id, diff)
    values (
      ${input.actor ?? "system"},
      ${input.action},
      ${input.entity_type},
      ${input.entity_id ?? ""},
      ${input.diff ?? {}}
    )
  `;
}

export async function listAuditLogs(params: { page?: number; pageSize?: number }) {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 50));
  const offset = (page - 1) * pageSize;

  const items = await sql()<Array<any>>`
    select id, actor, action, entity_type, entity_id, diff, created_at
    from audit_logs
    order by created_at desc
    limit ${pageSize} offset ${offset}
  `;
  const [{ count }] = await sql()<Array<{ count: string }>>`select count(*)::text as count from audit_logs`;
  return { items, page, pageSize, total: Number(count) };
}

