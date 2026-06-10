import { describe, expect, test } from 'bun:test';
import { routes } from '../index';

describe('Auth routes', () => {
  test('registers /me', () => {
    const me = routes.find(r => r.path === '/me');
    expect(me).toBeTruthy();
    expect(me?.name).toBe('me');
  });

  test('registers /dev behind auth and capability gates', () => {
    const dev = routes.find(r => r.path === '/dev');
    expect(dev).toBeTruthy();
    expect((dev as any)?.meta?.requiresAuth).toBe(true);
    expect((dev as any)?.meta?.requiresCapability).toBe('dev_panel_access');
  });

  test('/submit requires auth', () => {
    const submit = routes.find(r => r.path === '/submit');
    expect(submit).toBeTruthy();
    expect((submit as any)?.meta?.requiresAuth).toBe(true);
  });
});
