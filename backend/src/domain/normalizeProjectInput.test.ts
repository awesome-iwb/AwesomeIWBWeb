import { describe, expect, test } from 'bun:test';
import { normalizeProjectInput } from './normalizeProjectInput';

describe('normalizeProjectInput', () => {
  test('maps legacy platform developer user_id to stcn_user_id', () => {
    const out: any = normalizeProjectInput({
      name: 'X',
      platform_developers: [{ username: 'u', user_id: 'legacy' }]
    });
    expect(out.platform_developers).toEqual([{ username: 'u', stcn_user_id: 'legacy', hzzc_user_id: '' }]);
  });
});

