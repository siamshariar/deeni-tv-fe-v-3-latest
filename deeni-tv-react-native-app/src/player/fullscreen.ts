/**
 * Fullscreen (web hooks/use-fullscreen.ts → native): phones lock landscape
 * and hide the system bars; leaving it unlocks rotation again (the app runs
 * in both orientations, plan D-28). TV has nothing to rotate: fullscreen is
 * only the full-bleed layout, and TV is always fullscreen (product decision
 * 2026-10-17): both players start full-bleed and can't leave it, and their
 * bars have no Full screen button. Overlays keep opening on top (web W-09).
 *
 * Phones also follow the phone's rotation, like the YouTube app (product
 * request 2026-10-18; the web has no equivalent): turning the phone sideways
 * opens fullscreen (the Watched player's when it is open), turning it back
 * upright leaves it. That fullscreen doesn't lock the orientation, or turning
 * back could never be noticed. The Full screen button still locks landscape.
 * Leaving fullscreen by button or Back while the phone is sideways rotates back
 * to the upright screen at once, like the YouTube app (product request
 * 2026-10-18), and holds it until the phone is really turned upright
 * (accelerometer); then rotation is free again, so turning the phone sideways
 * reopens fullscreen. Without an accelerometer the windowed landscape view stays
 * until the phone is upright.
 */
import * as NavigationBar from 'expo-navigation-bar';
import * as ScreenOrientation from 'expo-screen-orientation';
import { Accelerometer } from 'expo-sensors';
import { Dimensions, Platform } from 'react-native';

import { usePreviousPlayerStore } from '@/store/usePreviousPlayerStore';
import { useUiStore } from '@/store/useUiStore';

/** What switched fullscreen: the viewer (button, Back) or turning the phone. */
export type FullscreenSource = 'user' | 'rotation';

/** The current fullscreen was opened by turning the phone: turning it upright leaves it. */
let byRotation = false;
/** The viewer left fullscreen with the phone sideways: don't reopen it until the phone is upright. */
let rotationOptOut = false;
/** System fullscreen (bars hidden, maybe an orientation lock) is applied. */
let systemOn = false;
/** The viewer is leaving fullscreen with the phone sideways: rotate back to the upright screen. */
let portraitOnExit = false;
/** Accelerometer watch that frees the portrait lock once the phone is held upright. */
let uprightWatch: { remove(): void } | null = null;
/** Bumped on every entry into fullscreen: a slower exit must not lock portrait afterwards. */
let generation = 0;

/** Gravity in the screen's plane (g) below which the phone counts as flat: tilted back more than ~70°. */
const MIN_PLANE_G = 0.34;
/** Long axis vs short axis: gravity within ~35° of the long axis counts as upright. */
const UPRIGHT_RATIO = 1.4;
/** Upright for this long before rotation is given back (a brief tilt doesn't count). */
const UPRIGHT_HOLD_MS = 400;
const SENSOR_INTERVAL_MS = 200;

const windowIsLandscape = () => {
  const { width, height } = Dimensions.get('window');
  return width > height;
};

/**
 * Held upright, judged the way Android's own auto-rotate judges it: the direction of
 * gravity in the screen's plane, at any tilt up to ~70° back. A phone lying flat has
 * no orientation (Android doesn't rotate it either) and keeps the lock. Phone test,
 * 2026-10-18: requiring 0.7 g along the long axis (≤45° tilt) never released for a
 * phone tilted back or lying on the desk, so turning it later did nothing.
 */
export function isHeldUpright(x: number, y: number): boolean {
  return Math.hypot(x, y) >= MIN_PLANE_G && Math.abs(y) >= UPRIGHT_RATIO * Math.abs(x);
}

function stopUprightWatch(): void {
  uprightWatch?.remove();
  uprightWatch = null;
}

/**
 * Lock the upright screen and give rotation back once the phone is held upright.
 * false: no accelerometer or no lock, so the caller frees rotation itself.
 */
async function holdPortraitUntilUpright(): Promise<boolean> {
  const gen = generation;
  try {
    if (!(await Accelerometer.isAvailableAsync())) return false;
    if (gen !== generation) return true; // fullscreen reopened meanwhile: leave its lock alone
    await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
  } catch {
    return false;
  }
  if (gen !== generation) return true;
  stopUprightWatch();
  let uprightSince = 0;
  Accelerometer.setUpdateInterval(SENSOR_INTERVAL_MS);
  uprightWatch = Accelerometer.addListener(({ x, y }) => {
    if (!isHeldUpright(x, y)) {
      uprightSince = 0;
      return;
    }
    const now = Date.now();
    if (!uprightSince) uprightSince = now;
    else if (now - uprightSince >= UPRIGHT_HOLD_MS) {
      stopUprightWatch();
      ScreenOrientation.unlockAsync().catch(() => {});
    }
  });
  return true;
}

async function enterSystemFullscreen(lockLandscape: boolean): Promise<void> {
  if (Platform.isTV) return;
  generation += 1;
  stopUprightWatch();
  systemOn = true;
  try {
    // Rotation-opened fullscreen drops any earlier lock, so turning the phone upright is seen.
    if (lockLandscape) await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
    else await ScreenOrientation.unlockAsync();
  } catch {}
  if (Platform.OS === 'android') {
    try {
      await NavigationBar.setVisibilityAsync('hidden');
    } catch {}
  }
}

async function exitSystemFullscreen(): Promise<void> {
  if (Platform.isTV) return;
  systemOn = false;
  const toPortrait = portraitOnExit;
  portraitOnExit = false;
  if (!(toPortrait && (await holdPortraitUntilUpright()))) {
    // No accelerometer: keep the windowed landscape view until the phone is upright.
    if (toPortrait) rotationOptOut = true;
    try {
      await ScreenOrientation.unlockAsync();
    } catch {}
  }
  if (Platform.OS === 'android') {
    try {
      await NavigationBar.setVisibilityAsync('visible');
    } catch {}
  }
}

function anyFullscreen(): boolean {
  return useUiStore.getState().isFullscreen || usePreviousPlayerStore.getState().isFullscreen;
}

function noteSwitch(on: boolean, source: FullscreenSource): void {
  if (on) {
    // A button press makes it a locked fullscreen; rotation only counts when it opened it.
    if (source === 'user' || !anyFullscreen()) byRotation = source === 'rotation';
    rotationOptOut = false;
    portraitOnExit = false;
  } else if (source === 'user' && windowIsLandscape()) {
    portraitOnExit = true;
  }
}

function afterLeaving(): void {
  if (anyFullscreen()) {
    portraitOnExit = false;
    return;
  }
  byRotation = false;
  void exitSystemFullscreen();
}

/** TV never leaves fullscreen. */
export const ALWAYS_FULLSCREEN = Platform.isTV;

export function setMainFullscreen(on: boolean, source: FullscreenSource = 'user'): void {
  if (!on && ALWAYS_FULLSCREEN) return;
  noteSwitch(on, source);
  useUiStore.getState().setFullscreen(on);
  if (on) void enterSystemFullscreen(source === 'user');
  else afterLeaving();
}

export function toggleMainFullscreen(): void {
  setMainFullscreen(!useUiStore.getState().isFullscreen);
}

/** Previous player fullscreen. Minimizing it also leaves the main fullscreen (web). */
export function setPreviousFullscreen(on: boolean, source: FullscreenSource = 'user'): void {
  if (!on && ALWAYS_FULLSCREEN) return;
  noteSwitch(on, source);
  usePreviousPlayerStore.setState({ isFullscreen: on, controlsVisible: true });
  if (on) {
    void enterSystemFullscreen(source === 'user');
    return;
  }
  if (useUiStore.getState().isFullscreen) useUiStore.getState().setFullscreen(false);
  afterLeaving();
}

/**
 * Phones: the window's orientation, on every turn and when the Watched player
 * opens or closes. Sideways → fullscreen (unless the viewer just left it);
 * upright → leave a fullscreen that turning opened.
 */
export function onPhoneOrientation(landscape: boolean): void {
  if (ALWAYS_FULLSCREEN) return;
  if (!landscape) {
    rotationOptOut = false;
    if (byRotation && anyFullscreen()) {
      if (usePreviousPlayerStore.getState().isFullscreen) setPreviousFullscreen(false, 'rotation');
      else setMainFullscreen(false, 'rotation');
    } else if (!anyFullscreen() && systemOn) {
      // e.g. the Watched player was closed while fullscreen: drop its lock and bar hiding.
      void exitSystemFullscreen();
    }
    return;
  }
  if (rotationOptOut || anyFullscreen()) return;
  if (usePreviousPlayerStore.getState().isOpen) setPreviousFullscreen(true, 'rotation');
  else setMainFullscreen(true, 'rotation');
}
