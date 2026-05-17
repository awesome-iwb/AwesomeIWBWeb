WITH duplicates AS (
  SELECT id, name,
    ROW_NUMBER() OVER (PARTITION BY lower(name) ORDER BY created_at ASC) as rn
  FROM users
)
UPDATE users SET name = d.name || '_' || (d.rn - 1)::text
FROM duplicates d
WHERE users.id = d.id AND d.rn > 1;

ALTER TABLE users ADD CONSTRAINT users_name_unique UNIQUE (name);
