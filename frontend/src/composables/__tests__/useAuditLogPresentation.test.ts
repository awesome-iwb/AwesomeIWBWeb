import { describe, expect, test } from 'bun:test';
import { presentAuditLog } from '../useAuditLogPresentation';

describe('presentAuditLog', () => {
  test('formats project update with before/after diff', () => {
    const row = {
      id: '1',
      actor: 'alice',
      action: 'update',
      entity_type: 'project',
      entity_id: 'p1',
      created_at: '2026-05-16T00:00:00Z',
      diff: {
        before: { name: '旧项目', banner_url: 'a.png' },
        after: { name: '旧项目', banner_url: 'b.png' },
      },
    };
    const p = presentAuditLog(row);
    expect(p.title).toContain('更新项目');
    expect(p.actorLabel).toBe('alice');
    expect(p.changeLines.some((l) => l.includes('横幅图'))).toBe(true);
  });

  test('maps custom approve action', () => {
    const p = presentAuditLog({
      id: '2',
      actor: 'ops',
      action: 'approve',
      entity_type: 'submission',
      entity_id: 's1',
      created_at: '2026-05-16T00:00:00Z',
      diff: { project_id: 'p99' },
    });
    expect(p.title).toContain('审核通过');
    expect(p.subtitle).toContain('ops');
  });
});
