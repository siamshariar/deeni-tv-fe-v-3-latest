import { StatusBar } from 'expo-status-bar';
import { useKeepAwake } from 'expo-keep-awake';
import { useCallback, useEffect, useRef } from 'react';
import { Platform, StyleSheet, View, useTVEventHandler } from 'react-native';

import { CornerMasks } from '@/components/common/CornerMasks';
import { Focusable } from '@/components/common/Focusable';
import { PageGradient } from '@/components/common/Gradient';
import { OverlayHost, useBackHandler } from '@/components/overlays/OverlayHost';
import { ErrorOverlay } from '@/components/player/Covers';
import { LivePlayerView } from '@/components/player/LivePlayerView';
import { PreviousPlayerLayer } from '@/components/player/PreviousPlayerLayer';
import { ControlBar } from '@/components/shell/ControlBar';
import { DonateButton } from '@/components/shell/DonateButton';
import { useFrameLayout } from '@/hooks/useFrameLayout';
import { colors } from '@/lib/theme';
import { openChannelModal, refreshBroadcast, refreshChannelListInBackground } from '@/player/actions';
import { broadcast } from '@/player/broadcastController';
import { onPhoneOrientation, toggleMainFullscreen } from '@/player/fullscreen';
import { useBroadcastStore } from '@/store/useBroadcastStore';
import { useChannelStore } from '@/store/useChannelStore';
import { usePreviousPlayerStore } from '@/store/usePreviousPlayerStore';
import { useUiStore } from '@/store/useUiStore';

const FS_CONTROLS_HIDE_MS = 3500;
// TV: after a channel or programme has started, the bar stays a little longer before hiding.
const FS_HIDE_AFTER_START_MS = 5000;

/**
 * The one screen (web app/page.tsx): the live player in its frame with the
 * control bar, the Donate pill, the Previous player layer and every overlay.
 * Phones follow the web's mobile view; TV follows the desktop view (scaled).
 */
export default function LiveScreen() {
  const layout = useFrameLayout();
  const isFullscreen = useUiStore((s) => s.isFullscreen);
  const fsControlsVisible = useUiStore((s) => s.fsControlsVisible);
  const overlayCount = useUiStore((s) => s.overlays.length);
  const firstVisitPicker = useUiStore((s) => s.overlays.includes('channels-first'));
  const donateHasFocusTurn = useUiStore((s) => s.tvFocusArea === 'donate');
  const phase = useBroadcastStore((s) => s.phase);
  const errorMessage = useBroadcastStore((s) => s.errorMessage);
  const previousOpen = usePreviousPlayerStore((s) => s.isOpen);
  const previousFullscreen = usePreviousPlayerStore((s) => s.isFullscreen);
  const videoStarting = useBroadcastStore((s) => s.videoStarting);

  useBackHandler();
  useKeepAwake();

  // Phones: turning the phone sideways opens fullscreen, turning it upright leaves it
  // (YouTube app; see player/fullscreen.ts). Tablets (short side ≥ 600 dp) and TV keep their layouts.
  const isPhone = !Platform.isTV && Math.min(layout.windowWidth, layout.windowHeight) < 600;
  const isLandscape = layout.windowWidth > layout.windowHeight;
  useEffect(() => {
    if (isPhone) onPhoneOrientation(isLandscape);
  }, [isPhone, isLandscape, previousOpen]);

  // First visit → mandatory channel picker; returning visitor → auto-start.
  useEffect(() => {
    const saved = useChannelStore.getState().selectedId;
    if (saved) void broadcast.loadChannel(saved, { userStart: true });
    else useUiStore.getState().open('channels-first');
    refreshChannelListInBackground();
  }, []);

  // Fullscreen: the bar hides after 3.5 s; a tap or any remote key shows it
  // (Back too: see useBackHandler).
  const fsActivity = useUiStore((s) => s.fsActivity);
  const bump = useCallback(() => useUiStore.getState().showFsControls(), []);
  // TV (always fullscreen), like other TV players: while a channel the viewer
  // started is loading (app open, channel switch, Refresh, back from the Watched
  // player) the bar stays up, then hides 5 s after the video appears, later 3.5 s
  // after the last key. Automatic changes (the next programme, a recovery reload)
  // leave the bar as it is: hidden stays hidden. Phones keep the plain 3.5 s timer.
  const holdBar = Platform.isTV && videoStarting;
  const afterStart = useRef(false);
  useEffect(() => {
    if (!isFullscreen || overlayCount > 0) return;
    if (holdBar) {
      afterStart.current = true;
      useUiStore.getState().setFsControlsVisible(true);
      return;
    }
    const delay = afterStart.current ? FS_HIDE_AFTER_START_MS : FS_CONTROLS_HIDE_MS;
    const t = setTimeout(() => {
      afterStart.current = false;
      useUiStore.getState().setFsControlsVisible(false);
    }, delay);
    return () => clearTimeout(t);
  }, [isFullscreen, fsActivity, overlayCount, holdBar]);
  useTVEventHandler((evt) => {
    // Focus moves arrive here too; only real remote keys count.
    if (evt.eventType === 'focus' || evt.eventType === 'blur') return;
    if (useUiStore.getState().isFullscreen) bump();
  });

  const compact = layout.size === 'mobile' && !isFullscreen;
  const video = isFullscreen
    ? layout.fullscreenVideo
    : { left: layout.frameLeft, top: layout.frameTop, width: layout.frameWidth, height: layout.videoHeight };
  const barVisible = !isFullscreen || fsControlsVisible || overlayCount > 0;
  // TV fullscreen with the bar hidden: the first key only shows the bar. The
  // buttons can't take focus meanwhile; an invisible full-screen target holds it,
  // so OK can't press a button nobody can see.
  const tvBarHidden = Platform.isTV && isFullscreen && !barVisible && phase !== 'error';

  return (
    <View style={styles.root}>
      <StatusBar hidden={isFullscreen || previousFullscreen} style="light" />
      {isFullscreen ? <View style={[StyleSheet.absoluteFill, { backgroundColor: '#000' }]} /> : <PageGradient />}

      {/* First visit: the web hides the player, bar and Donate behind a 90 % black,
          blurred backdrop. Without a blur they would show through, so they are hidden. */}
      <View style={[StyleSheet.absoluteFill, { opacity: firstVisitPicker ? 0 : 1 }]} pointerEvents="box-none" collapsable={false}>
        <View style={{ position: 'absolute', left: video.left, top: video.top, width: video.width, height: video.height }}>
          <LivePlayerView
            width={video.width}
            height={video.height}
            unit={layout.unit}
            compact={compact}
            onActivity={isFullscreen ? bump : undefined}
          />
          {!isFullscreen ? <CornerMasks radius={layout.cornerRadius} /> : null}
        </View>

        <View
          // Not flattened, so hiding/showing the bar never drops D-pad focus (TV).
          collapsable={false}
          pointerEvents={barVisible ? 'box-none' : 'none'}
          style={
            isFullscreen
              ? { position: 'absolute', left: 0, right: 0, bottom: 0, opacity: barVisible ? 1 : 0 }
              : { position: 'absolute', left: layout.frameLeft, top: layout.frameTop + layout.videoHeight, width: layout.frameWidth }
          }
        >
          <ControlBar
            layout={layout}
            fullscreen={isFullscreen}
            onToggleFullscreen={toggleMainFullscreen}
            onActivity={isFullscreen ? bump : undefined}
            preferFocus={overlayCount === 0 && !previousOpen && phase !== 'error' && !tvBarHidden && !donateHasFocusTurn}
            blocked={previousOpen || tvBarHidden}
          />
        </View>

        {tvBarHidden ? (
          <Focusable
            style={StyleSheet.absoluteFill}
            focusStyle={{}}
            hasTVPreferredFocus
            onPress={bump}
            accessibilityLabel="Show controls"
          />
        ) : null}

        {phase === 'error' ? (
          <View
            style={
              isFullscreen
                ? StyleSheet.absoluteFill
                : {
                    position: 'absolute',
                    left: layout.frameLeft,
                    top: layout.frameTop,
                    width: layout.frameWidth,
                    height: layout.videoHeight + layout.barHeight,
                    borderRadius: layout.cornerRadius,
                    overflow: 'hidden',
                  }
            }
          >
            <ErrorOverlay
              unit={layout.unit}
              message={errorMessage ?? ''}
              onTryAgain={refreshBroadcast}
              onChangeChannel={openChannelModal}
            />
          </View>
        ) : null}

        {!isFullscreen ? (
          <DonateButton
            unit={layout.unit}
            blocked={previousOpen}
            preferFocus={donateHasFocusTurn && overlayCount === 0 && !previousOpen && phase !== 'error'}
          />
        ) : null}
      </View>

      <PreviousPlayerLayer />
      <OverlayHost />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
});
