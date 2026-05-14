import { ref, computed } from 'vue';
import { readJsonOrThrow, useApi } from './useApi';

export interface Release {
  tag_name: string;
  published_at: string | null;
  body: string;
  html_url: string;
}

export interface Relation {
  target: string;
  type: 'fork' | 'plugin' | 'inspired' | 'alternative';
}

/**
 * Canonical project type used by the frontend.
 *
 * Notes:
 * - `ai_usage_state` is a stable tri-state used by the project detail "reCAPTCHA-style" badge.
 * - `recommendation` may be a string (JSON mode) or array (DB mode / normalized payloads).
 */
export interface Project {
  id?: string;
  slug?: string;
  name: string;
  developer: string;
  organization?: string;
  status: string;
  recommendation: string;
  is_editors_choice?: boolean;
  github_url: string;
  avatar?: string;
  icon?: string;
  banner?: string;
  description: string;
  keywords: string[];
  ai_usage_state?: 'unknown' | 'over50' | 'under50';
  ai_generated?: boolean;
  human_verified?: boolean;
  reviews?: { author: string; content: string }[];
  stars?: number;
  version?: string;
  last_update?: string;
  language?: string;
  github_is_fork?: boolean;
  github_parent_url?: string;
  github_source_url?: string;
  relations?: Relation[];
  releases?: Release[];
  extra?: any;
}

export interface Category {
  id: string;
  name: string;
  description: string;
  projects: Project[];
}

const categories = ref<Category[]>([]);
const loading = ref(true);
const PROJECTS_TTL_MS = 120000;
const lastFetchedAt = ref(0);

export function useProjects() {
  const { apiFetch } = useApi();
  const normalizeProject = (p: any): Project => {
    const recommendationRaw = p?.recommendation;
    let recommendation = '';
    if (Array.isArray(recommendationRaw) && recommendationRaw.length > 0) {
      recommendation = String(recommendationRaw[0]).trim();
    } else if (typeof recommendationRaw === 'string') {
      recommendation = recommendationRaw.trim();
    }
    const isEditorsChoice = Boolean(p?.is_editors_choice ?? p?.extra?.is_editors_choice ?? false);
    return {
      ...p,
      status: String(p?.status ?? ''),
      recommendation,
      is_editors_choice: isEditorsChoice,
      keywords: Array.isArray(p?.keywords) ? p.keywords : [],
      description: String(p?.description ?? ''),
      developer: String(p?.developer ?? ''),
      github_url: String(p?.github_url ?? ''),
      organization: p?.organization || p?.extra?.feishu?.organization || ''
    } as Project;
  };

  /**
   * Fetch the full catalog used by the homepage.
   *
   * Endpoint: GET /api/projects
   * Payload shape: { categories: Category[] }
   */
  const fetchProjects = async (force = false) => {
    if (!force && categories.value.length > 0 && Date.now() - lastFetchedAt.value < PROJECTS_TTL_MS) {
      return;
    }

    loading.value = true;
    try {
      const res = await apiFetch('/api/projects', { method: 'GET' });
      const json = await readJsonOrThrow<{ categories?: Array<any> }>(res);
      categories.value = (json.categories ?? []).map((c: any) => ({
        ...c,
        projects: (c.projects ?? []).map(normalizeProject)
      })) as Category[];
      lastFetchedAt.value = Date.now();
    } catch (e) {
      console.error(e);
    } finally {
      loading.value = false;
    }
  };

  const allProjects = computed(() => {
    return categories.value.reduce((acc, cat) => acc.concat(cat.projects), [] as Project[]);
  });

  /**
   * Fetch a single project by name (or slug depending on backend mode).
   *
   * Endpoint: GET /api/projects/:name
   * Fallback: resolve from the already-loaded catalog when network fetch fails.
   */
  const fetchProjectByName = async (name: string): Promise<Project | null> => {
    try {
      const res = await apiFetch(`/api/projects/${encodeURIComponent(name)}`, { method: 'GET' });
      const project = await readJsonOrThrow<any>(res);
      return normalizeProject(project);
    } catch {
      return allProjects.value.find(p => p.name.toLowerCase() === name.toLowerCase()) || null;
    }
  };

  /**
   * Fetch lightweight global stats for the hero section.
   *
   * Endpoint: GET /api/stats
   * Fallback: compute from the current catalog when the endpoint is unavailable.
   */
  const fetchStats = async () => {
    try {
      const res = await apiFetch('/api/stats', { method: 'GET' });
      return await readJsonOrThrow<any>(res);
    } catch {
      const totalProjects = categories.value.reduce((acc, cat) => acc + cat.projects.length, 0);
      const totalStars = categories.value.reduce((acc, cat) => {
        return acc + cat.projects.reduce((sum, p) => sum + (p.stars || 0), 0);
      }, 0);
      return { totalProjects, totalStars };
    }
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
