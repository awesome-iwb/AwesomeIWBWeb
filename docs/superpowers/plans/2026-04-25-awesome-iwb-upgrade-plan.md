# Awesome IWB Full Upgrade Plan

**Goal:** Transform the Awesome IWB project into a fully-featured, multi-page web application with an automated submission process, advanced search/discovery, dark mode, PWA support, and a robust Elysia.js/Bun backend API.

**Architecture:** 
The application will shift from a thick-client approach (where the frontend fetches all data once) to a more balanced architecture utilizing the Elysia.js backend. 
- **Backend (Bun + Elysia):** Expand to serve individual project data, aggregate statistics, and handle GitHub Issue/PR submissions via the GitHub REST API.
- **Frontend (Vue 3 + Tailwind):** Implement dynamic routing, Dark Mode (`class` strategy in Tailwind), PWA via `vite-plugin-pwa`, dynamic SEO meta tags (`@vueuse/head`), and advanced reactive filtering for the Home view.

**Tech Stack:** Bun, Elysia.js, Vue 3, Vue Router, Tailwind CSS, Vite PWA, @vueuse/head.

---

### Task 1: Backend API Expansion (Elysia & Bun)

**Files:**
- Modify: `backend/src/index.ts`
- Modify: `frontend/src/composables/useProjects.ts`
- Modify: `frontend/src/views/ProjectDetailView.vue`

- [ ] **Step 1: Expand Elysia Endpoints**
  Update `backend/src/index.ts` to provide specific endpoints for single projects and stats.
  ```typescript
  import { Elysia } from "elysia";
  import { cors } from '@elysiajs/cors'
  import data from "./data.json";

  const app = new Elysia()
    .use(cors())
    .get("/", () => "Welcome to Awesome-IWB API")
    .get("/api/projects", () => data)
    .get("/api/projects/:name", ({ params: { name }, set }) => {
      const project = data.find(p => p.name.toLowerCase() === name.toLowerCase());
      if (!project) {
        set.status = 404;
        return { error: "Project not found" };
      }
      return project;
    })
    .get("/api/stats", () => {
      const totalProjects = data.length;
      const totalStars = data.reduce((acc, p) => acc + (p.github_stars || 0), 0);
      return { totalProjects, totalStars };
    })
    .listen(8080);

  console.log(`🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`);
  ```

- [ ] **Step 2: Update Frontend Data Fetching**
  Modify `useProjects.ts` to utilize the new `/api/projects/:name` endpoint for the Detail view, reducing client-side logic.
  ```typescript
  export async function fetchProjectByName(name: string): Promise<Project | null> {
    try {
      const response = await fetch(`http://localhost:8080/api/projects/${encodeURIComponent(name)}`);
      if (!response.ok) return null;
      return await response.json();
    } catch (e) {
      console.error(e);
      return null;
    }
  }
  ```

- [ ] **Step 3: Update ProjectDetailView to use the new API**
  Replace local array filtering with the new `fetchProjectByName` call on component mount.

### Task 2: Visual & UX Upgrade (Dark Mode & PWA)

**Files:**
- Modify: `frontend/index.html`
- Modify: `frontend/tailwind.config.js`
- Modify: `frontend/src/App.vue`
- Modify: `frontend/vite.config.ts`

- [ ] **Step 1: Configure Tailwind Dark Mode**
  In `tailwind.config.js`, add `darkMode: 'class',`.

- [ ] **Step 2: Implement Dark Mode Toggle**
  In `App.vue` (or Navigation component), add a reactive toggle button using `@vueuse/core`'s `useDark` and `useToggle`.
  ```html
  <script setup lang="ts">
  import { useDark, useToggle } from '@vueuse/core'
  const isDark = useDark()
  const toggleDark = useToggle(isDark)
  </script>
  <template>
    <button @click="toggleDark()">Toggle Dark Mode</button>
  </template>
  ```

- [ ] **Step 3: Setup PWA**
  Install `vite-plugin-pwa` in the frontend directory.
  Update `vite.config.ts`:
  ```typescript
  import { VitePWA } from 'vite-plugin-pwa'
  export default defineConfig({
    plugins: [
      vue(),
      VitePWA({
        registerType: 'autoUpdate',
        manifest: {
          name: 'Awesome IWB',
          short_name: 'AIWB',
          theme_color: '#ffffff',
          icons: [{ src: '/favicon.svg', sizes: '192x192', type: 'image/svg+xml' }]
        }
      })
    ]
  })
  ```

### Task 3: Search & Discovery (Advanced Filtering & SEO)

**Files:**
- Modify: `frontend/src/views/HomeView.vue`
- Modify: `frontend/src/main.ts`
- Modify: `frontend/package.json`

- [ ] **Step 1: Advanced Filtering in HomeView**
  Add a sidebar or top filter bar allowing users to filter projects by:
  - Language (Vue, React, Python, etc.)
  - Status (Active, Archived)
  - Has Badges
  Use Vue `computed` properties to chain these filters against the `projects` array.

- [ ] **Step 2: Dynamic SEO Meta Tags**
  Install `@vueuse/head` via `npm install @vueuse/head`.
  In `main.ts`, setup the head manager.
  In `ProjectDetailView.vue`, dynamically set the title and OG meta tags based on the loaded project data.
  ```typescript
  import { useHead } from '@vueuse/head'
  useHead({
    title: computed(() => `${project.value?.name || 'Loading'} - Awesome IWB`),
    meta: [
      { name: 'description', content: computed(() => project.value?.description) },
      { property: 'og:title', content: computed(() => project.value?.name) },
      { property: 'og:image', content: computed(() => project.value?.banner_url || project.value?.icon_url) }
    ]
  })
  ```

### Task 4: Automated Submission Process (Submit App API)

**Files:**
- Create: `frontend/src/views/SubmitView.vue`
- Modify: `frontend/src/router/index.ts`
- Modify: `backend/src/index.ts`
- Modify: `backend/package.json`

- [ ] **Step 1: Frontend Submit Form**
  Create a form in `SubmitView.vue` to collect `Project Name`, `GitHub URL`, `Description`, and `Author`. POST this data to `http://localhost:8080/api/submit`. Add a navigation link to this route.

- [ ] **Step 2: Backend Submission Handler**
  Install `@octokit/rest` in `backend`.
  Update `backend/src/index.ts` to handle the `POST /api/submit` endpoint.
  ```typescript
  import { Octokit } from "@octokit/rest";
  // Requires GITHUB_TOKEN in backend/.env
  const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

  app.post("/api/submit", async ({ body, set }) => {
    try {
      const { name, url, description, author } = body as any;
      const issueBody = `### New Project Submission\n\n**Name:** ${name}\n**URL:** ${url}\n**Description:** ${description}\n**Author:** ${author}\n\nPlease review and add to data.json.`;
      
      const response = await octokit.rest.issues.create({
        owner: "your-github-username", // To be configured
        repo: "awesome-iwb",
        title: `[Submission] ${name}`,
        body: issueBody,
        labels: ["new-project"]
      });
      
      return { success: true, issueUrl: response.data.html_url };
    } catch (e: any) {
      set.status = 500;
      return { error: e.message };
    }
  });
  ```

- [ ] **Step 3: Integrate into Router**
  Add `/submit` route in `frontend/src/router/index.ts`.
