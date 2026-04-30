import { ref, computed } from 'vue';

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
  status?: string;
  recommendation?: string | string[];
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
}

export interface Category {
  id: string;
  name: string;
  description: string;
  projects: Project[];
}

const categories = ref<Category[]>([]);
const loading = ref(true);

export function useProjects() {
  /**
   * Fetch the full catalog used by the homepage.
   *
   * Endpoint: GET /api/projects
   * Payload shape: { categories: Category[] }
   */
  const fetchProjects = async () => {
    loading.value = true;
    try {
      const res = await fetch('/api/projects');
      if (!res.ok) throw new Error('Failed to fetch projects');
      const json = await res.json();
      categories.value = (json.categories ?? []) as Category[];
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
      const res = await fetch(`/api/projects/${encodeURIComponent(name)}`);
      if (!res.ok) return null;
      return (await res.json()) as Project;
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
    const res = await fetch('/api/stats');
    if (!res.ok) {
      const totalProjects = categories.value.reduce((acc, cat) => acc + cat.projects.length, 0);
      const totalStars = categories.value.reduce((acc, cat) => {
        return acc + cat.projects.reduce((sum, p) => sum + (p.stars || 0), 0);
      }, 0);
      return { totalProjects, totalStars };
    }
    return await res.json();
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
