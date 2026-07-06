import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'fs';
import path from 'path';

const read = (p: string) => readFileSync(path.join(process.cwd(), p), 'utf8');

describe('notification UI wiring', () => {
  test('admin notifications route and sidebar are capability gated', () => {
    const router = read('src/router/index.ts');
    const layout = read('src/views/admin/AdminLayout.vue');
    const endpoints = read('src/api/endpoints.ts');

    expect(router.includes("path: 'notifications'")).toBe(true);
    expect(router.includes("requiresCapability: 'notification:manage'")).toBe(true);
    expect(layout.includes("to: '/admin/notifications'")).toBe(true);
    expect(layout.includes("cap: 'notification:manage'")).toBe(true);
    expect(layout.includes('Bell')).toBe(true);
    expect(endpoints.includes("notifications: '/api/admin/notifications'")).toBe(true);
  });

  test('user notification host has desktop stack, mobile banner and read dismissal', () => {
    const host = read('src/components/UserNotificationHost.vue');
    const app = read('src/App.vue');

    expect(app.includes('UserNotificationHost')).toBe(true);
    expect(app.includes('<UserNotificationHost v-if="!isBackofficeRoute"')).toBe(true);
    expect(host.includes('right-5 top-24')).toBe(true);
    expect(host.includes('md:hidden')).toBe(true);
    expect(host.includes('pageSize: \'5\'')).toBe(true);
    expect(host.includes('slice(0, 3)')).toBe(true);
    expect(host.includes('API.notifications.markRead')).toBe(true);
    expect(host.includes("window.setInterval(() => void loadNotices(), 60_000)")).toBe(true);
  });
});
