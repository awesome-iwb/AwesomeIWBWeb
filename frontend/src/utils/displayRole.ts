export type DisplayRole = 'superadmin' | 'ops' | 'editor' | 'dev' | 'user';

const OPS_MARKER_CAPABILITIES = [
  'user:manage',
  'user:delete',
  'audit:read',
  'org:manage',
  'analytics:read',
] as const;

const EDITOR_MARKER_CAPABILITIES = [
  'story:manage',
  'category:manage',
  'submission:read',
  'submission:approve',
  'submission:reject',
  'moderation:read',
  'moderation:approve',
  'moderation:reject',
  'media:manage',
] as const;

export function inferDisplayRole(
  capabilities: string[],
  options?: { isSuperadmin?: boolean },
): DisplayRole {
  if (options?.isSuperadmin) return 'superadmin';
  const caps = new Set(capabilities);
  if (OPS_MARKER_CAPABILITIES.some((id) => caps.has(id))) return 'ops';
  if (caps.has('admin_panel_access')) {
    if (EDITOR_MARKER_CAPABILITIES.some((id) => caps.has(id))) return 'editor';
    return 'ops';
  }
  if (caps.has('dev_panel_access')) return 'dev';
  return 'user';
}

export function displayRoleLabel(role: DisplayRole | string): string {
  switch (role) {
    case 'superadmin':
      return '超级管理员';
    case 'ops':
      return '运维';
    case 'editor':
      return '编者';
    case 'dev':
      return '开发者';
    default:
      return '用户';
  }
}

export function displayRoleBadgeClass(role: DisplayRole | string, selected = false): string {
  if (selected) return '';
  switch (role) {
    case 'superadmin':
      return 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300';
    case 'ops':
      return 'bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300';
    case 'editor':
      return 'bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-300';
    case 'dev':
      return 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300';
    default:
      return 'opacity-80';
  }
}
