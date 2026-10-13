import { Pressable, StyleSheet, View } from 'react-native';

import { broadcast } from '@/player/broadcastController';
import { useBroadcastStore } from '@/store/useBroadcastStore';
import { usePreviousPlayerStore } from '@/store/usePreviousPlayerStore';

import { BrandedCover, RemainingTimePill, TuningOverlay } from './Covers';
import { YouTubeWebView } from './YouTubeWebView';

/**
 * The live broadcast inside its 16:9 box. Layers, bottom to top (web order):
 * WebView (hidden until the first real movement) → touch shield (the live
 * video ignores taps) → remaining-time pill → tuning → branded cover.
 * The WebView is never remounted: framed ↔ fullscreen only changes the box.
 */
export function LivePlayerView({
  width,
  height,
  unit,
  compact,
  onActivity,
}: {
  width: number;
  height: number;
  unit: number;
  compact: boolean;
  /** A tap on the video (shows the fullscreen controls; nothing else). */
  onActivity?: () => void;
}) {
  const phase = useBroadcastStore((s) => s.phase);
  const coverVisible = useBroadcastStore((s) => s.coverVisible);
  const coverTitle = useBroadcastStore((s) => s.coverTitle);
  const videoVisible = useBroadcastStore((s) => s.videoVisible);
  const remaining = useBroadcastStore((s) => Math.max(0, s.duration - s.currentTime));
  const unavailableUntil = useBroadcastStore((s) => s.unavailableUntil);
  const previousOpen = usePreviousPlayerStore((s) => s.isOpen);

  const vmin = Math.min(width, height);
  const showBranded = phase === 'branded' || phase === 'unavailable' || (phase === 'playing' && coverVisible);
  const note =
    phase === 'unavailable' && unavailableUntil
      ? "This programme isn't available here. The next one starts soon."
      : undefined;

  return (
    <View style={{ width, height, backgroundColor: '#000' }}>
      <YouTubeWebView
        engine={broadcast.engine}
        role="live"
        onMessage={(msg) => broadcast.onPlayerMessage(msg)}
        // Opacity (not unmount) so the stream keeps playing underneath covers
        // and under the Previous player.
        style={[StyleSheet.absoluteFill, { opacity: videoVisible && !previousOpen ? 1 : 0 }]}
      />
      <Pressable style={StyleSheet.absoluteFill} onPress={onActivity} focusable={false} accessible={false} />
      {phase === 'playing' && !showBranded ? <RemainingTimePill unit={unit} compact={compact} remaining={remaining} /> : null}
      {phase === 'tuning' ? <TuningOverlay unit={unit} compact={compact} vmin={vmin} /> : null}
      {showBranded ? <BrandedCover unit={unit} compact={compact} vmin={vmin} title={coverTitle} note={note} /> : null}
    </View>
  );
}
