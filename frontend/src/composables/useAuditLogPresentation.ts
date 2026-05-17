import type { Component } from 'vue';
import {
  Plus,
  Pencil,
  Trash2,
  LogIn,
  CheckCircle2,
  XCircle,
  Send,
  Download,
  Upload,
  RotateCcw,
  UserPlus,
  Shield,
  KeyRound,
  FileJson,
  Image,
  FolderKanban,
  Tags,
  Building2,
  MessageSquare,
  Bug,
  Handshake,
  ScrollText,
  UserCog,
} from 'lucide-vue-next';

export interface AuditLogRow {
  id: string;
  actor: string;
  action: string;
  entity_type: string;
  entity_id: string;
  diff?: Record<string, unknown> | null;
  created_at: string;
}

export type AuditIconKind =
  | 'create'
  | 'update'
  | 'delete'
  | 'login'
  | 'approve'
  | 'reject'
  | 'submit'
  | 'export'
  | 'import'
  | 'rollback'
  | 'member'
  | 'security'
  | 'default';

export interface AuditPresentation {
  icon: Component;
  iconKind: AuditIconKind;
  iconClass: string;
  title: string;
  subtitle: string;
  changeLines: string[];
  actorLabel: string;
  objectLabel: string;
}

const ENTITY_LABELS: Record<string, string> = {
  project: '项目',
  category: '分类',
  user: '用户',
  submission: '投稿',
  media: '媒体',
  organization: '组织',
  comment: '评论',
  comment_moderation: '评论审核',
  bug_moderation: 'Bug 审核',
  project_claim: '项目认领',
  local_account: '本地账号',
};

const FIELD_LABELS: Record<string, string> = {
  name: '名称',
  title: '标题',
  slug: '标识',
  description: '简介',
  short_description: '短描述',
  keywords: '关键词',
  banner_url: '横幅图',
  icon_url: '图标',
  cover_url: '封面',
  icon: '图标',
  banner: '横幅',
  category_id: '分类',
  status: '状态',
  featured: '精选',
  sort_order: '排序',
  role: '角色',
  is_active: '启用状态',
  email: '邮箱',
  avatar_url: '头像',
  review_note: '审核备注',
  capabilities: '权限',
  user_id: '用户',
  org_id: '组织',
  project_id: '项目',
  new_owner_user_id: '新负责人',
  from_submission: '来源投稿',
  revisionId: '版本',
  kind: '类型',
  has_password: '已设密码',
  must_change_password: '需改密',
  ip: 'IP',
  ua: '浏览器',
  username: '用户名',
  reason: '原因',
};

const ACTION_TEMPLATES: Record<string, { title: string; subtitle?: string; iconKind?: AuditIconKind }> = {
  create: { title: '新建', iconKind: 'create' },
  update: { title: '更新', iconKind: 'update' },
  delete: { title: '删除', iconKind: 'delete' },
  submit: { title: '提交审核', iconKind: 'submit' },
  approve: { title: '审核通过', iconKind: 'approve' },
  reject: { title: '审核驳回', iconKind: 'reject' },
  rollback: { title: '版本回滚', iconKind: 'rollback' },
  export_json: { title: '导出 JSON', iconKind: 'export' },
  export_csv: { title: '导出 CSV', iconKind: 'export' },
  import_json: { title: '导入 JSON', iconKind: 'import' },
  import_csv: { title: '导入 CSV', iconKind: 'import' },
  add_member: { title: '添加成员', iconKind: 'member' },
  remove_member: { title: '移除成员', iconKind: 'member' },
  add_project_member: { title: '添加项目成员', iconKind: 'member' },
  remove_project_member: { title: '移除项目成员', iconKind: 'member' },
  add_org_member: { title: '添加组织成员', iconKind: 'member' },
  transfer_ownership: { title: '转移负责人', iconKind: 'member' },
  update_role: { title: '调整角色', iconKind: 'update' },
  update_capabilities: { title: '调整权限', iconKind: 'security' },
  activate: { title: '启用账号', iconKind: 'update' },
  deactivate: { title: '禁用账号', iconKind: 'delete' },
  create_user: { title: '创建用户', iconKind: 'create' },
  delete_user: { title: '删除用户', iconKind: 'delete' },
  reset_password: { title: '重置密码', iconKind: 'security' },
  rename_user: { title: '重命名用户', iconKind: 'update' },
  soft_delete_media: { title: '删除媒体', iconKind: 'delete' },
  restore_media: { title: '恢复媒体', iconKind: 'create' },
  approve_comment: { title: '通过评论', iconKind: 'approve' },
  reject_comment: { title: '驳回评论', iconKind: 'reject' },
  approve_bug: { title: '通过 Bug', iconKind: 'approve' },
  reject_bug: { title: '驳回 Bug', iconKind: 'reject' },
  approve_claim: { title: '通过认领', iconKind: 'approve' },
  reject_claim: { title: '驳回认领', iconKind: 'reject' },
  superadmin_login_attempt: { title: '超管登录尝试', iconKind: 'login' },
  superadmin_password_changed: { title: '超管修改密码', iconKind: 'security' },
  superadmin_seeded: { title: '初始化超管账号', iconKind: 'security' },
};

const ICON_BY_KIND: Record<AuditIconKind, Component> = {
  create: Plus,
  update: Pencil,
  delete: Trash2,
  login: LogIn,
  approve: CheckCircle2,
  reject: XCircle,
  submit: Send,
  export: Download,
  import: Upload,
  rollback: RotateCcw,
  member: UserPlus,
  security: Shield,
  default: ScrollText,
};

const ICON_CLASS_BY_KIND: Record<AuditIconKind, string> = {
  create: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400',
  update: 'bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400',
  delete: 'bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400',
  login: 'bg-violet-100 text-violet-600 dark:bg-violet-500/20 dark:text-violet-400',
  approve: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400',
  reject: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400',
  submit: 'bg-sky-100 text-sky-600 dark:bg-sky-500/20 dark:text-sky-400',
  export: 'bg-slate-100 text-slate-600 dark:bg-slate-500/20 dark:text-slate-300',
  import: 'bg-slate-100 text-slate-600 dark:bg-slate-500/20 dark:text-slate-300',
  rollback: 'bg-orange-100 text-orange-600 dark:bg-orange-500/20 dark:text-orange-400',
  member: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400',
  security: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400',
  default: 'bg-slate-100 text-slate-600 dark:bg-slate-500/20 dark:text-slate-300',
};

function entityLabel(type: string): string {
  return ENTITY_LABELS[type] ?? type;
}

function fieldLabel(key: string): string {
  return FIELD_LABELS[key] ?? key;
}

function truncate(val: unknown, max = 48): string {
  if (val === null || val === undefined) return '（空）';
  if (typeof val === 'boolean') return val ? '是' : '否';
  if (typeof val === 'number') return String(val);
  if (Array.isArray(val)) return val.length ? `[${val.length} 项]` : '（空）';
  if (typeof val === 'object') {
    const s = JSON.stringify(val);
    return s.length > max ? s.slice(0, max) + '…' : s;
  }
  const s = String(val);
  return s.length > max ? s.slice(0, max) + '…' : s;
}

function pickName(obj: Record<string, unknown> | undefined): string {
  if (!obj) return '';
  const n = obj.name ?? obj.title ?? obj.slug;
  return n != null ? String(n) : '';
}

function objectRef(row: AuditLogRow): string {
  const diff = row.diff ?? {};
  const name =
    pickName(diff.after as Record<string, unknown>) ||
    pickName(diff.before as Record<string, unknown>) ||
    (typeof diff.name === 'string' ? diff.name : '') ||
    (typeof diff.title === 'string' ? diff.title : '');
  if (name) return name;
  if (row.entity_id) return row.entity_id.slice(0, 8) + (row.entity_id.length > 8 ? '…' : '');
  return '';
}

function diffBeforeAfter(diff: Record<string, unknown>): string[] {
  const before = diff.before as Record<string, unknown> | undefined;
  const after = diff.after as Record<string, unknown> | undefined;
  if (!before && !after) return [];
  const keys = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]);
  const skip = new Set(['id', 'created_at', 'updated_at', 'deleted_at']);
  const lines: string[] = [];
  for (const key of keys) {
    if (skip.has(key)) continue;
    const b = before?.[key];
    const a = after?.[key];
    if (JSON.stringify(b) === JSON.stringify(a)) continue;
    const label = fieldLabel(key);
    if (b !== undefined && a !== undefined) {
      lines.push(`${label}：${truncate(b, 32)} → ${truncate(a, 32)}`);
    } else if (a !== undefined) {
      lines.push(`${label} 设为 ${truncate(a, 32)}`);
    } else if (b !== undefined) {
      lines.push(`${label} 已清除（原 ${truncate(b, 32)}）`);
    }
  }
  return lines.slice(0, 8);
}

function diffFlatChanges(diff: Record<string, unknown>): string[] {
  const lines: string[] = [];
  if (diff.role !== undefined) lines.push(`角色设为 ${truncate(diff.role)}`);
  if (diff.review_note !== undefined && String(diff.review_note).trim()) {
    lines.push(`备注：${truncate(diff.review_note, 64)}`);
  }
  if (diff.user_id !== undefined) lines.push(`用户 ID：${truncate(diff.user_id)}`);
  if (diff.org_id !== undefined) lines.push(`组织 ID：${truncate(diff.org_id)}`);
  if (diff.project_id !== undefined) lines.push(`关联项目：${truncate(diff.project_id)}`);
  if (diff.new_owner_user_id !== undefined) lines.push(`新负责人：${truncate(diff.new_owner_user_id)}`);
  if (diff.kind === 'project_update') lines.push('类型：项目变更投稿');
  if (diff.from_submission !== undefined) lines.push(`来自投稿 ${truncate(diff.from_submission)}`);
  if (diff.revisionId !== undefined) lines.push(`回滚至版本 ${truncate(diff.revisionId)}`);
  if (diff.capabilities !== undefined) {
    const caps = diff.capabilities;
    lines.push(Array.isArray(caps) ? `权限共 ${caps.length} 项` : `权限已更新`);
  }
  if (diff.name !== undefined && !diff.before) lines.push(`名称：${truncate(diff.name)}`);
  if (diff.slug !== undefined) lines.push(`标识：${truncate(diff.slug)}`);
  if (diff.email !== undefined) lines.push(`邮箱：${truncate(diff.email)}`);
  if (diff.has_password !== undefined) lines.push(diff.has_password ? '已设置密码' : '未设置密码');
  if (diff.status !== undefined) lines.push(`结果：${truncate(diff.status)}`);
  if (diff.reason !== undefined) lines.push(`原因：${truncate(diff.reason)}`);
  if (diff.username !== undefined) lines.push(`账号：${truncate(diff.username)}`);
  if (diff.ip !== undefined) lines.push(`IP：${truncate(diff.ip)}`);
  return lines;
}

function importExportSummary(diff: Record<string, unknown>): string[] {
  if (!diff || typeof diff !== 'object') return [];
  if (Array.isArray(diff)) return [`共 ${diff.length} 条记录`];
  const created = diff.created ?? diff.inserted;
  const updated = diff.updated;
  const failed = diff.failed ?? diff.errors;
  const lines: string[] = [];
  if (created != null) lines.push(`新增 ${created} 条`);
  if (updated != null) lines.push(`更新 ${updated} 条`);
  if (failed != null) lines.push(`失败 ${failed} 条`);
  if (lines.length) return lines;
  const keys = Object.keys(diff);
  if (keys.length <= 6) return keys.map((k) => `${fieldLabel(k)}：${truncate(diff[k])}`);
  return [`包含 ${keys.length} 项结果`];
}

function buildChangeLines(row: AuditLogRow): string[] {
  const diff = (row.diff ?? {}) as Record<string, unknown>;
  if (row.action === 'update' && diff.before && diff.after && typeof diff.before === 'object') {
    const lines = diffBeforeAfter(diff);
    if (lines.length) return lines;
  }
  if (Object.keys(diff).length === 0) return [];
  const flat = diffFlatChanges(diff);
  if (flat.length) return flat;
  if (['import_json', 'import_csv', 'export_json', 'export_csv'].includes(row.action)) {
    return importExportSummary(diff);
  }
  if (diff.before || diff.after) return diffBeforeAfter(diff);
  const keys = Object.keys(diff).filter((k) => !['before', 'after'].includes(k));
  if (keys.length === 0) return [];
  return keys.slice(0, 6).map((k) => `${fieldLabel(k)}：${truncate(diff[k])}`);
}

function resolveIconKind(action: string, template?: { iconKind?: AuditIconKind }): AuditIconKind {
  if (template?.iconKind) return template.iconKind;
  if (action.includes('login')) return 'login';
  if (action.includes('approve')) return 'approve';
  if (action.includes('reject')) return 'reject';
  if (action.includes('delete') || action === 'deactivate') return 'delete';
  if (action.includes('create') || action.includes('restore') || action === 'activate') return 'create';
  if (action.includes('export')) return 'export';
  if (action.includes('import')) return 'import';
  if (action.includes('rollback')) return 'rollback';
  if (action.includes('member') || action.includes('ownership')) return 'member';
  if (action.includes('password') || action.includes('superadmin') || action.includes('capabilities')) {
    return 'security';
  }
  if (action.includes('submit')) return 'submit';
  if (action.includes('update') || action.includes('rename') || action.includes('role')) return 'update';
  return 'default';
}

function buildSubtitle(row: AuditLogRow, ent: string, ref: string, actor: string): string {
  const tpl = ACTION_TEMPLATES[row.action];
  const actionText = tpl?.title ?? row.action;
  const who = actor && actor !== 'system' ? actor : '系统';
  const target = ref ? `${ent}「${ref}」` : ent;
  const parts = [`${who} 对${target}执行了${actionText}`];
  if (tpl?.subtitle) parts.push(tpl.subtitle);
  if (row.action === 'superadmin_login_attempt' && row.diff?.status) {
    parts.push(String(row.diff.status) === 'success' ? '登录成功' : '登录失败');
  }
  return parts.join(' · ');
}

export function presentAuditLog(row: AuditLogRow): AuditPresentation {
  const ent = entityLabel(row.entity_type);
  const ref = objectRef(row);
  const actor = row.actor?.trim() || 'system';
  const tpl = ACTION_TEMPLATES[row.action];
  const iconKind = resolveIconKind(row.action, tpl);
  const actionText = tpl?.title ?? row.action;
  const title = ref ? `${actionText}${ent}「${ref}」` : `${actionText}${ent}`;
  const subtitle = buildSubtitle(row, ent, ref, actor);
  const changeLines = buildChangeLines(row);
  const objectLabel = ref ? `${ent} · ${ref}` : row.entity_id ? `${ent} · ${row.entity_id.slice(0, 8)}` : ent;

  return {
    icon: ICON_BY_KIND[iconKind] ?? ScrollText,
    iconKind,
    iconClass: ICON_CLASS_BY_KIND[iconKind],
    title,
    subtitle,
    changeLines,
    actorLabel: actor === 'system' ? '系统' : actor,
    objectLabel,
  };
}

/** 实体类型对应的小图标（详情区用） */
export function entityTypeIcon(type: string): Component {
  const map: Record<string, Component> = {
    project: FolderKanban,
    category: Tags,
    user: UserCog,
    submission: Send,
    media: Image,
    organization: Building2,
    comment: MessageSquare,
    comment_moderation: MessageSquare,
    bug_moderation: Bug,
    project_claim: Handshake,
    local_account: KeyRound,
  };
  return map[type] ?? FileJson;
}

export function formatAuditDiffJson(diff: unknown): string {
  try {
    return JSON.stringify(diff ?? {}, null, 2);
  } catch {
    return String(diff ?? '');
  }
}
