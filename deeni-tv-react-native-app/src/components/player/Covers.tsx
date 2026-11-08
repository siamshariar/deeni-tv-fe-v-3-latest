import AlertCircle from 'lucide-react-native/icons/circle-alert';
import Clock from 'lucide-react-native/icons/clock';
import Play from 'lucide-react-native/icons/play';
import RefreshCw from 'lucide-react-native/icons/refresh-cw';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Platform, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { Focusable } from '@/components/common/Focusable';
import { Gradient } from '@/components/common/Gradient';
import { Logo } from '@/components/common/Logo';
import { Fade, Pulse, Spin, SweepBar } from '@/components/common/Motion';
import { LoaderRing } from '@/components/common/Rings';
import { YOUTUBE_ICON_MS, youtubeFlags } from '@/lib/config';
import { colors, fonts } from '@/lib/theme';
import { hideLaunchSplash } from '@/lib/launchSplash';
import { formatTime } from '@/lib/time';
import { noteThumbMissing, thumbQuality, thumbUrl, type ThumbQuality } from '@/lib/youtube/thumbnail';
import type { VideoProgram } from '@/types';

import { DeeniSpinnerView } from '../../../modules/deeni-live-player';

/** Size helpers: web px × unit (TV scale). `compact` = web ≤768 px mobile sizing. */
interface Sizing {
  unit: number;
  compact: boolean;
  /** min(width, height) of the video box, for the web's vmin-based sizes. */
  vmin: number;
}

/**
 * The branded "WATCHING ‹title›" screen (web W-03). Fully opaque: it hides
 * the YouTube iframe (its spinner, title bar, end screen) until the video
 * has really moved. `note` adds a line under the title (unavailable programme).
 *
 * `logoOnly`: the phone's first loading screen, while the schedule is fetched (user request
 * 2026-11-08, in place of the web's "Tuning into your broadcast..."): the same screen with no
 * text. The title box slots in once the programme is known; its place is kept, invisible, under
 * the sweep bar, so the ring stays where it is (a two-line title moves it up half a line).
 *
 * TV: TvCover. The WebView's browser side runs on the app's main thread, and on the TV box the SVG
 * gradient (drawn in software) and the Reanimated loops kept that thread busy while YouTube
 * started: decoder to first picture took 6.6 s instead of 3.6 s (profile, 2026-11-04).
 */
export function BrandedCover({
  unit,
  compact,
  vmin,
  title,
  note,
  upNext,
  videoId,
  titleOnTv,
  logoOnly,
}: Sizing & { title: string; note?: string; upNext?: boolean; videoId?: string; titleOnTv?: boolean; logoOnly?: boolean }) {
  if (Platform.isTV) return <TvCover unit={unit} title={titleOnTv ? title : ''} note={note} videoId={videoId} />;
  // Ring and sweep bar are sized from the screen like the web's 14vmin / 25vmin
  // (CSS vmin is the viewport, not the video box: the box-based size was ~30 %
  // smaller than the web's on TV).
  const window = useWindowDimensions();
  const screenVmin = Math.min(window.width, window.height);
  const ring = Math.round(Math.max((compact ? 56 : 72) * unit, Math.min(screenVmin * 0.14, (compact ? 112 : 144) * unit)));
  const smallText = (compact ? 7 : 10) * unit;
  const titleSize = (compact ? 14 : 18) * unit;
  // `hidden`: only holds the box's place (one line of title), for `logoOnly`.
  const titleBox = (hidden: boolean) => (
    <View
      accessibilityElementsHidden={hidden}
      importantForAccessibility={hidden ? 'no-hide-descendants' : 'auto'}
      style={{
        maxWidth: Math.min(vmin * 1.6, 512 * unit),
        backgroundColor: colors.fill5,
        borderColor: colors.border10,
        borderWidth: 1,
        borderRadius: 12 * unit,
        paddingHorizontal: (compact ? 12 : 20) * unit,
        paddingVertical: (compact ? 8 : 12) * unit,
        opacity: hidden ? 0 : 1,
      }}
    >
      <Text style={[styles.text, { color: colors.text50, fontFamily: fonts.medium, fontSize: smallText, letterSpacing: 1, marginBottom: 2 * unit }]}>
        {upNext ? 'UP NEXT' : 'WATCHING'}
      </Text>
      <Text numberOfLines={2} style={[styles.text, { fontFamily: fonts.bold, fontSize: titleSize, lineHeight: titleSize * 1.25 }]}>
        {hidden ? ' ' : title || 'Loading program...'}
      </Text>
      {note && !hidden ? (
        <Text style={[styles.text, { color: colors.text60, fontFamily: fonts.regular, fontSize: (compact ? 11 : 13) * unit, marginTop: 6 * unit }]}>
          {note}
        </Text>
      ) : null}
    </View>
  );
  return (
    <View style={[StyleSheet.absoluteFill, styles.center, { backgroundColor: '#000' }]}>
      <Gradient
        stops={[
          { offset: 0, color: '#18181b' },
          { offset: 0.5, color: '#09090b' },
          { offset: 1, color: '#000000' },
        ]}
      />
      <View style={[styles.center, { gap: (compact ? 10 : 16) * unit }]}>
        <View style={[styles.center, { width: ring, height: ring }]}>
          {/* "Up next" (a programme's last seconds, sound on) is not a loading screen: no spinner. */}
          {upNext ? (
            <Svg width={ring} height={ring} style={StyleSheet.absoluteFill}>
              <Circle cx={ring / 2} cy={ring / 2} r={ring / 2 - Math.max(2, 2 * unit)} fill="none" stroke={colors.gold} strokeOpacity={0.55} strokeWidth={Math.max(2, 2 * unit)} />
            </Svg>
          ) : (
            <LoaderRing size={ring} stroke={Math.max(2, 2 * unit)} />
          )}
          {/* Web: the wordmark at 40 % of the ring's height, capped by the ring's width. */}
          <Logo height={Math.min(ring * 0.4, (ring * 0.86) / (3033 / 595))} />
        </View>
        {/* Same order of children with and without `logoOnly`: the ring and sweep bar keep running. */}
        {logoOnly ? null : titleBox(false)}
        {upNext ? null : (
          <SweepBar
            width={Math.max(96 * unit, Math.min(screenVmin * 0.25, 192 * unit))}
            height={4 * unit}
            durationMs={1200}
            color={colors.gold}
            trackColor={colors.fill10}
          />
        )}
        {logoOnly ? titleBox(true) : null}
      </View>
    </View>
  );
}

/**
 * TV's loading screen (user requests 2026-11-04): the programme's picture, darkened (`videoId`, once
 * known), a thin ring in the middle and `title` under it on black (live player; the Watched
 * player's controls show its title). A note only when there is something to say (a programme that
 * isn't available). The launch splash ends when the picture is there (or none will come).
 */
function TvCover({ unit, title, note, videoId }: { unit: number; title: string; note?: string; videoId?: string }) {
  const ring = 64 * unit;
  return (
    <View style={[StyleSheet.absoluteFill, styles.center, { backgroundColor: '#000' }]}>
      {videoId ? <ThumbnailCover videoId={videoId} onReady={hideLaunchSplash} /> : null}
      {DeeniSpinnerView ? <DeeniSpinnerView style={{ width: ring, height: ring }} /> : <ActivityIndicator size={ring} color={colors.gold} />}
      {title ? (
        <View style={{ marginTop: 20 * unit, maxWidth: 840 * unit, backgroundColor: 'rgba(0,0,0,0.85)', borderRadius: 8 * unit, paddingHorizontal: 20 * unit, paddingVertical: 10 * unit }}>
          <Text numberOfLines={2} style={[styles.text, { fontFamily: fonts.medium, fontSize: 20 * unit, lineHeight: 28 * unit }]}>
            {title}
          </Text>
        </View>
      ) : null}
      {note ? (
        <Text style={[styles.text, { fontFamily: fonts.medium, fontSize: 16 * unit, marginTop: 20 * unit, paddingHorizontal: 24 * unit }]}>{note}</Text>
      ) : null}
    </View>
  );
}

/**
 * TV: the next programme in a small card while this one plays on to its end, with its sound. The
 * next one appears when this one ends (user request 2026-11-04; a full-screen card hid the last
 * 20 s). YouTube's own end-screen cards can show in those seconds, on videos that have them.
 */
export function UpNextCard({ unit, program }: { unit: number; program: VideoProgram }) {
  const thumbWidth = 168 * unit;
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        right: 32 * unit,
        bottom: 96 * unit,
        width: 496 * unit,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16 * unit,
        padding: 10 * unit,
        borderRadius: 10 * unit,
        borderWidth: 1,
        borderColor: colors.border10,
        backgroundColor: 'rgba(12,12,15,0.9)',
      }}
    >
      <Image
        source={{ uri: thumbUrl(program.videoId, 'hqdefault') }}
        style={{ width: thumbWidth, height: (thumbWidth * 9) / 16, borderRadius: 6 * unit, backgroundColor: '#18181b' }}
        resizeMode="cover"
      />
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.gold, fontFamily: fonts.semibold, fontSize: 12 * unit, letterSpacing: 1, marginBottom: 4 * unit }}>UP NEXT</Text>
        <Text numberOfLines={2} style={{ color: colors.white, fontFamily: fonts.semibold, fontSize: 16 * unit, lineHeight: 22 * unit }}>
          {program.title}
        </Text>
      </View>
    </View>
  );
}

/** A video's thumbnail, darkened (Watched player paused or ended; the TV's start cover). */
export function ThumbnailCover({ videoId, onReady }: { videoId: string; onReady?: () => void }) {
  const [quality, setQuality] = useState<ThumbQuality>(thumbQuality(videoId));
  useEffect(() => setQuality(thumbQuality(videoId)), [videoId]);
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Image
        source={{ uri: thumbUrl(videoId, quality) }}
        onLoad={onReady}
        onError={() => {
          if (quality === 'hqdefault') onReady?.();
          noteThumbMissing(videoId);
          setQuality('hqdefault');
        }}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
      />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.55)' }]} />
    </View>
  );
}

const INDICATOR_FADE_MS = 350;
// Dark glass over the picture: opaque enough that YouTube's white bars don't show through.
const GLASS = { fill: '#0c0c0f', fillOpacity: 0.94, stroke: '#ffffff', strokeOpacity: 0.16, strokeWidth: 1.5 } as const;

/**
 * The Watched player's ⏸ for a moment after the viewer resumes it (`trigger` = resume count),
 * over YouTube's own ⏸ (same symbol, the app's style); ▶ shows while paused (PausedIndicator).
 * Not at a programme's start or after a seek: YouTube's own icon shows then (user requests
 * 2026-11-03). The live player shows none. It sits over YouTube's own play/pause icon, which YouTube draws in the centre
 * of the picture for YOUTUBE_ICON_MS after every start, seek and resume (a 56 px circle inside
 * the iframe, which the app can't style), so the covers can lift once the video plays (user
 * request 2026-11-03: picture fast, and a standard-looking indicator instead of a logo stamp).
 * Sizes are dp, not `unit`: YouTube's icon is a fixed size. `covered` = the picture is hidden.
 */
export function PlaybackIndicator({ trigger, covered }: { trigger: number; covered: boolean }) {
  // Set during render (React's "previous prop" pattern), so the flash is up in the very frame
  // of the resume: an effect would leave one frame with YouTube's icon showing.
  const [prevTrigger, setPrevTrigger] = useState(trigger);
  const [until, setUntil] = useState(0);
  const [, setTick] = useState(0);
  if (prevTrigger !== trigger) {
    setPrevTrigger(trigger);
    // YouTube's icon stays a little longer after a resume than after a start (~4.2 s on the
    // phone): a shorter flash showed our ▶ turning into YouTube's ⏸.
    setUntil(trigger ? Date.now() + YOUTUBE_ICON_MS + 1000 : 0);
  }
  const now = Date.now();
  const on = !covered && now < until;
  const fading = !covered && !on && now < until + INDICATOR_FADE_MS;
  useEffect(() => {
    if (!on && !fading) return undefined;
    const t = setTimeout(() => setTick((n) => n + 1), Math.max(0, (on ? until : until + INDICATOR_FADE_MS) - Date.now()));
    return () => clearTimeout(t);
  }, [on, fading, until]);
  if (!youtubeFlags.cropChrome || (!on && !fading)) return null;
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.center]}>
      <Fade visible={on} durationMs={INDICATOR_FADE_MS} style={styles.center}>
        <IconDisc icon="pause" />
      </Fade>
    </View>
  );
}

/** ▶ or ⏸ on a dark glass disc (the Watched player's play / pause feedback). */
function IconDisc({ icon }: { icon: 'play' | 'pause' }) {
  const s = 68;
  return (
    <Svg width={s} height={s}>
      <Circle cx={s / 2} cy={s / 2} r={s / 2 - 0.75} {...GLASS} />
      {icon === 'play' ? (
        // Nudged right of centre, as play triangles are drawn for optical balance.
        <Path d={`M${s * 0.41} ${s * 0.31} L${s * 0.41} ${s * 0.69} L${s * 0.71} ${s * 0.5} Z`} fill={colors.white} stroke={colors.white} strokeWidth={3} strokeLinejoin="round" />
      ) : (
        <>
          <Rect x={s * 0.36} y={s * 0.31} width={s * 0.09} height={s * 0.38} rx={2} fill={colors.white} />
          <Rect x={s * 0.55} y={s * 0.31} width={s * 0.09} height={s * 0.38} rx={2} fill={colors.white} />
        </>
      )}
    </Svg>
  );
}

/**
 * ▶ in the centre while the Watched player is paused: the standard player convention (the icon
 * shows what a tap does; the bar's button shows ▶ too). User report 2026-11-03: ⏸ there was wrong.
 */
export function PausedIndicator() {
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.center]}>
      <IconDisc icon="play" />
    </View>
  );
}

/** "Failed to Load" (web W-14). Rendered over the whole player + bar, never clipped (plan D-17). */
export function ErrorOverlay({
  unit,
  message,
  onTryAgain,
  onChangeChannel,
}: {
  unit: number;
  message: string;
  onTryAgain: () => void;
  onChangeChannel: () => void;
}) {
  return (
    <View style={[StyleSheet.absoluteFill, styles.center, { backgroundColor: colors.black90, paddingHorizontal: 24 * unit }]}>
      <Pulse durationMs={2000} style={{ marginBottom: 20 * unit }}>
        <AlertCircle size={64 * unit} color={colors.red500} />
      </Pulse>
      <Text style={[styles.text, { fontFamily: fonts.bold, fontSize: 20 * unit, marginBottom: 8 * unit }]}>Failed to Load</Text>
      <Text style={[styles.text, { color: colors.text60, fontFamily: fonts.regular, fontSize: 14 * unit, marginBottom: 20 * unit, maxWidth: 420 * unit }]}>
        {message}
      </Text>
      <View style={{ flexDirection: 'row', gap: 12 * unit }}>
        <Focusable
          onPress={onTryAgain}
          hasTVPreferredFocus
          accessibilityRole="button"
          accessibilityLabel="Try Again"
          style={[styles.pillButton, { borderRadius: 999, paddingHorizontal: 22 * unit, paddingVertical: 10 * unit, overflow: 'hidden' }]}
          focusStyle={{ borderColor: colors.white, borderWidth: 2 }}
        >
          <Gradient direction="r" stops={[{ offset: 0, color: colors.gold }, { offset: 1, color: colors.purple600 }]} />
          <Spin durationMs={1000}>
            <RefreshCw size={16 * unit} color={colors.white} />
          </Spin>
          <Text style={[styles.text, { fontFamily: fonts.semibold, fontSize: 14 * unit, marginLeft: 8 * unit }]}>Try Again</Text>
        </Focusable>
        <Focusable
          onPress={onChangeChannel}
          accessibilityRole="button"
          accessibilityLabel="Change Channel"
          style={[styles.pillButton, { borderRadius: 999, borderWidth: 1, borderColor: colors.border20, paddingHorizontal: 22 * unit, paddingVertical: 10 * unit }]}
        >
          <Text style={[styles.text, { fontFamily: fonts.semibold, fontSize: 14 * unit }]}>Change Channel</Text>
        </Focusable>
      </View>
    </View>
  );
}

/** Clock + remaining time of the current programme, top-right of the video (web W-04). */
export function RemainingTimePill({
  unit,
  compact,
  remaining,
}: {
  unit: number;
  compact: boolean;
  remaining: number;
}) {
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: 12 * unit,
        right: 12 * unit,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6 * unit,
        backgroundColor: colors.black70,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: colors.border20,
        paddingHorizontal: (compact ? 10 : 12) * unit,
        paddingVertical: (compact ? 4 : 6) * unit,
      }}
    >
      <Clock size={(compact ? 12 : 14) * unit} color="rgba(255,255,255,0.8)" />
      <Text style={{ color: colors.white, fontFamily: fonts.mono, fontSize: (compact ? 11 : 12) * unit, fontVariant: ['tabular-nums'] }}>
        {formatTime(remaining)}
      </Text>
    </View>
  );
}

/** A small Play badge used on covers that need a tap (defensive fallback, plan D-13). */
export function PlayBadge({ unit, label, onPress }: { unit: number; label: string; onPress: () => void }) {
  return (
    <Focusable
      onPress={onPress}
      hasTVPreferredFocus
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6 * unit,
        backgroundColor: colors.black80,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: colors.border20,
        paddingHorizontal: 16 * unit,
        paddingVertical: 8 * unit,
      }}
    >
      <Play size={14 * unit} color={colors.white} fill={colors.white} />
      <Text style={{ color: colors.white, fontFamily: fonts.medium, fontSize: 13 * unit }}>{label}</Text>
    </Focusable>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  text: { color: colors.white, textAlign: 'center' },
  pillButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
});
