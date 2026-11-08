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

/** DeeniTV-V-2.png aspect ratio (3033×595), the wordmark in the bars and covers. */
export const LOGO_ASPECT = 3033 / 595;

/** Sizes inside a control bar, in layout units. */
export interface BarMetrics {
  padX: number;
  gap: number;
  buttonSize: number;
  iconSize: number;
  logoHeight: number;
}

/**
 * What a bar holds. `row`: the live bar, logo left and one group of buttons
 * right. `centred`: the Watched player's bar, logo left, a centred group and a
 * right group (logo and right group get equal columns so the centre stays centred).
 */
export type BarShape = { kind: 'row'; buttons: number } | { kind: 'centred'; centre: number; right: number };

/** Clear space kept between the logo and the buttons. */
const MIN_LOGO_GAP = 12;

function barWidthNeeded(shape: BarShape, m: BarMetrics, unit: number): number {
  const group = (n: number) => n * m.buttonSize + Math.max(0, n - 1) * m.gap;
  const logo = m.logoHeight * LOGO_ASPECT + MIN_LOGO_GAP * unit;
  if (shape.kind === 'row') return 2 * m.padX + logo + group(shape.buttons);
  return 2 * m.padX + group(shape.centre) + 2 * Math.max(logo, group(shape.right));
}

/**
 * The bar's web sizes, shrunk only when they don't fit `barWidth`. A rotated
 * phone needs this: its >768 dp window picks the tablet sizes (36 px buttons,
 * 24 px side padding), but the framed bar is only ~420 dp wide because the short
 * screen height caps the frame. The logo used to give way first, so it shrank to
 * a sliver and the buttons ran into it. Now, in order: side padding → 12 and gaps
 * → 4, buttons down to the phone's 28 (icons in proportion), the logo by at most
 * 15 % (keeps the 4 px gaps), gaps → 2, and only then the logo further. Bars
 * that fit (portrait, fullscreen, TV) keep the web sizes.
 */
export function fitBarMetrics(shape: BarShape, barWidth: number, base: BarMetrics, unit = 1): BarMetrics {
  const fits = (m: BarMetrics) => barWidthNeeded(shape, m, unit) <= barWidth;
  if (fits(base)) return base;
  const m: BarMetrics = { ...base, padX: Math.min(base.padX, 12 * unit), gap: Math.min(base.gap, 4 * unit) };
  const minButton = Math.min(base.buttonSize, 28 * unit);
  while (!fits(m) && m.buttonSize - unit >= minButton) m.buttonSize -= unit;
  m.iconSize = Math.round((m.buttonSize * base.iconSize) / base.buttonSize);
  const shrinkLogo = (floor: number) => {
    while (!fits(m) && m.logoHeight - 0.5 * unit >= floor) m.logoHeight -= 0.5 * unit;
  };
  shrinkLogo(base.logoHeight * 0.85);
  if (!fits(m)) m.gap = Math.min(m.gap, 2 * unit);
  shrinkLogo(12 * unit);
  return m;
}

/** "Contain" fit of a 16:9 box in an area (fullscreen). */
export function containFit16x9(areaWidth: number, areaHeight: number): { width: number; height: number } {
  const widthForFullHeight = Math.floor(areaHeight * (16 / 9));
  if (widthForFullHeight <= areaWidth) return { width: widthForFullHeight, height: areaHeight };
  return { width: areaWidth, height: Math.floor(areaWidth * (9 / 16)) };
}
