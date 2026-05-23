-- Remove deprecated recommendation badges (e.g. 值得尝试) from display data.
UPDATE projects
SET recommendation = '{}'::text[]
WHERE recommendation IS NOT NULL
  AND (
    array_length(recommendation, 1) IS NULL
    OR EXISTS (
      SELECT 1 FROM unnest(recommendation) AS r
      WHERE r ILIKE '%值得尝试%'
         OR r ILIKE '%非常推荐%'
         OR r ILIKE '%稳定%'
         OR r ILIKE '%不稳定%'
         OR r ILIKE '%观望%'
    )
  );
