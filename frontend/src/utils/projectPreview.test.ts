import { describe, expect, test } from "bun:test";
import { clampOverlayPosition, shouldEnterZoom, shouldOpenPanel } from "./projectPreview";

describe("project preview", () => {
  test("shouldEnterZoom: desktop hover enters zoom immediately", () => {
    expect(shouldEnterZoom({ mode: "desktop", elapsedMs: 0 })).toBe(true);
  });

  test("shouldOpenPanel: desktop hover opens panel only after 5000ms", () => {
    expect(shouldOpenPanel({ mode: "desktop", elapsedMs: 4999, hasBanner: true })).toBe(false);
    expect(shouldOpenPanel({ mode: "desktop", elapsedMs: 5000, hasBanner: true })).toBe(true);
  });

  test("shouldOpenPanel: no banner never opens panel", () => {
    expect(shouldOpenPanel({ mode: "desktop", elapsedMs: 99999, hasBanner: false })).toBe(false);
  });

  test("clampOverlayPosition: never offscreen", () => {
    const pos = clampOverlayPosition({
      cardRect: { left: 10, top: 10, width: 200, height: 120 },
      viewport: { width: 320, height: 480 },
      overlaySize: { width: 360, height: 240 }
    });
    expect(pos.left).toBeGreaterThanOrEqual(8);
    expect(pos.top).toBeGreaterThanOrEqual(8);
  });
});

