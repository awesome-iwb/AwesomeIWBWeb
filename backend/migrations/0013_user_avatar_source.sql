-- Migration: add avatar_source and stcn_username to users table
-- Date: 2026-05-08

-- avatar_source tracks where the avatar comes from:
--   'casdoor'  = synced from Casdoor/STCN OAuth
--   'upload'   = user uploaded custom avatar
--   'default'  = fallback placeholder
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_source TEXT NOT NULL DEFAULT 'default'
  CHECK (avatar_source IN ('casdoor', 'upload', 'default'));

-- stcn_username stores the STCN account name (Casdoor's `name` field)
-- This is the user's nickname displayed in our system
ALTER TABLE users ADD COLUMN IF NOT EXISTS stcn_username TEXT;

-- Create index for stcn_username lookups
CREATE INDEX IF NOT EXISTS users_stcn_username_idx ON users (stcn_username) WHERE stcn_username IS NOT NULL;

-- Backfill existing users: if they have a casdoor_id and avatar_url, mark as casdoor
UPDATE users SET avatar_source = 'casdoor'
WHERE avatar_source = 'default' AND casdoor_id IS NOT NULL AND avatar_url <> '';
