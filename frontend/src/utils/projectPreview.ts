export type PreviewMode = "desktop" | "touch";

/**
 * Whether the card should enter "zoom" state.
 *
 * - Desktop: zoom immediately on hover.
 * - Touch: zoom only after the long-press threshold is reached.
 */
export function shouldEnterZoom(input: { mode: PreviewMode; elapsedMs: number }) {
  return input.mode === "desktop" ? true : input.elapsedMs >= 700;
}

/**
 * Whether the preview panel (Teleport overlay) should open.
 *
 * Guardrails:
 * - Requires `hasBanner=true` (no banner → never open panel).
 * - Desktop: open after 5000ms hover.
 * - Touch: open after 700ms long-press.
 */
export function shouldOpenPanel(input: { mode: PreviewMode; elapsedMs: number; hasBanner: boolean }) {
  if (!input.hasBanner) return false;
  return input.mode === "desktop" ? input.elapsedMs >= 5000 : input.elapsedMs >= 700;
}

/**
 * Compute an on-screen position for a fixed-position overlay anchored to a card.
 *
 * Strategy:
 * - Prefer placing above the card if there is enough space.
 * - Otherwise place below.
 * - Clamp to viewport with padding to avoid off-screen overflow.
 */
export function clampOverlayPosition(input: {
  cardRect: { left: number; top: number; width: number; height: number };
  viewport: { width: number; height: number };
  overlaySize: { width: number; height: number };
  padding?: number;
}) {
  const padding = input.padding ?? 8;
  const preferTop = input.cardRect.top >= input.overlaySize.height + padding;
  const rawTop = preferTop
    ? input.cardRect.top - input.overlaySize.height - padding
    : input.cardRect.top + input.cardRect.height + padding;

  const rawLeft = input.cardRect.left + input.cardRect.width / 2 - input.overlaySize.width / 2;

  const maxLeft = Math.max(padding, input.viewport.width - input.overlaySize.width - padding);
  const maxTop = Math.max(padding, input.viewport.height - input.overlaySize.height - padding);

  const left = Math.min(maxLeft, Math.max(padding, rawLeft));
  const top = Math.min(maxTop, Math.max(padding, rawTop));

  return { left, top, placement: preferTop ? ("top" as const) : ("bottom" as const) };
}
