/**
 * Preset system tags (card / header) vs custom registry tags (gallery only).
 */

export type TagGroup = 'feature' | 'state' | 'release' | 'community' | 'custom';
export type TagVariant = 'emerald' | 'amber' | 'sky' | 'rose' | 'indigo' | 'purple' | 'orange' | 'slate' | 'blue' | 'contextual' | 'status' | 'trust' | 'version' | 'tech';
export type TagZone = 'card' | 'header' | 'gallery';
export type TagSource = 'system' | 'registry';

export interface RegistryTag {
  id: string;
  slug: string;
  label: string;
  group: TagGroup;
  color_variant: string;
  show_on_card: boolean;
  show_on_header: boolean;
  show_in_gallery: boolean;
  card_priority: number;
}

export interface ResolvedTag {
  id: string;
  label: string;
  group: TagGroup | 'system';
  variant: TagVariant;
  source: TagSource;
  icon?: 'zap' | 'shield' | 'tag' | 'code' | 'clock' | 'category' | 'star';
  priority: number;
}

export interface ResolveProjectTagsInput {
  categoryName?: string;
  status?: string;
  version?: string;
  last_update?: string;
  language?: string;
  stars?: number;
  registry_tags?: RegistryTag[];
}

export interface ResolvedProjectTags {
  card: ResolvedTag[];
  header: ResolvedTag[];
  gallery: Record<string, ResolvedTag[]>;
}

const CARD_MAX = 4;
const CARD_MAX_MOBILE = 3;

const VARIANT_CLASSES: Record<TagVariant, string> = {
  emerald: 'bg-emerald-50 text-emerald-600 border-emerald-200/50 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20',
  amber: 'bg-amber-50 text-amber-600 border-amber-200/50 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20',
  sky: 'bg-sky-50 text-sky-600 border-sky-200/50 dark:bg-sky-500/10 dark:text-sky-400 dark:border-sky-500/20',
  rose: 'bg-rose-50 text-rose-600 border-rose-200/50 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20',
  indigo: 'bg-indigo-50 text-indigo-600 border-indigo-200/50 dark:bg-indigo-500/10 dark:text-indigo-400 dark:border-indigo-500/20',
  purple: 'bg-purple-50 text-purple-600 border-purple-200/50 dark:bg-purple-500/10 dark:text-purple-400 dark:border-purple-500/20',
  orange: 'bg-orange-50 text-orange-600 border-orange-200/50 dark:bg-orange-500/10 dark:text-orange-400 dark:border-orange-500/20',
  blue: 'bg-blue-50 text-blue-600 border-blue-200/50 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20',
  slate: 'bg-secondary text-muted-foreground border-border',
  contextual: 'bg-secondary text-muted-foreground border-border backdrop-blur-sm',
  status: 'bg-card text-muted-foreground border-border',
  trust: 'bg-blue-50 text-blue-600 border-blue-200/50 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20',
  version: 'bg-sky-50 text-sky-600 border-sky-200/50 dark:bg-sky-500/10 dark:text-sky-400 dark:border-sky-500/20',
  tech: 'bg-indigo-50 text-indigo-600 border-indigo-200/50 dark:bg-indigo-500/10 dark:text-indigo-400 dark:border-indigo-500/20',
};

export function tagVariantClass(variant: TagVariant): string {
  return VARIANT_CLASSES[variant] ?? VARIANT_CLASSES.slate;
}

function registryVariant(v: string): TagVariant {
  const allowed: TagVariant[] = ['emerald', 'amber', 'sky', 'rose', 'indigo', 'purple', 'orange', 'slate', 'blue'];
  return allowed.includes(v as TagVariant) ? (v as TagVariant) : 'slate';
}

function formatRelativeUpdate(iso?: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const diff = Date.now() - d.getTime();
  const days = Math.floor(diff / 86400000);
  if (days < 1) return '今天更新';
  if (days < 30) return `${days} 天前更新`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} 个月前更新`;
  return `${Math.floor(months / 12)} 年前更新`;
}

function versionLabel(v?: string): string | null {
  const s = String(v ?? '').trim();
  if (!s) return null;
  return s.startsWith('v') || s.startsWith('V') ? s : `v${s}`;
}

function starsLabel(n?: number): string | null {
  if (n == null || !Number.isFinite(n) || n <= 0) return null;
  if (n >= 1000) return `⭐ ${(n / 1000).toFixed(1)}k`;
  return `⭐ ${Math.floor(n)}`;
}

function dedupeTags(tags: ResolvedTag[]): ResolvedTag[] {
  const seen = new Set<string>();
  const out: ResolvedTag[] = [];
  for (const t of tags) {
    const key = `${t.source}:${t.label}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}

function registryToResolved(t: RegistryTag): ResolvedTag {
  return {
    id: t.id,
    label: t.label,
    group: t.group,
    variant: registryVariant(t.color_variant),
    source: 'registry',
    priority: t.card_priority ?? 0,
  };
}

function statusVariant(status: string): TagVariant {
  if (status === '活跃') return 'emerald';
  return 'status';
}

export function resolveProjectDisplayTags(input: ResolveProjectTagsInput): ResolvedProjectTags {
  const registry = input.registry_tags ?? [];

  const status = String(input.status ?? '').trim();
  const ver = versionLabel(input.version);
  const updated = formatRelativeUpdate(input.last_update);
  const stars = starsLabel(input.stars);

  const systemHeader: ResolvedTag[] = [];
  if (status) {
    systemHeader.push({
      id: 'sys-status',
      label: status,
      group: 'system',
      variant: statusVariant(status),
      source: 'system',
      icon: 'zap',
      priority: 100,
    });
  }
  if (ver) {
    systemHeader.push({
      id: 'sys-version',
      label: ver,
      group: 'system',
      variant: 'version',
      source: 'system',
      icon: 'tag',
      priority: 80,
    });
  }
  if (updated) {
    systemHeader.push({
      id: 'sys-updated',
      label: updated,
      group: 'system',
      variant: 'slate',
      source: 'system',
      icon: 'clock',
      priority: 70,
    });
  }
  if (stars) {
    systemHeader.push({
      id: 'sys-stars',
      label: stars,
      group: 'system',
      variant: 'amber',
      source: 'system',
      icon: 'star',
      priority: 65,
    });
  }

  const cardCandidates: ResolvedTag[] = [];
  const cat = String(input.categoryName ?? '').trim();
  if (cat) {
    cardCandidates.push({
      id: 'sys-category',
      label: cat,
      group: 'system',
      variant: 'contextual',
      source: 'system',
      icon: 'category',
      priority: 110,
    });
  }
  if (status) {
    cardCandidates.push({
      id: 'sys-status-card',
      label: status,
      group: 'system',
      variant: statusVariant(status),
      source: 'system',
      icon: 'zap',
      priority: 100,
    });
  }
  if (ver) {
    cardCandidates.push({
      id: 'sys-version-card',
      label: ver,
      group: 'system',
      variant: 'version',
      source: 'system',
      icon: 'tag',
      priority: 85,
    });
  }
  const lang = String(input.language ?? '').trim();
  if (lang) {
    cardCandidates.push({
      id: 'sys-lang',
      label: lang,
      group: 'system',
      variant: 'tech',
      source: 'system',
      icon: 'code',
      priority: 60,
    });
  }

  const card = dedupeTags(cardCandidates)
    .sort((a, b) => b.priority - a.priority)
    .slice(0, CARD_MAX);

  const header = dedupeTags(systemHeader).sort((a, b) => b.priority - a.priority);

  const gallery: Record<string, ResolvedTag[]> = {
    state: [],
    feature: [],
    release: [],
    community: [],
    custom: [],
  };

  for (const t of registry.filter((r) => r.show_in_gallery)) {
    const resolved = registryToResolved(t);
    const bucket = gallery[t.group] ?? gallery.custom;
    if (!bucket.some((x) => x.label === resolved.label)) bucket.push(resolved);
  }

  return { card, header, gallery };
}

export const CARD_TAG_LIMIT = CARD_MAX;
export const CARD_TAG_LIMIT_MOBILE = CARD_MAX_MOBILE;

export const GALLERY_GROUP_LABELS: Record<string, string> = {
  state: '状态与运营',
  feature: '功能特性',
  release: '版本与发布',
  community: '作者与贡献',
  custom: '其他',
};
