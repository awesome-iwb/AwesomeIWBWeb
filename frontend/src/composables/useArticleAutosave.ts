import { ref, watch, computed, type Ref } from 'vue';
import { useDebounceFn } from '@vueuse/core';
import { onBeforeRouteLeave } from 'vue-router';
import { adminFetch, formatAdminError } from './useAdminFetch';

export type ArticleSaveStatus = 'idle' | 'saving' | 'saved' | 'error' | 'dirty' | 'conflict';

export function useArticleAutosave<T extends Record<string, unknown>>(
  articleId: Ref<string>,
  draft: Ref<T>,
  detailUrl: (id: string) => string,
) {
  const saveStatus = ref<ArticleSaveStatus>('idle');
  const saveError = ref('');
  const serverSnapshot = ref('');
  const serverVersion = ref(1);
  const conflictServerData = ref<T | null>(null);

  const isDirty = computed(() => JSON.stringify(draft.value) !== serverSnapshot.value);

  function syncSnapshot() {
    serverSnapshot.value = JSON.stringify(draft.value);
    if ((draft.value as any).version !== undefined) {
      serverVersion.value = (draft.value as any).version;
    }
    saveStatus.value = 'saved';
  }

  async function saveNow(): Promise<boolean> {
    if (!articleId.value) return false;
    if (!isDirty.value) {
      saveStatus.value = 'saved';
      return true;
    }
    saveStatus.value = 'saving';
    saveError.value = '';
    try {
      const payload = { ...draft.value, expectedVersion: serverVersion.value };
      const res = await adminFetch(detailUrl(articleId.value), {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      if (res.status === 409) {
        const json = await res.json().catch(() => ({}));
        const serverArticle = json?.error?.serverArticle ?? json?.serverArticle ?? null;
        conflictServerData.value = serverArticle as T | null;
        saveStatus.value = 'conflict';
        saveError.value = '文章已被他人修改，请选择覆盖或放弃本地修改';
        return false;
      }
      if (!res.ok) {
        throw new Error(formatAdminError(await res.json().catch(() => ({})), '保存失败', res.status));
      }
      const updated = (await res.json()) as T;
      Object.assign(draft.value, updated);
      syncSnapshot();
      conflictServerData.value = null;
      return true;
    } catch (e: unknown) {
      saveStatus.value = 'error';
      saveError.value = e instanceof Error ? e.message : '保存失败';
      return false;
    }
  }

  function resolveConflict(strategy: 'overwrite' | 'discard'): boolean {
    if (saveStatus.value !== 'conflict') return false;

    if (strategy === 'discard' && conflictServerData.value) {
      Object.assign(draft.value, conflictServerData.value);
      syncSnapshot();
    } else if (strategy === 'overwrite' && conflictServerData.value) {
      (draft.value as any).version = (conflictServerData.value as any).version;
      serverVersion.value = (conflictServerData.value as any).version;
      conflictServerData.value = null;
      saveStatus.value = 'dirty';
      void saveNow();
      return true;
    }

    conflictServerData.value = null;
    return true;
  }

  const debouncedSave = useDebounceFn(() => {
    if (isDirty.value && saveStatus.value !== 'conflict') void saveNow();
  }, 2000);

  watch(
    draft,
    () => {
      if (saveStatus.value === 'conflict') return;
      if (JSON.stringify(draft.value) !== serverSnapshot.value) {
        if (saveStatus.value !== 'saving') saveStatus.value = 'dirty';
        debouncedSave();
      }
    },
    { deep: true },
  );

  onBeforeRouteLeave((_to, _from, next) => {
    if (saveStatus.value === 'conflict') {
      if (window.confirm('存在未解决的冲突，确定离开？')) next();
      else next(false);
      return;
    }
    if (isDirty.value) {
      if (window.confirm('有未保存的更改，确定离开？')) next();
      else next(false);
      return;
    }
    next();
  });

  return { saveStatus, saveError, isDirty, saveNow, syncSnapshot, serverVersion, conflictServerData, resolveConflict };
}
