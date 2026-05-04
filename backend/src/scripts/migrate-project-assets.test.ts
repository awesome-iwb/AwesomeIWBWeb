import { describe, expect, test } from 'bun:test';
import { rewriteProjectAssets } from './migrate-project-assets';

describe('rewriteProjectAssets', () => {
  test('rewrites local_images to assets/projects/<key>', () => {
    const input = {
      categories: [
        {
          id: 'c1',
          name: 'x',
          description: 'x',
          projects: [
            {
              name: 'TimerIn',
              github_url: 'https://github.com/a/b',
              icon: '/local_images/icons/aaa.webp',
              banner: '/local_images/banners/bbb.webp',
              avatar: '/local_images/avatars/ccc.webp'
            }
          ]
        }
      ]
    };
    const out = rewriteProjectAssets(input as any);
    const p = out.categories[0].projects[0] as any;
    expect(p.icon).toBe('/assets/projects/a-b/icon.webp');
    expect(p.banner).toBe('/assets/projects/a-b/banner.webp');
    expect(p.avatar).toBe('/assets/projects/a-b/avatar.webp');
  });
});

