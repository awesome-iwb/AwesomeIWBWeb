const SSG_API_BASE = import.meta.env.VITE_SSG_API_BASE || import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8080';

function resolveApiUrl(url: string): string {
  if (!url.startsWith('/')) return url;
  if (typeof window !== 'undefined') return url;
  return new URL(url, SSG_API_BASE).toString();
}

export function useApi() {
  const apiFetch = async (url: string, options: RequestInit = {}): Promise<Response> => {
    const headers = new Headers(options.headers ?? {});
    headers.set('Content-Type', headers.get('Content-Type') ?? 'application/json');

    const method = (options.method ?? 'GET').toUpperCase();
    const requestOptions: RequestInit = { ...options, headers, credentials: 'include' };
    if (method === 'GET' && requestOptions.cache === undefined) {
      requestOptions.cache = 'no-store';
    }

    return fetch(resolveApiUrl(url), requestOptions);
  };

  const apiGet = (url: string) => apiFetch(url, { method: 'GET' });
  const apiPost = (url: string, body?: any) => apiFetch(url, { method: 'POST', body: body ? JSON.stringify(body) : undefined });
  const apiPut = (url: string, body?: any) => apiFetch(url, { method: 'PUT', body: body ? JSON.stringify(body) : undefined });
  const apiPatch = (url: string, body?: any) => apiFetch(url, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined });
  const apiDelete = (url: string) => apiFetch(url, { method: 'DELETE' });

  return { apiFetch, apiGet, apiPost, apiPut, apiPatch, apiDelete };
}

export function apiFetchWithToken(url: string, token: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers ?? {});
  headers.set('Authorization', `Bearer ${token}`);
  if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  return fetch(resolveApiUrl(url), { ...options, headers, credentials: 'include' });
}
