CREATE TABLE IF NOT EXISTS article_editing_presence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_name TEXT NOT NULL DEFAULT '',
  user_avatar_url TEXT NOT NULL DEFAULT '',
  last_heartbeat TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(article_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_editing_presence_article ON article_editing_presence (article_id, last_heartbeat DESC);
