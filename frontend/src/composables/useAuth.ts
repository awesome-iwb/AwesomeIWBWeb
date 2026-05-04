import { computed, ref } from 'vue';

type AuthRole = 'user' | 'dev' | 'ops';

export type AuthUser = {
  name: string;
  avatarUrl: string;
  role: AuthRole;
  stcn_user_id: string;
  sectl_user_id: string;
  lincube_user_id: string;
};

const STORAGE_KEY = 'awesome_iwb_auth';

const user = ref<AuthUser | null>(null);
const ready = ref(false);

const loadOnce = () => {
  if (ready.value) return;
  ready.value = true;
  if (typeof window === 'undefined') return;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    user.value = JSON.parse(raw) as AuthUser;
  } catch {
    user.value = null;
  }
};

const persist = () => {
  if (typeof window === 'undefined') return;
  try {
    if (!user.value) {
      window.localStorage.removeItem(STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(user.value));
  } catch {}
};

export const useAuth = () => {
  loadOnce();

  const isAuthenticated = computed(() => Boolean(user.value));

  const loginDemo = (input?: Partial<AuthUser>) => {
    const next: AuthUser = {
      name: input?.name ?? '演示用户',
      avatarUrl: input?.avatarUrl ?? '/assets/people/placeholder.svg',
      role: input?.role ?? 'user',
      stcn_user_id: input?.stcn_user_id ?? '',
      sectl_user_id: input?.sectl_user_id ?? '',
      lincube_user_id: input?.lincube_user_id ?? ''
    };
    user.value = next;
    persist();
  };

  const setRole = (role: AuthRole) => {
    if (!user.value) return;
    user.value = { ...user.value, role };
    persist();
  };

  const updateUser = (partial: Partial<AuthUser>) => {
    if (!user.value) return;
    user.value = { ...user.value, ...partial };
    persist();
  };

  const logout = () => {
    user.value = null;
    persist();
  };

  return { user, isAuthenticated, loginDemo, logout, setRole, updateUser };
};
