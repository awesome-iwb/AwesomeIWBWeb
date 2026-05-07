ALTER TABLE local_accounts
  ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT false;

UPDATE local_accounts
SET role = 'ops'
WHERE username = 'lincube';

