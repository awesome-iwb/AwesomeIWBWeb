-- Migration: media tags
-- Date: 2026-05-14

CREATE TABLE IF NOT EXISTS media_tags (
  media_id UUID NOT NULL REFERENCES media_assets(id) ON DELETE CASCADE,
  tag TEXT NOT NULL,
  PRIMARY KEY (media_id, tag)
);

CREATE INDEX IF NOT EXISTS media_tags_tag_idx ON media_tags(tag);
