/**
 * TV focus helpers (from Safe Kids TV lib/tvFocus.ts). `requestTVFocus` exists
 * on native views (and on refs of Pressable / View) in react-native-tvos, but
 * isn't in the public types.
 */
type Focusable = { requestTVFocus?: () => void } | null | undefined;

export function requestTVFocus(target: unknown): void {
  (target as Focusable)?.requestTVFocus?.();
}

/**
 * Focuses now and again after 400 ms: a request made during a screen
 * transition (one view unmounting while another mounts) can be dropped by
 * Android TV. Returns the cleanup for an effect.
 */
export function focusWithRetry(focus: () => void, delayMs = 400): () => void {
  focus();
  const timer = setTimeout(focus, delayMs);
  return () => clearTimeout(timer);
}
