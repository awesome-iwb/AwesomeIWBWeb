import type { RouteRecordRaw, Router } from 'vue-router'
import { isNavigationFailure, NavigationFailureType } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import ProjectDetailView from '../views/ProjectDetailView.vue'
import SubmitProjectView from '../views/SubmitProjectView.vue'
import CompareView from '../views/CompareView.vue'
import FeaturedView from '../views/FeaturedView.vue'
import CategoriesView from '../views/CategoriesView.vue'
import AdminLayout from '../views/admin/AdminLayout.vue'
import AboutView from '../views/AboutView.vue'
import MeView from '../views/MeView.vue'
import AdminLoginView from '../views/AdminLoginView.vue'
import AuthResultView from '../views/AuthResultView.vue'
import AuthPopupCallbackView from '../views/AuthPopupCallbackView.vue'
import NotFoundView from '../views/NotFoundView.vue'
import { useAnalytics } from '../composables/useAnalytics'
import { useAuth } from '../composables/useAuth'

export const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'home',
    component: HomeView,
    meta: { showNavBar: true }
  },
  {
    path: '/admin',
    component: AdminLayout,
    meta: { requiresAuth: true, requiresCapability: 'admin_panel_access' },
    children: [
      { path: '', redirect: '/admin/dashboard' },
      { path: 'dashboard', name: 'admin-dashboard', component: () => import('../views/admin/DashboardView.vue'), meta: { title: '总览' } },
      { path: 'stories', name: 'admin-stories', component: () => import('../views/admin/StoriesView.vue'), meta: { title: '文章管理', requiresCapability: 'story:manage' } },
      { path: 'stories/:id/edit', name: 'admin-article-edit', component: () => import('../views/admin/ArticleEditView.vue'), meta: { title: '编辑文章', requiresCapability: 'story:manage' } },
      { path: 'projects', name: 'admin-projects', component: () => import('../views/admin/ProjectsView.vue'), meta: { title: '项目管理', requiresCapability: 'project:read' } },
      { path: 'tags', redirect: '/admin/projects' },
      {
        path: 'review',
        name: 'admin-review',
        component: () => import('../views/admin/ReviewView.vue'),
        meta: {
          title: '审核',
          requiresAnyCapability: ['submission:read', 'moderation:read', 'feedback:manage'],
        },
      },
      {
        path: 'submissions',
        name: 'admin-submissions',
        redirect: (to) => ({ path: '/admin/review', query: { ...to.query, tab: 'projects' } }),
        meta: { title: '项目审核', requiresCapability: 'submission:read' },
      },
      {
        path: 'moderation',
        name: 'admin-moderation',
        redirect: (to) => ({ path: '/admin/review', query: { ...to.query, tab: 'comments' } }),
        meta: { title: '内容审核', requiresCapability: 'moderation:read' },
      },
      {
        path: 'feedback',
        name: 'admin-feedback',
        redirect: (to) => ({ path: '/admin/review', query: { ...to.query, tab: 'bugs' } }),
        meta: { title: '评论反馈', requiresCapability: 'feedback:manage' },
      },
      { path: 'users', name: 'admin-users', component: () => import('../views/admin/UsersView.vue'), meta: { title: '用户权限', requiresCapability: 'user:read' } },
      { path: 'developers', name: 'admin-developers', component: () => import('../views/admin/DevelopersView.vue'), meta: { title: '开发者与组织', requiresAnyCapability: ['dev:developer_manage', 'org:review', 'claim:review'] } },
      { path: 'media', name: 'admin-media', component: () => import('../views/admin/MediaView.vue'), meta: { title: '图床管理', requiresCapability: 'media:read' } },
      { path: 'audit', name: 'admin-audit', component: () => import('../views/admin/AuditView.vue'), meta: { title: '审计日志', requiresCapability: 'audit:read' } },
      { path: 'analytics', name: 'admin-analytics', component: () => import('../views/admin/AnalyticsView.vue'), meta: { title: '数据分析', requiresCapability: 'analytics:read' } },
      { path: 'routes', name: 'admin-routes', component: () => import('../views/admin/RoutesView.vue'), meta: { title: '路由管理', requiresAuth: true, requiresCapability: 'route:manage' } },
      { path: 'sync', name: 'admin-sync', component: () => import('../views/admin/SyncSettingsView.vue'), meta: { title: '数据同步', requiresCapability: 'project:update' } },
      { path: 'organizations', redirect: () => ({ path: '/admin/developers', query: { tab: 'organizations' } }) },
      { path: 'claims', redirect: () => ({ path: '/admin/developers', query: { tab: 'claims' } }) },
    ],
  },
  {
    path: '/dontusejy',
    name: 'admin-login',
    component: AdminLoginView,
    meta: { showNavBar: false }
  },
  {
    path: '/admin-login',
    redirect: '/dontusejy'
  },
  {
    path: '/hzzc',
    redirect: '/dontusejy'
  },
  {
    path: '/today',
    name: 'today',
    alias: '/featured',
    component: FeaturedView,
    meta: { showNavBar: true }
  },
  {
    path: '/articles/:slug',
    name: 'article-detail',
    component: () => import('../views/ArticleDetailView.vue'),
    meta: { showNavBar: true, showBack: true, title: '文章' }
  },
  {
    path: '/categories',
    name: 'categories',
    component: CategoriesView,
    meta: { showNavBar: true, title: '浏览分类' }
  },
  {
    path: '/about',
    name: 'about',
    component: AboutView,
    meta: { showNavBar: true, showBack: true, title: '关于我们' }
  },
  {
    path: '/ecosystem',
    redirect: '/about'
  },
  {
    path: '/compare',
    name: 'compare',
    component: CompareView,
    meta: { showNavBar: true, showBack: true, title: '横向对比' }
  },
  {
    path: '/submit',
    name: 'submit',
    component: SubmitProjectView,
    meta: { showNavBar: true, showBack: true, title: '提交新项目', requiresAuth: true }
  },
  {
    path: '/me',
    name: 'me',
    component: MeView,
    meta: { showNavBar: true, showBack: true, title: '个人中心' }
  },
  {
    path: '/u/:name',
    name: 'user-profile',
    component: () => import('../views/UserProfileView.vue'),
    meta: { showNavBar: true, showBack: true }
  },
  {
    path: '/auth/popup-callback',
    name: 'auth-popup-callback',
    component: AuthPopupCallbackView,
    meta: { showNavBar: false }
  },
  {
    path: '/auth/result',
    name: 'auth-result',
    component: AuthResultView,
    meta: { showNavBar: true, showBack: true, title: '账号信息确认', requiresAuth: true }
  },
  {
    path: '/dev',
    component: () => import('../views/dev/DevLayout.vue'),
    meta: { requiresAuth: true, requiresCapability: 'dev_panel_access' },
    children: [
      { path: '', redirect: '/dev/dashboard' },
      { path: 'dashboard', name: 'dev-dashboard', component: () => import('../views/dev/DevDashboardView.vue'), meta: { title: '总览' } },
      { path: 'organizations', name: 'dev-organizations', component: () => import('../views/dev/DevOrganizationsView.vue'), meta: { title: '组织管理' } },
      { path: 'organizations/create', name: 'dev-org-create', component: () => import('../views/dev/DevOrgCreateView.vue'), meta: { title: '创建组织' } },
      { path: 'organizations/:id', name: 'dev-org-detail', component: () => import('../views/dev/DevOrgDetailView.vue'), meta: { title: '组织详情' } },
      { path: 'projects', name: 'dev-projects', component: () => import('../views/dev/DevProjectsView.vue'), meta: { title: '项目管理' } },
      { path: 'projects/:id', name: 'dev-project-detail', component: () => import('../views/dev/DevProjectDetailView.vue'), meta: { title: '项目详情' } },
      { path: 'bugs', name: 'dev-bugs', component: () => import('../views/dev/DevBugsView.vue'), meta: { title: 'Bug 反馈' } },
      { path: 'comments', name: 'dev-comments', component: () => import('../views/dev/DevCommentsView.vue'), meta: { title: '评论管理' } },
    ],
  },
  {
    path: '/project/:name',
    name: 'project-detail',
    component: ProjectDetailView,
    meta: { showNavBar: true, showBack: true }
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: NotFoundView,
    meta: { showNavBar: true, showBack: true, title: '页面未找到' }
  }
]

export function setupRouterGuard(router: Router) {
  let initPromise: Promise<void> | null = null

  const isNonFatalNavigationFailure = (error: unknown): boolean => {
    return (
      isNavigationFailure(error, NavigationFailureType.aborted) ||
      isNavigationFailure(error, NavigationFailureType.cancelled) ||
      isNavigationFailure(error, NavigationFailureType.duplicated)
    )
  }

  const ensureAuthInitialized = (): Promise<void> => {
    if (initPromise) return initPromise
    const { isAuthenticated, fetchUser } = useAuth()
    if (isAuthenticated.value) return Promise.resolve()
    initPromise = fetchUser().then(() => {})
    return initPromise
  }

  const ensureCapabilityLoaded = async (requiredCapability: string): Promise<boolean> => {
    const auth = useAuth()
    if (!auth.isAuthenticated.value) return false
    if (auth.hasCapability(requiredCapability)) return true
    await auth.fetchUser()
    return auth.hasCapability(requiredCapability)
  }

  const ensureAnyCapabilityLoaded = async (requiredCapabilities: string[]): Promise<boolean> => {
    const auth = useAuth()
    if (!auth.isAuthenticated.value) return false
    if (requiredCapabilities.some((c) => auth.hasCapability(c))) return true
    await auth.fetchUser()
    return requiredCapabilities.some((c) => auth.hasCapability(c))
  }

  router.beforeEach(async (to) => {
    if (typeof window === 'undefined') return true
    await ensureAuthInitialized()
    const { isAuthenticated } = useAuth();
    if ((to.meta as any)?.requiresAuth && !isAuthenticated.value) {
      return { path: '/me', query: { redirect: to.fullPath } };
    }
    const capability = (to.meta as any)?.requiresCapability || (to.matched.find(r => (r.meta as any)?.requiresCapability)?.meta as any)?.requiresCapability;
    if (capability) {
      const allowed = await ensureCapabilityLoaded(capability);
      if (!allowed) return { path: '/me', query: { redirect: to.fullPath } };
    }
    const anyCapsRecord = to.matched.find((r) => {
      const m = (r.meta as any)?.requiresAnyCapability
      return Array.isArray(m) && m.length > 0
    })
    const anyCaps = (anyCapsRecord?.meta as any)?.requiresAnyCapability as string[] | undefined
    if (anyCaps?.length) {
      const allowed = await ensureAnyCapabilityLoaded(anyCaps)
      if (!allowed) return { path: '/me', query: { redirect: to.fullPath } };
    }
    return true;
  });

  router.onError((error, to) => {
    if (isNonFatalNavigationFailure(error)) return
    if ((to?.path ?? '') === '/auth/popup-callback') return
    if ((to?.path ?? '') === '/me') return
    if ((to?.path ?? '') === '/auth/result') return
    void router.replace({ path: '/not-found', query: { reason: 'navigation-error' } })
  })

  router.afterEach((to) => {
    if (typeof window === 'undefined') return
    try {
      const { trackPageView } = useAnalytics()
      trackPageView(to.fullPath)
    } catch {}
  })
}
