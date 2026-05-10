import type { RouteRecordRaw, Router } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import ProjectDetailView from '../views/ProjectDetailView.vue'
import SubmitProjectView from '../views/SubmitProjectView.vue'
import CompareView from '../views/CompareView.vue'
import FeaturedView from '../views/FeaturedView.vue'
import AdminView from '../views/AdminView.vue'
import AboutView from '../views/AboutView.vue'
import MeView from '../views/MeView.vue'
import AdminLoginView from '../views/AdminLoginView.vue'
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
    name: 'admin',
    component: AdminView,
    meta: { showNavBar: false, requiresAuth: true, requiresCapability: 'admin_panel_access' }
  },
  {
    path: '/admin-login',
    name: 'admin-login',
    component: AdminLoginView,
    meta: { showNavBar: false }
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
  }
]

export function setupRouterGuard(router: Router) {
  let initPromise: Promise<void> | null = null

  const ensureAuthInitialized = (): Promise<void> => {
    if (initPromise) return initPromise
    const { isAuthenticated, fetchUser } = useAuth()
    if (isAuthenticated.value) return Promise.resolve()
    initPromise = fetchUser().then(() => {})
    return initPromise
  }

  router.beforeEach(async (to) => {
    if (typeof window === 'undefined') return true
    await ensureAuthInitialized()
    const { isAuthenticated } = useAuth();
    if ((to.meta as any)?.requiresAuth && !isAuthenticated.value) {
      return { path: '/me', query: { redirect: to.fullPath } };
    }
    const capability = (to.meta as any)?.requiresCapability;
    if (capability) {
      const { hasCapability } = useAuth();
      if (!hasCapability(capability)) return { path: '/me', query: { redirect: to.fullPath } };
    }
    return true;
  });
}
