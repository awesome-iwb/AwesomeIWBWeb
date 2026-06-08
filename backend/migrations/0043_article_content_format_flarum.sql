-- Add 'flarum' to the CHECK constraint on content_format in the articles table
ALTER TABLE articles DROP CONSTRAINT IF EXISTS articles_content_format_check;
ALTER TABLE articles ADD CONSTRAINT articles_content_format_check CHECK (content_format IN ('markdown', 'html', 'latex', 'plain', 'flarum'));
