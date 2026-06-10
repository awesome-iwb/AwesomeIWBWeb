import { describe, expect, test } from 'bun:test';
import { normalizeProjectTags } from './projectTags';

describe('normalizeProjectTags', () => {
  test('uses feishu project_state_tags as keywords and removes tech_stack overlaps', () => {
    const before: any = {
      keywords: ['Avalonia', '画饼', '别的旧标签'],
      extra: {
        feishu: {
          tech_stack: ['Avalonia', 'C#'],
          project_state_tags: ['画饼', 'Avalonia']
        }
      }
    };

    const after = normalizeProjectTags(before);
    expect(after.keywords).toEqual(['画饼']);
  });

  test('drops legacy keywords when feishu tags are missing', () => {
    const before: any = { keywords: ['Avalonia', '画饼'] };
    const after = normalizeProjectTags(before);
    expect(after.keywords).toEqual([]);
  });

  test('promotes extra release metadata for frontend consumers', () => {
    const before: any = {
      keywords: [],
      extra: {
        releases: [{ tag_name: 'v1.0.0', published_at: null, body: '', html_url: 'https://github.com/a/b/releases/tag/v1.0.0' }],
        relations: [{ target: 'Base', type: 'fork' }],
        reviews: [{ author: 'Ops', content: 'Good' }],
      },
    };
    const after = normalizeProjectTags(before);
    expect(after.releases).toEqual(before.extra.releases);
    expect(after.relations).toEqual(before.extra.relations);
    expect(after.reviews).toEqual(before.extra.reviews);
  });

  test('sanitizes release metadata before exposing it to frontend consumers', () => {
    const after = normalizeProjectTags({
      keywords: [],
      extra: {
        releases: [
          {
            tag_name: 'v' + '1'.repeat(200),
            published_at: 'not-a-date',
            body: 'notes\n'.repeat(1000),
            html_url: 'https://github.com/Owner/Repo/releases/tag/old',
          },
          {
            tag_name: 'bad',
            published_at: '2026-01-01T00:00:00.000Z',
            body: 'ignored',
            html_url: 'javascript:alert(1)',
          },
          {
            tag_name: '',
            html_url: 'https://github.com/Owner/Repo/releases/tag/empty',
          },
        ],
      },
    } as any);

    expect(after.releases).toHaveLength(2);
    expect(after.releases[0].tag_name).toHaveLength(160);
    expect(after.releases[0].published_at).toBeNull();
    expect(after.releases[0].body).toHaveLength(4000);
    expect(after.releases[0].html_url).toBe(
      `https://github.com/Owner/Repo/releases/tag/${encodeURIComponent(('v' + '1'.repeat(200)).slice(0, 160))}`
    );
    expect(after.releases[1]).toEqual({
      tag_name: 'bad',
      published_at: '2026-01-01T00:00:00.000Z',
      body: 'ignored',
      html_url: '',
    });
  });
});
