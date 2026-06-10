import { describe, expect, test } from 'bun:test';
import { stringifyJsonLd } from '../jsonLd';

describe('stringifyJsonLd', () => {
  test('escapes script-breaking characters in JSON-LD', () => {
    const json = stringifyJsonLd({
      name: '</script><img src=x onerror=alert(1)>',
      description: 'a & b',
    });

    expect(json).toContain('\\u003c/script\\u003e');
    expect(json).toContain('\\u003cimg src=x onerror=alert(1)\\u003e');
    expect(json).toContain('a \\u0026 b');
    expect(json).not.toContain('</script>');
    expect(json).not.toContain('<img');
  });
});
