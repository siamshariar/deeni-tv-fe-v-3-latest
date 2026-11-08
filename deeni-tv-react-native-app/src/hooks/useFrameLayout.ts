import { useMemo } from 'react';
import { Platform, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { containFit16x9, playerFrameWidth, playerSizeForWidth, type PlayerSize } from '@/lib/playerLayout';

/**
 * Geometry of the player frame (16:9 video + control bar), shared by the
 * live player and the Previous player so both are the exact same box (web
 * lib/player-layout.ts).
 *
 * TV follows the web's desktop view, scaled: TV units = web CSS px × `unit`,
 * with unit = window width / 1280 (plan D-31: the TV looks like the 1280×720
 * laptop capture, WEB-44).
 */
export interface FrameLayout {
  size: PlayerSize;
  isTV: boolean;
  /** Multiply web CSS px by this to get layout units (1 on phones/tablets). */
  unit: number;
  windowWidth: number;
  windowHeight: number;
  frameLeft: number;
  frameTop: number;
  frameWidth: number;
  videoHeight: number;
  barHeight: number;
  buttonSize: number;
  iconSize: number;
  logoHeight: number;
  /** Top corner radius of the video (web rounded-t-2xl / md:rounded-t-3xl). */
  cornerRadius: number;
  /** Fullscreen: the 16:9 video "contain"-fit in the whole window. */
  fullscreenVideo: { width: number; height: number; left: number; top: number };
  /** Modal width rule: max 672 (>640) / 384 (≤640), 16 px gutters. */
  modalWidth: number;
}

export function useFrameLayout(): FrameLayout {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  return useMemo(() => {
    const isTV = Platform.isTV;
    const size: PlayerSize = isTV ? 'desktop' : playerSizeForWidth(width);
    const unit = isTV ? width / 1280 : 1;
    const isMobile = size === 'mobile';
    const buttonSize = (isMobile ? 28 : 36) * unit;
    const iconSize = (isMobile ? 14 : 18) * unit;
    const barPadding = (isMobile ? 12 : 16) * unit;
    const barHeight = buttonSize + barPadding * 2;
    const availableHeight = height - (isTV ? 0 : insets.top + insets.bottom);
    const frameWidth = playerFrameWidth(size, width, availableHeight, unit);
    const videoHeight = Math.floor((frameWidth * 9) / 16);
    const frameTop = Math.max(0, (isTV ? 0 : insets.top) + (availableHeight - videoHeight - barHeight) / 2);
    const fit = containFit16x9(width, height);
    const modalMax = width > 640 ? 672 : 384;
    return {
      size,
      isTV,
      unit,
      windowWidth: width,
      windowHeight: height,
      frameLeft: Math.floor((width - frameWidth) / 2),
      frameTop: Math.floor(frameTop),
      frameWidth,
      videoHeight,
      barHeight,
      buttonSize,
      iconSize,
      logoHeight: (isMobile ? 20 : 28) * unit,
      cornerRadius: (width >= 768 || isTV ? 24 : 16) * unit,
      fullscreenVideo: {
        width: fit.width,
        height: fit.height,
        left: Math.floor((width - fit.width) / 2),
        top: Math.floor((height - fit.height) / 2),
      },
      modalWidth: Math.min(modalMax * unit, width - 32 * unit),
    };
  }, [width, height, insets.top, insets.bottom]);
}
