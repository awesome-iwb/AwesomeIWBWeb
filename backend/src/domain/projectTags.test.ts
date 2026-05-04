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
});

