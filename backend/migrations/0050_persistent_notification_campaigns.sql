ALTER TABLE notification_campaigns
  ADD COLUMN IF NOT EXISTS delivery_mode TEXT NOT NULL DEFAULT 'snapshot',
  ADD COLUMN IF NOT EXISTS action_url TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS action_label TEXT NOT NULL DEFAULT '';

ALTER TABLE notification_campaigns
  DROP CONSTRAINT IF EXISTS notification_campaigns_audience_kind_check;
ALTER TABLE notification_campaigns
  ADD CONSTRAINT notification_campaigns_audience_kind_check
  CHECK (audience_kind IN ('all', 'users', 'developers'));

ALTER TABLE notification_campaigns
  DROP CONSTRAINT IF EXISTS notification_campaigns_status_check;
ALTER TABLE notification_campaigns
  ADD CONSTRAINT notification_campaigns_status_check
  CHECK (status IN ('draft', 'sent', 'active', 'archived'));

ALTER TABLE notification_campaigns
  DROP CONSTRAINT IF EXISTS notification_campaigns_delivery_mode_check;
ALTER TABLE notification_campaigns
  ADD CONSTRAINT notification_campaigns_delivery_mode_check
  CHECK (delivery_mode IN ('snapshot', 'persistent'));

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS campaign_id UUID;

UPDATE notifications n
SET campaign_id = c.id
FROM notification_campaigns c
WHERE n.campaign_id IS NULL
  AND n.data->>'campaign_id' = c.id::TEXT;

WITH ranked AS (
  SELECT id,
         row_number() OVER (PARTITION BY user_name, campaign_id ORDER BY created_at, id) AS duplicate_number
  FROM notifications
  WHERE campaign_id IS NOT NULL
)
UPDATE notifications n
SET campaign_id = NULL
FROM ranked r
WHERE n.id = r.id
  AND r.duplicate_number > 1;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'notifications_campaign_id_fkey'
  ) THEN
    ALTER TABLE notifications
      ADD CONSTRAINT notifications_campaign_id_fkey
      FOREIGN KEY (campaign_id)
      REFERENCES notification_campaigns(id)
      ON DELETE SET NULL;
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS notifications_user_campaign_unique_idx
  ON notifications (user_name, campaign_id)
  WHERE campaign_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS notification_campaigns_persistent_active_idx
  ON notification_campaigns (audience_kind, created_at DESC)
  WHERE delivery_mode = 'persistent' AND status = 'active';
