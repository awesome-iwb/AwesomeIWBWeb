import { computed, ref } from 'vue';
import { API } from '../api/endpoints';
import { ApiError, readJsonOrThrow, useApi } from './useApi';

type AuthRole = 'user' | 'dev' | 'ops';
type UserTier = 'user' | 'dev' | 'ops';

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
    updated_at?: string;
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
  /** Bumped when avatar metadata changes so `<img>` can bust browser caches without a pre-existing query string. */
  avatar_display_rev?: number;
  updated_at?: string;
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

const clearLocalAuthState = () => {
  user.value = null;
  token.value = null;
  persist();
};

function sortedCapabilitiesSignature(capabilities: string[] | undefined): string {
  if (!capabilities?.length) return '';
  return [...capabilities].map((c) => String(c)).sort().join('\u0001');
}

export function getAvatarDisplaySrc(u: AuthUser | null | undefined): string {
  if (!u) return '/assets/people/placeholder.svg';
  const base = u.avatarUrl || '/assets/people/placeholder.svg';
  if (!base || base.startsWith('data:')) return base;
  if (base.includes('?')) return base;
  const v = u.avatar_display_rev ?? u.updated_at;
  if (v === undefined || v === null || v === '') return base;
  return `${base}?v=${encodeURIComponent(String(v))}`;
}

function dispatchAuthUpdated(detail: { avatarChanged: boolean; capabilitiesChanged: boolean }) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('auth:updated', { detail }));
}

function applyAuthMeResponse(json: AuthMeResponse): boolean {
  if (!json.user) {
    clearLocalAuthState();
    return false;
  }

  const prev = user.value;
  const prevRawAvatar = (prev?.avatar_url ?? prev?.avatarUrl ?? '').trim();
  const prevSig = sortedCapabilitiesSignature(prev?.capabilities);
  const prevUpdatedAt = (prev?.updated_at ?? '').trim();

  const caps = Array.isArray(json.capabilities) ? json.capabilities : [];
  const isSuper = json.is_superadmin === true;

  const nextRawAvatar = (json.user.avatar_url ?? '').trim();
  const avatarContentChanged = nextRawAvatar !== prevRawAvatar;
  const nextSig = sortedCapabilitiesSignature(caps);
  const capsChanged = prevSig !== nextSig;

  const serverUpdatedAt = (json.user.updated_at ?? '').trim();
  const metaUpdated = Boolean(serverUpdatedAt && serverUpdatedAt !== prevUpdatedAt);

  let avatar_display_rev = prev?.avatar_display_rev;
  if (avatarContentChanged || metaUpdated) {
    avatar_display_rev = Date.now();
  }

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
    binding_confirmed_at: prev?.binding_confirmed_at,
    organizations: json.organizations ?? [],
    updated_at: serverUpdatedAt || prev?.updated_at,
    avatar_display_rev,
  } satisfies Omit<AuthUser, 'profileConfirmed'>;

  user.value = {
    ...nextUser,
    profileConfirmed: readProfileConfirmed(nextUser),
  };
  persist();

  if (prev && (avatarContentChanged || capsChanged)) {
    dispatchAuthUpdated({ avatarChanged: avatarContentChanged, capabilitiesChanged: capsChanged });
  }

  return true;
}

let authSessionRefreshInFlight: Promise<boolean> | null = null;
let authSessionListenersInstalled = false;
let authSessionResumeDebounce: ReturnType<typeof setTimeout> | null = null;
let authSessionInterval: ReturnType<typeof setInterval> | null = null;
const AUTH_SESSION_RESUME_DEBOUNCE_MS = 400;

export type InstallAuthSessionLifecycleOptions = {
  /**
   * 由 `App.vue` 统一在 focus / 定时器里先打 `/api/health`（buildId）再打 `refreshSession` 时启用，
   * 避免此处再挂一套 interval + focus，与整站版本提示逻辑打架。
   */
  deferForegroundAndIntervalToApp?: boolean;
};

let authSessionDispose: (() => void) | null = null;

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

  const isProjectMember = (_projectId: string): boolean => {
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

  const getUserTier = (): UserTier => {
    if (!user.value) return 'user';
    if (user.value.is_superadmin) return 'ops';
    if (user.value.capabilities?.includes('admin_panel_access')) return 'ops';
    if (user.value.capabilities?.includes('dev_panel_access')) return 'dev';
    return 'user';
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
      const res = await apiFetch(API.auth.me, { cache: 'no-store' });
      const json = await readJsonOrThrow<AuthMeResponse>(res);
      return applyAuthMeResponse(json);
    } catch {
      clearLocalAuthState();
      return false;
    }
  };

  const refreshSession = async (): Promise<boolean> => {
    loadOnce();
    if (!user.value) return false;
    if (authSessionRefreshInFlight) return authSessionRefreshInFlight;

    const run = async (): Promise<boolean> => {
      try {
        const res = await apiFetch(API.auth.me, { cache: 'no-store' });
        const json = await readJsonOrThrow<AuthMeResponse>(res);
        return applyAuthMeResponse(json);
      } catch (e) {
        if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
          clearLocalAuthState();
          return false;
        }
        return Boolean(user.value);
      }
    };

    const p = run().finally(() => {
      if (authSessionRefreshInFlight === p) authSessionRefreshInFlight = null;
    });
    authSessionRefreshInFlight = p;
    return p;
  };

  const installAuthSessionLifecycle = (options?: InstallAuthSessionLifecycleOptions): (() => void) => {
    if (typeof window === 'undefined') return () => {};
    if (options?.deferForegroundAndIntervalToApp) {
      return () => {};
    }
    if (authSessionListenersInstalled && authSessionDispose) return authSessionDispose;

    const scheduleResumeRefresh = () => {
      loadOnce();
      if (!user.value) return;
      if (authSessionResumeDebounce) window.clearTimeout(authSessionResumeDebounce);
      authSessionResumeDebounce = window.setTimeout(() => {
        authSessionResumeDebounce = null;
        void refreshSession();
      }, AUTH_SESSION_RESUME_DEBOUNCE_MS);
    };

    const onFocus = () => scheduleResumeRefresh();
    const onVisibility = () => {
      if (document.visibilityState === 'visible') scheduleResumeRefresh();
    };

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    authSessionInterval = window.setInterval(() => void refreshSession(), 5 * 60 * 1000);

    const dispose = () => {
      if (!authSessionListenersInstalled) return;
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
      if (authSessionInterval != null) {
        window.clearInterval(authSessionInterval);
        authSessionInterval = null;
      }
      if (authSessionResumeDebounce) {
        window.clearTimeout(authSessionResumeDebounce);
        authSessionResumeDebounce = null;
      }
      authSessionListenersInstalled = false;
      authSessionDispose = null;
    };

    authSessionListenersInstalled = true;
    authSessionDispose = dispose;
    return dispose;
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
          avatar_display_rev: Date.now(),
        });
        return json.url;
      }
      return null;
    } catch {
      return null;
    }
  };

  type AvatarSourceSaveResult = { ok: true } | { ok: false; message: string };

  const setAvatarSource = async (source: 'casdoor' | 'upload'): Promise<AvatarSourceSaveResult> => {
    try {
      const res = await apiFetch(API.auth.userAvatarSource, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: { message?: string }; message?: string };
      if (!res.ok) {
        const msg = json?.error?.message || json?.message || '保存失败';
        return { ok: false, message: String(msg) };
      }
      await fetchUser();
      return { ok: true };
    } catch (e: unknown) {
      return { ok: false, message: e instanceof Error ? e.message : '保存失败' };
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
    getUserTier,
    loginWithPassword,
    getCasdoorAuthorizeUrl,
    handleCallback,
    fetchUser,
    refreshSession,
    installAuthSessionLifecycle,
    setToken,
    logout,
    setRole,
    updateUser,
    uploadAvatar,
    setAvatarSource,
    markProfileConfirmed,
  };
};
