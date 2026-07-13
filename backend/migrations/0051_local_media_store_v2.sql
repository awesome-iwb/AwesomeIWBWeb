-- Local media store v2: immutable blobs, logical assets, aliases, variants and migration checkpoints.
BEGIN;

CREATE TABLE IF NOT EXISTS media_blobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sha256 TEXT NOT NULL UNIQUE CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  object_key TEXT NOT NULL UNIQUE,
  storage_layout TEXT NOT NULL DEFAULT 'v2' CHECK (storage_layout IN ('legacy', 'v2')),
  mime TEXT NOT NULL,
  size BIGINT NOT NULL CHECK (size >= 0),
  width INTEGER NULL CHECK (width IS NULL OR width > 0),
  height INTEGER NULL CHECK (height IS NULL OR height > 0),
  state TEXT NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'available', 'missing', 'corrupt', 'quarantined')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  verified_at TIMESTAMPTZ NULL,
  last_error TEXT NULL
);

ALTER TABLE media_assets ADD COLUMN IF NOT EXISTS blob_id UUID NULL REFERENCES media_blobs(id) ON DELETE RESTRICT;
ALTER TABLE media_assets ADD COLUMN IF NOT EXISTS namespace TEXT NOT NULL DEFAULT 'content';
ALTER TABLE media_assets ADD COLUMN IF NOT EXISTS original_sha256 TEXT NULL;
ALTER TABLE media_assets ADD COLUMN IF NOT EXISTS integrity_status TEXT NOT NULL DEFAULT 'unknown';
ALTER TABLE media_assets ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ NULL;

ALTER TABLE media_assets DROP CONSTRAINT IF EXISTS media_assets_original_sha256_check;
ALTER TABLE media_assets ADD CONSTRAINT media_assets_original_sha256_check
  CHECK (original_sha256 IS NULL OR original_sha256 ~ '^[0-9a-f]{64}$');
ALTER TABLE media_assets DROP CONSTRAINT IF EXISTS media_assets_integrity_status_check;
ALTER TABLE media_assets ADD CONSTRAINT media_assets_integrity_status_check
  CHECK (integrity_status IN ('unknown', 'verified', 'missing', 'corrupt'));

-- References are usage guards, not disposable child rows. Enforce the same
-- MEDIA_IN_USE invariant at the database boundary so a direct or concurrent
-- delete cannot silently cascade away evidence that an asset is still used.
ALTER TABLE media_references DROP CONSTRAINT IF EXISTS media_references_media_id_fkey;
ALTER TABLE media_references ADD CONSTRAINT media_references_media_id_fkey
  FOREIGN KEY (media_id) REFERENCES media_assets(id) ON DELETE RESTRICT;

UPDATE media_assets
SET namespace = CASE
  WHEN storage_key LIKE 'avatars/%' THEN 'avatars'
  WHEN storage_key LIKE 'projects/%' THEN 'projects'
  ELSE 'content'
END
WHERE namespace = 'content';

-- A database hash is only an expectation, not proof that the legacy file still
-- exists or matches it. Keep backfilled blobs pending until the audit/migration
-- process reads the bytes and verifies the SHA-256 value.
INSERT INTO media_blobs (sha256, object_key, storage_layout, mime, size, width, height, state, created_at)
SELECT DISTINCT ON (lower(sha256))
  lower(sha256), storage_key, 'legacy', mime, size, width, height, 'pending', created_at
FROM media_assets
WHERE sha256 ~* '^[0-9a-f]{64}$'
ORDER BY lower(sha256), created_at ASC, id ASC
ON CONFLICT (sha256) DO NOTHING;

UPDATE media_assets m
SET blob_id = b.id
FROM media_blobs b
WHERE m.blob_id IS NULL AND lower(m.sha256) = b.sha256;

CREATE INDEX IF NOT EXISTS media_assets_storage_key_idx ON media_assets(storage_key);
CREATE INDEX IF NOT EXISTS media_assets_blob_id_idx ON media_assets(blob_id);
CREATE INDEX IF NOT EXISTS media_assets_namespace_idx ON media_assets(namespace);
CREATE INDEX IF NOT EXISTS media_assets_integrity_idx ON media_assets(integrity_status);
CREATE INDEX IF NOT EXISTS media_blobs_state_idx ON media_blobs(state);
CREATE INDEX IF NOT EXISTS media_references_entity_idx
  ON media_references(entity_type, entity_id, ref_type);

CREATE TABLE IF NOT EXISTS media_aliases (
  alias_path TEXT PRIMARY KEY,
  asset_id UUID NOT NULL REFERENCES media_assets(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS media_aliases_asset_id_idx ON media_aliases(asset_id);

INSERT INTO media_aliases(alias_path, asset_id)
SELECT DISTINCT ON (storage_key) storage_key, id
FROM media_assets
ORDER BY storage_key, created_at ASC, id ASC
ON CONFLICT (alias_path) DO NOTHING;

CREATE TABLE IF NOT EXISTS media_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blob_id UUID NOT NULL REFERENCES media_blobs(id) ON DELETE CASCADE,
  preset TEXT NOT NULL,
  transform_version INTEGER NOT NULL DEFAULT 1 CHECK (transform_version > 0),
  object_key TEXT NOT NULL UNIQUE,
  sha256 TEXT NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  mime TEXT NOT NULL,
  size BIGINT NOT NULL CHECK (size >= 0),
  width INTEGER NOT NULL CHECK (width > 0),
  height INTEGER NOT NULL CHECK (height > 0),
  state TEXT NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'available', 'missing', 'corrupt')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  verified_at TIMESTAMPTZ NULL,
  UNIQUE(blob_id, preset, transform_version)
);

CREATE TABLE IF NOT EXISTS media_migration_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed', 'cancelled')),
  dry_run BOOLEAN NOT NULL DEFAULT true,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ NULL,
  summary JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS media_migration_items (
  run_id UUID NOT NULL REFERENCES media_migration_runs(id) ON DELETE CASCADE,
  blob_id UUID NOT NULL REFERENCES media_blobs(id) ON DELETE CASCADE,
  source_key TEXT NOT NULL,
  target_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'copied', 'verified', 'missing', 'conflict', 'failed', 'skipped')),
  expected_sha256 TEXT NOT NULL CHECK (expected_sha256 ~ '^[0-9a-f]{64}$'),
  actual_sha256 TEXT NULL CHECK (actual_sha256 IS NULL OR actual_sha256 ~ '^[0-9a-f]{64}$'),
  error TEXT NULL,
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY(run_id, blob_id)
);

CREATE INDEX IF NOT EXISTS media_migration_items_blob_id_idx ON media_migration_items(blob_id);

COMMIT;
