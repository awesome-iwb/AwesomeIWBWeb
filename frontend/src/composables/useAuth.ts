import { computed, ref } from 'vue';

type AuthRole = 'user' | 'dev' | 'ops';

export type AuthUser = {
  id?: string;
  name: string;
  avatarUrl: string;
  role: AuthRole;
  stcn_user_id: string;
  sectl_user_id: string;
  lincube_user_id: string;
  email?: string;
  avatar_url?: string;
};

const STORAGE_KEY = 'awesome_iwb_auth';
const TOKEN_KEY = 'awesome_iwb_token';

const user = ref<AuthUser | null>(null);
const token = ref<string | null>(null);
const ready = ref(false);

const loadOnce = () => {
  if (ready.value) return;
  ready.value = true;
  if (typeof window === 'undefined') return;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) user.value = JSON.parse(raw) as AuthUser;
    const t = window.localStorage.getItem(TOKEN_KEY);
    if (t) token.value = t;
  } catch {
    user.value = null;
    token.value = null;
  }
};

const persist = () => {
  if (typeof window === 'undefined') return;
  try {
    if (!user.value) {
      window.localStorage.removeItem(STORAGE_KEY);
      window.localStorage.removeItem(TOKEN_KEY);
      return;
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(user.value));
    if (token.value) window.localStorage.setItem(TOKEN_KEY, token.value);
  } catch {}
};

export const useAuth = () => {
  loadOnce();

  const isAuthenticated = computed(() => Boolean(user.value && token.value));

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
    token.value = 'demo-token';
    persist();
  };

  const setToken = (newToken: string, newUser?: Partial<AuthUser>) => {
    token.value = newToken;
    if (newUser) {
      user.value = {
        name: newUser.name ?? user.value?.name ?? '',
        avatarUrl: newUser.avatarUrl ?? newUser.avatar_url ?? user.value?.avatarUrl ?? '/assets/people/placeholder.svg',
        role: newUser.role ?? user.value?.role ?? 'user',
        stcn_user_id: newUser.stcn_user_id ?? user.value?.stcn_user_id ?? '',
        sectl_user_id: newUser.sectl_user_id ?? user.value?.sectl_user_id ?? '',
        lincube_user_id: newUser.lincube_user_id ?? user.value?.lincube_user_id ?? '',
        id: newUser.id ?? user.value?.id,
        email: newUser.email ?? user.value?.email,
      };
    }
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
    token.value = null;
    persist();
  };

  const fetchUser = async (): Promise<boolean> => {
    if (!token.value || token.value === 'demo-token') return false;
    try {
      const res = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token.value}` }
      });
      if (!res.ok) {
        logout();
        return false;
      }
      const text = await res.text();
      if (!text) return false;
      const json = JSON.parse(text);
      if (json.user) {
        setToken(token.value!, {
          id: json.user.id,
          name: json.user.name,
          role: json.user.role,
          avatar_url: json.user.avatar_url,
          email: json.user.email,
          stcn_user_id: json.user.stcn_user_id,
          sectl_user_id: json.user.sectl_user_id,
          lincube_user_id: json.user.lincube_user_id,
        });
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const loginWithCasdoor = async () => {
    const res = await fetch('/api/auth/login');
    const text = await res.text();
    if (!res.ok) {
      throw new Error(text || `登录服务不可用 (${res.status})`);
    }
    if (!text) {
      throw new Error('登录服务返回空响应');
    }
    const json = JSON.parse(text);
    if (!json.authorizeUrl) {
      throw new Error('登录服务未返回授权地址');
    }
    window.location.href = json.authorizeUrl;
  };

  const handleCallback = async (code: string, state: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/auth/callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`);
      const text = await res.text();
      if (!text) return false;
      const json = JSON.parse(text);
      if (json.token) {
        setToken(json.token, {
          id: json.user?.id,
          name: json.user?.name,
          role: json.user?.role,
          avatar_url: json.user?.avatar_url,
        });
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  return {
    user,
    token,
    isAuthenticated,
    loginDemo,
    loginWithCasdoor,
    handleCallback,
    fetchUser,
    setToken,
    logout,
    setRole,
    updateUser,
  };
};
