import { useAuth } from './useAuth';

const UPLOAD_ERROR_TEXT: Record<string, string> = {
  UPLOAD_UNAUTHORIZED: '你还没有登录或会话已过期，请重新登录后再上传。',
  UPLOAD_RATE_LIMITED: '上传过于频繁，请稍后再试。',
  UPLOAD_MISSING_FILE: '未检测到上传文件，请重新选择图片。',
  UPLOAD_FILE_TOO_LARGE: '图片文件过大，请压缩后重试。',
  UPLOAD_UNSUPPORTED_TYPE: '仅支持 PNG、JPG、WEBP 图片格式。',
  UPLOAD_INVALID_SIGNATURE: '图片文件内容异常，请更换文件后重试。',
};

const normalizeUploadError = (payload: any, status: number): string => {
  const code = typeof payload?.code === 'string' ? payload.code : '';
  if (code && UPLOAD_ERROR_TEXT[code]) return UPLOAD_ERROR_TEXT[code];
  if (typeof payload?.message === 'string' && payload.message.trim()) return payload.message.trim();
  if (status === 429) return UPLOAD_ERROR_TEXT.UPLOAD_RATE_LIMITED;
  if (status === 401) return UPLOAD_ERROR_TEXT.UPLOAD_UNAUTHORIZED;
  return '上传失败，请稍后重试。';
};

export const adminFetch = async (url: string, options: RequestInit = {}) => {
  const { token } = useAuth();
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  if (token.value?.trim()) {
    headers.set('Authorization', `Bearer ${token.value.trim()}`);
  }
  const method = (options.method ?? 'GET').toUpperCase();
  const requestOptions: RequestInit = { ...options, headers, credentials: 'include' };
  if (method === 'GET' && requestOptions.cache === undefined) {
    requestOptions.cache = 'no-cache';
  }
  return fetch(url, requestOptions);
};

export const formatAdminError = (payload: any, fallback: string, status?: number): string => {
  const nested = payload?.error;
  if (nested && typeof nested === 'object') {
    const msg = String(nested.message ?? fallback);
    const codePart = nested.code ? ` [${String(nested.code)}]` : '';
    const tracePart = nested.traceId ? ` (trace: ${String(nested.traceId)})` : '';
    return `${msg}${codePart}${tracePart}`;
  }
  if (typeof payload?.message === 'string' && payload.message.trim()) return payload.message.trim();
  if (typeof payload?.error === 'string' && payload.error.trim()) return payload.error.trim();
  if (typeof status === 'number') return `${fallback} (${status})`;
  return fallback;
};

export const isInternalUploadUrl = (value: string): boolean => value.startsWith('/api/uploads/');

export const normalizeMediaUrl = (value: unknown): string => {
  const text = String(value ?? '').trim();
  if (!text) return '';
  if (isInternalUploadUrl(text)) return text;
  return '';
};

export const uploadFile = async (file: File): Promise<string> => {
  const formData = new FormData();
  formData.append('image', file);
  try {
    const res = await adminFetch('/api/upload', { method: 'POST', body: formData });
    const payload = await res.json().catch(() => ({}));
    if (res.ok && typeof payload?.url === 'string') {
      return payload.url;
    }
    throw new Error(normalizeUploadError(payload, res.status));
  } catch (e: unknown) {
    if (e instanceof Error) throw e;
    throw new Error('上传失败，请检查网络后重试。');
  }
};

export const formatBytes = (size: unknown): string => {
  const bytes = typeof size === 'number' ? size : Number(size ?? 0);
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value >= 100 ? value.toFixed(0) : value.toFixed(1)} ${units[unitIndex]}`;
};

export const formatDateTime = (value: unknown): string => {
  if (!value) return '-';
  const dt = new Date(String(value));
  if (Number.isNaN(dt.getTime())) return String(value);
  return dt.toLocaleString();
};
