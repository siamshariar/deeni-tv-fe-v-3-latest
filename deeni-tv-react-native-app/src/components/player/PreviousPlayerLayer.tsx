import { History, Maximize, Minimize, Pause, Play, RotateCcw, RotateCw, Volume2, VolumeX, X } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Image,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TVFocusGuideView,
  View,
  useTVEventHandler,
  type HWEvent,
} from 'react-native';

import { CornerMasks } from '@/components/common/CornerMasks';
import { Focusable } from '@/components/common/Focusable';
import { Gradient, PageGradient } from '@/components/common/Gradient';
import { Logo } from '@/components/common/Logo';
import { RoundButton } from '@/components/shell/RoundButton';
import { useFrameLayout } from '@/hooks/useFrameLayout';
import { youtubeFlags } from '@/lib/config';
import { colors, fonts } from '@/lib/theme';
import { formatTime } from '@/lib/time';
import { focusWithRetry, requestTVFocus } from '@/lib/tvFocus';
import { setPreviousFullscreen } from '@/player/fullscreen';
import { SKIP_SECONDS, previousPlayer } from '@/player/previousController';
import { usePreviousPlayerStore } from '@/store/usePreviousPlayerStore';

import { BrandedCover } from './Covers';
import { YouTubeWebView } from './YouTubeWebView';

const CONTROLS_HIDE_MS = 3500;
// TV hold-to-scrub on the seek bar.
const SCRUB_TICK_MS = 150;
const SCRUB_RAMP_MS = 3000;
const SCRUB_MAX_MS = 30000;

/**
 * The Previous-programme player (web W-08): a full-screen layer over the
 * live player, with the same frame size and shape. Created the first time
 * the Previous list opens and kept mounted afterwards (only hidden), so the
 * page never has to be rebuilt.
 */
export function PreviousPlayerLayer() {
  const layout = useFrameLayout();
  const s = usePreviousPlayerStore();
  const [activity, setActivity] = useState(0);
  const bump = useCallback(() => {
    usePreviousPlayerStore.setState({ controlsVisible: true });
    setActivity((n) => n + 1);
  }, []);

  // Title / progress / pill (and the bar in fullscreen) hide after 3.5 s while playing.
  useEffect(() => {
    if (!s.isOpen) return;
    if (!s.isPlaying || s.isEnded || s.isLoading) {
      if (!s.controlsVisible) usePreviousPlayerStore.setState({ controlsVisible: true });
      return;
    }
    const t = setTimeout(() => usePreviousPlayerStore.setState({ controlsVisible: false }), CONTROLS_HIDE_MS);
    return () => clearTimeout(t);
  }, [s.isOpen, s.isPlaying, s.isEnded, s.isLoading, s.controlsVisible, activity]);

  // TV remote: any key shows the controls; media keys drive the transport.
  // react-native-tvos sends Android TV keys to JS on key-up only (key-down
  // events are off by default), so the handlers act on key-up.
  useTVEventHandler((evt: HWEvent) => {
    if (!Platform.isTV || !usePreviousPlayerStore.getState().isOpen) return;
    if (evt.eventKeyAction !== 1) return;
    bump();
    if (evt.eventType === 'playPause') previousPlayer.togglePlay();
    else if (evt.eventType === 'rewind') previousPlayer.skip(-SKIP_SECONDS);
    else if (evt.eventType === 'fastForward') previousPlayer.skip(SKIP_SECONDS);
  });

  if (!s.isCreated) return null;

  const fs = s.isFullscreen;
  const box = fs
    ? layout.fullscreenVideo
    : { left: layout.frameLeft, top: layout.frameTop, width: layout.frameWidth, height: layout.videoHeight };
  const compact = layout.size === 'mobile' && !fs;
  const unit = layout.unit;
  const showChrome = s.controlsVisible || !s.isPlaying || s.isEnded;
  const showThumb = youtubeFlags.thumbnailCoverOnPauseAndEnd && !!s.video && !s.isLoading && (!s.isPlaying || s.isEnded);
  // While the remote scrubs, the video keeps playing; a busy box can delay its progress
  // reports, so the stall cover is not shown then (it would cover the moving bar).
  const scrubbing = s.scrubTime !== null;
  const showBranded = !!s.video && (s.isLoading || (s.isStalled && !s.isEnded && !scrubbing));
  // TV fullscreen with the controls hidden: the first key only shows them (see the
  // live screen); the hidden buttons and seek bar can't take focus meanwhile.
  const tvHidden = Platform.isTV && s.isOpen && fs && !showChrome;
  // Web: the iframe is hidden whenever a cover is up (loading, stall, pause /
  // end thumbnail), so YouTube's own spinner, title bar and "More videos" never show.
  const videoShown = s.isOpen && !s.isLoading && (!s.isStalled || scrubbing) && (s.isPlaying || !youtubeFlags.thumbnailCoverOnPauseAndEnd);

  // Title / progress / pill. Always mounted while open, under the branded
  // cover like the web (z-30 under z-45; above it in fullscreen): unmounting
  // it during a stall dropped D-pad focus from the seek bar on TV.
  const strip = s.isOpen ? (
    <View
      collapsable={false}
      style={[StyleSheet.absoluteFill, { opacity: showChrome ? 1 : 0 }]}
      pointerEvents={showChrome || Platform.isTV ? 'box-none' : 'none'}
    >
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 12 * unit,
          right: 12 * unit,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4 * unit,
          backgroundColor: colors.black70,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: colors.border20,
          paddingHorizontal: 10 * unit,
          paddingVertical: 4 * unit,
        }}
      >
        <History size={12 * unit} color={colors.white} />
        <Text style={{ color: colors.white, fontFamily: fonts.medium, fontSize: 11 * unit }}>Previous Program</Text>
      </View>
      {/* Fullscreen: sits on top of the floating bar (web: info block above the controls),
          on the shared fullscreen gradient. */}
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: fs ? layout.barHeight : 0,
          paddingHorizontal: 12 * unit,
          paddingBottom: 8 * unit,
          paddingTop: 28 * unit,
        }}
      >
        {fs ? null : <Gradient direction="b" stops={[{ offset: 0, color: '#000', opacity: 0 }, { offset: 1, color: '#000', opacity: 0.85 }]} />}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 * unit, marginBottom: 6 * unit }}>
          <Text numberOfLines={1} style={{ flex: 1, color: colors.white, fontFamily: fonts.semibold, fontSize: (compact ? 11 : 13) * unit }}>
            {s.video?.title}
          </Text>
          <Text style={{ color: 'rgba(255,255,255,0.85)', fontFamily: fonts.mono, fontSize: (compact ? 10 : 12) * unit }}>
            {formatTime(s.scrubTime ?? s.currentTime)} / {formatTime(s.duration)}
          </Text>
        </View>
        <SeekBar unit={unit} current={s.scrubTime ?? s.currentTime} duration={s.duration} onActivity={bump} focusable={!tvHidden} />
      </View>
    </View>
  ) : null;

  return (
    <View
      // Never flattened by Fabric: an opacity change on a flattened View
      // re-creates it, re-parents its children and drops D-pad focus on TV.
      collapsable={false}
      style={[StyleSheet.absoluteFill, { opacity: s.isOpen ? 1 : 0 }]}
      pointerEvents={s.isOpen ? 'auto' : 'none'}
      accessibilityElementsHidden={!s.isOpen}
      importantForAccessibility={s.isOpen ? 'auto' : 'no-hide-descendants'}
    >
      {fs ? <View style={[StyleSheet.absoluteFill, { backgroundColor: '#000' }]} /> : <PageGradient />}

      <View
        style={{
          position: 'absolute',
          left: box.left,
          top: box.top,
          width: box.width,
          height: box.height,
          backgroundColor: '#000',
          borderTopLeftRadius: fs ? 0 : layout.cornerRadius,
          borderTopRightRadius: fs ? 0 : layout.cornerRadius,
        }}
      >
        <YouTubeWebView
          engine={previousPlayer.engine}
          role="previous"
          onMessage={(msg) => previousPlayer.onPlayerMessage(msg)}
          style={[StyleSheet.absoluteFill, { opacity: videoShown ? 1 : 0 }]}
        />
        {/* A tap only shows the controls; it never pauses (mobile web, M-06). */}
        <Pressable style={StyleSheet.absoluteFill} onPress={bump} focusable={false} accessible={false} />

        {showThumb ? <ThumbnailCover videoId={s.video!.videoId} /> : null}
        {fs ? null : strip}
        {showBranded ? (
          <BrandedCover unit={unit} compact={compact} vmin={Math.min(box.width, box.height)} title={s.video!.title} />
        ) : null}
        {fs && s.isOpen ? (
          // Web fullscreen: one edge-to-edge gradient (black 95 % → 70 % → clear) behind
          // the title / progress and the buttons; no separate bar band or border.
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              height: layout.barHeight + 120 * unit,
              opacity: showChrome ? 1 : 0,
            }}
          >
            <Gradient
              direction="b"
              stops={[
                { offset: 0, color: '#000', opacity: 0 },
                { offset: 0.45, color: '#000', opacity: 0.7 },
                { offset: 1, color: '#000', opacity: 0.95 },
              ]}
            />
          </View>
        ) : null}
        {fs ? strip : null}
        {fs ? null : <CornerMasks radius={layout.cornerRadius} />}
        {tvHidden ? (
          <Focusable style={StyleSheet.absoluteFill} focusStyle={{}} hasTVPreferredFocus onPress={bump} accessibilityLabel="Show controls" />
        ) : null}
      </View>

      {s.isOpen ? (
        <TransportBar
          layout={layout}
          fullscreen={fs}
          visible={!fs || showChrome}
          hidden={tvHidden}
          top={fs ? undefined : layout.frameTop + layout.videoHeight}
          onActivity={bump}
        />
      ) : null}
    </View>
  );
}

function ThumbnailCover({ videoId }: { videoId: string }) {
  const [quality, setQuality] = useState<'maxresdefault' | 'hqdefault'>('maxresdefault');
  useEffect(() => setQuality('maxresdefault'), [videoId]);
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Image
        source={{ uri: `https://img.youtube.com/vi/${videoId}/${quality}.jpg` }}
        onError={() => setQuality('hqdefault')}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
      />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.55)' }]} />
    </View>
  );
}

/** Seek bar: drag / tap on touch screens; a focusable step scrubber (◀ ▶ = ∓10 s) on TV. */
function SeekBar({
  unit,
  current,
  duration,
  onActivity,
  focusable = true,
}: {
  unit: number;
  current: number;
  duration: number;
  onActivity: () => void;
  focusable?: boolean;
}) {
  const widthRef = useRef(1);
  const [drag, setDrag] = useState<number | null>(null);
  const [focused, setFocused] = useState(false);
  const shown = drag ?? current;
  const progress = duration > 0 ? Math.min(1, Math.max(0, shown / duration)) : 0;

  // TV remote while the bar has focus:
  // - a press of left / right (sent on key-up) skips -/+10 s;
  // - holding it ("longLeft" / "longRight": once when the hold starts, again on
  //   release) moves the bar continuously, faster the longer it is held (1 % of
  //   the video per second, rising to 6 % after 3 s), and seeks once on release.
  const onActivityRef = useRef(onActivity);
  onActivityRef.current = onActivity;
  const scrub = useRef<{ timer: ReturnType<typeof setInterval>; pos: number } | null>(null);
  const endScrub = useCallback((commit: boolean) => {
    const sc = scrub.current;
    if (!sc) return;
    clearInterval(sc.timer);
    scrub.current = null;
    if (commit) previousPlayer.seek(sc.pos);
    usePreviousPlayerStore.setState({ scrubTime: null });
  }, []);
  const startScrub = useCallback(
    (dir: 1 | -1) => {
      endScrub(false);
      const startedAt = Date.now();
      const sc = { pos: usePreviousPlayerStore.getState().currentTime, timer: setInterval(() => tick(), SCRUB_TICK_MS) };
      scrub.current = sc;
      function tick() {
        const held = Date.now() - startedAt;
        if (held > SCRUB_MAX_MS) {
          endScrub(true); // the release never arrived
          return;
        }
        const dur = durationRef.current;
        const pctPerSec = 0.01 + 0.05 * Math.min(1, held / SCRUB_RAMP_MS);
        const step = Math.max(10, dur * pctPerSec) * (SCRUB_TICK_MS / 1000);
        sc.pos = Math.min(Math.max(0, sc.pos + dir * step), dur > 0 ? dur - 0.5 : sc.pos);
        usePreviousPlayerStore.setState({ scrubTime: sc.pos });
        onActivityRef.current();
      }
      tick();
    },
    [endScrub],
  );
  useEffect(() => () => endScrub(false), [endScrub]);
  useEffect(() => {
    if (!focused) endScrub(true);
  }, [focused, endScrub]);

  useTVEventHandler((evt: HWEvent) => {
    if (!Platform.isTV || !focused) return;
    const type = evt.eventType;
    if (type === 'longRight' || type === 'longLeft') {
      if (evt.eventKeyAction === 0) startScrub(type === 'longRight' ? 1 : -1);
      else endScrub(true);
      return;
    }
    if (evt.eventKeyAction !== 1) return; // key-up only (see the layer's handler)
    if (type === 'left') previousPlayer.skip(-SKIP_SECONDS);
    if (type === 'right') previousPlayer.skip(SKIP_SECONDS);
  });

  // Touch: positions come from the finger's pageX minus the bar's page position
  // (measured on layout and again when a touch starts). locationX was
  // unreliable: it is relative to whichever child the finger is over (the 12 px
  // thumb once it moves under the finger), and a drag never seeked.
  const barRef = useRef<View>(null);
  const barX = useRef(0);
  const measureBar = () =>
    barRef.current?.measure((_x, _y, w, _h, pageX) => {
      barX.current = pageX;
      if (w > 0) widthRef.current = w;
    });
  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e) => {
        measureBar();
        onActivity();
        setDrag(fraction(e.nativeEvent.pageX - barX.current) * durationRef.current);
      },
      onPanResponderMove: (e) => setDrag(fraction(e.nativeEvent.pageX - barX.current) * durationRef.current),
      onPanResponderRelease: (e) => {
        previousPlayer.seek(fraction(e.nativeEvent.pageX - barX.current) * durationRef.current);
        setDrag(null);
      },
      onPanResponderTerminate: () => setDrag(null),
    }),
  ).current;
  const durationRef = useRef(duration);
  durationRef.current = duration;
  function fraction(x: number) {
    return Math.min(1, Math.max(0, x / widthRef.current));
  }

  const track = (
    <View style={{ height: 4 * unit, borderRadius: 2 * unit, backgroundColor: 'rgba(255,255,255,0.3)' }}>
      <View style={{ width: `${progress * 100}%`, height: '100%', borderRadius: 2 * unit, backgroundColor: colors.red600 }} />
      <View
        style={{
          position: 'absolute',
          left: `${progress * 100}%`,
          top: -4 * unit,
          width: 12 * unit,
          height: 12 * unit,
          marginLeft: -6 * unit,
          borderRadius: 6 * unit,
          backgroundColor: colors.white,
        }}
      />
    </View>
  );

  if (Platform.isTV) {
    // No focus guide here: a guide without destinations swallowed focus on the
    // test box. The bar spans the whole width, so ◀ ▶ can't leave it anyway;
    // they skip ∓10 s, or scrub while held (handler above).
    return (
      <Focusable
        focusable={focusable}
        onFocus={() => {
          setFocused(true);
          onActivity();
        }}
        onBlur={() => setFocused(false)}
        onPress={() => previousPlayer.togglePlay()}
        accessibilityLabel="Seek bar. Left and right skip 10 seconds; hold to scrub."
        style={{ paddingVertical: 8 * unit, borderRadius: 4, borderWidth: 2, borderColor: 'transparent' }}
      >
        {track}
      </Focusable>
    );
  }

  return (
    <View
      {...responder.panHandlers}
      ref={barRef}
      onLayout={(e) => {
        widthRef.current = Math.max(1, e.nativeEvent.layout.width);
        measureBar();
      }}
      style={{ paddingVertical: 8 * unit }}
      hitSlop={{ top: 8, bottom: 8 }}
    >
      <View pointerEvents="none">{track}</View>
    </View>
  );
}

/** Logo · ⟲10 / Play-Pause-Replay / ⟳10 · Mute / Full screen / Close (web W-08 bar). */
function TransportBar({
  layout,
  fullscreen,
  visible,
  top,
  onActivity,
  hidden,
}: {
  layout: ReturnType<typeof useFrameLayout>;
  fullscreen: boolean;
  visible: boolean;
  top?: number;
  onActivity: () => void;
  /** TV fullscreen, controls hidden: no button may take focus. */
  hidden: boolean;
}) {
  const isPlaying = usePreviousPlayerStore((st) => st.isPlaying);
  const isEnded = usePreviousPlayerStore((st) => st.isEnded);
  const isMuted = usePreviousPlayerStore((st) => st.isMuted);
  const isOpen = usePreviousPlayerStore((st) => st.isOpen);
  const { buttonSize, iconSize, unit } = layout;
  const playRef = useRef<View>(null);
  // TV: Play/Pause takes focus when the player opens. The Previous list row
  // that had focus unmounts in the same moment, and Android TV drops a focus
  // request made during that transition, so it is repeated once (Safe Kids).
  useEffect(() => {
    if (!Platform.isTV || !isOpen) return undefined;
    return focusWithRetry(() => requestTVFocus(playRef.current));
  }, [isOpen]);
  // …and again when hidden fullscreen controls come back.
  const wasHidden = useRef(false);
  useEffect(() => {
    if (!Platform.isTV) return undefined;
    if (hidden) {
      wasHidden.current = true;
      return undefined;
    }
    if (!wasHidden.current) return undefined;
    wasHidden.current = false;
    return focusWithRetry(() => requestTVFocus(playRef.current));
  }, [hidden]);
  const act = (fn: () => void) => () => {
    onActivity();
    fn();
  };
  const centre = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 * unit }}>
      <RoundButton focusable={!hidden} icon={RotateCcw} label="Back 10 seconds" size={buttonSize} iconSize={iconSize} onPress={act(() => previousPlayer.skip(-SKIP_SECONDS))} onFocus={onActivity} />
      <RoundButton
        focusable={!hidden}
        ref={playRef}
        icon={isEnded ? RotateCcw : isPlaying ? Pause : Play}
        label={isEnded ? 'Replay' : isPlaying ? 'Pause' : 'Play'}
        size={buttonSize}
        iconSize={iconSize}
        onPress={act(() => previousPlayer.togglePlay())}
        hasTVPreferredFocus={isOpen}
        onFocus={onActivity}
      />
      <RoundButton focusable={!hidden} icon={RotateCw} label="Forward 10 seconds" size={buttonSize} iconSize={iconSize} onPress={act(() => previousPlayer.skip(SKIP_SECONDS))} onFocus={onActivity} />
    </View>
  );
  const right = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 * unit }}>
      <RoundButton focusable={!hidden} icon={isMuted ? VolumeX : Volume2} label={isMuted ? 'Unmute' : 'Mute'} size={buttonSize} iconSize={iconSize} onPress={act(() => previousPlayer.toggleMute())} onFocus={onActivity} />
      <RoundButton
        focusable={!hidden}
        icon={fullscreen ? Minimize : Maximize}
        label={fullscreen ? 'Exit full screen' : 'Full screen'}
        size={buttonSize}
        iconSize={iconSize}
        onPress={act(() => setPreviousFullscreen(!fullscreen))}
        onFocus={onActivity}
      />
      <RoundButton focusable={!hidden} icon={X} label="Close" size={buttonSize} iconSize={iconSize} onPress={() => previousPlayer.close()} onFocus={onActivity} />
    </View>
  );
  const row = (
    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <View style={{ flex: 1 }}>
        <Logo height={layout.logoHeight} style={{ maxWidth: '90%' }} />
      </View>
      {centre}
      <View style={{ flex: 1, alignItems: 'flex-end' }}>{right}</View>
    </View>
  );
  return (
    <View
      collapsable={false}
      pointerEvents={visible ? 'auto' : 'none'}
      style={{
        position: 'absolute',
        left: fullscreen ? 0 : layout.frameLeft,
        width: fullscreen ? layout.windowWidth : layout.frameWidth,
        ...(fullscreen ? { bottom: 0 } : { top }),
        opacity: visible ? 1 : 0,
        flexDirection: 'row',
        alignItems: 'center',
        ...(fullscreen
          ? {
              // Web fullscreen: no band or border; the layer's gradient is the background,
              // edge to edge.
              height: layout.barHeight,
              paddingHorizontal: (layout.windowWidth >= 640 || layout.isTV ? 24 : 12) * unit,
            }
          : {
              height: layout.barHeight,
              paddingHorizontal: (layout.windowWidth >= 640 || layout.isTV ? 24 : 12) * unit,
              backgroundColor: colors.black60,
              borderColor: colors.border10,
              borderWidth: 1,
              borderTopWidth: 0,
              borderBottomLeftRadius: layout.cornerRadius,
              borderBottomRightRadius: layout.cornerRadius,
            }),
      }}
    >
      {Platform.isTV ? (
        <TVFocusGuideView autoFocus trapFocusLeft trapFocusRight style={{ flex: 1, flexDirection: 'row' }}>
          {row}
        </TVFocusGuideView>
      ) : (
        row
      )}
    </View>
  );
}
