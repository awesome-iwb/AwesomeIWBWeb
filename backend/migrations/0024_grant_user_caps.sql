-- Migration: grant user capabilities to all existing users
-- Date: 2026-05-15

INSERT INTO user_capabilities (user_id, capability_id)
SELECT u.id, c.id FROM users u, capabilities c
WHERE c.id LIKE 'user:%'
ON CONFLICT (user_id, capability_id) DO NOTHING;
