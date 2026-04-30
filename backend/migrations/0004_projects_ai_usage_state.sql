alter table projects
  add column if not exists ai_usage_state text not null default 'unknown';

