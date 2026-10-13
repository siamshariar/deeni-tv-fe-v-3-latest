// Player frame sizing, ported from the web app's lib/player-layout.ts.
//
// Width of the player wrapper (16:9 frame + bottom bar): 70 % of the width
// (max 1400) on desktop, 90 % on tablet, 100 % on phones — always capped so
// the 16:9 frame plus the 96 px bar reserve fits the visible height. The
// Previous player uses the same box, so it looks like a second screen
// stacked on top of the live one.

export type PlayerSize = 'desktop' | 'tablet' | 'mobile';

const BAR_RESERVE_PX = 96;

/** Web breakpoints (synced-video-player useMediaQuery). */
export function playerSizeForWidth(width: number): PlayerSize {
  if (width <= 768) return 'mobile';
  if (width <= 1024) return 'tablet';
  return 'desktop';
}

/**
 * Frame width for a window, in the same units as the window.
 * `unit` scales the web's px constants (1 on phones/tablets; the TV scale on TV).
 */
export function playerFrameWidth(size: PlayerSize, windowWidth: number, windowHeight: number, unit = 1): number {
  const base =
    size === 'desktop' ? Math.min(windowWidth * 0.7, 1400 * unit) : size === 'tablet' ? windowWidth * 0.9 : windowWidth;
  const heightCap = ((windowHeight - BAR_RESERVE_PX * unit) * 16) / 9;
  return Math.floor(Math.max(0, Math.min(base, heightCap)));
}

/** "Contain" fit of a 16:9 box in an area (fullscreen). */
export function containFit16x9(areaWidth: number, areaHeight: number): { width: number; height: number } {
  const widthForFullHeight = Math.floor(areaHeight * (16 / 9));
  if (widthForFullHeight <= areaWidth) return { width: widthForFullHeight, height: areaHeight };
  return { width: areaWidth, height: Math.floor(areaWidth * (9 / 16)) };
}
