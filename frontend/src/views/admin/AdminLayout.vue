<template>
  <AdminShell
    brand="admin"
    brand-name="Awesome 后台"
    :sidebar-items="visibleNavItems"
    :user="authUser ? { name: authUser.name, avatar_url: authUser.avatar_url } : undefined"
    @logout="handleLogout"
    @go-home="router.push('/')"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { useAuth } from '../../composables/useAuth';
import { AdminShell } from '../../components/ui';
import {
  LayoutDashboard, FileText, Package, ClipboardCheck,
  Users, UserCog, Image, ScrollText, BarChart3, Route, RefreshCw,
} from 'lucide-vue-next';

const router = useRouter();
const { user: authUser, hasCapability, logout } = useAuth();

type NavItem = {
  key: string;
  label: string;
  to: string;
  icon: any;
  group?: 'primary' | 'secondary';
  primary?: boolean;
  cap?: string;
  anyCaps?: string[];
};

const adminNavItems: NavItem[] = [
  { key: 'dashboard', label: '总览', to: '/admin/dashboard', icon: LayoutDashboard, group: 'primary', primary: true, cap: 'admin_panel_access' },
  { key: 'stories', label: '文章管理', to: '/admin/stories', icon: FileText, group: 'primary', primary: true, cap: 'story:manage' },
  { key: 'projects', label: '项目管理', to: '/admin/projects', icon: Package, group: 'primary', primary: true, cap: 'project:read' },
  { key: 'sync', label: '数据同步', to: '/admin/sync', icon: RefreshCw, group: 'secondary', primary: false, cap: 'project:update' },
  { key: 'review', label: '审核', to: '/admin/review', icon: ClipboardCheck, group: 'primary', primary: true, anyCaps: ['submission:read', 'moderation:read', 'feedback:manage'] },
  { key: 'users', label: '用户权限', to: '/admin/users', icon: Users, group: 'secondary', primary: false, cap: 'user:read' },
  { key: 'developers', label: '开发者与组织', to: '/admin/developers', icon: UserCog, group: 'secondary', primary: false, anyCaps: ['dev:developer_manage', 'org:review', 'claim:review'] },
  { key: 'media', label: '图床管理', to: '/admin/media', icon: Image, group: 'secondary', primary: false, cap: 'media:read' },
  { key: 'audit', label: '审计日志', to: '/admin/audit', icon: ScrollText, group: 'secondary', primary: false, cap: 'audit:read' },
  { key: 'routes', label: '路由管理', to: '/admin/routes', icon: Route, group: 'secondary', primary: false, cap: 'route:manage' },
  { key: 'analytics', label: '数据分析', to: '/admin/analytics', icon: BarChart3, group: 'secondary', primary: false, cap: 'analytics:read' },
];

const visibleNavItems = computed(() =>
  adminNavItems.filter(item => {
    if (item.cap) return hasCapability(item.cap);
    if (item.anyCaps?.length) return item.anyCaps.some(c => hasCapability(c));
    return true;
  })
);

const handleLogout = async () => {
  await logout();
  router.push('/');
};
</script>
