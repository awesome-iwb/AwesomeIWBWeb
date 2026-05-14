import type { RouteRecordRaw, Router } from 'vue-router'
import { isNavigationFailure, NavigationFailureType } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import ProjectDetailView from '../views/ProjectDetailView.vue'
import SubmitProjectView from '../views/SubmitProjectView.vue'
import CompareView from '../views/CompareView.vue'
import FeaturedView from '../views/FeaturedView.vue'
import AdminLayout from '../views/admin/AdminLayout.vue'
import AboutView from '../views/AboutView.vue'
import MeView from '../views/MeView.vue'
import AdminLoginView from '../views/AdminLoginView.vue'
import AuthResultView from '../views/AuthResultView.vue'
import AuthPopupCallbackView from '../views/AuthPopupCallbackView.vue'
import NotFoundView from '../views/NotFoundView.vue'
import { useAuth } from '../composables/useAuth'
const isDev = import.meta.env.DEV

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
      { path: 'projects', name: 'admin-projects', component: () => import('../views/admin/ProjectsView.vue'), meta: { title: '项目管理', requiresCapability: 'project:read' } },
      { path: 'submissions', name: 'admin-submissions', component: () => import('../views/admin/SubmissionsView.vue'), meta: { title: '项目审核', requiresCapability: 'submission:read' } },
      { path: 'moderation', name: 'admin-moderation', component: () => import('../views/admin/ModerationView.vue'), meta: { title: '内容审核', requiresCapability: 'moderation:read' } },
      { path: 'feedback', name: 'admin-feedback', component: () => import('../views/admin/FeedbackView.vue'), meta: { title: '评论反馈', requiresCapability: 'feedback:manage' } },
      { path: 'users', name: 'admin-users', component: () => import('../views/admin/UsersView.vue'), meta: { title: '用户权限', requiresCapability: 'user:read' } },
      { path: 'media', name: 'admin-media', component: () => import('../views/admin/MediaView.vue'), meta: { title: '图床管理', requiresCapability: 'media:read' } },
      { path: 'audit', name: 'admin-audit', component: () => import('../views/admin/AuditView.vue'), meta: { title: '审计日志', requiresCapability: 'audit:read' } },
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
    name: 'featured',
    component: FeaturedView,
    meta: { showNavBar: true }
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
  ...(isDev
    ? [{
        path: '/dev',
        name: 'dev',
        component: () => import('../views/DevView.vue'),
        meta: { showNavBar: true, showBack: true, title: '开发者后台', requiresAuth: true, requiresCapability: 'dev_panel_access' }
      } as RouteRecordRaw]
    : []),
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
    return true;
  });

  router.onError((error, to) => {
    if (isNonFatalNavigationFailure(error)) return
    if ((to?.path ?? '') === '/auth/popup-callback') return
    if ((to?.path ?? '') === '/me') return
    if ((to?.path ?? '') === '/auth/result') return
    void router.replace({ path: '/not-found', query: { reason: 'navigation-error' } })
  })
}
