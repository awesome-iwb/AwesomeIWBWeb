CREATE TABLE IF NOT EXISTS article_links (
  from_article_id UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  to_slug TEXT NOT NULL,
  PRIMARY KEY (from_article_id, to_slug)
);

CREATE INDEX IF NOT EXISTS idx_article_links_to_slug ON article_links (to_slug);
