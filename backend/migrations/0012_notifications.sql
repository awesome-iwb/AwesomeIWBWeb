create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_name text not null,
  type text not null check (type in ('moderation_approved', 'moderation_rejected')),
  title text not null default '',
  body text not null default '',
  data jsonb not null default '{}'::jsonb,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_read_idx on notifications (user_name, is_read, created_at desc);
create index if not exists notifications_user_created_idx on notifications (user_name, created_at desc);
