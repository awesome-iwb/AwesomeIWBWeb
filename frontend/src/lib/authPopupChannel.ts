export type AuthPopupResult = {
  type: 'aiwb-oauth-popup-result';
  success: boolean;
  message?: string;
  publishedAt: number;
};

const CHANNEL_NAME = 'awesome-iwb-auth-popup';
const STORAGE_KEY = 'awesome_iwb_auth_popup_result';

function isAuthPopupResult(value: unknown): value is AuthPopupResult {
  const v = value as Partial<AuthPopupResult> | null;
  return Boolean(
    v &&
    v.type === 'aiwb-oauth-popup-result' &&
    typeof v.success === 'boolean'
  );
}

export function publishAuthPopupResult(success: boolean, message?: string) {
  if (typeof window === 'undefined') return;
  const payload: AuthPopupResult = {
    type: 'aiwb-oauth-popup-result',
    success,
    message,
    publishedAt: Date.now(),
  };

  try {
    const channel = new BroadcastChannel(CHANNEL_NAME);
    channel.postMessage(payload);
    channel.close();
  } catch {}

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    window.setTimeout(() => {
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        const current = raw ? JSON.parse(raw) as Partial<AuthPopupResult> : null;
        if (current?.publishedAt === payload.publishedAt) {
          window.localStorage.removeItem(STORAGE_KEY);
        }
      } catch {}
    }, 5000);
  } catch {}
}

export function subscribeAuthPopupResult(handler: (result: AuthPopupResult) => void): () => void {
  if (typeof window === 'undefined') return () => {};

  let closed = false;
  let channel: BroadcastChannel | null = null;

  const receive = (value: unknown) => {
    if (closed || !isAuthPopupResult(value)) return;
    handler(value);
  };

  try {
    channel = new BroadcastChannel(CHANNEL_NAME);
    channel.onmessage = (event) => receive(event.data);
  } catch {
    channel = null;
  }

  const onStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY || !event.newValue) return;
    try {
      receive(JSON.parse(event.newValue));
    } catch {}
  };

  window.addEventListener('storage', onStorage);

  return () => {
    closed = true;
    window.removeEventListener('storage', onStorage);
    try {
      channel?.close();
    } catch {}
  };
}
