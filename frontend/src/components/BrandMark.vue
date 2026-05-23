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
      src="/assets/brand/aiwb-icon.webp"
      alt="Awesome-IWB Icon"
      class="object-contain"
      :class="variant === 'footer' ? 'h-9 w-auto' : 'w-8 h-8'"
    />
    <div :class="variant === 'navbar' ? 'hidden sm:block' : 'block'">
      <img alt="aiwb-logo" src="/assets/brand/fontlogo/aiwb-font-dark.webp" class="h-6 dark:hidden">
      <img alt="aiwb-logo" src="/assets/brand/fontlogo/aiwb-font-white.webp" class="hidden h-6 dark:block">
    </div>
    <span v-if="title && variant === 'navbar'" class="font-bold text-foreground sm:hidden">
      {{ title }}
    </span>
  </div>
</template>
