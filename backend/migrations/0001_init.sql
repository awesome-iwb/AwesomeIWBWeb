create table if not exists schema_migrations (
  version text primary key,
  applied_at timestamptz not null default now()
);

create extension if not exists pgcrypto;

create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  sort_index int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  category_id uuid references categories(id) on delete set null,
  developer text not null default '',
  description text not null default '',
  keywords text[] not null default '{}',
  recommendation text[] not null default '{}',
  github_url text not null default '',
  icon text not null default '',
  banner text not null default '',
  stars int not null default 0,
  language text not null default '',
  last_update timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
