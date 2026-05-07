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

const user = ref<AuthUser | null>(null);
const token = ref<string | null>(null);
const ready = ref(false);

const loadOnce = () => {
  if (ready.value) return;
  ready.value = true;
  if (typeof window === 'undefined') return;
};

const persist = () => {
  // Cookie-based auth: no localStorage persistence.
};

export const useAuth = () => {
  loadOnce();

  const isAuthenticated = computed(() => Boolean(user.value));

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
    try {
      const res = await fetch('/api/auth/me', {
        credentials: 'include'
      });
      if (!res.ok) {
        logout();
        return false;
      }
      const text = await res.text();
      if (!text) return false;
      const json = JSON.parse(text);
      if (json.user) {
        user.value = {
          id: json.user.id,
          name: json.user.name,
          role: json.user.role,
          avatarUrl: json.user.avatar_url || '/assets/people/placeholder.svg',
          avatar_url: json.user.avatar_url,
          email: json.user.email,
          stcn_user_id: json.user.stcn_user_id,
          sectl_user_id: json.user.sectl_user_id,
          lincube_user_id: json.user.lincube_user_id,
        };
        persist();
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

  const loginWithPassword = async (username: string, password: string): Promise<boolean> => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ username, password })
    });
    if (!res.ok) return false;
    const json = await res.json();
    if (!json?.token) return false;
    setToken(json.token, {
      id: json.user?.id,
      name: json.user?.name,
      role: json.user?.role,
      avatar_url: json.user?.avatar_url
    });
    return true;
  };

  const handleCallback = async (code: string, state: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/auth/callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`, {
        credentials: 'include'
      });
      const text = await res.text();
      if (!res.ok) return false;
      if (text) {
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
      }
      return await fetchUser();
    } catch {
      return false;
    }
  };

  return {
    user,
    token,
    isAuthenticated,
    loginWithPassword,
    loginWithCasdoor,
    handleCallback,
    fetchUser,
    setToken,
    logout,
    setRole,
    updateUser,
  };
};
