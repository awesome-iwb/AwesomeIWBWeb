import { describe, expect, test } from 'bun:test';
import { getAllCapabilities, getAllCapabilityIds, getRoleTemplates, isSuperadmin } from './capabilities';

describe('capabilities', () => {
  test('includes user capabilities', () => {
    const ids = getAllCapabilityIds();
    expect(ids).toContain('user:comment');
    expect(ids).toContain('user:avatar');
    expect(ids).toContain('user:feedback');
    expect(ids).toContain('user:submit_project');
    expect(ids).toContain('user:profile');
    expect(ids).toContain('user:create_org');
  });

  test('includes dev capabilities', () => {
    const ids = getAllCapabilityIds();
    expect(ids).toContain('dev:project_edit');
    expect(ids).toContain('dev:bug_manage');
    expect(ids).toContain('dev:comment_manage');
    expect(ids).toContain('dev:stats_view');
    expect(ids).toContain('dev:project_admin');
    expect(ids).toContain('dev:org_manage');
  });

  test('includes org/claim capabilities', () => {
    const ids = getAllCapabilityIds();
    expect(ids).toContain('org:review');
    expect(ids).toContain('claim:review');
    expect(ids).toContain('org:manage');
  });

  test('developer role template includes user capabilities', () => {
    const templates = getRoleTemplates();
    const devCaps = templates.developer.capabilityIds;
    expect(devCaps).toContain('user:comment');
    expect(devCaps).toContain('user:avatar');
    expect(devCaps).toContain('dev_panel_access');
    expect(devCaps).toContain('dev:project_edit');
  });

  test('user role template includes all user capabilities', () => {
    const templates = getRoleTemplates();
    const userCaps = templates.user.capabilityIds;
    expect(userCaps).toContain('user:comment');
    expect(userCaps).toContain('user:avatar');
    expect(userCaps).toContain('user:feedback');
    expect(userCaps).toContain('user:submit_project');
    expect(userCaps).toContain('user:profile');
    expect(userCaps).toContain('user:create_org');
  });

  test('editor role template includes publishing and review capabilities', () => {
    const templates = getRoleTemplates();
    const editorCaps = templates.editor.capabilityIds;
    expect(editorCaps).toContain('story:manage');
    expect(editorCaps).toContain('submission:read');
    expect(editorCaps).toContain('submission:approve');
    expect(editorCaps).toContain('submission:reject');
    expect(editorCaps).toContain('moderation:read');
    expect(editorCaps).toContain('moderation:approve');
    expect(editorCaps).toContain('moderation:reject');
  });

  test('isSuperadmin checks username case-insensitively', () => {
    expect(isSuperadmin('lincube')).toBe(true);
    expect(isSuperadmin('Lincube')).toBe(true);
    expect(isSuperadmin('other')).toBe(false);
  });
});
