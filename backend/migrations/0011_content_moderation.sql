create table if not exists comment_moderation (
  id uuid primary key default gen_random_uuid(),
  project_name text not null,
  body text not null default '',
  actor_username text not null default '',
  actor_role text not null default '',
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  review_note text not null default '',
  feedback_entry_id uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists comment_moderation_status_created_idx on comment_moderation (status, created_at desc);
create index if not exists comment_moderation_actor_idx on comment_moderation (actor_username, status);

create table if not exists bug_moderation (
  id uuid primary key default gen_random_uuid(),
  project_name text not null,
  title text not null default '',
  body text not null default '',
  labels text[] not null default '{}'::text[],
  actor_username text not null default '',
  actor_role text not null default '',
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  review_note text not null default '',
  feedback_entry_id uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists bug_moderation_status_created_idx on bug_moderation (status, created_at desc);
create index if not exists bug_moderation_actor_idx on bug_moderation (actor_username, status);
