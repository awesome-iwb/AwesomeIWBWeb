import { useAuth } from './useAuth';

export function useApi() {
  const { token } = useAuth();

  const apiFetch = async (url: string, options: RequestInit = {}): Promise<Response> => {
    const headers = new Headers(options.headers ?? {});
    headers.set('Content-Type', headers.get('Content-Type') ?? 'application/json');

    const t = token.value;
    if (t && t !== 'demo-token') {
      headers.set('Authorization', `Bearer ${t}`);
    }

    return fetch(url, { ...options, headers });
  };

  const apiGet = (url: string) => apiFetch(url, { method: 'GET' });
  const apiPost = (url: string, body?: any) => apiFetch(url, { method: 'POST', body: body ? JSON.stringify(body) : undefined });
  const apiPut = (url: string, body?: any) => apiFetch(url, { method: 'PUT', body: body ? JSON.stringify(body) : undefined });
  const apiPatch = (url: string, body?: any) => apiFetch(url, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined });
  const apiDelete = (url: string) => apiFetch(url, { method: 'DELETE' });

  return { apiFetch, apiGet, apiPost, apiPut, apiPatch, apiDelete };
}
