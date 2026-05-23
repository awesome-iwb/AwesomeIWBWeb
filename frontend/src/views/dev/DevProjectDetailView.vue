<template>
  <div class="space-y-4">
    <ui-LoadingSpinner v-if="loading" brand="dev" />

    <template v-else-if="project">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div class="flex items-center gap-3">
          <Avatar class="w-10 h-10 rounded-xl">
            <AvatarImage :src="project.icon" :alt="project.name" />
            <AvatarFallback>{{ project.name?.charAt(0)?.toUpperCase() || '?' }}</AvatarFallback>
          </Avatar>
          <div>
            <h2 class="text-lg font-bold text-foreground">{{ project.name }}</h2>
            <div class="text-xs text-muted-foreground">{{ project.slug }}</div>
          </div>
        </div>
        <button v-if="hasCapability('dev:project_edit')" @click="saveProject" :disabled="isSaving" class="px-4 py-3 sm:py-2 min-h-[48px] sm:min-h-[44px] rounded-xl bg-blue-500 hover:bg-blue-600 text-white text-sm font-bold shadow-lg shadow-blue-500/20 transition-all disabled:opacity-50">
          {{ isSaving ? '保存中...' : '保存修改' }}
        </button>
      </div>

      <div v-if="hasCapability('dev:project_edit')" class="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <div class="p-4 sm:p-6 border-b border-border bg-accent/50 dark:bg-slate-900/50">
          <h3 class="font-bold text-sm text-muted-foreground">项目信息</h3>
        </div>
        <div class="p-4 sm:p-6 space-y-4">
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-bold text-muted-foreground mb-2">软件名称</label>
              <input type="text" v-model="draft.name" class="w-full px-4 py-3 sm:py-2.5 rounded-xl border border-border bg-card outline-none focus:border-blue-500 text-base sm:text-sm min-h-[48px]" />
            </div>
            <div class="space-y-1">
              <label class="block text-sm font-bold text-muted-foreground">主要开发者（平台账号）</label>
              <SearchSelect
                v-if="canEditPrimaryDeveloper"
                :key="`lead-${projectId}`"
                v-model="draft.developer_user_id"
                :search-fn="searchProjectUsers"
                placeholder="至少输入 1 个字符搜索平台用户"
                :initial-label="project?.developer_user_name || project?.developer || ''"
                clearable
                @update:model-value="onLeadDeveloperSelect"
              />
              <div
                v-else
                class="px-4 py-3 sm:py-2.5 rounded-xl border border-border bg-card text-sm text-muted-foreground min-h-[48px] flex items-center"
              >
                {{ project?.developer_user_name || project?.developer || '未指定' }}
              </div>
            </div>
          </div>
          <div class="space-y-1" v-if="hasCapability('dev:org_manage')">
            <label class="block text-sm font-bold text-muted-foreground">所属组织</label>
            <SearchSelect
              :key="`org-${projectId}`"
              v-model="draft.organization_id"
              :search-fn="searchMyOrganizations"
              placeholder="输入名称或 slug 筛选组织"
              :initial-label="project?.organization_name || ''"
              @update:model-value="onOrgSelect"
            />
          </div>
          <div class="space-y-1" v-else>
            <label class="block text-sm font-bold text-muted-foreground">所属组织</label>
            <div class="px-4 py-3 sm:py-2.5 rounded-xl border border-border bg-card text-sm text-muted-foreground min-h-[48px] flex items-center">
              {{ project?.organization_name || '未指定' }}
            </div>
          </div>
          <div>
            <label class="block text-sm font-bold text-muted-foreground mb-2">简介</label>
            <textarea v-model="draft.description" rows="3" class="w-full px-4 py-3 sm:py-2.5 rounded-xl border border-border bg-card outline-none focus:border-blue-500 resize-none text-base sm:text-sm"></textarea>
          </div>
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-bold text-muted-foreground mb-2">GitHub 仓库</label>
              <input type="text" v-model="draft.github_url" class="w-full px-4 py-3 sm:py-2.5 rounded-xl border border-border bg-card outline-none focus:border-blue-500 text-base sm:text-sm min-h-[48px]" />
            </div>
            <div>
              <label class="block text-sm font-bold text-muted-foreground mb-2">编程语言</label>
              <input type="text" v-model="draft.language" class="w-full px-4 py-3 sm:py-2.5 rounded-xl border border-border bg-card outline-none focus:border-blue-500 text-base sm:text-sm min-h-[48px]" />
            </div>
          </div>
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-bold text-muted-foreground mb-2">状态</label>
              <input type="text" v-model="draft.status" class="w-full px-4 py-3 sm:py-2.5 rounded-xl border border-border bg-card outline-none focus:border-blue-500 text-base sm:text-sm min-h-[48px]" />
            </div>
            <div>
              <label class="block text-sm font-bold text-muted-foreground mb-2">版本</label>
              <input type="text" v-model="draft.version" class="w-full px-4 py-3 sm:py-2.5 rounded-xl border border-border bg-card outline-none focus:border-blue-500 text-base sm:text-sm min-h-[48px]" />
            </div>
          </div>
          <div>
            <label class="block text-sm font-bold text-muted-foreground mb-2">关键词（逗号分隔）</label>
            <input type="text" v-model="draft.keywords" class="w-full px-4 py-3 sm:py-2.5 rounded-xl border border-border bg-card outline-none focus:border-blue-500 text-base sm:text-sm min-h-[48px]" />
          </div>
        </div>
      </div>

      <div
        v-if="canEditOwnerAdminFields"
        class="bg-card rounded-2xl border border-border shadow-sm overflow-hidden"
      >
        <div class="p-4 sm:p-6 border-b border-border bg-accent/50 dark:bg-slate-900/50">
          <h3 class="font-bold text-sm text-muted-foreground">展示素材与扩展信息</h3>
          <p class="text-xs text-muted-foreground mt-1">仅项目负责人且具备「项目管理者」权限时可编辑（图标、横幅、星级与备案相关 JSON 等）。</p>
        </div>
        <div class="p-4 sm:p-6 space-y-4">
          <ProjectMediaFields v-model:icon="draft.icon" v-model:banner="draft.banner" />
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-bold text-muted-foreground mb-2">AI 使用率标签</label>
              <select v-model="draft.ai_usage_state" class="w-full px-4 py-3 sm:py-2.5 rounded-xl border border-border bg-card outline-none focus:border-blue-500 text-base sm:text-sm min-h-[48px]">
                <option value="unknown">未知</option>
                <option value="under50">未超过 50%</option>
                <option value="over50">超过 50%</option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-bold text-muted-foreground mb-2">稳定性标签</label>
              <select v-model="draft.recommendation" class="w-full px-4 py-3 sm:py-2.5 rounded-xl border border-border bg-card outline-none focus:border-blue-500 text-base sm:text-sm min-h-[48px]">
                <option value="">无</option>
                <option value="稳定">稳定</option>
                <option value="不稳定">不稳定</option>
                <option value="观望中">观望中</option>
              </select>
            </div>
            <div class="lg:col-span-2">
              <label class="block text-sm font-bold text-muted-foreground mb-2">Star 数量</label>
              <input type="number" v-model.number="draft.stars" class="w-full px-4 py-3 sm:py-2.5 rounded-xl border border-border bg-card outline-none focus:border-blue-500 text-base sm:text-sm min-h-[48px]" />
            </div>
          </div>
          <div>
            <label class="block text-sm font-bold text-muted-foreground mb-2">扩展信息（JSON，可含备案图 URL 等）</label>
            <textarea
              v-model="extraJsonText"
              rows="8"
              class="w-full px-4 py-3 sm:py-2.5 rounded-xl border border-border bg-card outline-none focus:border-blue-500 font-mono text-sm"
              spellcheck="false"
            ></textarea>
          </div>
        </div>
      </div>

      <div class="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <div class="p-4 sm:p-6 border-b border-border bg-accent/50 dark:bg-slate-900/50 flex items-center justify-between">
          <h3 class="font-bold text-sm text-muted-foreground">项目成员</h3>
          <button v-if="hasCapability('dev:project_admin')" @click="showAddMember = true" class="px-3 py-2 min-h-[44px] rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold transition-colors">邀请协作者</button>
        </div>
        <div class="p-4 sm:p-6 space-y-2">
          <div v-if="members.length === 0" class="text-sm text-muted-foreground text-center py-4">暂无成员</div>
          <div v-for="m in members" :key="m.id || m.user_id" class="flex items-center gap-3 p-3 rounded-xl bg-card/50 min-h-[48px]">
            <Avatar class="w-8 h-8">
              <AvatarImage :src="m.user_avatar_url" :alt="m.user_name" />
              <AvatarFallback>{{ m.user_name?.charAt(0)?.toUpperCase() || '?' }}</AvatarFallback>
            </Avatar>
            <div class="flex-1 min-w-0">
              <div class="text-sm font-bold text-foreground truncate">{{ m.user_name || m.user_id }}</div>
            </div>
            <span class="px-2 py-0.5 rounded text-xs font-bold" :class="m.role === 'owner' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-secondary text-muted-foreground'">{{ m.role === 'owner' ? '负责人' : '协作者' }}</span>
            <button v-if="hasCapability('dev:project_admin') && m.role !== 'owner'" @click="removeMember(m)" class="text-xs text-rose-500 hover:underline px-2 py-1.5 min-h-[44px]">移除</button>
            <button v-if="hasCapability('dev:project_admin') && m.role !== 'owner'" @click="transferOwnership(m)" class="text-xs text-blue-500 hover:underline px-2 py-1.5 min-h-[44px]">转让</button>
          </div>
        </div>
      </div>
    </template>

    <div v-else class="text-center py-20 text-muted-foreground">
      <p class="text-sm">项目不存在或无权访问</p>
    </div>

    <Dialog v-model:open="showAddMember">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>邀请协作者</DialogTitle>
        </DialogHeader>
        <div class="space-y-4">
          <SearchSelect
            v-model="newMemberId"
            :search-fn="searchProjectUsers"
            placeholder="至少输入 1 个字符搜索用户"
          />
          <div class="flex gap-3">
            <button @click="addMember" :disabled="!newMemberId" class="flex-1 px-4 py-3 min-h-[48px] rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-sm disabled:opacity-50 transition-colors">确认邀请</button>
            <button @click="showAddMember = false; newMemberId = null" class="flex-1 px-4 py-3 min-h-[48px] rounded-xl bg-muted text-muted-foreground font-bold text-sm transition-colors">取消</button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRoute } from 'vue-router';
import { adminFetch, formatAdminError, normalizeMediaUrl } from '../../composables/useAdminFetch';
import { API } from '../../api/endpoints';
import { useAuth } from '../../composables/useAuth';
import SearchSelect from '../../components/admin/SearchSelect.vue';
import ProjectMediaFields from '../../components/shared/ProjectMediaFields.vue';
import { LoadingSpinner as uiLoadingSpinner } from '../../components/ui';
import { Avatar, AvatarImage, AvatarFallback } from '../../components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const route = useRoute();
const { hasCapability, user: authUser } = useAuth();
const projectId = route.params.id as string;

const project = ref<any | null>(null);
const draft = ref<any>({});
const members = ref<any[]>([]);
const loading = ref(true);
const isSaving = ref(false);
const showAddMember = ref(false);
const newMemberId = ref<string | null>(null);
const extraJsonText = ref('{}');
const orgLabelCache = new Map<string, string>();
const userLabelCache = new Map<string, string>();

const isProjectOwner = computed(() => {
  const uid = authUser.value?.id;
  if (!uid) return false;
  return members.value.some((m) => m.role === 'owner' && m.user_id === uid);
});

const canEditPrimaryDeveloper = computed(
  () => hasCapability('dev:project_admin') && isProjectOwner.value
);

const canEditOwnerAdminFields = computed(
  () => hasCapability('dev:project_admin') && isProjectOwner.value
);

const normalizeDevDraft = (j: any) => {
  const d = { ...j };
  if (Array.isArray(d.keywords)) d.keywords = d.keywords.join(', ');
  const rec = d.recommendation;
  if (Array.isArray(rec) && rec.length) d.recommendation = String(rec[0]);
  else if (Array.isArray(rec)) d.recommendation = '';
  else if (typeof rec !== 'string') d.recommendation = '';
  if (d.ai_usage_state !== 'unknown' && d.ai_usage_state !== 'over50' && d.ai_usage_state !== 'under50') {
    d.ai_usage_state = 'unknown';
  }
  const n = Number(d.stars);
  d.stars = Number.isFinite(n) ? n : 0;
  if (typeof d.icon !== 'string') d.icon = '';
  if (typeof d.banner !== 'string') d.banner = '';
  return d;
};

const fetchProject = async () => {
  loading.value = true;
  try {
    const res = await adminFetch(API.dev.projectDetail(projectId));
    if (res.ok) {
      const json = await res.json();
      project.value = json;
      draft.value = normalizeDevDraft(json);
      members.value = json.members ?? [];
      extraJsonText.value = JSON.stringify(json.extra ?? {}, null, 2);
    }
  } catch (e) {
    console.error('Fetch dev project detail error:', e);
  } finally {
    loading.value = false;
  }
};

const fetchMembers = async () => {
  try {
    const res = await adminFetch(API.dev.projectDetail(projectId));
    if (res.ok) {
      const json = await res.json();
      members.value = json.members ?? [];
    }
  } catch (e) {
    console.error('Fetch members error:', e);
  }
};

const searchMyOrganizations = async (q: string) => {
  const qt = q.trim();
  const qs = new URLSearchParams({ pageSize: '20' });
  if (qt) qs.set('q', qt);
  const res = await adminFetch(`/api/dev/organizations?${qs.toString()}`);
  if (!res.ok) return [];
  const data = await res.json();
  const raw = Array.isArray(data) ? data : data.items || [];
  return raw.map((o: any) => {
    orgLabelCache.set(String(o.id), o.name || '');
    const statusLabel = o.status === 'approved' ? '已通过' : o.status === 'pending' ? '审核中' : (o.status || '');
    return {
      id: String(o.id),
      label: o.name || '',
      subtitle: [o.slug ? `@${o.slug}` : '', statusLabel].filter(Boolean).join(' · '),
      avatar: o.avatar_url,
    };
  });
};

const searchProjectUsers = async (q: string) => {
  const qt = q.trim();
  if (qt.length < 1) return [];
  const qs = new URLSearchParams({ q: qt, pageSize: '15' });
  const res = await adminFetch(`${API.dev.projectUserSearch(projectId)}?${qs.toString()}`);
  if (!res.ok) return [];
  const data = await res.json();
  const rows = data.items || [];
  return rows.map((u: any) => {
    const label = u.name || u.id || '';
    userLabelCache.set(String(u.id), label);
    return { id: String(u.id), label, avatar: u.avatar_url || '' };
  });
};

const onOrgSelect = (val: string | null) => {
  if (val) draft.value.organization_name = orgLabelCache.get(val) || draft.value.organization_name;
  else draft.value.organization_name = '';
};

const onLeadDeveloperSelect = (val: string | null) => {
  if (val) {
    const label = userLabelCache.get(val) || '';
    draft.value.developer_user_name = label;
    draft.value.developer = label;
  } else {
    draft.value.developer_user_id = null;
    draft.value.developer_user_name = '';
    draft.value.developer = '';
  }
};

const addMember = async () => {
  if (!newMemberId.value || !project.value?.id) return;
  const res = await adminFetch(`/api/dev/projects/${encodeURIComponent(project.value.id)}/members`, {
    method: 'POST',
    body: JSON.stringify({ user_id: newMemberId.value, role: 'collaborator' }),
  });
  if (res.ok) {
    showAddMember.value = false;
    newMemberId.value = null;
    await fetchMembers();
  } else {
    const json = await res.json();
    alert(json.error || '添加失败');
  }
};

const removeMember = async (m: any) => {
  if (!project.value?.id || !confirm('确定移除此成员？')) return;
  const res = await adminFetch(`/api/dev/projects/${encodeURIComponent(project.value.id)}/members/${encodeURIComponent(m.user_id || m.id)}`, {
    method: 'DELETE',
  });
  if (res.ok) await fetchMembers();
};

const transferOwnership = async (m: any) => {
  if (!project.value?.id || !confirm('确定将项目转让给此成员？你将变为协作者。')) return;
  const res = await adminFetch(`/api/dev/projects/${encodeURIComponent(project.value.id)}/members/${encodeURIComponent(m.user_id || m.id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ role: 'owner' }),
  });
  if (res.ok) await fetchProject();
};

const saveProject = async () => {
  isSaving.value = true;
  try {
    const updates: Record<string, any> = {};
    const baseFields = ['name', 'description', 'github_url', 'language', 'status', 'version'];
    for (const field of baseFields) {
      if (draft.value[field] !== undefined) updates[field] = draft.value[field];
    }
    if (draft.value.keywords !== undefined) updates.keywords = draft.value.keywords;
    if (hasCapability('dev:org_manage') && draft.value.organization_id !== undefined) {
      updates.organization_id = draft.value.organization_id;
    }
    if (canEditPrimaryDeveloper.value && draft.value.developer_user_id !== undefined) {
      updates.developer_user_id = draft.value.developer_user_id;
    }
    if (canEditOwnerAdminFields.value) {
      updates.icon = normalizeMediaUrl(draft.value.icon);
      updates.banner = normalizeMediaUrl(draft.value.banner);
      updates.stars = Number(draft.value.stars) || 0;
      updates.ai_usage_state = draft.value.ai_usage_state;
      const rec = String(draft.value.recommendation ?? '').trim();
      updates.recommendation = rec ? [rec] : [];
      try {
        updates.extra = JSON.parse(extraJsonText.value || '{}') as object;
      } catch {
        alert('扩展信息（JSON）格式无效，请修正后再保存。');
        return;
      }
    }

    const res = await adminFetch(API.dev.projectDetail(projectId), {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(formatAdminError(json, '保存失败', res.status));
    project.value = json;
    draft.value = normalizeDevDraft(json);
    members.value = json.members ?? members.value;
    extraJsonText.value = JSON.stringify(json.extra ?? {}, null, 2);
    alert('保存成功');
  } catch (e: unknown) {
    alert(formatAdminError({ message: e instanceof Error ? e.message : '' }, '保存失败'));
  } finally {
    isSaving.value = false;
  }
};

onMounted(fetchProject);
</script>
