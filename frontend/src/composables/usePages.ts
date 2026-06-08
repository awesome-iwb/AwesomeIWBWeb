import { ref } from 'vue';
import { useApi } from './useApi';

export type PageRule = {
  id: string;
  path: string;
  title: string;
  description: string;
  group: string;
  icon: string;
  required_capability: string;
  is_visible: boolean;
  is_enabled: boolean;
  sort_index: number;
  created_at: string;
  updated_at: string;
};

const pages = ref<PageRule[]>([]);
const loaded = ref(false);

export function usePages() {
  const { apiFetch } = useApi();

  const fetchPages = async () => {
    try {
      const res = await apiFetch('/api/pages');
      if (res.ok) {
        const data = await res.json() as { items: PageRule[] };
        pages.value = data.items || [];
        loaded.value = true;
      }
    } catch (e) {
      console.error('Failed to fetch pages config', e);
    }
  };

  return {
    pages,
    loaded,
    fetchPages,
  };
}
