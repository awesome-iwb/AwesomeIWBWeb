CREATE OR REPLACE FUNCTION _awesomeiwb_safe_github_repo_url(raw text)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  owner text;
  repo text;
  parts text[];
BEGIN
  IF raw IS NULL OR btrim(raw) = '' THEN
    RETURN '';
  END IF;

  IF raw !~ '^https://github\.com/' THEN
    RETURN '';
  END IF;

  parts := regexp_split_to_array(regexp_replace(raw, '^https://github\.com/', ''), '/');
  IF array_length(parts, 1) < 2 THEN
    RETURN '';
  END IF;

  owner := parts[1];
  repo := regexp_replace(split_part(split_part(parts[2], '?', 1), '#', 1), '\.git$', '', 'i');

  IF lower(owner) IN (
    'about', 'apps', 'blog', 'codespaces', 'contact', 'customer-stories', 'dashboard', 'enterprise',
    'events', 'explore', 'features', 'issues', 'join', 'login', 'marketplace', 'new', 'notifications',
    'organizations', 'orgs', 'pricing', 'pulls', 'search', 'security', 'settings', 'sponsors', 'topics',
    'trending'
  ) THEN
    RETURN '';
  END IF;

  IF owner !~ '^[A-Za-z0-9]([A-Za-z0-9-]{0,37}[A-Za-z0-9])?$' THEN
    RETURN '';
  END IF;

  IF repo !~ '^[A-Za-z0-9._-]{1,100}$' OR repo IN ('.', '..') OR repo ~ '\.git$' THEN
    RETURN '';
  END IF;

  RETURN 'https://github.com/' || owner || '/' || repo;
END;
$$;

CREATE OR REPLACE FUNCTION _awesomeiwb_safe_upload_url(raw text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN raw IS NOT NULL
      AND raw LIKE '/api/uploads/%'
      AND raw NOT LIKE '%?%'
      AND raw NOT LIKE '%#%'
      AND raw !~ '\\'
      AND lower(raw) !~ '%(2e|2f|5c)'
      AND raw !~ '(^|/)(\.|\.\.)(/|$)'
    THEN raw
    ELSE ''
  END;
$$;

CREATE OR REPLACE FUNCTION _awesomeiwb_safe_public_http_url(raw text)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  trimmed text;
BEGIN
  trimmed := btrim(coalesce(raw, ''));
  IF trimmed = '' THEN
    RETURN '';
  END IF;

  IF trimmed !~ '^https?://[^/?#@]+([/?#]|$)' THEN
    RETURN '';
  END IF;

  IF trimmed ~ '^[a-z]+://[^/?#]*@' THEN
    RETURN '';
  END IF;

  RETURN trimmed;
END;
$$;

UPDATE projects
SET
  github_url = _awesomeiwb_safe_github_repo_url(github_url),
  github_parent_url = _awesomeiwb_safe_github_repo_url(github_parent_url),
  github_source_url = _awesomeiwb_safe_github_repo_url(github_source_url),
  icon = _awesomeiwb_safe_upload_url(icon),
  avatar = _awesomeiwb_safe_upload_url(avatar),
  banner = _awesomeiwb_safe_upload_url(banner);

UPDATE organizations
SET
  avatar_url = _awesomeiwb_safe_upload_url(avatar_url),
  website_url = _awesomeiwb_safe_public_http_url(website_url);

UPDATE articles
SET cover_image = _awesomeiwb_safe_upload_url(cover_image);

UPDATE users
SET
  upload_avatar_url = _awesomeiwb_safe_upload_url(upload_avatar_url),
  external_avatar_url = _awesomeiwb_safe_public_http_url(external_avatar_url);

UPDATE users
SET avatar_url = CASE
  WHEN avatar_source = 'upload' THEN _awesomeiwb_safe_upload_url(avatar_url)
  ELSE _awesomeiwb_safe_public_http_url(avatar_url)
END;

UPDATE users
SET avatar_source = 'default'
WHERE avatar_source <> 'default' AND avatar_url = '';

DROP FUNCTION _awesomeiwb_safe_public_http_url(text);
DROP FUNCTION _awesomeiwb_safe_upload_url(text);
DROP FUNCTION _awesomeiwb_safe_github_repo_url(text);
