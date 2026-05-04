import { describe, expect, test } from 'bun:test';
import { computeCursorFrames } from './captchaCursor';

describe('computeCursorFrames', () => {
  test('keeps target inside badge bounds', () => {
    const frames = computeCursorFrames({
      badge: { width: 260, height: 44 },
      checkbox: { x: 12, y: 10, width: 24, height: 24 }
    });
    expect(frames.target.x).toBeGreaterThanOrEqual(0);
    expect(frames.target.y).toBeGreaterThanOrEqual(0);
    expect(frames.target.x).toBeLessThanOrEqual(260);
    expect(frames.target.y).toBeLessThanOrEqual(44);
  });

  test('starts outside then moves in', () => {
    const frames = computeCursorFrames({
      badge: { width: 260, height: 44 },
      checkbox: { x: 12, y: 10, width: 24, height: 24 }
    });
    expect(frames.start.x).toBeGreaterThan(260);
    expect(frames.start.y).toBeLessThan(0);
    expect(frames.exit.y).toBeGreaterThan(44);
  });
});

