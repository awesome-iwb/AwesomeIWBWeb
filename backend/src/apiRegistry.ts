export type ApiScope = 'public' | 'auth' | 'admin';
export type ApiMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface ApiRouteSpec {
  id: string;
  method: ApiMethod;
  path: string;
  scope: ApiScope;
  deprecated?: boolean;
  replacedBy?: string;
}

export const API_REGISTRY: ApiRouteSpec[] = [
  { id: 'health', method: 'GET', path: '/api/health', scope: 'public' },
  { id: 'categories.list', method: 'GET', path: '/api/categories', scope: 'public' },
  { id: 'projects.list', method: 'GET', path: '/api/projects', scope: 'public' },
  { id: 'projects.create.legacy', method: 'POST', path: '/api/projects', scope: 'public', deprecated: true },
  { id: 'projects.detail', method: 'GET', path: '/api/projects/:name', scope: 'public' },
  { id: 'stats', method: 'GET', path: '/api/stats', scope: 'public' },

  { id: 'feedback.list', method: 'GET', path: '/api/feedback', scope: 'public' },
  { id: 'feedback.create', method: 'POST', path: '/api/feedback', scope: 'auth' },
  { id: 'feedback.update', method: 'PATCH', path: '/api/feedback/:id', scope: 'auth' },
  { id: 'feedback.replies.list', method: 'GET', path: '/api/feedback/:id/replies', scope: 'public' },
  { id: 'feedback.replies.create', method: 'POST', path: '/api/feedback/:id/replies', scope: 'auth' },

  { id: 'submissions.create', method: 'POST', path: '/api/submissions', scope: 'public' },
  { id: 'submissions.create.alias', method: 'POST', path: '/api/submit', scope: 'public', deprecated: true, replacedBy: 'submissions.create' },
  { id: 'submissions.dev.create', method: 'POST', path: '/api/dev/submissions', scope: 'auth' },

  { id: 'stories.list', method: 'GET', path: '/api/stories', scope: 'public' },
  { id: 'stories.asset', method: 'GET', path: '/api/stories/:id/:filename', scope: 'public' },
  { id: 'stories.save', method: 'POST', path: '/api/stories', scope: 'admin' },

  { id: 'uploads.get', method: 'GET', path: '/api/uploads/:filename', scope: 'public' },
  { id: 'uploads.create', method: 'POST', path: '/api/upload', scope: 'auth' },
  { id: 'avatar.upload', method: 'POST', path: '/api/user/avatar', scope: 'auth' },

  { id: 'moderation.my', method: 'GET', path: '/api/moderation/my', scope: 'auth' },
  { id: 'notifications.list', method: 'GET', path: '/api/notifications', scope: 'auth' },
  { id: 'notifications.read', method: 'PATCH', path: '/api/notifications/:id/read', scope: 'auth' },
  { id: 'notifications.readAll', method: 'POST', path: '/api/notifications/read-all', scope: 'auth' },
  { id: 'capabilities', method: 'GET', path: '/api/capabilities', scope: 'auth' },
  { id: 'user.capabilities', method: 'GET', path: '/api/user/capabilities', scope: 'auth' },

  { id: 'admin.categories.list', method: 'GET', path: '/api/admin/categories', scope: 'admin' },
  { id: 'admin.categories.create', method: 'POST', path: '/api/admin/categories', scope: 'admin' },
  { id: 'admin.categories.update', method: 'PUT', path: '/api/admin/categories/:id', scope: 'admin' },
  { id: 'admin.categories.delete', method: 'DELETE', path: '/api/admin/categories/:id', scope: 'admin' },

  { id: 'admin.projects.list', method: 'GET', path: '/api/admin/projects', scope: 'admin' },
  { id: 'admin.projects.create', method: 'POST', path: '/api/admin/projects', scope: 'admin' },
  { id: 'admin.projects.update', method: 'PUT', path: '/api/admin/projects/:id', scope: 'admin' },
  { id: 'admin.projects.delete', method: 'DELETE', path: '/api/admin/projects/:id', scope: 'admin' },
  { id: 'admin.projects.revisions', method: 'GET', path: '/api/admin/projects/:id/revisions', scope: 'admin' },
  { id: 'admin.projects.rollback', method: 'POST', path: '/api/admin/projects/:id/rollback', scope: 'admin' },
  { id: 'admin.projects.exportJson', method: 'GET', path: '/api/admin/projects/export.json', scope: 'admin' },
  { id: 'admin.projects.exportCsv', method: 'GET', path: '/api/admin/projects/export.csv', scope: 'admin' },
  { id: 'admin.projects.importJson', method: 'POST', path: '/api/admin/projects/import.json', scope: 'admin' },
  { id: 'admin.projects.importCsv', method: 'POST', path: '/api/admin/projects/import.csv', scope: 'admin' },

  { id: 'admin.audit.list', method: 'GET', path: '/api/admin/audit-logs', scope: 'admin' },
  { id: 'admin.submissions.list', method: 'GET', path: '/api/admin/submissions', scope: 'admin' },
  { id: 'admin.submissions.detail', method: 'GET', path: '/api/admin/submissions/:id', scope: 'admin' },
  { id: 'admin.submissions.approve', method: 'POST', path: '/api/admin/submissions/:id/approve', scope: 'admin' },
  { id: 'admin.submissions.reject', method: 'POST', path: '/api/admin/submissions/:id/reject', scope: 'admin' },

  { id: 'admin.users.list', method: 'GET', path: '/api/admin/users', scope: 'admin' },
  { id: 'admin.users.create', method: 'POST', path: '/api/admin/users', scope: 'admin' },
  { id: 'admin.users.delete', method: 'DELETE', path: '/api/admin/users/:id', scope: 'admin' },
  { id: 'admin.users.role', method: 'PATCH', path: '/api/admin/users/:id/role', scope: 'admin' },
  { id: 'admin.users.active', method: 'PATCH', path: '/api/admin/users/:id/active', scope: 'admin' },
  { id: 'admin.users.password', method: 'PATCH', path: '/api/admin/users/:id/password', scope: 'admin' },
  { id: 'admin.users.capabilities.get', method: 'GET', path: '/api/admin/users/:id/capabilities', scope: 'admin' },
  { id: 'admin.users.capabilities.put', method: 'PUT', path: '/api/admin/users/:id/capabilities', scope: 'admin' },

  { id: 'admin.moderation.comments.list', method: 'GET', path: '/api/admin/moderation/comments', scope: 'admin' },
  { id: 'admin.moderation.bugs.list', method: 'GET', path: '/api/admin/moderation/bugs', scope: 'admin' },
  { id: 'admin.moderation.comments.approve', method: 'POST', path: '/api/admin/moderation/comments/:id/approve', scope: 'admin' },
  { id: 'admin.moderation.comments.reject', method: 'POST', path: '/api/admin/moderation/comments/:id/reject', scope: 'admin' },
  { id: 'admin.moderation.bugs.approve', method: 'POST', path: '/api/admin/moderation/bugs/:id/approve', scope: 'admin' },
  { id: 'admin.moderation.bugs.reject', method: 'POST', path: '/api/admin/moderation/bugs/:id/reject', scope: 'admin' },

  { id: 'admin.media.list', method: 'GET', path: '/api/admin/media', scope: 'admin' },
  { id: 'admin.media.references', method: 'GET', path: '/api/admin/media/:id/references', scope: 'admin' },
  { id: 'admin.media.delete', method: 'DELETE', path: '/api/admin/media/:id', scope: 'admin' },
  { id: 'admin.media.restore', method: 'POST', path: '/api/admin/media/:id/restore', scope: 'admin' },
  { id: 'admin.media.tags.get', method: 'GET', path: '/api/admin/media/:id/tags', scope: 'admin' },
  { id: 'admin.media.tags.patch', method: 'PATCH', path: '/api/admin/media/:id/tags', scope: 'admin' },
  { id: 'admin.media.batchTag', method: 'POST', path: '/api/admin/media/batch-tag', scope: 'admin' },
  { id: 'admin.media.batchDelete', method: 'POST', path: '/api/admin/media/batch-delete', scope: 'admin' },
  { id: 'admin.dashboard', method: 'GET', path: '/api/admin/dashboard', scope: 'admin' },
  { id: 'admin.roleTemplates', method: 'GET', path: '/api/admin/role-templates', scope: 'admin' },

  { id: 'auth.casdoor.login', method: 'GET', path: '/api/auth/login', scope: 'public' },
  { id: 'auth.local.login', method: 'POST', path: '/api/auth/login', scope: 'public' },
  { id: 'auth.callback', method: 'GET', path: '/api/auth/callback', scope: 'public' },
  { id: 'auth.me', method: 'GET', path: '/api/auth/me', scope: 'auth' },
  { id: 'auth.logout', method: 'POST', path: '/api/auth/logout', scope: 'public' },
  { id: 'auth.refresh', method: 'POST', path: '/api/auth/refresh', scope: 'auth' },
  { id: 'auth.superadmin.changePassword', method: 'POST', path: '/api/auth/superadmin/change-password', scope: 'auth' },
  { id: 'auth.local.status', method: 'GET', path: '/api/auth/local/status', scope: 'public' },
];
