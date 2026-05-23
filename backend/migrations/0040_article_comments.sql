CREATE TABLE IF NOT EXISTS article_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES article_comments(id) ON DELETE CASCADE,
  body TEXT NOT NULL DEFAULT '',
  author_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  author_username TEXT NOT NULL DEFAULT '',
  author_role TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_article_comments_article ON article_comments (article_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_article_comments_parent ON article_comments (parent_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_article_comments_author ON article_comments (author_user_id);
