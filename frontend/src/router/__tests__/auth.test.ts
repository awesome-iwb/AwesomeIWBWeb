import { describe, expect, test } from 'bun:test';
import { routes } from '../index';

describe('Auth routes', () => {
  test('registers /me', () => {
    const me = routes.find(r => r.path === '/me');
    expect(me).toBeTruthy();
    expect(me?.name).toBe('me');
  });

  test('registers /dev', () => {
    const dev = routes.find(r => r.path === '/dev');
    expect(dev).toBeTruthy();
    expect(dev?.name).toBe('dev');
    expect((dev as any)?.meta?.requiresAuth).toBe(true);
    expect((dev as any)?.meta?.requiresRole).toBe('dev');
  });

  test('/submit requires auth', () => {
    const submit = routes.find(r => r.path === '/submit');
    expect(submit).toBeTruthy();
    expect((submit as any)?.meta?.requiresAuth).toBe(true);
  });
});
