const SSG_API_BASE = import.meta.env.VITE_SSG_API_BASE || import.meta.env.VITE_API_BASE_URL || 'https://aiwb.smart-teach.cn';

function resolveApiUrl(url: string): string {
  if (!url.startsWith('/')) return url;
  if (typeof window !== 'undefined') return url;
  return new URL(url, SSG_API_BASE).toString();
}

export class ApiError extends Error {
  status: number;
  code: string;
  traceId?: string;

  constructor(message: string, status: number, code = 'API_ERROR', traceId?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.traceId = traceId;
  }
}

async function parseErrorPayload(res: Response): Promise<ApiError> {
  let bodyText = '';
  try {
    bodyText = await res.text();
  } catch {}

  if (!bodyText) {
    return new ApiError(`请求失败 (${res.status})`, res.status);
  }

  try {
    const json = JSON.parse(bodyText) as any;
    const nested = json?.error;
    if (nested && typeof nested === 'object') {
      return new ApiError(
        String(nested.message ?? `请求失败 (${res.status})`),
        res.status,
        String(nested.code ?? 'API_ERROR'),
        nested.traceId ? String(nested.traceId) : undefined,
      );
    }
    if (typeof json?.message === 'string' || typeof json?.error === 'string') {
      return new ApiError(String(json.message ?? json.error), res.status, String(json.code ?? 'API_ERROR'));
    }
  } catch {}

  return new ApiError(bodyText, res.status);
}

export async function readJsonOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) throw await parseErrorPayload(res);
  const text = await res.text();
  if (!text) throw new ApiError('服务返回空响应', res.status || 500, 'EMPTY_RESPONSE');
  return JSON.parse(text) as T;
}

export function formatApiError(error: unknown, fallback = '请求失败，请稍后重试'): string {
  if (error instanceof ApiError) {
    const codePart = error.code ? ` [${error.code}]` : '';
    const tracePart = error.traceId ? ` (trace: ${error.traceId})` : '';
    return `${error.message}${codePart}${tracePart}`;
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

export function useApi() {
  const apiFetch = async (url: string, options: RequestInit = {}): Promise<Response> => {
    const headers = new Headers(options.headers ?? {});
    const hasBody = options.body !== undefined && options.body !== null;
    const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;

    if (hasBody && !isFormData && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

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
  const hasBody = options.body !== undefined && options.body !== null;
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  if (hasBody && !isFormData && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  return fetch(resolveApiUrl(url), { ...options, headers, credentials: 'include' });
}
