<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <h2 class="text-lg font-bold text-foreground">创建组织</h2>
    </div>

    <div class="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
      <div class="p-4 sm:p-6 space-y-4">
        <div>
          <label class="block text-sm font-bold text-muted-foreground mb-2">组织名称 <span class="text-rose-500">*</span></label>
          <input type="text" v-model="form.name" @input="autoSlug" class="w-full px-4 py-3 sm:py-2.5 rounded-xl border border-border bg-card outline-none focus:border-blue-500 text-base sm:text-sm min-h-[48px]" placeholder="输入组织名称" />
        </div>
        <div>
          <label class="block text-sm font-bold text-muted-foreground mb-2">Slug（自动生成，可手动修改）</label>
          <input type="text" v-model="form.slug" class="w-full px-4 py-3 sm:py-2.5 rounded-xl border border-border bg-card outline-none focus:border-blue-500 text-base sm:text-sm min-h-[48px]" placeholder="organization-slug" />
        </div>
        <div>
          <label class="block text-sm font-bold text-muted-foreground mb-2">描述</label>
          <textarea v-model="form.description" rows="3" class="w-full px-4 py-3 sm:py-2.5 rounded-xl border border-border bg-card outline-none focus:border-blue-500 resize-none text-base sm:text-sm"></textarea>
        </div>
        <div>
          <label class="block text-sm font-bold text-muted-foreground mb-2">网站</label>
          <input type="text" v-model="form.website_url" class="w-full px-4 py-3 sm:py-2.5 rounded-xl border border-border bg-card outline-none focus:border-blue-500 text-base sm:text-sm min-h-[48px]" placeholder="https://example.com" />
        </div>

        <div v-if="errorMessage" class="p-4 rounded-2xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 text-rose-600 dark:text-rose-400 font-bold text-sm">
          {{ errorMessage }}
        </div>

        <div v-if="successMessage" class="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-bold text-sm">
          {{ successMessage }}
        </div>

        <div class="flex gap-3">
          <button @click="submitCreate" :disabled="isSubmitting || !form.name.trim()" class="flex-1 px-4 py-3 min-h-[48px] rounded-2xl bg-blue-500 hover:bg-blue-600 text-white font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            {{ isSubmitting ? '提交中...' : '提交申请' }}
          </button>
          <router-link to="/dev/organizations" class="flex-1 px-4 py-3 min-h-[48px] rounded-2xl bg-secondary text-foreground font-bold hover:bg-accent transition-colors text-center inline-flex items-center justify-center">
            返回
          </router-link>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { adminFetch, formatAdminError } from '../../composables/useAdminFetch';
import { API } from '../../api/endpoints';

const router = useRouter();

const form = ref({
  name: '',
  slug: '',
  description: '',
  website_url: '',
});
const isSubmitting = ref(false);
const errorMessage = ref('');
const successMessage = ref('');

const autoSlug = () => {
  form.value.slug = form.value.name
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
};

const submitCreate = async () => {
  if (!form.value.name.trim()) return;
  isSubmitting.value = true;
  errorMessage.value = '';
  successMessage.value = '';
  try {
    const res = await adminFetch(API.dev.organizations, {
      method: 'POST',
      body: JSON.stringify(form.value),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(formatAdminError(json, '创建失败', res.status));
    successMessage.value = '组织创建成功！请等待运维审核通过后即可使用。';
    setTimeout(() => {
      router.push('/dev/organizations');
    }, 2000);
  } catch (e: unknown) {
    errorMessage.value = formatAdminError({ message: e instanceof Error ? e.message : '' }, '创建失败');
  } finally {
    isSubmitting.value = false;
  }
};
</script>
