CREATE TABLE IF NOT EXISTS article_annotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  anchor_id TEXT NOT NULL DEFAULT '',
  selected_text TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  author_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  author_username TEXT NOT NULL DEFAULT '',
  author_role TEXT NOT NULL DEFAULT '',
  resolved BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_article_annotations_article ON article_annotations (article_id, anchor_id);
CREATE INDEX IF NOT EXISTS idx_article_annotations_author ON article_annotations (author_user_id);
