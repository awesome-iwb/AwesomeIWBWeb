<script setup lang="ts">
import { contributors } from '../content/contributors.generated';
import { operations as operationsTeam } from '../content/ops.generated';
import { thanks as thanksTeam } from '../content/thanks.generated';
import { friendLinks } from '../content/friendLinks';

type Member = {
  key: string;
  name: string;
  role: string;
  href?: string;
  linkLabel?: string;
  avatar: string;
};

const placeholderAvatar = '/assets/people/placeholder.svg';

const linkLabelFor = (href: string, fallback: string) => {
  if (href.includes('github.com/')) return `@${fallback}`;
  try {
    return new URL(href).hostname;
  } catch {
    return href;
  }
};

const operations: Member[] =
  operationsTeam.length === 4
    ? operationsTeam.map((m) => ({
        key: m.key,
        name: m.name,
        role: '运营组',
        href: m.href,
        linkLabel: linkLabelFor(m.href, m.key),
        avatar: m.avatar || placeholderAvatar
      }))
    : Array.from({ length: 4 }).map((_, idx) => ({
        key: `ops${idx + 1}`,
        name: '待加入',
        role: '',
        avatar: placeholderAvatar
      }));

const thanks: Member[] =
  thanksTeam.length === 2
    ? thanksTeam.map((m) => ({
        key: m.key,
        name: m.name,
        role: m.role,
        href: m.href,
        linkLabel: linkLabelFor(m.href, m.key),
        avatar: m.avatar || placeholderAvatar
      }))
    : Array.from({ length: 2 }).map((_, idx) => ({
        key: `thanks${idx + 1}`,
        name: '待加入',
        role: '',
        avatar: placeholderAvatar
      }));

const contributorMembers: Member[] = contributors.map((c) => ({
  key: c.key,
  name: c.name,
  role: '贡献者',
  href: c.href,
  linkLabel: linkLabelFor(c.href, c.key),
  avatar: c.avatar || placeholderAvatar
}));

const excludedContributorKeys = new Set(
  [...operationsTeam, ...thanksTeam].map((m) => String(m.key ?? "").trim().toLowerCase()).filter(Boolean)
);
const displayContributors = contributorMembers.filter((c) => !excludedContributorKeys.has(String(c.key).toLowerCase()));
</script>

<template>
  <div class="min-h-screen bg-[#F8FAFC] dark:bg-[#0B1120] text-slate-900 dark:text-slate-100 font-sans pb-20">
    <main class="pt-24 px-4 sm:px-6 w-full max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out-expo">
      <div class="mb-12">
        <h1 class="text-4xl md:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-white mb-4">关于我们</h1>
        <p class="text-lg text-slate-600 dark:text-slate-300 leading-relaxed">
          专为广大中小学电教打造的班级希沃/鸿合等一体机/数字白板/班班通一站式软件推荐清单和实用知识手册，助你在新学期快速上手班级一体机新玩法！<br />
          <span class="font-bold">为广大电教倾情撰写，让班级大屏更好用！</span>
        </p>
      </div>

      <section class="bg-white/60 dark:bg-slate-900/30 backdrop-blur-md border border-white/70 dark:border-slate-800/70 rounded-3xl p-8 mb-8">
        <h2 class="text-2xl font-extrabold text-slate-900 dark:text-white mb-6">运营组</h2>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <a
            v-for="m in operations"
            :key="m.key"
            :href="m.href || '#'"
            target="_blank"
            rel="noopener noreferrer"
            class="group flex items-center gap-4 p-5 rounded-2xl border border-slate-200/70 dark:border-slate-800/70 bg-white/70 dark:bg-slate-950/30 hover:bg-white dark:hover:bg-slate-950/40 transition-colors"
          >
            <img :src="m.avatar" :alt="m.name" class="h-12 w-12 rounded-full bg-slate-200/70 dark:bg-slate-700/70 shrink-0 object-cover" @error="(e) => { (e.target as HTMLImageElement).src = placeholderAvatar }" />
            <div class="min-w-0">
              <div class="text-base font-extrabold text-slate-800 dark:text-slate-100 line-clamp-1">{{ m.name }}</div>
              <div class="text-sm text-slate-500 dark:text-slate-400 line-clamp-1">{{ m.role }}</div>
              <div class="text-sm text-emerald-600 dark:text-emerald-400 line-clamp-1">{{ m.linkLabel }}</div>
            </div>
          </a>
        </div>
      </section>

      <section class="bg-white/60 dark:bg-slate-900/30 backdrop-blur-md border border-white/70 dark:border-slate-800/70 rounded-3xl p-8 mb-8">
        <h2 class="text-2xl font-extrabold text-slate-900 dark:text-white mb-6">贡献者</h2>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <a
            v-for="c in displayContributors"
            :key="c.key"
            :href="c.href"
            target="_blank"
            rel="noopener noreferrer"
            class="group flex items-center gap-4 p-5 rounded-2xl border border-slate-200/70 dark:border-slate-800/70 bg-white/70 dark:bg-slate-950/30 hover:bg-white dark:hover:bg-slate-950/40 transition-colors"
          >
            <img :src="c.avatar" :alt="c.name" class="h-12 w-12 rounded-full bg-slate-200/70 dark:bg-slate-700/70 shrink-0 object-cover" @error="(e) => { (e.target as HTMLImageElement).src = placeholderAvatar }" />
            <div class="min-w-0">
              <div class="text-base font-extrabold text-slate-800 dark:text-slate-100 line-clamp-1">{{ c.name }}</div>
              <div class="text-sm text-slate-500 dark:text-slate-400 line-clamp-1">{{ c.role }}</div>
              <div class="text-sm text-emerald-600 dark:text-emerald-400 line-clamp-1">{{ c.linkLabel }}</div>
            </div>
          </a>
        </div>
      </section>

      <section class="bg-white/60 dark:bg-slate-900/30 backdrop-blur-md border border-white/70 dark:border-slate-800/70 rounded-3xl p-8">
        <h2 class="text-2xl font-extrabold text-slate-900 dark:text-white mb-6">感谢</h2>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <a
            v-for="m in thanks"
            :key="m.key"
            :href="m.href || '#'"
            target="_blank"
            rel="noopener noreferrer"
            class="group flex items-center gap-4 p-5 rounded-2xl border border-slate-200/70 dark:border-slate-800/70 bg-white/70 dark:bg-slate-950/30 hover:bg-white dark:hover:bg-slate-950/40 transition-colors"
          >
            <img :src="m.avatar" :alt="m.name" class="h-12 w-12 rounded-full bg-slate-200/70 dark:bg-slate-700/70 shrink-0 object-cover" @error="(e) => { (e.target as HTMLImageElement).src = placeholderAvatar }" />
            <div class="min-w-0">
              <div class="text-base font-extrabold text-slate-800 dark:text-slate-100 line-clamp-1">{{ m.name }}</div>
              <div class="text-sm text-slate-500 dark:text-slate-400 line-clamp-1">{{ m.role }}</div>
              <div class="text-sm text-emerald-600 dark:text-emerald-400 line-clamp-1">{{ m.linkLabel }}</div>
            </div>
          </a>
        </div>
      </section>

      <section class="bg-white/60 dark:bg-slate-900/30 backdrop-blur-md border border-white/70 dark:border-slate-800/70 rounded-3xl p-8 mt-8">
        <h2 class="text-2xl font-extrabold text-slate-900 dark:text-white mb-6">友情链接</h2>
        <div class="flex flex-col gap-4">
          <a
            v-for="l in friendLinks"
            :key="l.key"
            :href="l.href"
            target="_blank"
            rel="noopener noreferrer"
            class="group flex items-start gap-4 p-5 rounded-2xl border border-slate-200/70 dark:border-slate-800/70 bg-white/70 dark:bg-slate-950/30 hover:bg-white dark:hover:bg-slate-950/40 transition-colors"
          >
            <div class="min-w-0">
              <div class="text-base font-extrabold text-slate-800 dark:text-slate-100 line-clamp-1">{{ l.name }}</div>
              <div class="text-sm text-slate-500 dark:text-slate-400 line-clamp-2">{{ l.description }}</div>
              <div class="text-sm text-emerald-600 dark:text-emerald-400 line-clamp-1">{{ linkLabelFor(l.href, l.key) }}</div>
            </div>
          </a>
        </div>
      </section>
    </main>
  </div>
</template>
