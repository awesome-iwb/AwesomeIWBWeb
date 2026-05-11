-- Migration: drop sectl_user_id and lincube_user_id, add hzzc_user_id
-- Date: 2026-05-11

DROP INDEX IF EXISTS users_sectl_user_id_idx;
ALTER TABLE users DROP COLUMN IF EXISTS sectl_user_id;
ALTER TABLE users DROP COLUMN IF EXISTS lincube_user_id;

ALTER TABLE users ADD COLUMN IF NOT EXISTS hzzc_user_id TEXT;
CREATE INDEX IF NOT EXISTS users_hzzc_user_id_idx ON users (hzzc_user_id) WHERE hzzc_user_id IS NOT NULL;
