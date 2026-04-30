import { createRouter, createWebHistory, createMemoryHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import ProjectDetailView from '../views/ProjectDetailView.vue'
import SubmitProjectView from '../views/SubmitProjectView.vue'
import GlobalGraphView from '../views/GlobalGraphView.vue'
import CompareView from '../views/CompareView.vue'
import FeaturedView from '../views/FeaturedView.vue'
import AdminView from '../views/AdminView.vue'

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
    path: '/ecosystem',
    name: 'global-graph',
    component: GlobalGraphView,
    meta: { showNavBar: true, showBack: true, title: '生态图谱' }
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
    meta: { showNavBar: true, showBack: true, title: '提交新项目' }
  },
  {
    path: '/project/:name',
    name: 'project-detail',
    component: ProjectDetailView,
    meta: { showNavBar: true, showBack: true }
  }
]

const router = createRouter({
  history: import.meta.env.SSR ? createMemoryHistory(import.meta.env.BASE_URL) : createWebHistory(import.meta.env.BASE_URL),
  routes,
  scrollBehavior() {
    return { top: 0 }
  }
})

export default router
