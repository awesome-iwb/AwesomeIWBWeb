<template>
  <div class="space-y-4">
    <div v-if="loading" class="flex items-center justify-center py-20">
      <div class="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
    </div>

    <template v-else-if="project">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0 bg-slate-100 dark:bg-slate-700">
            <img v-if="project.icon" :src="project.icon" :alt="project.name" class="w-full h-full object-cover" />
            <div v-else class="w-full h-full flex items-center justify-center text-slate-400 text-sm font-bold">{{ (project.name || '?')[0] }}</div>
          </div>
          <div>
            <h2 class="text-lg font-bold text-slate-900 dark:text-white">{{ project.name }}</h2>
            <div class="text-xs text-slate-400">{{ project.slug }}</div>
          </div>
        </div>
        <button @click="saveProject" :disabled="isSaving" class="px-4 py-2 rounded-xl bg-blue-500 hover:bg-blue-600 text-white text-sm font-bold shadow-lg shadow-blue-500/20 transition-all disabled:opacity-50">
          {{ isSaving ? '保存中...' : '保存修改' }}
        </button>
      </div>

      <div class="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div class="p-4 lg:p-6 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50">
          <h3 class="font-bold text-sm text-slate-700 dark:text-slate-300">项目信息</h3>
        </div>
        <div class="p-4 lg:p-6 space-y-4">
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">软件名称</label>
              <input type="text" v-model="draft.name" class="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 outline-none focus:border-blue-500 text-base" />
            </div>
            <div>
              <label class="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">开发者</label>
              <input type="text" v-model="draft.developer" class="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 outline-none focus:border-blue-500 text-base" />
            </div>
          </div>
          <div>
            <label class="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">简介</label>
            <textarea v-model="draft.description" rows="3" class="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 outline-none focus:border-blue-500 resize-none text-base"></textarea>
          </div>
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">GitHub 仓库</label>
              <input type="text" v-model="draft.github_url" class="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 outline-none focus:border-blue-500 text-base" />
            </div>
            <div>
              <label class="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">编程语言</label>
              <input type="text" v-model="draft.language" class="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 outline-none focus:border-blue-500 text-base" />
            </div>
          </div>
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">状态</label>
              <input type="text" v-model="draft.status" class="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 outline-none focus:border-blue-500 text-base" />
            </div>
            <div>
              <label class="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">版本</label>
              <input type="text" v-model="draft.version" class="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 outline-none focus:border-blue-500 text-base" />
            </div>
          </div>
          <div>
            <label class="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">关键词（逗号分隔）</label>
            <input type="text" v-model="draft.keywords" class="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 outline-none focus:border-blue-500 text-base" />
          </div>
        </div>
      </div>

      <div class="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div class="p-4 lg:p-6 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50">
          <h3 class="font-bold text-sm text-slate-700 dark:text-slate-300">项目成员</h3>
        </div>
        <div class="p-4 lg:p-6">
          <div class="space-y-2">
            <div v-for="m in members" :key="m.user_id ?? m.org_id ?? ''" class="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50">
              <div class="w-8 h-8 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-700 flex-shrink-0">
                <img v-if="m.user_avatar_url || m.org_avatar_url" :src="m.user_avatar_url || m.org_avatar_url" class="w-full h-full object-cover" />
                <div v-else class="w-full h-full flex items-center justify-center text-xs font-bold text-slate-400">{{ (m.user_name || m.org_name || '?')[0] }}</div>
              </div>
              <div class="flex-1 min-w-0">
                <div class="text-sm font-medium truncate text-slate-900 dark:text-white">{{ m.user_name || m.org_name || '未知' }}</div>
                <div v-if="m.org_name" class="text-[10px] text-slate-400">组织</div>
              </div>
              <span class="text-[10px] px-1.5 py-0.5 rounded font-medium" :class="m.role === 'owner' ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400' : 'bg-slate-100 dark:bg-slate-700 text-slate-500'">{{ m.role === 'owner' ? '所有者' : '协作者' }}</span>
            </div>
            <div v-if="members.length === 0" class="text-sm text-slate-400 text-center py-6">暂无成员</div>
          </div>
        </div>
      </div>
    </template>

    <div v-else class="text-center py-20 text-slate-400">
      <p class="text-sm">项目不存在或无权访问</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { adminFetch, formatAdminError } from '../../composables/useAdminFetch';
import { API } from '../../api/endpoints';

const route = useRoute();
const projectId = route.params.id as string;

const project = ref<any | null>(null);
const draft = ref<any>({});
const members = ref<any[]>([]);
const loading = ref(true);
const isSaving = ref(false);

const fetchProject = async () => {
  loading.value = true;
  try {
    const res = await adminFetch(API.dev.projectDetail(projectId));
    if (res.ok) {
      const json = await res.json();
      project.value = json;
      draft.value = { ...json };
      members.value = json.members ?? [];
    }
  } catch (e) {
    console.error('Fetch dev project detail error:', e);
  } finally {
    loading.value = false;
  }
};

const saveProject = async () => {
  isSaving.value = true;
  try {
    const allowedFields = ['name', 'description', 'icon', 'banner', 'github_url', 'language', 'status', 'version', 'keywords'];
    const updates: Record<string, any> = {};
    for (const field of allowedFields) {
      if (draft.value[field] !== undefined) updates[field] = draft.value[field];
    }
    const res = await adminFetch(API.dev.projectDetail(projectId), {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(formatAdminError(json, '保存失败', res.status));
    project.value = json;
    draft.value = { ...json };
    alert('保存成功');
  } catch (e: unknown) {
    alert(formatAdminError({ message: e instanceof Error ? e.message : '' }, '保存失败'));
  } finally {
    isSaving.value = false;
  }
};

onMounted(fetchProject);
</script>
