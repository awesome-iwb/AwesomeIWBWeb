-- =============================================================
-- 项目详情图轮播（Project Gallery）
--
-- 在项目详情页顶部展示的截图墙。支持三类素材：
--   image       站内上传的图片（/api/uploads/...）
--   text        纯文字卡（无图，用于特性说明 / 章节分隔）
--   video_embed 视频外链（只存厂商 + 视频 ID，播放地址由代码模板拼装）
--
-- 权限：开发者复用 dev:project_edit + project_members 归属校验；
--       运维使用新增的 gallery:manage。
-- =============================================================

CREATE TABLE IF NOT EXISTS project_gallery_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

  media_type TEXT NOT NULL DEFAULT 'image'
    CHECK (media_type IN ('image', 'text', 'video_embed')),

  -- 只允许站内上传地址，由 domain/projectGalleryItem.ts 的
  -- normalizeInternalUploadUrl 兜底校验
  image_url TEXT NOT NULL DEFAULT '',

  title   TEXT NOT NULL DEFAULT '',
  caption TEXT NOT NULL DEFAULT '',

  -- 跳转目标：外链 与 站内项目 二选一（表级 CHECK 保证互斥）
  link_url          TEXT NOT NULL DEFAULT '',
  linked_project_id UUID REFERENCES projects(id) ON DELETE SET NULL,

  -- 视频外链：绝不存原始 URL，杜绝 iframe src 注入
  video_provider TEXT NOT NULL DEFAULT ''
    CHECK (video_provider IN ('', 'bilibili', 'tencent', 'youku')),
  video_id TEXT NOT NULL DEFAULT '',

  sort_index INT     NOT NULL DEFAULT 0,
  is_enabled BOOLEAN NOT NULL DEFAULT true,

  created_by TEXT NOT NULL DEFAULT '',
  updated_by TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT project_gallery_items_payload_check CHECK (
    (media_type = 'image'       AND image_url <> '') OR
    (media_type = 'text'        AND (title <> '' OR caption <> '')) OR
    (media_type = 'video_embed' AND video_provider <> '' AND video_id <> '')
  ),
  CONSTRAINT project_gallery_items_target_check CHECK (
    NOT (link_url <> '' AND linked_project_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS project_gallery_items_project_sort_idx
  ON project_gallery_items (project_id, sort_index, created_at);

-- 前台只读路径的部分索引（只扫启用项）
CREATE INDEX IF NOT EXISTS project_gallery_items_enabled_idx
  ON project_gallery_items (project_id, sort_index)
  WHERE is_enabled;

DROP TRIGGER IF EXISTS project_gallery_items_updated_at ON project_gallery_items;
CREATE TRIGGER project_gallery_items_updated_at
  BEFORE UPDATE ON project_gallery_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- -------------------------------------------------------------
-- 埋点：按 (条目, 日期) 汇总的计数器，而非明细行。
--
-- 曝光量级 = 详情页 PV x 条目数，明细行会迅速膨胀且无查询价值。
-- 不复用 click_events：analytics.ts 的 click_total 是不带过滤的
-- count(*)，塞入曝光会污染运维看板；且 click_events 以 project_slug
-- 为键，没有 item 维度，无法回答「哪张图效果好」。
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS project_gallery_daily_stats (
  item_id     UUID NOT NULL REFERENCES project_gallery_items(id) ON DELETE CASCADE,
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  stat_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  impressions BIGINT NOT NULL DEFAULT 0,
  clicks      BIGINT NOT NULL DEFAULT 0,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (item_id, stat_date)
);

CREATE INDEX IF NOT EXISTS project_gallery_daily_stats_project_date_idx
  ON project_gallery_daily_stats (project_id, stat_date DESC);

-- -------------------------------------------------------------
-- 权限与菜单（对齐 0049_notification_campaigns.sql 的四步范式）
-- -------------------------------------------------------------
INSERT INTO capabilities (id, name, category, description, sort_index) VALUES
  ('gallery:manage', '详情图管理', 'ops.content', '管理全站项目详情图轮播素材与投放', 2360)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  description = EXCLUDED.description,
  sort_index = EXCLUDED.sort_index;

-- 回填给所有已有运维后台权限的用户，避免「菜单可见但 403」
INSERT INTO user_capabilities (user_id, capability_id)
  SELECT uc.user_id, 'gallery:manage'
  FROM user_capabilities uc
  WHERE uc.capability_id = 'admin_panel_access'
ON CONFLICT DO NOTHING;

INSERT INTO pages (path, title, "group", icon, required_capability, is_visible, sort_index) VALUES
  ('/admin/project-gallery', '详情图管理', '运维', 'Images', 'gallery:manage', true, 45)
ON CONFLICT (path) DO UPDATE SET
  title = EXCLUDED.title,
  "group" = EXCLUDED."group",
  icon = EXCLUDED.icon,
  required_capability = EXCLUDED.required_capability,
  is_visible = EXCLUDED.is_visible,
  sort_index = EXCLUDED.sort_index,
  updated_at = now();
