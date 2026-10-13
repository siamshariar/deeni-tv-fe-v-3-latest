/**
 * Fullscreen (web hooks/use-fullscreen.ts → native): phones lock landscape
 * and hide the system bars; leaving it unlocks rotation again (the app runs
 * in both orientations, plan D-28). TV has nothing to rotate: fullscreen is
 * only the full-bleed layout. Overlays keep opening on top (web W-09).
 */
import * as NavigationBar from 'expo-navigation-bar';
import * as ScreenOrientation from 'expo-screen-orientation';
import { Platform } from 'react-native';

import { usePreviousPlayerStore } from '@/store/usePreviousPlayerStore';
import { useUiStore } from '@/store/useUiStore';

async function enterSystemFullscreen(): Promise<void> {
  if (Platform.isTV) return;
  try {
    await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
  } catch {}
  if (Platform.OS === 'android') {
    try {
      await NavigationBar.setVisibilityAsync('hidden');
    } catch {}
  }
}

async function exitSystemFullscreen(): Promise<void> {
  if (Platform.isTV) return;
  try {
    await ScreenOrientation.unlockAsync();
  } catch {}
  if (Platform.OS === 'android') {
    try {
      await NavigationBar.setVisibilityAsync('visible');
    } catch {}
  }
}

function anyFullscreen(): boolean {
  return useUiStore.getState().isFullscreen || usePreviousPlayerStore.getState().isFullscreen;
}

export function setMainFullscreen(on: boolean): void {
  useUiStore.getState().setFullscreen(on);
  if (on) void enterSystemFullscreen();
  else if (!anyFullscreen()) void exitSystemFullscreen();
}

export function toggleMainFullscreen(): void {
  setMainFullscreen(!useUiStore.getState().isFullscreen);
}

/** Previous player fullscreen. Minimizing it also leaves the main fullscreen (web). */
export function setPreviousFullscreen(on: boolean): void {
  usePreviousPlayerStore.setState({ isFullscreen: on, controlsVisible: true });
  if (on) {
    void enterSystemFullscreen();
    return;
  }
  if (useUiStore.getState().isFullscreen) useUiStore.getState().setFullscreen(false);
  if (!anyFullscreen()) void exitSystemFullscreen();
}
