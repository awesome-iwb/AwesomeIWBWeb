<template>
  <div class="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
    <div class="p-4 sm:p-6 border-b border-border bg-accent/50 dark:bg-slate-900/50 flex items-center justify-between gap-3">
      <div>
        <h3 class="font-bold text-sm text-muted-foreground">详情图轮播管理</h3>
        <p class="text-xs text-muted-foreground mt-1">
          {{ mode === 'dev' ? '管理你作为成员的项目详情图（图片 / 文字 / 视频外链）。' : '跨项目维护所有详情图素材。' }}
        </p>
      </div>
      <button
        @click="openCreate"
        class="px-3 py-2 min-h-[44px] rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold transition-colors shrink-0"
      >
        + 添加详情图
      </button>
    </div>

    <div class="p-4 sm:p-6">
      <div v-if="loading" class="text-sm text-muted-foreground text-center py-6">加载中...</div>
      <div v-else-if="items.length === 0" class="text-sm text-muted-foreground text-center py-6">
        暂无详情图，点击右上角「添加详情图」开始创建。
      </div>

      <ul v-else class="space-y-3">
        <li
          v-for="(item, index) in items"
          :key="item.id"
          class="flex items-center gap-3 p-3 rounded-xl border border-border bg-card/50"
        >
          <!-- 缩略预览 -->
          <div class="w-16 h-16 shrink-0 rounded-lg overflow-hidden bg-muted flex items-center justify-center">
            <img v-if="item.media_type === 'image' && item.image_url" :src="item.image_url" class="w-full h-full object-cover" alt="" />
            <span v-else-if="item.media_type === 'video_embed'" class="text-[10px] font-bold text-blue-500 text-center leading-tight px-1">视频<br />外链</span>
            <span v-else class="text-[10px] font-bold text-muted-foreground text-center leading-tight px-1">文字<br />卡片</span>
          </div>

          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2">
              <span class="px-1.5 py-0.5 rounded text-[10px] font-bold"
                :class="item.media_type === 'image' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                  : item.media_type === 'video_embed' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                  : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'">
                {{ mediaTypeLabel(item.media_type) }}
              </span>
              <span class="text-sm font-bold text-foreground truncate">{{ item.title || '(无标题)' }}</span>
            </div>
            <div v-if="item.caption" class="text-xs text-muted-foreground truncate mt-0.5">{{ item.caption }}</div>
            <div class="text-xs text-muted-foreground mt-0.5">
              排序 {{ index + 1 }}
              <span v-if="item.is_enabled" class="text-emerald-600 dark:text-emerald-400">· 已启用</span>
              <span v-else class="text-rose-500">· 已停用</span>
            </div>
          </div>

          <!-- 启用开关 -->
          <button
            @click="toggleEnabled(item)"
            class="px-2 py-1 min-h-[40px] rounded-lg text-xs font-bold transition-colors shrink-0"
            :class="item.is_enabled ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-muted text-muted-foreground'"
            :title="item.is_enabled ? '点击停用' : '点击启用'"
          >
            {{ item.is_enabled ? '启用中' : '已停用' }}
          </button>

          <!-- 排序 -->
          <div class="flex flex-col shrink-0">
            <button @click="moveItem(index, -1)" :disabled="index === 0" class="px-2 py-1 text-xs rounded hover:bg-accent disabled:opacity-30">↑</button>
            <button @click="moveItem(index, 1)" :disabled="index === items.length - 1" class="px-2 py-1 text-xs rounded hover:bg-accent disabled:opacity-30">↓</button>
          </div>

          <!-- 操作 -->
          <div class="flex items-center gap-1 shrink-0">
            <button @click="openEdit(item)" class="px-2 py-1.5 min-h-[40px] rounded-lg text-xs text-blue-500 hover:underline">编辑</button>
            <button @click="removeItem(item)" class="px-2 py-1.5 min-h-[40px] rounded-lg text-xs text-rose-500 hover:underline">删除</button>
          </div>
        </li>
      </ul>
    </div>

    <!-- 创建 / 编辑 抽屉 -->
    <Dialog v-model:open="editing">
      <DialogContent class="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{{ draft.id ? '编辑详情图' : '添加详情图' }}</DialogTitle>
        </DialogHeader>

        <div class="space-y-4">
          <!-- 媒体类型 -->
          <div>
            <label class="block text-sm font-bold text-muted-foreground mb-2">素材类型</label>
            <div class="grid grid-cols-3 gap-2">
              <button
                v-for="t in mediaTypes"
                :key="t.value"
                @click="draft.media_type = t.value"
                class="px-3 py-2.5 min-h-[44px] rounded-xl border text-sm font-bold transition-colors"
                :class="draft.media_type === t.value ? 'border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-400' : 'border-border text-muted-foreground hover:bg-accent'"
              >
                {{ t.label }}
              </button>
            </div>
          </div>

          <!-- 图片上传 -->
          <div v-if="draft.media_type === 'image'">
            <label class="block text-sm font-bold text-muted-foreground mb-2">图片</label>
            <div class="flex items-center gap-3">
              <div class="w-20 h-20 shrink-0 rounded-xl overflow-hidden bg-muted border border-border flex items-center justify-center">
                <img v-if="draft.image_url" :src="draft.image_url" class="w-full h-full object-cover" alt="" />
                <span v-else class="text-xs text-muted-foreground">无图</span>
              </div>
              <div class="flex-1 space-y-2">
                <button @click="triggerUpload" :disabled="uploading" class="px-3 py-2 min-h-[44px] rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold disabled:opacity-50">
                  {{ uploading ? '上传中...' : '上传图片' }}
                </button>
                <input type="file" ref="fileInputRef" @change="onFile" class="hidden" accept="image/*" />
                <input
                  type="text"
                  :value="draft.image_url"
                  @input="draft.image_url = normalizeMediaUrl(($event.target as HTMLInputElement).value)"
                  class="w-full px-3 py-2 rounded-xl border border-border bg-card outline-none focus:border-blue-500 text-sm"
                  placeholder="或粘贴站内地址（/api/uploads/...）"
                />
              </div>
            </div>
          </div>

          <!-- 视频外链 -->
          <div v-else-if="draft.media_type === 'video_embed'">
            <label class="block text-sm font-bold text-muted-foreground mb-2">视频播放页链接</label>
            <input
              type="text"
              v-model="draft.videoInput"
              class="w-full px-4 py-3 sm:py-2.5 rounded-xl border border-border bg-card outline-none focus:border-blue-500 text-base sm:text-sm min-h-[48px]"
              placeholder="https://www.bilibili.com/video/BV...  （仅支持 B 站 / 腾讯视频 / 优酷）"
            />
            <p v-if="videoWarning" class="text-xs text-rose-500 mt-1">{{ videoWarning }}</p>
            <p v-else class="text-xs text-muted-foreground mt-1">系统仅保存厂商与视频 ID，播放地址由后端安全生成。</p>
          </div>

          <!-- 标题 -->
          <div>
            <label class="block text-sm font-bold text-muted-foreground mb-2">
              标题{{ draft.media_type === 'text' ? '（文字卡必填）' : '' }}
            </label>
            <input
              type="text"
              v-model="draft.title"
              maxlength="120"
              class="w-full px-4 py-3 sm:py-2.5 rounded-xl border border-border bg-card outline-none focus:border-blue-500 text-base sm:text-sm min-h-[48px]"
              placeholder="最多 120 字"
            />
          </div>

          <!-- 说明文案 -->
          <div>
            <label class="block text-sm font-bold text-muted-foreground mb-2">说明文案</label>
            <textarea
              v-model="draft.caption"
              rows="3"
              maxlength="600"
              class="w-full px-4 py-3 sm:py-2.5 rounded-xl border border-border bg-card outline-none focus:border-blue-500 resize-none text-base sm:text-sm"
              placeholder="最多 600 字"
            ></textarea>
          </div>

          <!-- 跳转 -->
          <div>
            <label class="block text-sm font-bold text-muted-foreground mb-2">点击跳转</label>
            <div class="grid grid-cols-3 gap-2 mb-3">
              <button
                v-for="opt in jumpOptions"
                :key="opt.value"
                @click="jumpMode = opt.value"
                class="px-2 py-2 min-h-[44px] rounded-xl border text-xs font-bold transition-colors"
                :class="jumpMode === opt.value ? 'border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-400' : 'border-border text-muted-foreground hover:bg-accent'"
              >
                {{ opt.label }}
              </button>
            </div>

            <input
              v-if="jumpMode === 'link'"
              type="text"
              v-model="draft.link_url"
              class="w-full px-4 py-3 sm:py-2.5 rounded-xl border border-border bg-card outline-none focus:border-blue-500 text-base sm:text-sm min-h-[48px]"
              placeholder="https:// 外部链接"
            />
            <SearchSelect
              v-else-if="jumpMode === 'project'"
              :key="`lp-${draft.linked_project_id || 'none'}`"
              v-model="draft.linked_project_id"
              :search-fn="searchProjects"
              placeholder="搜索并关联一个项目"
              :initial-label="draft.linked_project_name ? `@${draft.linked_project_slug || draft.linked_project_name}` : ''"
              clearable
            />
            <p v-if="jumpMode === 'project' && !draft.linked_project_id" class="text-xs text-muted-foreground mt-1">留空表示不关联项目。</p>
          </div>

          <!-- 启用 -->
          <div class="flex items-center gap-3">
            <button
              @click="draft.is_enabled = !draft.is_enabled"
              class="px-3 py-1.5 min-h-[40px] rounded-lg text-xs font-bold transition-colors"
              :class="draft.is_enabled ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-muted text-muted-foreground'"
            >
              {{ draft.is_enabled ? '启用（将展示在前台）' : '停用（前台不展示）' }}
            </button>
          </div>

          <div v-if="formError" class="text-xs text-rose-500">{{ formError }}</div>
        </div>

        <div class="flex gap-3 mt-6">
          <button
            @click="save"
            :disabled="saving"
            class="flex-1 px-4 py-3 min-h-[48px] rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-sm disabled:opacity-50 transition-colors"
          >
            {{ saving ? '保存中...' : (draft.id ? '保存修改' : '创建') }}
          </button>
          <button
            @click="editing = false"
            class="flex-1 px-4 py-3 min-h-[48px] rounded-xl bg-muted text-muted-foreground font-bold text-sm transition-colors"
          >
            取消
          </button>
        </div>
      </DialogContent>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { adminFetch, formatAdminError, uploadFile, normalizeMediaUrl } from '../../composables/useAdminFetch';
import { API } from '../../api/endpoints';
import type { GalleryItem } from '../../composables/useProjects';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import SearchSelect from '../../components/admin/SearchSelect.vue';

const props = withDefaults(
  defineProps<{
    mode?: 'dev' | 'admin';
    projectId: string;
  }>(),
  { mode: 'dev' }
);

type MediaType = 'image' | 'text' | 'video_embed';
type JumpMode = 'none' | 'link' | 'project';

interface DraftItem {
  id: string | null;
  media_type: MediaType;
  image_url: string;
  title: string;
  caption: string;
  link_url: string;
  linked_project_id: string | null;
  linked_project_slug: string | null;
  linked_project_name: string | null;
  videoInput: string;
  is_enabled: boolean;
}

const mediaTypes: Array<{ value: MediaType; label: string }> = [
  { value: 'image', label: '图片' },
  { value: 'text', label: '文字' },
  { value: 'video_embed', label: '视频' },
];

const jumpOptions: Array<{ value: JumpMode; label: string }> = [
  { value: 'none', label: '不跳转' },
  { value: 'link', label: '外部链接' },
  { value: 'project', label: '关联项目' },
];

const VIDEO_HOSTS = ['www.bilibili.com', 'bilibili.com', 'm.bilibili.com', 'v.qq.com', 'v.youku.com'];

const items = ref<GalleryItem[]>([]);
const loading = ref(true);
const editing = ref(false);
const saving = ref(false);
const uploading = ref(false);
const formError = ref('');
const fileInputRef = ref<HTMLInputElement | null>(null);

const draft = ref<DraftItem>(emptyDraft());
const jumpMode = ref<JumpMode>('none');

const videoWarning = computed(() => {
  if (draft.value.media_type !== 'video_embed') return '';
  const url = draft.value.videoInput.trim();
  if (!url) return '请粘贴视频播放页链接';
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:') return '请使用 https 链接';
    if (!VIDEO_HOSTS.includes(u.hostname.toLowerCase())) return '仅支持 B 站 / 腾讯视频 / 优酷的播放页地址';
    return '';
  } catch {
    return '请输入有效的视频播放页链接';
  }
});

function emptyDraft(): DraftItem {
  return {
    id: null,
    media_type: 'image',
    image_url: '',
    title: '',
    caption: '',
    link_url: '',
    linked_project_id: null,
    linked_project_slug: null,
    linked_project_name: null,
    videoInput: '',
    is_enabled: true,
  };
}

function mediaTypeLabel(t: MediaType): string {
  return t === 'image' ? '图片' : t === 'text' ? '文字' : '视频';
}

// ---- 加载 ----
const loadItems = async () => {
  loading.value = true;
  try {
    const url = props.mode === 'dev'
      ? API.dev.projectGallery(props.projectId)
      : API.admin.projectGalleryByProject(props.projectId);
    const res = await adminFetch(url);
    if (res.ok) {
      const json = await res.json();
      items.value = (json.items ?? []).slice().sort((a: GalleryItem, b: GalleryItem) => a.sort_index - b.sort_index);
    }
  } catch (e) {
    console.error('Load gallery items error:', e);
  } finally {
    loading.value = false;
  }
};

// ---- 跳转模式联动 ----
watch(
  () => [draft.value.link_url, draft.value.linked_project_id] as const,
  ([link, pid]) => {
    if (link && link.trim()) jumpMode.value = 'link';
    else if (pid) jumpMode.value = 'project';
    else jumpMode.value = 'none';
  }
);

const triggerUpload = () => fileInputRef.value?.click();
const onFile = async (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  (e.target as HTMLInputElement).value = '';
  if (!file) return;
  uploading.value = true;
  formError.value = '';
  try {
    draft.value.image_url = await uploadFile(file);
  } catch (err: unknown) {
    formError.value = err instanceof Error ? err.message : '上传失败';
  } finally {
    uploading.value = false;
  }
};

// ---- 关联项目搜索（复用前台目录接口）----
const searchProjects = async (q: string): Promise<Array<{ id: string; label: string; subtitle?: string }>> => {
  try {
    const res = await fetch('/api/projects', { cache: 'no-store' });
    if (!res.ok) return [];
    const data = await res.json();
    const cats = Array.isArray(data?.categories) ? data.categories : [];
    const all: any[] = [];
    for (const c of cats) if (Array.isArray(c.projects)) all.push(...c.projects);
    const qt = q.trim().toLowerCase();
    return all
      .filter((p) => !qt || (p.name || '').toLowerCase().includes(qt) || (p.slug || '').toLowerCase().includes(qt))
      .slice(0, 20)
      .map((p) => ({ id: String(p.id), label: p.name || '', subtitle: p.slug ? `@${p.slug}` : '' }));
  } catch {
    return [];
  }
};

// ---- 抽屉 ----
const openCreate = () => {
  draft.value = emptyDraft();
  jumpMode.value = 'none';
  formError.value = '';
  editing.value = true;
};

const openEdit = (item: GalleryItem) => {
  draft.value = {
    id: item.id,
    media_type: item.media_type,
    image_url: item.image_url || '',
    title: item.title || '',
    caption: item.caption || '',
    link_url: item.link_url || '',
    linked_project_id: item.linked_project_id || null,
    linked_project_slug: item.linked_project_slug || null,
    linked_project_name: item.linked_project_name || null,
    videoInput: item.video_page_url || item.video_embed_url || '',
    is_enabled: item.is_enabled,
  };
  jumpMode.value = item.linked_project_id ? 'project' : item.link_url ? 'link' : 'none';
  formError.value = '';
  editing.value = true;
};

const buildPayload = (): Record<string, any> => {
  const d = draft.value;
  const payload: Record<string, any> = {
    media_type: d.media_type,
    title: d.title,
    caption: d.caption,
    is_enabled: d.is_enabled,
  };
  if (d.media_type === 'image') {
    payload.image_url = d.image_url;
  } else if (d.media_type === 'video_embed') {
    payload.video_url = d.videoInput.trim();
  }
  if (jumpMode.value === 'link' && d.link_url.trim()) {
    payload.link_url = d.link_url.trim();
  } else if (jumpMode.value === 'project' && d.linked_project_id) {
    payload.linked_project_id = d.linked_project_id;
  }
  return payload;
};

const save = async () => {
  if (draft.value.media_type === 'video_embed' && videoWarning.value) {
    formError.value = videoWarning.value;
    return;
  }
  saving.value = true;
  formError.value = '';
  try {
    const body = buildPayload();
    let url: string;
    let method: string;
    if (draft.value.id) {
      url = props.mode === 'dev'
        ? API.dev.projectGalleryItem(props.projectId, draft.value.id)
        : API.admin.projectGalleryItem(draft.value.id);
      method = 'PATCH';
    } else {
      url = props.mode === 'dev'
        ? API.dev.projectGallery(props.projectId)
        : API.admin.projectGallery;
      method = 'POST';
      if (props.mode === 'admin') body.project_id = props.projectId;
    }
    const res = await adminFetch(url, { method, body: JSON.stringify(body) });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(formatAdminError(json, draft.value.id ? '保存失败' : '创建失败', res.status));
    editing.value = false;
    await loadItems();
  } catch (e: unknown) {
    formError.value = e instanceof Error ? e.message : '保存失败';
  } finally {
    saving.value = false;
  }
};

const toggleEnabled = async (item: GalleryItem) => {
  const next = !item.is_enabled;
  const targetUrl = props.mode === 'dev'
    ? API.dev.projectGalleryItem(props.projectId, item.id)
    : API.admin.projectGalleryItem(item.id);
  const res = await adminFetch(targetUrl, { method: 'PATCH', body: JSON.stringify({ is_enabled: next }) });
  if (res.ok) {
    item.is_enabled = next;
  } else {
    const json = await res.json().catch(() => ({}));
    alert(formatAdminError(json, '状态更新失败', res.status));
  }
};

const removeItem = async (item: GalleryItem) => {
  if (!confirm(`确定删除「${item.title || '该详情图'}」？此操作不可撤销。`)) return;
  const url = props.mode === 'dev'
    ? API.dev.projectGalleryItem(props.projectId, item.id)
    : API.admin.projectGalleryItem(item.id);
  const res = await adminFetch(url, { method: 'DELETE' });
  if (res.ok) {
    items.value = items.value.filter((it) => it.id !== item.id);
  } else {
    const json = await res.json().catch(() => ({}));
    alert(formatAdminError(json, '删除失败', res.status));
  }
};

const moveItem = async (index: number, dir: -1 | 1) => {
  const target = index + dir;
  if (target < 0 || target >= items.value.length) return;
  const arr = items.value.slice();
  [arr[index], arr[target]] = [arr[target], arr[index]];
  items.value = arr;
  const orders = arr.map((it, i) => ({ id: it.id, sort_index: i }));
  const url = props.mode === 'dev'
    ? API.dev.projectGalleryReorder(props.projectId)
    : API.admin.projectGalleryReorder;
  const body = props.mode === 'dev' ? { orders } : { project_id: props.projectId, orders };
  const res = await adminFetch(url, { method: 'POST', body: JSON.stringify(body) });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    alert(formatAdminError(json, '排序失败', res.status));
    await loadItems();
  }
};

onMounted(loadItems);
</script>
