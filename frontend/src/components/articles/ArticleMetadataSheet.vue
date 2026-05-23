<script setup lang="ts">
import { ref } from 'vue';
import SearchSelect from '../admin/SearchSelect.vue';
import { adminFetch, normalizeMediaUrl } from '../../composables/useAdminFetch';
import { API } from '../../api/endpoints';
import type { ArticleContentFormat } from '../../lib/renderArticleContent';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '../ui/sheet';

type LayoutType = 'hero' | 'interview' | 'app_spotlight';
type ArticleStatus = 'draft' | 'published';

interface ArticleProject {
  project_id?: string;
  slug?: string;
  name: string;
  icon?: string;
}

export interface ArticleDraft {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  category: string;
  layout_type: LayoutType;
  content_format: ArticleContentFormat;
  content: string;
  cover_image: string;
  theme: 'dark' | 'light';
  projects: ArticleProject[];
  status: ArticleStatus;
  sort_index: number;
  version: number;
}

const open = defineModel<boolean>('open', { default: false });
const draft = defineModel<ArticleDraft>('draft', { required: true });

const projectPickId = ref<string | null>(null);
const projectMetaCache = new Map<string, { id: string; slug: string; name: string; icon?: string }>();
const bannerInput = ref<HTMLInputElement | null>(null);
const uploadError = ref('');

async function searchProjects(q: string) {
  const qt = q.trim();
  if (qt.length < 1) return [];
  const res = await adminFetch(`${API.admin.projects}?q=${encodeURIComponent(qt)}&pageSize=20`);
  if (!res.ok) return [];
  const json = await res.json();
  const list = json.items ?? json.projects ?? [];
  return list.map((p: { id: string; slug: string; name: string; icon?: string }) => {
    projectMetaCache.set(String(p.id), p);
    return { id: String(p.id), label: p.name, subtitle: p.slug, avatar: p.icon || '' };
  });
}

function onProjectPicked(id: string | null) {
  if (!id) return;
  const p = projectMetaCache.get(id);
  if (!p) return;
  if (draft.value.projects.some((x) => x.project_id === p.id || x.name === p.name)) {
    projectPickId.value = null;
    return;
  }
  draft.value.projects.push({
    project_id: p.id,
    slug: p.slug,
    name: p.name,
    icon: p.icon || '',
  });
  projectPickId.value = null;
}

function removeProject(i: number) {
  draft.value.projects.splice(i, 1);
}

function triggerBannerUpload() {
  bannerInput.value?.click();
}

async function uploadBanner(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  try {
    const { uploadFile } = await import('../../composables/useAdminFetch');
    draft.value.cover_image = await uploadFile(file);
    uploadError.value = '';
  } catch (err: unknown) {
    uploadError.value = err instanceof Error ? err.message : '上传失败';
  }
}
</script>

<template>
  <Sheet v-model:open="open">
    <SheetContent side="right" class="w-full sm:max-w-md overflow-y-auto">
      <SheetHeader>
        <SheetTitle>文章设置</SheetTitle>
      </SheetHeader>

      <div class="mt-4 space-y-4 pb-8">
        <div>
          <label class="block text-sm font-bold text-muted-foreground mb-1">形态</label>
          <select v-model="draft.layout_type" class="w-full px-3 py-2 rounded-xl border border-border bg-card text-sm">
            <option value="hero">Hero 全图</option>
            <option value="interview">访谈/窄栏</option>
            <option value="app_spotlight">应用推荐列</option>
          </select>
        </div>
        <div>
          <label class="block text-sm font-bold text-muted-foreground mb-1">内容格式</label>
          <select v-model="draft.content_format" class="w-full px-3 py-2 rounded-xl border border-border bg-card text-sm">
            <option value="markdown">Markdown</option>
            <option value="html">HTML</option>
            <option value="latex">LaTeX</option>
            <option value="plain">纯文本</option>
          </select>
        </div>
        <div>
          <label class="block text-sm font-bold text-muted-foreground mb-1">Slug（URL）</label>
          <input v-model="draft.slug" type="text" class="w-full px-3 py-2 rounded-xl border border-border bg-card text-sm" />
        </div>
        <div>
          <label class="block text-sm font-bold text-muted-foreground mb-1">分类</label>
          <input v-model="draft.category" type="text" class="w-full px-3 py-2 rounded-xl border border-border bg-card text-sm" />
        </div>
        <div>
          <label class="block text-sm font-bold text-muted-foreground mb-1">排序</label>
          <input v-model.number="draft.sort_index" type="number" class="w-full px-3 py-2 rounded-xl border border-border bg-card text-sm" />
        </div>
        <div v-if="draft.layout_type !== 'interview'">
          <label class="block text-sm font-bold text-muted-foreground mb-1">副标题</label>
          <input v-model="draft.subtitle" type="text" class="w-full px-3 py-2 rounded-xl border border-border bg-card text-sm" />
        </div>
        <div v-if="draft.layout_type === 'hero'">
          <label class="block text-sm font-bold text-muted-foreground mb-1 flex justify-between">
            <span>封面</span>
            <button type="button" class="text-emerald-500 text-xs" @click="triggerBannerUpload">上传</button>
          </label>
          <input ref="bannerInput" type="file" class="hidden" accept="image/*" @change="uploadBanner" />
          <div class="flex gap-3 items-center">
            <img v-if="draft.cover_image" :src="draft.cover_image" class="h-14 w-24 object-cover rounded-lg border" alt="" />
            <input
              :value="draft.cover_image"
              type="text"
              class="flex-1 px-3 py-2 rounded-xl border border-border bg-card text-sm"
              @input="draft.cover_image = normalizeMediaUrl(($event.target as HTMLInputElement).value)"
            />
          </div>
        </div>
        <div v-if="draft.layout_type === 'hero'">
          <label class="block text-sm font-bold text-muted-foreground mb-1">主题</label>
          <select v-model="draft.theme" class="w-full px-3 py-2 rounded-xl border border-border bg-card text-sm">
            <option value="dark">深色</option>
            <option value="light">浅色</option>
          </select>
        </div>
        <div>
          <label class="block text-sm font-bold text-muted-foreground mb-1">关联项目</label>
          <div class="flex flex-wrap gap-2 mb-2">
            <span
              v-for="(p, i) in draft.projects"
              :key="i"
              class="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-accent text-xs"
            >
              {{ p.name }}
              <button type="button" class="text-rose-500" @click="removeProject(i)">×</button>
            </span>
          </div>
          <SearchSelect
            :key="`proj-${draft.id}`"
            v-model="projectPickId"
            :search-fn="searchProjects"
            placeholder="搜索项目以添加"
            @update:model-value="onProjectPicked"
          />
        </div>
        <p v-if="uploadError" class="text-xs text-rose-500">{{ uploadError }}</p>
      </div>
    </SheetContent>
  </Sheet>
</template>
