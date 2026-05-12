-- Migration: media asset registry and references
-- Date: 2026-05-12

CREATE TABLE IF NOT EXISTS media_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sha256 TEXT NOT NULL,
  storage_key TEXT NOT NULL,
  url TEXT NOT NULL,
  mime TEXT NOT NULL,
  size BIGINT NOT NULL,
  width INTEGER NULL,
  height INTEGER NULL,
  source TEXT NOT NULL DEFAULT 'upload',
  uploader_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ NULL,
  last_referenced_at TIMESTAMPTZ NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS media_assets_url_uidx ON media_assets (url);
CREATE INDEX IF NOT EXISTS media_assets_sha256_idx ON media_assets (sha256);
CREATE INDEX IF NOT EXISTS media_assets_status_idx ON media_assets (status);

CREATE TABLE IF NOT EXISTS media_references (
  media_id UUID NOT NULL REFERENCES media_assets(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  field_path TEXT NOT NULL,
  ref_type TEXT NOT NULL DEFAULT 'usage',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (media_id, entity_type, entity_id, field_path, ref_type)
);

CREATE INDEX IF NOT EXISTS media_references_media_id_idx ON media_references (media_id);

INSERT INTO capabilities (id, name, category, description, sort_index) VALUES
  ('media:read', '查看媒体', 'media', '查看媒体资产和引用关系', 2000),
  ('media:manage', '管理媒体', 'media', '软删除和恢复媒体资产', 2010)
ON CONFLICT (id) DO NOTHING;
