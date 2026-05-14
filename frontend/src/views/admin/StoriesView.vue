<template>
  <FloatingPanel
    ref="panelRef"
    :selectedLabel="currentStory?.title || ''"
    placeholder="选择一篇文章"
    listLabel="文章列表"
    :count="stories.length"
    :prevEnabled="selectedIndex !== null && selectedIndex > 0"
    :nextEnabled="selectedIndex !== null && selectedIndex < stories.length - 1"
    @prev="selectedIndex !== null && selectedIndex > 0 ? selectedIndex-- : undefined"
    @next="selectedIndex !== null && selectedIndex < stories.length - 1 ? selectedIndex++ : undefined"
  >
    <template #list>
      <div class="flex justify-between items-center mb-4">
        <h2 class="font-bold text-lg">文章列表</h2>
        <button @click="createNewStory" class="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center hover:bg-emerald-200 transition-colors">
          <Plus class="w-4 h-4" />
        </button>
      </div>

      <div
        v-for="(story, index) in stories"
        :key="story.id"
        @click="selectStory(index)"
        class="p-4 rounded-2xl border cursor-pointer transition-all duration-200 group"
        :class="selectedIndex === index ? 'bg-emerald-500 text-white border-emerald-500 shadow-lg shadow-emerald-500/20' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-emerald-400'"
      >
        <h3 class="font-bold truncate" :class="selectedIndex === index ? 'text-white' : 'text-slate-900 dark:text-white'">{{ story.title || '未命名文章' }}</h3>
        <p class="text-sm truncate mt-1" :class="selectedIndex === index ? 'text-emerald-100' : 'text-slate-500'">{{ story.category }}</p>
      </div>
    </template>

    <template #content>
      <div v-if="currentStory" class="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden flex flex-col">

        <div class="p-4 lg:p-6 border-b border-slate-100 dark:border-slate-700 grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6 bg-slate-50/50 dark:bg-slate-900/50">
          <div class="lg:col-span-1">
            <label class="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">文章大标题</label>
            <input type="text" v-model="currentStory.title" class="w-full px-4 py-3 lg:py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 outline-none focus:border-emerald-500 text-base" placeholder="例如：重新定义班级大屏" />
          </div>
          <div class="lg:col-span-1">
            <label class="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">副标题</label>
            <input type="text" v-model="currentStory.subtitle" class="w-full px-4 py-3 lg:py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 outline-none focus:border-emerald-500 text-base" placeholder="例如：探索 ClassIsland 带来的智能灵动体验" />
          </div>
          <div class="lg:col-span-1">
            <label class="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">分类标签</label>
            <input type="text" v-model="currentStory.category" class="w-full px-4 py-3 lg:py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 outline-none focus:border-emerald-500 text-base" placeholder="例如：编辑推荐" />
          </div>
          <div class="lg:col-span-1">
            <label class="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">发布日期</label>
            <input type="text" v-model="currentStory.date" class="w-full px-4 py-3 lg:py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 outline-none focus:border-emerald-500 text-base" placeholder="例如：SATURDAY, APRIL 25" />
          </div>
          <div class="lg:col-span-2">
            <label class="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 flex justify-between">
              <span>封面大图 (Banner)</span>
              <span class="text-emerald-500 text-xs cursor-pointer hover:underline" @click="triggerBannerUpload">上传新封面...</span>
              <input type="file" ref="bannerInput" @change="uploadBanner" class="hidden" accept="image/*" />
            </label>
            <div class="flex gap-4 items-center">
              <img v-if="currentStory.coverImage" :src="currentStory.coverImage" class="h-16 w-32 object-cover rounded-lg border border-slate-200 dark:border-slate-700" />
              <input
                type="text"
                :value="currentStory.coverImage"
                @input="currentStory.coverImage = normalizeMediaUrl(($event.target as HTMLInputElement).value)"
                class="flex-1 px-4 py-3 lg:py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 outline-none focus:border-emerald-500 text-base"
                placeholder="请上传并使用站内地址（/api/uploads/...）"
              />
            </div>
            <div v-if="uploadErrorMessage" class="mt-2 text-xs text-rose-500">{{ uploadErrorMessage }}</div>
          </div>
        </div>

        <div class="flex items-center gap-1 lg:gap-2 p-2 lg:p-3 border-b border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-x-auto">
          <button @click="insertText('**加粗**')" class="p-3 lg:p-2 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 flex-shrink-0" title="加粗"><Bold class="w-5 h-5 lg:w-4 lg:h-4" /></button>
          <button @click="insertText('*斜体*')" class="p-3 lg:p-2 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 flex-shrink-0" title="斜体"><Italic class="w-5 h-5 lg:w-4 lg:h-4" /></button>
          <div class="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1 lg:mx-2 flex-shrink-0"></div>
          <button @click="insertText('### 标题')" class="p-3 lg:p-2 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 flex-shrink-0" title="标题"><Heading class="w-5 h-5 lg:w-4 lg:h-4" /></button>
          <button @click="insertText('> 引用段落')" class="p-3 lg:p-2 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 flex-shrink-0" title="引用"><Quote class="w-5 h-5 lg:w-4 lg:h-4" /></button>
          <button @click="insertText('- 列表项')" class="p-3 lg:p-2 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 flex-shrink-0" title="列表"><List class="w-5 h-5 lg:w-4 lg:h-4" /></button>
          <div class="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1 lg:mx-2 flex-shrink-0"></div>
          <button @click="triggerImageUpload" class="p-3 lg:p-2 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-emerald-600 dark:text-emerald-400 flex items-center gap-2 text-sm font-bold flex-shrink-0" title="插入图片">
            <ImageIcon class="w-5 h-5 lg:w-4 lg:h-4" /> <span class="hidden sm:inline">上传插图</span>
          </button>
          <input type="file" ref="imageInput" @change="uploadImageToMarkdown" class="hidden" accept="image/*" />

          <div class="ml-auto flex items-center gap-2 bg-slate-100 dark:bg-slate-900 p-1 rounded-lg flex-shrink-0">
            <button @click="viewMode = 'edit'" class="px-3 py-1 text-sm rounded-md transition-colors" :class="viewMode === 'edit' ? 'bg-white dark:bg-slate-700 shadow-sm' : 'text-slate-500'">编辑</button>
            <button @click="viewMode = 'split'" class="px-3 py-1 text-sm rounded-md transition-colors hidden sm:block" :class="viewMode === 'split' ? 'bg-white dark:bg-slate-700 shadow-sm' : 'text-slate-500'">双栏</button>
            <button @click="viewMode = 'preview'" class="px-3 py-1 text-sm rounded-md transition-colors" :class="viewMode === 'preview' ? 'bg-white dark:bg-slate-700 shadow-sm' : 'text-slate-500'">预览</button>
          </div>

          <button @click="saveStories" class="h-8 px-3 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold flex items-center gap-1.5 transition-colors flex-shrink-0">
            <Save class="w-4 h-4" />
            <span class="hidden sm:inline">{{ isSaving ? '保存中...' : '保存' }}</span>
          </button>
        </div>

        <div class="flex-1 flex min-h-[300px] lg:min-h-[500px]">
          <div v-show="viewMode !== 'preview'" class="flex-1 border-r border-slate-100 dark:border-slate-700">
            <textarea
              ref="markdownTextarea"
              v-model="currentStory.content"
              class="w-full h-full p-4 lg:p-6 bg-transparent resize-none outline-none font-mono text-base lg:text-sm leading-relaxed"
              placeholder="在这里使用 Markdown 语法撰写您的文章正文..."
            ></textarea>
          </div>

          <div v-show="viewMode !== 'edit'" class="flex-1 bg-slate-50/50 dark:bg-slate-900/30 p-4 lg:p-8 overflow-y-auto max-h-[400px] lg:max-h-[600px] prose prose-slate dark:prose-invert max-w-none">
            <div v-html="renderedMarkdown"></div>
          </div>
        </div>
      </div>
      <div v-else class="flex items-center justify-center border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-3xl min-h-[300px]">
        <p class="text-slate-400">点击下方悬浮栏选择文章</p>
      </div>
    </template>
  </FloatingPanel>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { Save, Plus, Bold, Italic, Heading, Quote, List, Image as ImageIcon } from 'lucide-vue-next';
import MarkdownIt from 'markdown-it';
import DOMPurify from 'dompurify';
import { adminFetch, formatAdminError, uploadFile, normalizeMediaUrl } from '../../composables/useAdminFetch';
import FloatingPanel from '../../components/admin/FloatingPanel.vue';

const md = new MarkdownIt({ html: true, breaks: true });

const panelRef = ref<InstanceType<typeof FloatingPanel> | null>(null);

interface FeaturedStory {
  id: string;
  title: string;
  subtitle: string;
  category: string;
  coverImage: string;
  date: string;
  projects: any[];
  theme: 'dark' | 'light';
  content: string;
}

const stories = ref<FeaturedStory[]>([]);
const selectedIndex = ref<number | null>(null);
const viewMode = ref<'edit' | 'split' | 'preview'>('split');
const isSaving = ref(false);
const uploadErrorMessage = ref('');

const currentStory = computed(() => {
  if (selectedIndex.value === null) return null;
  return stories.value[selectedIndex.value];
});

const renderedMarkdown = computed(() => {
  if (!currentStory.value?.content) return '';
  return DOMPurify.sanitize(md.render(currentStory.value.content));
});

const fetchStories = async () => {
  try {
    const res = await adminFetch('/api/stories');
    if (res.ok) {
      stories.value = await res.json();
      if (stories.value.length > 0) selectedIndex.value = 0;
    }
  } catch (e: unknown) {
    alert(formatAdminError({ message: e instanceof Error ? e.message : '' }, '获取文章失败'));
  }
};

const saveStories = async () => {
  isSaving.value = true;
  try {
    const res = await adminFetch('/api/stories', {
      method: 'POST',
      body: JSON.stringify(stories.value)
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      throw new Error(formatAdminError(json, '保存失败', res.status));
    }
    alert('保存成功！');
  } catch (e: unknown) {
    alert(formatAdminError({ message: e instanceof Error ? e.message : '' }, '保存失败'));
  } finally {
    isSaving.value = false;
  }
};

const selectStory = (index: number) => {
  selectedIndex.value = index;
  panelRef.value?.close();
};

const createNewStory = () => {
  stories.value.push({
    id: 'feature-' + Date.now(),
    title: '全新推荐文章',
    subtitle: '副标题...',
    category: 'Editors\' Choice',
    coverImage: '',
    date: new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).toUpperCase(),
    projects: [],
    theme: 'dark',
    content: '# 在这里输入大标题\n\n写点什么...'
  });
  selectedIndex.value = stories.value.length - 1;
  panelRef.value?.close();
};

const bannerInput = ref<HTMLInputElement | null>(null);
const imageInput = ref<HTMLInputElement | null>(null);
const markdownTextarea = ref<HTMLTextAreaElement | null>(null);

const triggerBannerUpload = () => bannerInput.value?.click();
const triggerImageUpload = () => imageInput.value?.click();

const uploadBanner = async (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file || !currentStory.value) return;
  uploadErrorMessage.value = '';
  try {
    const url = await uploadFile(file);
    currentStory.value.coverImage = url;
  } catch (err: unknown) {
    uploadErrorMessage.value = err instanceof Error ? err.message : '上传失败';
  }
};

const uploadImageToMarkdown = async (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  uploadErrorMessage.value = '';
  try {
    const url = await uploadFile(file);
    insertText(`\n![图片描述](${url})\n`);
  } catch (err: unknown) {
    uploadErrorMessage.value = err instanceof Error ? err.message : '上传失败';
  }
};

const insertText = (text: string) => {
  if (!currentStory.value || !markdownTextarea.value) return;

  const start = markdownTextarea.value.selectionStart;
  const end = markdownTextarea.value.selectionEnd;
  const currentContent = currentStory.value.content;

  currentStory.value.content =
    currentContent.substring(0, start) +
    text +
    currentContent.substring(end);

  setTimeout(() => {
    if (markdownTextarea.value) {
      markdownTextarea.value.focus();
      markdownTextarea.value.selectionStart = start + text.length;
      markdownTextarea.value.selectionEnd = start + text.length;
    }
  }, 10);
};

onMounted(() => {
  fetchStories();
});
</script>

<style scoped>
.prose img {
  border-radius: 1rem;
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1);
  margin: 2rem 0;
}
</style>
