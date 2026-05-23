<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <h2 class="text-lg font-bold text-foreground">Bug 反馈</h2>
    </div>

    <div class="flex flex-wrap gap-2">
      <select v-model="filterStatus" @change="fetchBugs" class="px-3 py-3 sm:py-2 rounded-xl border border-border bg-card outline-none focus:border-blue-500 text-base sm:text-sm min-h-[48px]">
        <option value="">全部状态</option>
        <option value="open">待处理</option>
        <option value="doing">处理中</option>
        <option value="done">已完成</option>
        <option value="closed">已关闭</option>
      </select>
      <select v-model="filterProject" @change="fetchBugs" class="px-3 py-3 sm:py-2 rounded-xl border border-border bg-card outline-none focus:border-blue-500 text-base sm:text-sm min-h-[48px]">
        <option value="">全部项目</option>
        <option v-for="p in projectNames" :key="p" :value="p">{{ p }}</option>
      </select>
    </div>

    <ui-LoadingSpinner v-if="loading" brand="dev" />

    <div v-else-if="bugs.length === 0" class="bg-card rounded-2xl border border-border shadow-sm">
      <ui-EmptyState :icon="Bug" title="暂无 Bug 反馈" containerClass="p-10" />
    </div>

    <div v-else class="space-y-3">
      <div v-for="bug in bugs" :key="bug.id" class="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <div class="p-4 sm:p-5">
          <div class="flex items-start justify-between gap-3">
            <div class="flex-1 min-w-0">
              <div class="font-bold text-sm text-foreground truncate">{{ bug.title || bug.body?.slice(0, 80) || '无标题' }}</div>
              <div class="text-xs text-slate-400 mt-1">
                <span>{{ bug.project_name }}</span>
                <span v-if="bug.actor_username"> · {{ bug.actor_username }}</span>
                <span> · {{ formatTime(bug.created_at) }}</span>
              </div>
            </div>
            <Badge :variant="getStatusConfig(badgeStatus(bug.status)).variant" :class="getStatusConfig(badgeStatus(bug.status)).class">
              {{ badgeLabel(bug.status) || getStatusConfig(badgeStatus(bug.status)).label }}
            </Badge>
          </div>
          <p v-if="bug.body && bug.title" class="text-xs text-muted-foreground mt-2 line-clamp-2">{{ bug.body }}</p>
          <div class="flex items-center gap-2 mt-3">
            <select
              :value="bug.status"
              @change="updateBugStatus(bug.id, ($event.target as HTMLSelectElement).value)"
              class="text-xs px-2 py-2 min-h-[44px] rounded-lg border border-border bg-card outline-none"
            >
              <option value="open">待处理</option>
              <option value="doing">处理中</option>
              <option value="done">已完成</option>
              <option value="closed">已关闭</option>
            </select>
            <button @click="openReply(bug)" class="text-xs px-3 py-2 min-h-[44px] rounded-lg bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 font-medium hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-colors">
              回复
            </button>
          </div>
        </div>
      </div>
    </div>

    <Pagination :page="page" :total="Math.ceil(total / 20)" :items-per-page="1" :sibling-count="1" @update:page="page = $event">
      <PaginationList v-slot="{ items }" class="flex items-center gap-1">
        <PaginationPrev />
        <template v-for="(item, index) in items" :key="index">
          <PaginationListItem v-if="item.type === 'page'" :value="item.value" as-child>
            <Button variant="outline" class="w-9 h-9" :class="item.value === page ? 'bg-[var(--color-brand-500)] text-white border-[var(--color-brand-500)]' : ''">{{ item.value }}</Button>
          </PaginationListItem>
          <PaginationEllipsis v-else :index="index" />
        </template>
        <PaginationNext />
      </PaginationList>
    </Pagination>

    <Dialog v-model:open="showReplyModal">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>回复 Bug</DialogTitle>
        </DialogHeader>
        <div class="space-y-4">
          <textarea v-model="replyBody" rows="4" class="w-full px-4 py-3 rounded-xl border border-border bg-card outline-none focus:border-blue-500 resize-none text-base" placeholder="输入回复内容"></textarea>
          <div class="flex gap-3">
            <button @click="submitReply" :disabled="isReplying || !replyBody.trim()" class="flex-1 px-4 py-3 min-h-[48px] rounded-2xl bg-blue-500 hover:bg-blue-600 text-white font-bold transition-colors disabled:opacity-50">
              {{ isReplying ? '提交中...' : '提交回复' }}
            </button>
            <button @click="showReplyModal = false" class="flex-1 px-4 py-3 min-h-[48px] rounded-2xl bg-secondary text-foreground font-bold hover:bg-accent transition-colors">
              取消
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { adminFetch, formatAdminError } from '../../composables/useAdminFetch';
import { API } from '../../api/endpoints';
import { Bug } from 'lucide-vue-next';
import { LoadingSpinner as uiLoadingSpinner, EmptyState as uiEmptyState } from '../../components/ui';
import { Badge, getStatusConfig } from '../../components/ui/badge';
import { Pagination, PaginationList, PaginationListItem, PaginationPrev, PaginationNext, PaginationEllipsis } from '../../components/ui/pagination';
import { Button } from '../../components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const bugs = ref<any[]>([]);
const page = ref(1);
const pageSize = ref(20);
const total = ref(0);
const loading = ref(true);
const filterStatus = ref('');
const filterProject = ref('');
const projectNames = ref<string[]>([]);

const showReplyModal = ref(false);
const replyBugId = ref('');
const replyBody = ref('');
const isReplying = ref(false);

const formatTime = (v: string) => {
  try {
    const d = new Date(v);
    if (isNaN(d.getTime())) return v;
    return d.toLocaleString('zh-CN');
  } catch { return v; }
};

const badgeStatus = (s: string) => {
  const map: Record<string, string> = { doing: 'pending', done: 'resolved' };
  return map[s] ?? s;
};

const badgeLabel = (s: string) => {
  const map: Record<string, string> = { doing: '处理中', done: '已完成' };
  return map[s] ?? undefined;
};

const fetchBugs = async () => {
  loading.value = true;
  try {
    const qs = new URLSearchParams();
    qs.set('kind', 'bug');
    if (filterStatus.value) qs.set('status', filterStatus.value);
    if (filterProject.value) qs.set('project', filterProject.value);
    qs.set('page', String(page.value));
    qs.set('pageSize', String(pageSize.value));
    const res = await adminFetch(`${API.dev.feedback}?${qs.toString()}`);
    if (res.ok) {
      const json = await res.json();
      bugs.value = json.items ?? [];
      total.value = json.total ?? 0;
      const names = new Set<string>();
      for (const b of bugs.value) {
        if (b.project_name) names.add(b.project_name);
      }
      projectNames.value = Array.from(names);
    }
  } catch (e) {
    console.error('Fetch dev bugs error:', e);
  } finally {
    loading.value = false;
  }
};

const updateBugStatus = async (id: string, status: string) => {
  try {
    const res = await adminFetch(API.dev.feedbackDetail(id), {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(formatAdminError(json, '更新失败', res.status));
    await fetchBugs();
  } catch (e: unknown) {
    alert(formatAdminError({ message: e instanceof Error ? e.message : '' }, '更新失败'));
  }
};

const openReply = (bug: any) => {
  replyBugId.value = bug.id;
  replyBody.value = '';
  showReplyModal.value = true;
};

const submitReply = async () => {
  if (!replyBody.value.trim()) return;
  isReplying.value = true;
  try {
    const res = await adminFetch(API.dev.feedbackReplies(replyBugId.value), {
      method: 'POST',
      body: JSON.stringify({ body: replyBody.value }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(formatAdminError(json, '回复失败', res.status));
    showReplyModal.value = false;
    replyBody.value = '';
  } catch (e: unknown) {
    alert(formatAdminError({ message: e instanceof Error ? e.message : '' }, '回复失败'));
  } finally {
    isReplying.value = false;
  }
};

watch(page, fetchBugs);

onMounted(fetchBugs);
</script>
