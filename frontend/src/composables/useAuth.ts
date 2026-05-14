import { computed, ref } from 'vue';
import { API } from '../api/endpoints';
import { ApiError, readJsonOrThrow, useApi } from './useApi';

type AuthRole = 'user' | 'dev' | 'ops';

type AuthMeResponse = {
  user?: {
    id?: string;
    name?: string;
    avatar_url?: string;
    avatar_source?: 'casdoor' | 'upload' | 'default';
    avatar_media_id?: string;
    email?: string;
    stcn_user_id?: string;
    stcn_username?: string;
    hzzc_user_id?: string;
  };
  capabilities?: string[];
  is_superadmin?: boolean;
  organizations?: AuthUserOrganization[];
};

type LoginResponse = {
  token?: string;
};

type AuthorizeUrlResponse = {
  authorizeUrl?: string;
};

type UploadAvatarResponse = {
  url?: string;
  media_id?: string;
  storage_key?: string;
};

function inferRoleFromCapabilities(capabilities: string[] | undefined, isSuperadmin: boolean | undefined): AuthRole {
  if (isSuperadmin) return 'ops';
  if (!capabilities) return 'user';
  if (capabilities.includes('admin_panel_access')) return 'ops';
  if (capabilities.includes('dev_panel_access')) return 'dev';
  return 'user';
}

export type AuthUserOrganization = {
  id: string;
  name: string;
  slug: string;
  avatar_url: string;
  description: string;
  website_url: string;
  status: string;
  member_role: 'owner' | 'admin' | 'member';
};

export type AuthUser = {
  id?: string;
  name: string;
  avatarUrl: string;
  avatar_source?: 'casdoor' | 'upload' | 'default';
  avatar_media_id?: string;
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
  organizations?: AuthUserOrganization[];
};

const STORAGE_KEY = 'awesome_iwb_auth';
const PROFILE_CONFIRMED_PREFIX = 'awesome_iwb_profile_confirmed:';

const user = ref<AuthUser | null>(null);
const token = ref<string | null>(null);
const ready = ref(false);

const loadFromStorage = () => {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) user.value = JSON.parse(raw);
  } catch {}
};

const loadOnce = () => {
  if (ready.value) return;
  ready.value = true;
  if (typeof window === 'undefined') return;
  loadFromStorage();
};

const getProfileConfirmedKey = (identity: { id?: string; name?: string } | null | undefined): string | null => {
  const id = String(identity?.id ?? '').trim();
  if (id) return `${PROFILE_CONFIRMED_PREFIX}${id}`;
  const name = String(identity?.name ?? '').trim();
  if (name) return `${PROFILE_CONFIRMED_PREFIX}name:${name.toLowerCase()}`;
  return null;
};

const readProfileConfirmed = (identity: { id?: string; name?: string } | null | undefined): boolean => {
  if (typeof window === 'undefined') return false;
  const key = getProfileConfirmedKey(identity);
  if (!key) return false;
  return localStorage.getItem(key) === '1';
};

const writeProfileConfirmed = (identity: { id?: string; name?: string } | null | undefined, value: boolean) => {
  if (typeof window === 'undefined') return;
  const key = getProfileConfirmedKey(identity);
  if (!key) return;
  if (value) {
    localStorage.setItem(key, '1');
  } else {
    localStorage.removeItem(key);
  }
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

  const { apiFetch } = useApi();

  const isAuthenticated = computed(() => Boolean(user.value));
  const isSuperadmin = computed(() => user.value?.is_superadmin === true);
  const capabilities = computed(() => user.value?.capabilities ?? []);
  const organizations = computed(() => user.value?.organizations ?? []);

  const hasCapability = (cap: string) => {
    if (!user.value) return false;
    if (user.value.is_superadmin) return true;
    return user.value.capabilities?.includes(cap) ?? false;
  };

  const isProjectMember = (projectId: string): boolean => {
    if (!user.value) return false;
    if (user.value.is_superadmin) return true;
    return false;
  };

  const isOrgAdmin = (orgId: string): boolean => {
    if (!user.value) return false;
    if (user.value.is_superadmin) return true;
    const org = user.value.organizations?.find(o => o.id === orgId);
    return org?.member_role === 'owner' || org?.member_role === 'admin' || false;
  };

  const hasUserCapability = (capId: string): boolean => {
    if (!user.value) return false;
    if (user.value.is_superadmin) return true;
    return user.value.capabilities?.includes(capId) ?? false;
  };

  const setToken = (newToken: string, newUser?: Partial<AuthUser>) => {
    token.value = newToken;
    if (newUser) {
      const nextUser = {
        name: newUser.name ?? user.value?.name ?? '',
        avatarUrl: newUser.avatarUrl ?? newUser.avatar_url ?? user.value?.avatarUrl ?? '/assets/people/placeholder.svg',
        avatar_source: newUser.avatar_source ?? user.value?.avatar_source ?? 'default',
        avatar_media_id: newUser.avatar_media_id ?? user.value?.avatar_media_id,
        role: newUser.role ?? user.value?.role ?? 'user',
        stcn_user_id: newUser.stcn_user_id ?? user.value?.stcn_user_id ?? '',
        stcn_username: newUser.stcn_username ?? user.value?.stcn_username ?? '',
        hzzc_user_id: newUser.hzzc_user_id ?? user.value?.hzzc_user_id ?? '',
        id: newUser.id ?? user.value?.id,
        email: newUser.email ?? user.value?.email,
        is_superadmin: newUser.is_superadmin ?? user.value?.is_superadmin ?? false,
        capabilities: newUser.capabilities ?? user.value?.capabilities ?? [],
        binding_confirmed_at: newUser.binding_confirmed_at ?? user.value?.binding_confirmed_at,
      } satisfies Omit<AuthUser, 'profileConfirmed'>;
      user.value = {
        ...nextUser,
        profileConfirmed: readProfileConfirmed(nextUser),
      };
    }
    persist();
  };

  const clearLocalAuthState = () => {
    user.value = null;
    token.value = null;
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

  const markProfileConfirmed = () => {
    if (!user.value) return;
    writeProfileConfirmed(user.value, true);
    user.value = {
      ...user.value,
      profileConfirmed: true,
      binding_confirmed_at: user.value.binding_confirmed_at || new Date().toISOString(),
    };
    persist();
  };

  const logout = async (): Promise<boolean> => {
    try {
      await apiFetch(API.auth.logout, { method: 'POST', credentials: 'include' });
    } catch {}
    const stillAuthed = await fetchUser();
    return !stillAuthed;
  };

  const fetchUser = async (): Promise<boolean> => {
    try {
      const res = await apiFetch(API.auth.me);
      const json = await readJsonOrThrow<AuthMeResponse>(res);
      if (!json.user) {
        clearLocalAuthState();
        return false;
      }

      const caps = Array.isArray(json.capabilities) ? json.capabilities : [];
      const isSuper = json.is_superadmin === true;

      const nextUser = {
        id: json.user.id,
        name: json.user.name ?? '',
        role: inferRoleFromCapabilities(caps, isSuper),
        avatarUrl: json.user.avatar_url || '/assets/people/placeholder.svg',
        avatar_url: json.user.avatar_url,
        avatar_source: json.user.avatar_source || 'default',
        avatar_media_id: json.user.avatar_media_id,
        email: json.user.email,
        stcn_user_id: json.user.stcn_user_id ?? '',
        stcn_username: json.user.stcn_username,
        hzzc_user_id: json.user.hzzc_user_id ?? '',
        is_superadmin: isSuper,
        capabilities: caps,
        binding_confirmed_at: user.value?.binding_confirmed_at,
        organizations: json.organizations ?? [],
      } satisfies Omit<AuthUser, 'profileConfirmed'>;
      user.value = {
        ...nextUser,
        profileConfirmed: readProfileConfirmed(nextUser),
      };
      persist();
      return true;
    } catch {
      clearLocalAuthState();
      return false;
    }
  };

  const getCasdoorAuthorizeUrl = async (returnTo?: string): Promise<string> => {
    const params = new URLSearchParams();
    if (returnTo) params.set('returnTo', returnTo);
    // Frontend only supports popup OAuth flow; always request popup callback mode.
    params.set('popup', '1');

    const url = `${API.auth.login}${params.toString() ? `?${params.toString()}` : ''}`;
    const res = await apiFetch(url);
    const json = await readJsonOrThrow<AuthorizeUrlResponse>(res);
    if (!json.authorizeUrl) {
      throw new ApiError('登录服务未返回授权地址', 502, 'MISSING_AUTHORIZE_URL');
    }
    return String(json.authorizeUrl);
  };

  const loginWithPassword = async (username: string, password: string): Promise<boolean> => {
    try {
      const res = await apiFetch(API.auth.login, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username, password }),
      });
      const json = await readJsonOrThrow<LoginResponse>(res);
      if (!json.token) return false;
      setToken(json.token);
      return await fetchUser();
    } catch {
      return false;
    }
  };

  const handleCallback = async (code: string, state: string): Promise<boolean> => {
    try {
      const res = await apiFetch(`${API.auth.callback}?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`);
      const text = await res.text();
      if (!res.ok) return false;

      if (text) {
        const json = JSON.parse(text) as LoginResponse;
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
      const res = await apiFetch(API.auth.userAvatar, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      const json = await readJsonOrThrow<UploadAvatarResponse>(res);
      if (json.url) {
        updateUser({
          avatarUrl: json.url,
          avatar_url: json.url,
          avatar_source: 'upload',
          avatar_media_id: json.media_id,
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
    organizations,
    hasCapability,
    isProjectMember,
    isOrgAdmin,
    hasUserCapability,
    loginWithPassword,
    getCasdoorAuthorizeUrl,
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
