alter table projects
  add column if not exists avatar text not null default '',
  add column if not exists status text not null default '',
  add column if not exists version text not null default '',
  add column if not exists github_is_fork boolean not null default false,
  add column if not exists github_parent_url text not null default '',
  add column if not exists github_source_url text not null default '',
  add column if not exists extra jsonb not null default '{}'::jsonb;
