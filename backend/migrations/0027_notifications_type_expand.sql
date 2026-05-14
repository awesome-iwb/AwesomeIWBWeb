-- Migration: expand notifications.type CHECK constraint
-- Date: 2026-05-15

ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'moderation_approved', 'moderation_rejected',
    'role_promoted', 'role_demoted',
    'org_approved', 'org_rejected',
    'claim_approved', 'claim_rejected'
  ));
