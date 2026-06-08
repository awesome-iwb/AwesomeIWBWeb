-- Migration: Add is_enabled column to pages table
ALTER TABLE pages ADD COLUMN IF NOT EXISTS is_enabled BOOLEAN DEFAULT true;
