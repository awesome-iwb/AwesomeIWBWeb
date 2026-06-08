import { describe, expect, test } from 'bun:test';
import { renderArticleContent } from '../renderArticleContent';

describe('renderArticleContent', () => {
  test('renders markdown to html', () => {
    const html = renderArticleContent('markdown', 'Hello **World**');
    expect(html).toContain('Hello <strong>World</strong>');
  });

  test('renders inline math equation', () => {
    const html = renderArticleContent('markdown', 'Math $x^2$ inline');
    expect(html).toContain('class="katex"');
    expect(html).toContain('x^2');
  });

  test('renders block math equation', () => {
    const html = renderArticleContent('markdown', 'Math block:\n\n$$\nE = mc^2\n$$');
    expect(html).toContain('class="katex-display"');
    expect(html).toContain('E = mc^2');
  });

  test('ignores math parsing inside inline code backticks', () => {
    const html = renderArticleContent('markdown', 'Code `echo $VAR` here');
    expect(html).not.toContain('class="katex"');
    expect(html).toContain('<code>echo $VAR</code>');
  });

  test('renders Callout blocks note/tip/warning/error', () => {
    const text = '::: tip\nThis is a tip box\n:::';
    const html = renderArticleContent('markdown', text);
    expect(html).toContain('callout-block callout-tip');
    expect(html).toContain('This is a tip box');
    expect(html).toContain('callout-title');
    expect(html).toContain('提示');
  });

  test('renders task lists checkbox items', () => {
    const text = '- [ ] Task 1\n- [x] Task 2';
    const html = renderArticleContent('markdown', text);
    expect(html).toContain('class="task-list-item');
    expect(html).toContain('type="checkbox"');
    expect(html).toContain('disabled');
    expect(html).toContain('checked');
  });

  test('renders custom code fence blocks with copy button', () => {
    const text = '```typescript\nconst a = 1;\n```';
    const html = renderArticleContent('markdown', text);
    expect(html).toContain('code-block-wrapper');
    expect(html).toContain('code-block-header');
    expect(html).toContain('TYPESCRIPT');
    expect(html).toContain('copy-code-btn');
    expect(html).toContain('hljs');
  });

  test('renders custom poll card block', () => {
    const text = '[poll name="Favorite whiteboard"]\n- Ink Canvas\n- ClassIsland\n[/poll]';
    const html = renderArticleContent('markdown', text);
    expect(html).toContain('poll-card-wrapper');
    expect(html).toContain('Favorite whiteboard');
    expect(html).toContain('Ink Canvas');
    expect(html).toContain('ClassIsland');
  });

  test('renders image tags with figure and figcaption caption wrappers', () => {
    const text = '![Gorgeous whiteboard image](/images/whiteboard.png)';
    const html = renderArticleContent('markdown', text);
    expect(html).toContain('<figure class="image-figure">');
    expect(html).toContain('<figcaption class="image-caption">Gorgeous whiteboard image</figcaption>');
    expect(html).toContain('<img src="/images/whiteboard.png" alt="Gorgeous whiteboard image">');
  });

  test('parses Flarum-style upl-image-preview elements', () => {
    const text = '[upl-image-preview uuid=ba4fcf85 url=https://forum.smart-teach.cn/image.png alt={TEXT?}]';
    const html = renderArticleContent('flarum', text);
    // Since alt={TEXT?} is stripped, it shouldn't render caption
    expect(html).not.toContain('<figcaption>');
    expect(html).toContain('src="https://forum.smart-teach.cn/image.png"');
  });

  test('parses Flarum-style user mentions', () => {
    const text = 'Hello @"jiangyin14"#1 and @"DryIce-cc"#334';
    const html = renderArticleContent('flarum', text);
    expect(html).toContain('<span class="user-mention">@jiangyin14</span>');
    expect(html).toContain('<span class="user-mention">@DryIce-cc</span>');
  });

  test('does not parse Flarum elements in standard markdown mode', () => {
    const text = 'Hello @"jiangyin14"#1';
    const html = renderArticleContent('markdown', text);
    expect(html).not.toContain('user-mention');
    expect(html).toContain('@&quot;jiangyin14&quot;#1');
  });
});
