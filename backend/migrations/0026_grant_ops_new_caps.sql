-- Migration: grant org/claim capabilities to existing ops users
-- Date: 2026-05-15

INSERT INTO user_capabilities (user_id, capability_id)
SELECT u.id, c.id FROM users u, capabilities c
WHERE u.role = 'ops' AND c.id IN ('org:review', 'claim:review', 'org:manage')
ON CONFLICT (user_id, capability_id) DO NOTHING;
