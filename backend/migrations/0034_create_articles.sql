CREATE TABLE IF NOT EXISTS articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL DEFAULT '',
  subtitle TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT '',
  layout_type TEXT NOT NULL DEFAULT 'hero'
    CHECK (layout_type IN ('hero', 'interview', 'app_spotlight')),
  content_format TEXT NOT NULL DEFAULT 'markdown'
    CHECK (content_format IN ('markdown', 'html', 'latex', 'plain')),
  content TEXT NOT NULL DEFAULT '',
  cover_image TEXT NOT NULL DEFAULT '',
  theme TEXT NOT NULL DEFAULT 'dark' CHECK (theme IN ('dark', 'light')),
  projects JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  sort_index INTEGER NOT NULL DEFAULT 0,
  published_at TIMESTAMPTZ,
  author_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_articles_status_published ON articles (status, published_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_articles_layout ON articles (layout_type);
CREATE INDEX IF NOT EXISTS idx_articles_sort ON articles (sort_index DESC, updated_at DESC);
