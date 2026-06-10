-- Migration: make project categorization lossless.
--
-- Projects must remain visible after their category is deleted, so the catalog has a
-- stable system fallback category. Historical rows with NULL or dangling category_id
-- are backfilled into that category.

INSERT INTO categories (id, name, description, sort_index)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  '未分类',
  '未选择分类，或原分类已删除的项目。',
  2147483647
)
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    description = CASE
      WHEN trim(categories.description) = '' THEN EXCLUDED.description
      ELSE categories.description
    END,
    sort_index = EXCLUDED.sort_index,
    updated_at = now();

UPDATE projects
SET category_id = '00000000-0000-0000-0000-000000000001',
    updated_at = now()
WHERE category_id IS NULL
   OR NOT EXISTS (
     SELECT 1
     FROM categories
     WHERE categories.id = projects.category_id
   );

ALTER TABLE projects
  ALTER COLUMN category_id SET DEFAULT '00000000-0000-0000-0000-000000000001';

DO $$
DECLARE
  category_fk_name text;
BEGIN
  SELECT conname
  INTO category_fk_name
  FROM pg_constraint
  WHERE conrelid = 'projects'::regclass
    AND confrelid = 'categories'::regclass
    AND contype = 'f'
    AND array_length(conkey, 1) = 1
    AND conkey[1] = (
      SELECT attnum
      FROM pg_attribute
      WHERE attrelid = 'projects'::regclass
        AND attname = 'category_id'
    )
  LIMIT 1;

  IF category_fk_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE projects DROP CONSTRAINT %I', category_fk_name);
  END IF;
END $$;

ALTER TABLE projects
  ADD CONSTRAINT projects_category_id_fkey
  FOREIGN KEY (category_id)
  REFERENCES categories(id)
  ON DELETE SET DEFAULT;
