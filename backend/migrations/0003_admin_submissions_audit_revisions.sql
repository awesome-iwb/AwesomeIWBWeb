create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor text not null default 'system',
  action text not null,
  entity_type text not null,
  entity_id text not null default '',
  diff jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists project_revisions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists project_submissions (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'pending',
  payload jsonb not null default '{}'::jsonb,
  submitter_meta jsonb not null default '{}'::jsonb,
  review_note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
