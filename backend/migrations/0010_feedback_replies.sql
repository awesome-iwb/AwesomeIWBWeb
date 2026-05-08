create table if not exists feedback_replies (
  id uuid primary key default gen_random_uuid(),
  feedback_id uuid not null references feedback_entries(id) on delete cascade,
  body text not null default '',
  actor_username text not null default '',
  actor_role text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists feedback_replies_feedback_id_idx on feedback_replies (feedback_id, created_at desc);
