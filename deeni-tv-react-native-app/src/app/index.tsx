import { StatusBar } from 'expo-status-bar';
import { useKeepAwake } from 'expo-keep-awake';
import { useCallback, useEffect, useState } from 'react';
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
import { toggleMainFullscreen } from '@/player/fullscreen';
import { useBroadcastStore } from '@/store/useBroadcastStore';
import { useChannelStore } from '@/store/useChannelStore';
import { usePreviousPlayerStore } from '@/store/usePreviousPlayerStore';
import { useUiStore } from '@/store/useUiStore';

const FS_CONTROLS_HIDE_MS = 3500;

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

  useBackHandler();
  useKeepAwake();

  // First visit → mandatory channel picker; returning visitor → auto-start.
  useEffect(() => {
    const saved = useChannelStore.getState().selectedId;
    if (saved) void broadcast.loadChannel(saved);
    else useUiStore.getState().open('channels-first');
    refreshChannelListInBackground();
  }, []);

  // Fullscreen: the bar hides after 3.5 s; a tap or any remote key shows it.
  const [activity, setActivity] = useState(0);
  const bump = useCallback(() => {
    useUiStore.getState().setFsControlsVisible(true);
    setActivity((n) => n + 1);
  }, []);
  useEffect(() => {
    if (!isFullscreen || overlayCount > 0) return;
    const t = setTimeout(() => useUiStore.getState().setFsControlsVisible(false), FS_CONTROLS_HIDE_MS);
    return () => clearTimeout(t);
  }, [isFullscreen, activity, overlayCount]);
  useTVEventHandler(() => {
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
