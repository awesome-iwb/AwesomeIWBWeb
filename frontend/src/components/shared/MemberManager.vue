<template>
  <div class="space-y-3">
    <div v-if="canManage" class="flex items-center gap-2">
      <input type="text" v-model="inviteUserId" class="flex-1 px-3 py-2 rounded-xl border border-border bg-card outline-none focus:border-blue-500 text-sm" placeholder="输入用户 ID 邀请" />
      <select v-model="inviteRole" class="px-3 py-2 rounded-xl border border-border bg-card outline-none focus:border-blue-500 text-sm">
        <option value="collaborator" v-if="targetType === 'project'">协作者</option>
        <option value="owner" v-if="targetType === 'project'">所有者</option>
        <option value="member" v-if="targetType === 'organization'">成员</option>
        <option value="admin" v-if="targetType === 'organization'">管理员</option>
      </select>
      <button @click="handleInvite" :disabled="isInviting || !inviteUserId.trim()" class="px-4 py-2 rounded-xl bg-blue-500 hover:bg-blue-600 text-white text-sm font-bold transition-colors disabled:opacity-50">
        {{ isInviting ? '...' : '邀请' }}
      </button>
    </div>

    <div class="space-y-2">
      <div v-for="m in members" :key="m.user_id ?? m.org_id ?? ''" class="flex items-center gap-3 p-3 rounded-xl bg-card">
        <div class="w-8 h-8 rounded-full overflow-hidden bg-muted flex-shrink-0">
          <img v-if="m.user_avatar_url || m.org_avatar_url" :src="m.user_avatar_url || m.org_avatar_url" class="w-full h-full object-cover" />
          <div v-else class="w-full h-full flex items-center justify-center text-xs font-bold text-muted-foreground">{{ (m.user_name || m.org_name || '?')[0] }}</div>
        </div>
        <div class="flex-1 min-w-0">
          <div class="text-sm font-medium truncate text-foreground">{{ m.user_name || m.org_name || '未知' }}</div>
          <div v-if="m.org_name && m.user_name" class="text-[10px] text-muted-foreground">组织: {{ m.org_name }}</div>
        </div>
        <span class="text-[10px] px-1.5 py-0.5 rounded font-medium flex-shrink-0" :class="roleClass(m.role)">
          {{ roleLabel(m.role) }}
        </span>
        <template v-if="canManage && m.role !== 'owner'">
          <select
            v-if="targetType === 'organization' && m.role !== 'owner'"
            :value="m.role"
            @change="handleChangeRole(m.user_id, ($event.target as HTMLSelectElement).value)"
            class="text-xs px-2 py-1 rounded-lg border border-border bg-card outline-none"
          >
            <option value="admin">管理员</option>
            <option value="member">成员</option>
          </select>
          <button @click="handleRemove(m.user_id, m.org_id)" class="text-xs px-2 py-1 rounded-lg bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 font-medium hover:bg-rose-100 dark:hover:bg-rose-500/20 transition-colors flex-shrink-0">
            移除
          </button>
        </template>
      </div>
      <div v-if="members.length === 0" class="text-sm text-slate-400 text-center py-6">暂无成员</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { adminFetch, formatAdminError } from '../../composables/useAdminFetch';
import { API } from '../../api/endpoints';

const props = defineProps<{
  members: any[];
  canManage: boolean;
  targetType: 'project' | 'organization';
  targetId: string;
}>();

const emit = defineEmits<{
  refresh: [];
}>();

const inviteUserId = ref('');
const inviteRole = ref(props.targetType === 'project' ? 'collaborator' : 'member');
const isInviting = ref(false);

const roleLabel = (role: string) => {
  if (props.targetType === 'project') {
    return role === 'owner' ? '所有者' : '协作者';
  }
  return role === 'owner' ? '所有者' : role === 'admin' ? '管理员' : '成员';
};

const roleClass = (role: string) => {
  if (role === 'owner') return 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400';
  if (role === 'admin') return 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400';
  return 'bg-secondary text-muted-foreground';
};

const handleInvite = async () => {
  if (!inviteUserId.value.trim()) return;
  isInviting.value = true;
  try {
    const url = props.targetType === 'project'
      ? API.dev.projectMembers(props.targetId)
      : API.dev.organizationMembers(props.targetId);
    const res = await adminFetch(url, {
      method: 'POST',
      body: JSON.stringify({ user_id: inviteUserId.value.trim(), role: inviteRole.value }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(formatAdminError(json, '邀请失败', res.status));
    inviteUserId.value = '';
    emit('refresh');
  } catch (e: unknown) {
    alert(formatAdminError({ message: e instanceof Error ? e.message : '' }, '邀请失败'));
  } finally {
    isInviting.value = false;
  }
};

const handleRemove = async (userId: string | null, _orgId: string | null) => {
  if (!confirm('确认移除该成员？')) return;
  try {
    let url: string;
    if (props.targetType === 'project') {
      url = `${API.dev.projectMembers(props.targetId)}/${encodeURIComponent(userId ?? '')}`;
    } else {
      url = `${API.dev.organizationMembers(props.targetId)}/${encodeURIComponent(userId ?? '')}`;
    }
    const res = await adminFetch(url, { method: 'DELETE' });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      throw new Error(formatAdminError(json, '移除失败', res.status));
    }
    emit('refresh');
  } catch (e: unknown) {
    alert(formatAdminError({ message: e instanceof Error ? e.message : '' }, '移除失败'));
  }
};

const handleChangeRole = async (userId: string, role: string) => {
  try {
    const url = `${API.dev.organizationMembers(props.targetId)}/${encodeURIComponent(userId)}`;
    const res = await adminFetch(url, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(formatAdminError(json, '修改角色失败', res.status));
    emit('refresh');
  } catch (e: unknown) {
    alert(formatAdminError({ message: e instanceof Error ? e.message : '' }, '修改角色失败'));
  }
};
</script>
