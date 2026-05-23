<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-w-2xl max-h-[85vh] flex flex-col">
      <DialogHeader>
        <DialogTitle>标签库</DialogTitle>
        <p class="text-sm text-muted-foreground mt-1">
          自定义标签仅出现在应用详情侧栏「项目标签」画廊；列表卡片与详情头为 GitHub 同步的预制标签。
        </p>
      </DialogHeader>

      <div class="flex gap-2 flex-wrap shrink-0">
        <input
          v-model="filterQ"
          type="text"
          placeholder="搜索标签"
          class="flex-1 min-w-[160px] px-3 py-2 rounded-xl border border-border bg-card text-sm"
          @keyup.enter="fetchTags"
        />
        <select v-model="filterGroup" class="px-3 py-2 rounded-xl border border-border bg-card text-sm" @change="fetchTags">
          <option value="">全部分组</option>
          <option value="feature">功能特性</option>
          <option value="state">状态与运营</option>
          <option value="release">版本与发布</option>
          <option value="community">作者与贡献</option>
          <option value="custom">其他</option>
        </select>
        <button type="button" class="px-4 py-2 rounded-xl bg-secondary text-sm font-bold" @click="fetchTags">搜索</button>
        <button type="button" class="px-4 py-2 rounded-xl bg-emerald-500 text-white text-sm font-bold" @click="openCreate">新建</button>
      </div>

      <div v-if="loading" class="text-muted-foreground text-sm py-6 text-center">加载中…</div>
      <div v-else class="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1">
        <div
          v-for="tag in items"
          :key="tag.id"
          class="p-3 rounded-xl border border-border bg-card flex flex-wrap items-center gap-3 justify-between"
        >
          <div class="min-w-0">
            <div class="font-bold">{{ tag.label }}</div>
            <p class="text-xs text-muted-foreground mt-0.5">{{ groupLabel(tag.group) }} · {{ tag.slug }}</p>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <span class="text-xs px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300">
              {{ tag.project_count ?? 0 }} 项目
            </span>
            <button type="button" class="text-xs font-bold text-sky-600" @click="filterProjects(tag)">筛选</button>
            <button type="button" class="text-xs font-bold text-emerald-600" @click="editTag(tag)">编辑</button>
            <button type="button" class="text-xs font-bold text-rose-500" @click="removeTag(tag)">删除</button>
          </div>
        </div>
        <p v-if="items.length === 0" class="text-sm text-muted-foreground text-center py-8">暂无标签</p>
      </div>
    </DialogContent>
  </Dialog>

  <Dialog v-model:open="showEditor">
    <DialogContent class="max-w-lg">
      <DialogHeader>
        <DialogTitle>{{ draft.id ? '编辑标签' : '新建标签' }}</DialogTitle>
      </DialogHeader>
      <div class="space-y-3">
        <div>
          <label class="text-sm font-bold text-muted-foreground">名称</label>
          <input v-model="draft.label" type="text" class="w-full mt-1 px-3 py-2 rounded-xl border border-border bg-card text-sm" />
        </div>
        <div>
          <label class="text-sm font-bold text-muted-foreground">Slug</label>
          <input v-model="draft.slug" type="text" class="w-full mt-1 px-3 py-2 rounded-xl border border-border bg-card text-sm" />
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="text-sm font-bold text-muted-foreground">分组</label>
            <select v-model="draft.group" class="w-full mt-1 px-3 py-2 rounded-xl border border-border bg-card text-sm">
              <option value="feature">功能特性</option>
              <option value="state">状态与运营</option>
              <option value="release">版本与发布</option>
              <option value="community">作者与贡献</option>
              <option value="custom">其他</option>
            </select>
          </div>
          <div>
            <label class="text-sm font-bold text-muted-foreground">颜色</label>
            <select v-model="draft.color_variant" class="w-full mt-1 px-3 py-2 rounded-xl border border-border bg-card text-sm">
              <option v-for="c in colorOptions" :key="c" :value="c">{{ c }}</option>
            </select>
          </div>
        </div>
        <div>
          <label class="text-sm font-bold text-muted-foreground">画廊排序优先级</label>
          <input v-model.number="draft.card_priority" type="number" class="w-full mt-1 px-3 py-2 rounded-xl border border-border bg-card text-sm" />
        </div>
      </div>
      <DialogFooter>
        <button type="button" class="flex-1 py-2.5 rounded-xl bg-emerald-500 text-white font-bold text-sm" @click="saveTag">保存</button>
        <button type="button" class="flex-1 py-2.5 rounded-xl bg-muted font-bold text-sm" @click="showEditor = false">取消</button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { adminFetch, formatAdminError } from '../../composables/useAdminFetch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

type TagRow = {
  id: string;
  slug: string;
  label: string;
  group: string;
  color_variant: string;
  show_on_card: boolean;
  show_on_header: boolean;
  show_in_gallery: boolean;
  card_priority: number;
  is_active: boolean;
  project_count?: number;
};

const open = defineModel<boolean>('open', { default: false });

const emit = defineEmits<{
  updated: [];
  'filter-by-tag': [tagId: string];
}>();

const items = ref<TagRow[]>([]);
const loading = ref(false);
const filterQ = ref('');
const filterGroup = ref('');
const showEditor = ref(false);
const colorOptions = ['emerald', 'amber', 'sky', 'rose', 'indigo', 'purple', 'orange', 'slate', 'blue'];

const emptyDraft = (): TagRow => ({
  id: '',
  slug: '',
  label: '',
  group: 'feature',
  color_variant: 'slate',
  show_on_card: false,
  show_on_header: false,
  show_in_gallery: true,
  card_priority: 0,
  is_active: true,
});

const draft = ref<TagRow>(emptyDraft());

function groupLabel(g: string) {
  const map: Record<string, string> = {
    feature: '功能特性',
    state: '状态与运营',
    release: '版本与发布',
    community: '作者与贡献',
    custom: '其他',
  };
  return map[g] ?? g;
}

async function fetchTags() {
  loading.value = true;
  try {
    const params = new URLSearchParams();
    if (filterQ.value) params.set('q', filterQ.value);
    if (filterGroup.value) params.set('group', filterGroup.value);
    const res = await adminFetch(`/api/admin/tags?${params}`);
    if (!res.ok) throw new Error(formatAdminError(await res.json().catch(() => ({})), '加载失败', res.status));
    const json = await res.json();
    items.value = json.items ?? [];
  } catch (e: unknown) {
    alert(e instanceof Error ? e.message : '加载失败');
  } finally {
    loading.value = false;
  }
}

function openCreate() {
  draft.value = emptyDraft();
  showEditor.value = true;
}

function editTag(tag: TagRow) {
  draft.value = { ...tag, show_in_gallery: true, show_on_card: false, show_on_header: false };
  showEditor.value = true;
}

function filterProjects(tag: TagRow) {
  emit('filter-by-tag', tag.id);
  open.value = false;
}

async function saveTag() {
  try {
    const payload = {
      ...draft.value,
      show_in_gallery: true,
      show_on_card: false,
      show_on_header: false,
    };
    const isNew = !draft.value.id;
    const res = await adminFetch(isNew ? '/api/admin/tags' : `/api/admin/tags/${draft.value.id}`, {
      method: isNew ? 'POST' : 'PATCH',
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(formatAdminError(await res.json().catch(() => ({})), '保存失败', res.status));
    showEditor.value = false;
    await fetchTags();
    emit('updated');
  } catch (e: unknown) {
    alert(e instanceof Error ? e.message : '保存失败');
  }
}

async function removeTag(tag: TagRow) {
  if (!confirm(`删除标签「${tag.label}」？已关联的项目将失去该标签。`)) return;
  const res = await adminFetch(`/api/admin/tags/${tag.id}`, { method: 'DELETE' });
  if (!res.ok) {
    alert(formatAdminError(await res.json().catch(() => ({})), '删除失败', res.status));
    return;
  }
  await fetchTags();
  emit('updated');
}

watch(open, (isOpen) => {
  if (isOpen) fetchTags();
});

defineExpose({ fetchTags });
</script>
