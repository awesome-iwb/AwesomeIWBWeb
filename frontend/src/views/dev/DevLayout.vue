<template>
  <AdminShell
    brand="dev"
    brand-name="Dev 后台"
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
  LayoutDashboard, Building2, Package, Bug, MessageSquare,
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
};

const devNavItems: NavItem[] = [
  { key: 'dashboard', label: '总览', to: '/dev/dashboard', icon: LayoutDashboard, group: 'primary', primary: true, cap: 'dev_panel_access' },
  { key: 'organizations', label: '组织管理', to: '/dev/organizations', icon: Building2, group: 'primary', primary: true, cap: 'dev_panel_access' },
  { key: 'projects', label: '项目管理', to: '/dev/projects', icon: Package, group: 'primary', primary: true, cap: 'dev_panel_access' },
  { key: 'bugs', label: 'Bug 反馈', to: '/dev/bugs', icon: Bug, group: 'primary', primary: true, cap: 'dev:bug_manage' },
  { key: 'comments', label: '评论管理', to: '/dev/comments', icon: MessageSquare, group: 'secondary', primary: false, cap: 'dev:comment_manage' },
];

const visibleNavItems = computed(() =>
  devNavItems.filter(item => {
    if (item.cap) return hasCapability(item.cap);
    return true;
  })
);

const handleLogout = async () => {
  await logout();
  router.push('/');
};
</script>
