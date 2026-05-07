-- Migration: users and api_tokens tables for auth system
-- Date: 2026-05-07

-- Users table: stores authenticated users from Casdoor/STCN and local accounts
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  casdoor_id TEXT UNIQUE,
  name TEXT NOT NULL,
  avatar_url TEXT NOT NULL DEFAULT '',
  email TEXT,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'dev', 'ops')),
  stcn_user_id TEXT,
  sectl_user_id TEXT,
  lincube_user_id TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for Casdoor ID lookups
CREATE INDEX IF NOT EXISTS users_casdoor_id_idx ON users (casdoor_id);

-- Index for platform user ID lookups (used by dev matching)
CREATE INDEX IF NOT EXISTS users_stcn_user_id_idx ON users (stcn_user_id) WHERE stcn_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS users_sectl_user_id_idx ON users (sectl_user_id) WHERE sectl_user_id IS NOT NULL;

-- API tokens table: for internal/service accounts (e.g., AdminView, CI/CD)
CREATE TABLE IF NOT EXISTS api_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'ops' CHECK (role IN ('ops')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  expires_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for active token lookups
CREATE INDEX IF NOT EXISTS api_tokens_active_idx ON api_tokens (token_hash, is_active) WHERE is_active = true;

-- Add updated_at trigger for users table
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS users_updated_at ON users;
CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
