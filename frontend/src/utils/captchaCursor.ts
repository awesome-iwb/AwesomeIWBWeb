export type Rect = { x: number; y: number; width: number; height: number };

export function computeCursorFrames(input: { badge: { width: number; height: number }; checkbox: Rect }) {
  const w = Math.max(1, input.badge.width);
  const h = Math.max(1, input.badge.height);
  const c = input.checkbox;

  const cx = c.x + c.width / 2;
  const cy = c.y + c.height / 2;

  const target = {
    x: Math.min(Math.max(cx - 10, 4), w - 4),
    y: Math.min(Math.max(cy - 10, 4), h - 4)
  };

  return {
    start: { x: w + 18, y: -18 },
    target,
    exit: { x: Math.round(w * 0.65), y: h + 18 }
  };
}

