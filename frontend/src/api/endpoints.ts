export const API = {
  auth: {
    login: '/api/auth/login',
    callback: '/api/auth/callback',
    me: '/api/auth/me',
    logout: '/api/auth/logout',
    capabilities: '/api/capabilities',
    userAvatar: '/api/user/avatar',
  },
  catalog: {
    categories: '/api/categories',
    projects: '/api/projects',
    stats: '/api/stats',
    stories: '/api/stories',
  },
  feedback: {
    list: '/api/feedback',
    detail: (id: string) => `/api/feedback/${encodeURIComponent(id)}`,
    replies: (id: string) => `/api/feedback/${encodeURIComponent(id)}/replies`,
  },
  upload: {
    image: '/api/upload',
  },
  submissions: {
    list: '/api/submissions',
    dev: '/api/dev/submissions',
  },
  admin: {
    categories: '/api/admin/categories',
    projects: '/api/admin/projects',
    submissions: '/api/admin/submissions',
    moderationComments: '/api/admin/moderation/comments',
    moderationBugs: '/api/admin/moderation/bugs',
    users: '/api/admin/users',
    auditLogs: '/api/admin/audit-logs',
    media: '/api/admin/media',
    dashboard: '/api/admin/dashboard',
    roleTemplates: '/api/admin/role-templates',
    mediaTags: (id: string) => `/api/admin/media/${encodeURIComponent(id)}/tags`,
    mediaBatchTag: '/api/admin/media/batch-tag',
    mediaBatchDelete: '/api/admin/media/batch-delete',
  },
} as const;
