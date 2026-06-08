-- Migration: Fix category of analytics:read capability to ops.analytics
UPDATE capabilities SET category = 'ops.analytics' WHERE id = 'analytics:read';
