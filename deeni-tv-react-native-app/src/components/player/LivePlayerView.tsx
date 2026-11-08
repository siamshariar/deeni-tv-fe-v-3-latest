import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { broadcast } from '@/player/broadcastController';
import { useBroadcastStore } from '@/store/useBroadcastStore';
import { usePreviousPlayerStore } from '@/store/usePreviousPlayerStore';

import { BrandedCover, RemainingTimePill, TuningOverlay, UpNextCard } from './Covers';
import { NativeLivePlayer, nativeLivePlayerAvailable } from './NativeLivePlayer';
import { YouTubeWebView } from './YouTubeWebView';

/** Its own component: it changes every second, and the player around it has no reason to render with it. */
function LiveRemainingPill({ unit, compact }: { unit: number; compact: boolean }) {
  const remaining = useBroadcastStore((s) => Math.floor(Math.max(0, s.duration - s.currentTime)));
  return <RemainingTimePill unit={unit} compact={compact} remaining={remaining} />;
}

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
  const coverVideoId = useBroadcastStore((s) => s.coverVideoId);
  const upNextCard = useBroadcastStore((s) => s.upNextCard);
  const endCover = useBroadcastStore((s) => s.endCover);
  const videoVisible = useBroadcastStore((s) => s.videoVisible);
  const unavailableUntil = useBroadcastStore((s) => s.unavailableUntil);
  const previousOpen = usePreviousPlayerStore((s) => s.isOpen);

  const vmin = Math.min(width, height);
  // TV: the branded cover from the start (no tuning screen before it: a second heavy draw on the
  // main thread YouTube's start shares), with the programme once it is known.
  const tvTuning = Platform.isTV && phase === 'tuning';
  // TV, a stall while playing (no picture to show): nothing of ours over the video. YouTube's own
  // spinner shows, as on YouTube, and the controller still catches up behind the scenes.
  const tvStall = Platform.isTV && phase === 'playing' && coverVisible && !coverVideoId;
  const showBranded = tvTuning || phase === 'branded' || phase === 'unavailable' || (phase === 'playing' && coverVisible && !tvStall);
  const note =
    phase === 'unavailable' && unavailableUntil
      ? "This programme isn't available here. The next one starts soon."
      : undefined;

  // Opacity (not unmount) so the stream keeps playing underneath covers and under the Previous player.
  const playerStyle = [StyleSheet.absoluteFill, { opacity: videoVisible && !previousOpen ? 1 : 0 }];

  return (
    <View style={{ width, height, backgroundColor: '#000' }}>
      {nativeLivePlayerAvailable ? (
        <NativeLivePlayer engine={broadcast.engine} onMessage={(msg) => broadcast.onPlayerMessage(msg)} style={playerStyle} />
      ) : (
        <YouTubeWebView engine={broadcast.engine} role="live" onMessage={(msg) => broadcast.onPlayerMessage(msg)} style={playerStyle} />
      )}
      <Pressable style={StyleSheet.absoluteFill} onPress={onActivity} focusable={false} accessible={false} />
      {phase === 'playing' && !showBranded ? <LiveRemainingPill unit={unit} compact={compact} /> : null}
      {upNextCard && phase === 'playing' && !showBranded ? <UpNextCard unit={unit} program={upNextCard} /> : null}
      {phase === 'tuning' && !tvTuning ? <TuningOverlay unit={unit} compact={compact} vmin={vmin} /> : null}
      {showBranded ? <BrandedCover unit={unit} compact={compact} vmin={vmin} title={coverTitle} titleOnTv note={note} upNext={endCover && phase === 'playing'} videoId={coverVideoId ?? undefined} /> : null}
    </View>
  );
}
