import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'fs';
import path from 'path';

const readProjectDetail = () => readFileSync(path.join(import.meta.dir, '..', 'ProjectDetailView.vue'), 'utf8');
const readCommentPanel = () => readFileSync(path.join(import.meta.dir, '..', '..', 'components', 'CommentPanel.vue'), 'utf8');

describe('Comments UI', () => {
  test('removes GitHub discussions embed from project detail', () => {
    const s = readProjectDetail();
    expect(s.includes('giscus.app/client.js')).toBe(false);
    expect(s.includes('Discussions')).toBe(false);
  });

  test('comment panel prompts login via STCN', () => {
    const s = readCommentPanel();
    expect(s.includes('智教联盟登录')).toBe(true);
    expect(s.includes('需要登录')).toBe(true);
  });

  test('bug UI looks like issues and supports safe markdown rendering', () => {
    const s = readCommentPanel();
    expect(s.includes('renderSafeMarkdown')).toBe(true);
    expect(s.includes('ISSUE_LABELS')).toBe(true);
    expect(s.includes('issueLabels')).toBe(true);
  });

  test('uses predefined labels for issues', () => {
    const s = readCommentPanel();
    expect(s.includes('标签')).toBe(true);
    expect(s.includes('预制标签')).toBe(false);
  });

  test('supports image upload toolbar for markdown', () => {
    const s = readCommentPanel();
    expect(s.includes('API.upload.image')).toBe(true);
    expect(s.includes('插入图片')).toBe(true);
    expect(s.includes('加粗')).toBe(true);
  });
});
