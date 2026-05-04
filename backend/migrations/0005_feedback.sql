create table if not exists feedback_entries (
  id uuid primary key default gen_random_uuid(),
  project_name text not null,
  kind text not null check (kind in ('comment', 'bug')),
  title text not null default '',
  body text not null default '',
  labels text[] not null default '{}'::text[],
  status text not null default 'open' check (status in ('open', 'doing', 'done')),
  actor_username text not null default '',
  actor_role text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists feedback_entries_project_kind_created_at_idx on feedback_entries (project_name, kind, created_at desc);
create index if not exists feedback_entries_status_idx on feedback_entries (status);

