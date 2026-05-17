-- Persist last OAuth (IdP) avatar URL separately from the displayed avatar_url so users
-- who choose "upload" can switch back to alliance sync without losing either URL.
-- English-only migration comments per project convention.

ALTER TABLE users ADD COLUMN IF NOT EXISTS external_avatar_url TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS upload_avatar_url TEXT NOT NULL DEFAULT '';

-- Backfill: users already on custom upload keep their file URL for restore.
UPDATE users SET upload_avatar_url = avatar_url WHERE avatar_source = 'upload' AND upload_avatar_url = '' AND avatar_url <> '';

-- Backfill: alliance-synced rows keep the last known IdP URL in external_avatar_url.
UPDATE users
SET external_avatar_url = avatar_url
WHERE casdoor_id IS NOT NULL
  AND external_avatar_url = ''
  AND avatar_url <> ''
  AND avatar_source IN ('casdoor', 'default');
