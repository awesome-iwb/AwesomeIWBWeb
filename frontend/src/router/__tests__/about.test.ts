import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { routes } from '../index';

describe('About route', () => {
  test('registers /about', () => {
    const about = routes.find(r => r.path === '/about');
    expect(about).toBeTruthy();
    expect(about?.name).toBe('about');
  });

  test('redirects /ecosystem to /about', () => {
    const ecosystem = routes.find(r => r.path === '/ecosystem');
    expect(ecosystem).toBeTruthy();
    expect(ecosystem?.redirect).toBe('/about');
  });
});

describe('Footer', () => {
  test('does not render maintainer cards in footer', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const footerPath = join(here, '../../components/SiteFooter.vue');
    const contents = readFileSync(footerPath, 'utf8');
    expect(contents.includes('v-for="m in maintainers"')).toBe(false);
    expect(contents.includes('const maintainers')).toBe(false);
  });
});

