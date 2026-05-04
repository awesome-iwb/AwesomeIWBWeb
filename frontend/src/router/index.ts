import { createRouter, createWebHistory, createMemoryHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import ProjectDetailView from '../views/ProjectDetailView.vue'
import SubmitProjectView from '../views/SubmitProjectView.vue'
import CompareView from '../views/CompareView.vue'
import FeaturedView from '../views/FeaturedView.vue'
import AdminView from '../views/AdminView.vue'
import AboutView from '../views/AboutView.vue'
import MeView from '../views/MeView.vue'
import { useAuth } from '../composables/useAuth'
import DevView from '../views/DevView.vue'

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
  {
    path: '/dev',
    name: 'dev',
    component: DevView,
    meta: { showNavBar: true, showBack: true, title: '开发者后台', requiresAuth: true, requiresRole: 'dev' }
  },
  {
    path: '/project/:name',
    name: 'project-detail',
    component: ProjectDetailView,
    meta: { showNavBar: true, showBack: true }
  }
]

const router = createRouter({
  history: typeof window === 'undefined'
    ? createMemoryHistory((import.meta as any).env?.BASE_URL ?? '/')
    : createWebHistory((import.meta as any).env?.BASE_URL ?? '/'),
  routes,
  scrollBehavior() {
    return { top: 0 }
  }
})

router.beforeEach((to) => {
  if (typeof window === 'undefined') return true;
  const { isAuthenticated } = useAuth();
  if ((to.meta as any)?.requiresAuth && !isAuthenticated.value) {
    return { path: '/me', query: { redirect: to.fullPath } };
  }
  const role = (to.meta as any)?.requiresRole;
  if (role) {
    const { user } = useAuth();
    if (user.value?.role !== role) return { path: '/me', query: { redirect: to.fullPath } };
  }
  return true;
});

export default router
