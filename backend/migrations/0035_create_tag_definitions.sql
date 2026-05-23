CREATE TABLE IF NOT EXISTS tag_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  "group" TEXT NOT NULL DEFAULT 'custom'
    CHECK ("group" IN ('feature', 'state', 'release', 'community', 'custom')),
  color_variant TEXT NOT NULL DEFAULT 'slate'
    CHECK (color_variant IN ('emerald', 'amber', 'sky', 'rose', 'indigo', 'purple', 'orange', 'slate', 'blue')),
  show_on_card BOOLEAN NOT NULL DEFAULT false,
  show_on_header BOOLEAN NOT NULL DEFAULT false,
  show_in_gallery BOOLEAN NOT NULL DEFAULT true,
  card_priority INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tag_definitions_group ON tag_definitions ("group");
CREATE INDEX IF NOT EXISTS idx_tag_definitions_active ON tag_definitions (is_active);

CREATE TABLE IF NOT EXISTS project_tag_links (
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tag_definitions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_project_tag_links_tag ON project_tag_links (tag_id);
