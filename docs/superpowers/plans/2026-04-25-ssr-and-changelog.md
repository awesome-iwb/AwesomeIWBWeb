# Release Fetching & Vite SSG Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatically fetch GitHub releases for all projects and migrate the frontend to Vite SSG for SEO optimization.

**Architecture:** 
1. The Python backend script `update_github_stats.py` will fetch up to 5 recent releases/tags for each GitHub project and save them to `data.json`.
2. The Vue frontend will be migrated to `vite-ssg` to statically generate HTML files for all routes (including dynamic project detail pages) at build time.
3. The `ProjectDetailView.vue` will display the latest release with changelog and a timeline of previous releases.

**Tech Stack:** Python (PyGithub), Vue 3, Vite SSG, Tailwind CSS, markdown-it

---

### Task 1: Backend - Fetch GitHub Releases

**Files:**
- Modify: `backend/src/update_github_stats.py`

- [ ] **Step 1: Add release fetching logic to Python script**
Modify `update_github_stats.py` to fetch releases for each repository.

```python
# In update_github_stats.py, inside the process_project function, after fetching basic repo info:
def get_recent_releases(repo):
    try:
        releases = repo.get_releases()
        release_data = []
        count = 0
        for release in releases:
            if count >= 5:
                break
            release_data.append({
                "tag_name": release.tag_name,
                "published_at": release.published_at.isoformat() if release.published_at else None,
                "body": release.body or "",
                "html_url": release.html_url
            })
            count += 1
            
        # Fallback to tags if no releases exist
        if not release_data:
            tags = repo.get_tags()
            count = 0
            for tag in tags:
                if count >= 5:
                    break
                # Try to get commit date for the tag
                try:
                    commit = repo.get_commit(tag.commit.sha)
                    date = commit.commit.author.date.isoformat()
                except:
                    date = None
                    
                release_data.append({
                    "tag_name": tag.name,
                    "published_at": date,
                    "body": "", # Tags usually don't have rich bodies like releases
                    "html_url": f"https://github.com/{repo.full_name}/releases/tag/{tag.name}"
                })
                count += 1
                
        return release_data
    except Exception as e:
        print(f"Error fetching releases for {repo.full_name}: {e}")
        return []

# Then assign it to the project object:
# project['releases'] = get_recent_releases(repo)
```

- [ ] **Step 2: Run the script to verify data.json updates**
Run: `cd backend/src && python update_github_stats.py`
Verify that `backend/src/data.json` now contains a `releases` array for GitHub projects.

- [ ] **Step 3: Update TypeScript Interface**
Modify `frontend/src/composables/useProjects.ts` to include the new data type.

```typescript
export interface Release {
  tag_name: string;
  published_at: string;
  body: string;
  html_url: string;
}

export interface Project {
  // ... existing fields ...
  releases?: Release[];
}
```

- [ ] **Step 4: Commit**
```bash
git add backend/src/update_github_stats.py frontend/src/composables/useProjects.ts backend/src/data.json
git commit -m "feat(backend): fetch recent GitHub releases and update interfaces"
```

---

### Task 2: Frontend - Install Dependencies and Setup SSG

**Files:**
- Modify: `frontend/package.json`
- Modify: `frontend/vite.config.ts`
- Modify: `frontend/src/main.ts`

- [ ] **Step 1: Install vite-ssg and markdown renderer**
```bash
cd frontend
npm install vite-ssg markdown-it dompurify
npm install -D @types/markdown-it @types/dompurify
```

- [ ] **Step 2: Update vite.config.ts for SSG**
Modify `vite.config.ts` to configure SSG options.

```typescript
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'
import fs from 'fs'

// Read projects to generate dynamic routes
const data = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../backend/src/data.json'), 'utf-8'));
const projectRoutes = data.categories.flatMap((c: any) => 
  c.projects.map((p: any) => `/project/${encodeURIComponent(p.name)}`)
);

export default defineConfig({
  plugins: [
    vue(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Awesome IWB',
        short_name: 'AIWB',
        theme_color: '#0B1120',
        icons: [{ src: '/favicon.svg', sizes: '192x192', type: 'image/svg+xml' }]
      }
    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8080',
        changeOrigin: true
      }
    }
  },
  // @ts-ignore
  ssgOptions: {
    script: 'async',
    formatting: 'minify',
    includedRoutes(paths: string[]) {
      return paths.filter(i => !i.includes('/:name')).concat(projectRoutes);
    },
  },
})
```

- [ ] **Step 3: Update main.ts to use ViteSSG**

```typescript
import { ViteSSG } from 'vite-ssg'
import { createHead } from '@vueuse/head'
import App from './App.vue'
import { routes } from './router'
import './assets/index.css'

export const createApp = ViteSSG(
  App,
  { routes },
  ({ app, router, routes, isClient, initialState }) => {
    const head = createHead()
    app.use(head)
  }
)
```

- [ ] **Step 4: Update package.json scripts**
Change `"build": "vue-tsc -b && vite build"` to `"build": "vue-tsc -b && vite-ssg build"`.

- [ ] **Step 5: Commit**
```bash
git add frontend/package.json frontend/package-lock.json frontend/vite.config.ts frontend/src/main.ts
git commit -m "build(frontend): configure vite-ssg for static site generation"
```

---

### Task 3: Frontend - Data Fetching Refactor for SSG

SSG requires data to be available at build time, so relying on dynamic `/api` calls during component mount will result in empty HTML.

**Files:**
- Modify: `frontend/src/composables/useProjects.ts`
- Modify: `frontend/src/views/GlobalGraphView.vue`

- [ ] **Step 1: Refactor useProjects.ts to import JSON directly**

```typescript
import { ref, computed } from 'vue';
import dataJson from '../../../backend/src/data.json';

// ... interfaces ...

// Initialize directly with static data
const categories = ref<Category[]>(dataJson.categories as Category[]);
const loading = ref(false);
const initialized = ref(true);

export function useProjects() {
  const fetchProjects = async () => {
    // No-op since data is already loaded statically
    loading.value = false;
  };

  const allProjects = computed(() => {
    return categories.value.reduce((acc, cat) => acc.concat(cat.projects), [] as Project[]);
  });

  const fetchProjectByName = async (name: string): Promise<Project | null> => {
    return allProjects.value.find(p => p.name.toLowerCase() === name.toLowerCase()) || null;
  };

  const fetchStats = async () => {
    const totalProjects = categories.value.reduce((acc, cat) => acc + cat.projects.length, 0);
    const totalStars = categories.value.reduce((acc, cat) => {
      return acc + cat.projects.reduce((sum, p) => sum + (p.stars || 0), 0);
    }, 0);
    return { totalProjects, totalStars };
  };

  return {
    categories,
    allProjects,
    loading,
    fetchProjects,
    fetchProjectByName,
    fetchStats
  };
}
```

- [ ] **Step 2: Wrap Client-Only components (ECharts)**
In `GlobalGraphView.vue` and `ProjectLineageGraph.vue`, wrap `<VChart>` with `<ClientOnly>` to prevent SSG hydration errors.

```vue
<!-- In GlobalGraphView.vue and ProjectLineageGraph.vue -->
<ClientOnly>
  <VChart class="w-full h-full absolute inset-0" :option="option" autoresize @click="handleChartClick" />
</ClientOnly>
```

- [ ] **Step 3: Commit**
```bash
git add frontend/src/composables/useProjects.ts frontend/src/views/GlobalGraphView.vue frontend/src/components/ProjectLineageGraph.vue
git commit -m "refactor(frontend): use static data import and ClientOnly for SSG compatibility"
```

---

### Task 4: Frontend - Implement Changelog UI

**Files:**
- Modify: `frontend/src/views/ProjectDetailView.vue`

- [ ] **Step 1: Setup markdown-it and DOMPurify**
In `ProjectDetailView.vue`:
```typescript
import MarkdownIt from 'markdown-it';
import DOMPurify from 'dompurify';
import { History, ArrowRight } from 'lucide-vue-next'; // Add new icons

const md = new MarkdownIt({ breaks: true, linkify: true });

const renderMarkdown = (text: string) => {
  if (!text) return '';
  return DOMPurify.sanitize(md.render(text));
};

// ... inside computed or methods
const latestRelease = computed(() => project.value?.releases?.[0]);
const historyReleases = computed(() => project.value?.releases?.slice(1) || []);
```

- [ ] **Step 2: Add "What's New" Section**
Add the UI between the "About" and "Lineage Graph" sections:

```vue
<!-- What's New (Releases) -->
<section v-if="project.releases && project.releases.length > 0">
  <h2 class="text-2xl font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
    <History class="w-6 h-6 text-emerald-500" /> 最近更新
  </h2>
  
  <!-- Latest Release -->
  <div v-if="latestRelease" class="bg-white dark:bg-[#111827] rounded-3xl p-6 border border-slate-200/80 dark:border-slate-800/80 shadow-sm mb-6">
    <div class="flex items-center justify-between mb-4">
      <div class="flex items-center gap-3">
        <span class="px-3 py-1 bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 rounded-lg font-bold text-sm">
          {{ latestRelease.tag_name }}
        </span>
        <span class="text-slate-500 text-sm" v-if="latestRelease.published_at">
          发布于 {{ formatDate(latestRelease.published_at) }}
        </span>
      </div>
      <a :href="latestRelease.html_url" target="_blank" class="text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 text-sm font-medium flex items-center gap-1">
        查看完整日志 <ArrowRight class="w-4 h-4" />
      </a>
    </div>
    
    <div class="prose prose-sm prose-slate dark:prose-invert max-w-none max-h-60 overflow-y-auto custom-scrollbar pr-2" v-if="latestRelease.body">
      <div v-html="renderMarkdown(latestRelease.body)"></div>
    </div>
    <div v-else class="text-slate-500 italic text-sm">
      该版本没有提供详细的更新日志。
    </div>
  </div>

  <!-- Historical Timeline -->
  <div v-if="historyReleases.length > 0" class="pl-4 border-l-2 border-slate-200 dark:border-slate-800 space-y-6">
    <div v-for="release in historyReleases" :key="release.tag_name" class="relative">
      <div class="absolute -left-[21px] top-1.5 w-3 h-3 bg-slate-200 dark:bg-slate-700 border-2 border-white dark:border-[#0B1120] rounded-full"></div>
      <div class="flex items-center gap-3 mb-1">
        <a :href="release.html_url" target="_blank" class="font-bold text-slate-700 dark:text-slate-300 hover:text-emerald-600 transition-colors">
          {{ release.tag_name }}
        </a>
        <span class="text-slate-400 text-xs" v-if="release.published_at">{{ formatDate(release.published_at) }}</span>
      </div>
    </div>
  </div>
</section>
```

- [ ] **Step 3: Run Build to Verify SSG**
Run `npm run build` and ensure HTML files are generated in `dist/project/` without errors.

- [ ] **Step 4: Commit**
```bash
git add frontend/src/views/ProjectDetailView.vue
git commit -m "feat(frontend): add changelog UI and release timeline"
```