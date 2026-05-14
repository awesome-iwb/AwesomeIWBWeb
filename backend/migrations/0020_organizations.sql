-- Migration: organizations and organization_members tables
-- Date: 2026-05-15

CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  avatar_url TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  website_url TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','rejected','suspended')),
  review_note TEXT NOT NULL DEFAULT '',
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS org_status_idx ON organizations(status);
CREATE INDEX IF NOT EXISTS org_created_by_idx ON organizations(created_by);

CREATE TABLE IF NOT EXISTS organization_members (
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member'
    CHECK (role IN ('owner','admin','member')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (org_id, user_id)
);

CREATE INDEX IF NOT EXISTS org_members_user_idx ON organization_members(user_id);
