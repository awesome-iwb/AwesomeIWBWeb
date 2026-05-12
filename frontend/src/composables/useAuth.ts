import { computed, ref } from 'vue';

type AuthRole = 'user' | 'dev' | 'ops';

function inferRoleFromCapabilities(capabilities: string[] | undefined, isSuperadmin: boolean | undefined): AuthRole {
  if (isSuperadmin) return 'ops';
  if (!capabilities) return 'user';
  if (capabilities.includes('admin_panel_access')) return 'ops';
  if (capabilities.includes('dev_panel_access')) return 'dev';
  return 'user';
}

export type AuthUser = {
  id?: string;
  name: string;
  avatarUrl: string;
  avatar_source?: 'casdoor' | 'upload' | 'default';
  /** Display label only - not used for permission checks. Use hasCapability() instead. */
  role: AuthRole;
  stcn_user_id: string;
  stcn_username?: string;
  hzzc_user_id: string;
  email?: string;
  avatar_url?: string;
  is_superadmin?: boolean;
  capabilities?: string[];
  profileConfirmed?: boolean;
  binding_confirmed_at?: string;
};

const STORAGE_KEY = 'awesome_iwb_auth';

const user = ref<AuthUser | null>(null);
const token = ref<string | null>(null);
const ready = ref(false);

const loadFromStorage = () => {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      user.value = JSON.parse(raw);
    }
  } catch {}
};

const loadOnce = () => {
  if (ready.value) return;
  ready.value = true;
  if (typeof window === 'undefined') return;
  loadFromStorage();
};

const persist = () => {
  if (typeof window === 'undefined') return;
  if (!user.value) {
    localStorage.removeItem(STORAGE_KEY);
    return;
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user.value));
  } catch {}
};

export const useAuth = () => {
  loadOnce();

  const isAuthenticated = computed(() => Boolean(user.value));

  const isSuperadmin = computed(() => user.value?.is_superadmin === true);

  const capabilities = computed(() => user.value?.capabilities ?? []);

  const hasCapability = (cap: string) => {
    if (!user.value) return false;
    if (user.value.is_superadmin) return true;
    return user.value.capabilities?.includes(cap) ?? false;
  };

  const setToken = (newToken: string, newUser?: Partial<AuthUser>) => {
    token.value = newToken;
    if (newUser) {
      user.value = {
        name: newUser.name ?? user.value?.name ?? '',
        avatarUrl: newUser.avatarUrl ?? newUser.avatar_url ?? user.value?.avatarUrl ?? '/assets/people/placeholder.svg',
        avatar_source: newUser.avatar_source ?? user.value?.avatar_source ?? 'default',
        role: newUser.role ?? user.value?.role ?? 'user',
        stcn_user_id: newUser.stcn_user_id ?? user.value?.stcn_user_id ?? '',
        stcn_username: newUser.stcn_username ?? user.value?.stcn_username ?? '',
        hzzc_user_id: newUser.hzzc_user_id ?? user.value?.hzzc_user_id ?? '',
        id: newUser.id ?? user.value?.id,
        email: newUser.email ?? user.value?.email,
        is_superadmin: newUser.is_superadmin ?? user.value?.is_superadmin ?? false,
        capabilities: newUser.capabilities ?? user.value?.capabilities ?? [],
        profileConfirmed: newUser.profileConfirmed ?? user.value?.profileConfirmed ?? false,
        binding_confirmed_at: newUser.binding_confirmed_at ?? user.value?.binding_confirmed_at,
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

  const clearLocalAuthState = () => {
    user.value = null;
    token.value = null;
    persist();
  };

  const markProfileConfirmed = () => {
    if (!user.value) return;
    user.value = {
      ...user.value,
      profileConfirmed: true,
      binding_confirmed_at: user.value.binding_confirmed_at || new Date().toISOString(),
    };
    persist();
  };

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
    } catch {}
    clearLocalAuthState();
  };


  const fetchUser = async (): Promise<boolean> => {
    try {
      const res = await fetch('/api/auth/me', {
        credentials: 'include'
      });
      if (!res.ok) {
        clearLocalAuthState();
        return false;
      }
      const text = await res.text();
      if (!text) return false;
      const json = JSON.parse(text);
      if (json.user) {
        const caps = json.capabilities ?? [];
        const isSuper = json.is_superadmin ?? false;
        user.value = {
          id: json.user.id,
          name: json.user.name,
          role: inferRoleFromCapabilities(caps, isSuper),
          avatarUrl: json.user.avatar_url || '/assets/people/placeholder.svg',
          avatar_url: json.user.avatar_url,
          avatar_source: json.user.avatar_source || 'default',
          email: json.user.email,
          stcn_user_id: json.user.stcn_user_id,
          stcn_username: json.user.stcn_username,
          hzzc_user_id: json.user.hzzc_user_id,
          is_superadmin: isSuper,
          capabilities: caps,
          profileConfirmed: user.value?.profileConfirmed ?? false,
          binding_confirmed_at: user.value?.binding_confirmed_at,
        };
        persist();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const getCasdoorAuthorizeUrl = async (returnTo?: string, popup = false): Promise<string> => {
    const params = new URLSearchParams();
    if (returnTo) params.set('returnTo', returnTo);
    if (popup) params.set('popup', '1');
    const url = `/api/auth/login${params.toString() ? '?' + params.toString() : ''}`;
    const res = await fetch(url);
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
    return String(json.authorizeUrl);
  };

  const loginWithCasdoor = async (returnTo?: string) => {
    const authorizeUrl = await getCasdoorAuthorizeUrl(returnTo, false);
    window.location.href = authorizeUrl;
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
    setToken(json.token);
    return await fetchUser();
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
          setToken(json.token);
          return await fetchUser();
        }
      }
      return await fetchUser();
    } catch {
      return false;
    }
  };

  const uploadAvatar = async (file: File): Promise<string | null> => {
    try {
      const formData = new FormData();
      formData.append('image', file);
      const res = await fetch('/api/user/avatar', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      if (!res.ok) return null;
      const json = await res.json();
      if (json.url) {
        updateUser({
          avatarUrl: json.url,
          avatar_url: json.url,
          avatar_source: 'upload',
        });
        return json.url;
      }
      return null;
    } catch {
      return null;
    }
  };

  return {
    user,
    token,
    isAuthenticated,
    isSuperadmin,
    capabilities,
    hasCapability,
    loginWithPassword,
    getCasdoorAuthorizeUrl,
    loginWithCasdoor,
    handleCallback,
    fetchUser,
    setToken,
    logout,
    setRole,
    updateUser,
    uploadAvatar,
    markProfileConfirmed,
  };
};
