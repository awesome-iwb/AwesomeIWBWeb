<script setup lang="ts">
type BrandMarkVariant = 'navbar' | 'footer';

defineProps<{
  title?: string;
  variant: BrandMarkVariant;
}>();
</script>

<template>
  <div class="flex items-center gap-3">
    <img
      src="/images/aiwb-icon.webp"
      alt="Awesome-IWB Icon"
      class="object-contain"
      :class="variant === 'footer' ? 'h-9 w-auto' : 'w-8 h-8'"
    />
    <picture :class="variant === 'navbar' ? 'hidden sm:block' : 'block'">
      <source media="(prefers-color-scheme: dark)" srcset="/images/fontlogo/aiwb-font-white.webp">
      <img alt="aiwb-logo" src="/images/fontlogo/aiwb-font-dark.webp" class="h-6">
    </picture>
    <span v-if="title && variant === 'navbar'" class="font-bold text-slate-800 dark:text-slate-200 sm:hidden">
      {{ title }}
    </span>
  </div>
</template>
