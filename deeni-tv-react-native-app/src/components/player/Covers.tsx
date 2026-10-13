import { AlertCircle, Clock, Play, RefreshCw, Tv } from 'lucide-react-native';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { Focusable } from '@/components/common/Focusable';
import { Gradient } from '@/components/common/Gradient';
import { Logo } from '@/components/common/Logo';
import { Pulse, Spin, SweepBar } from '@/components/common/Motion';
import { LoaderRing } from '@/components/common/Rings';
import { colors, fonts } from '@/lib/theme';
import { formatTime } from '@/lib/time';

/** Size helpers: web px × unit (TV scale). `compact` = web ≤768 px mobile sizing. */
interface Sizing {
  unit: number;
  compact: boolean;
  /** min(width, height) of the video box, for the web's vmin-based sizes. */
  vmin: number;
}

/** "Tuning into your broadcast..." (web W-02) while the schedule is fetched. */
export function TuningOverlay({ unit, compact }: Sizing) {
  const ring = (compact ? 80 : 96) * unit;
  const icon = (compact ? 40 : 48) * unit;
  return (
    <View style={[StyleSheet.absoluteFill, styles.center, { backgroundColor: colors.black90, padding: 16 * unit }]}>
      <View style={[styles.center, { width: ring, height: ring, marginBottom: 24 * unit }]}>
        <LoaderRing size={ring} stroke={4 * unit} trackOpacity={0.3} durationMs={2000} />
        <Pulse>
          <Tv size={icon} color={colors.gold} />
        </Pulse>
      </View>
      <Text style={[styles.text, { fontFamily: fonts.medium, fontSize: (compact ? 16 : 18) * unit, marginBottom: 8 * unit }]}>
        Tuning into your broadcast...
      </Text>
      <Text style={[styles.text, { color: colors.text60, fontFamily: fonts.regular, fontSize: (compact ? 12 : 14) * unit }]}>
        Please wait while we connect
      </Text>
      <View style={{ marginTop: 24 * unit }}>
        <SweepBar width={192 * unit} height={4 * unit} durationMs={1500} color={colors.gold} trackColor="rgba(217,165,20,0.2)" />
      </View>
    </View>
  );
}

/**
 * The branded "WATCHING ‹title›" screen (web W-03). Fully opaque: it hides
 * the YouTube iframe (its spinner, title bar, end screen) until the video
 * has really moved. `note` adds a line under the title (unavailable programme).
 */
export function BrandedCover({ unit, compact, vmin, title, note }: Sizing & { title: string; note?: string }) {
  // Ring and sweep bar are sized from the screen like the web's 14vmin / 25vmin
  // (CSS vmin is the viewport, not the video box: the box-based size was ~30 %
  // smaller than the web's on TV).
  const window = useWindowDimensions();
  const screenVmin = Math.min(window.width, window.height);
  const ring = Math.round(Math.max((compact ? 56 : 72) * unit, Math.min(screenVmin * 0.14, (compact ? 112 : 144) * unit)));
  const smallText = (compact ? 7 : 10) * unit;
  const titleSize = (compact ? 14 : 18) * unit;
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
          <LoaderRing size={ring} stroke={Math.max(2, 2 * unit)} />
          {/* Web: the wordmark at 40 % of the ring's height, capped by the ring's width. */}
          <Logo height={Math.min(ring * 0.4, (ring * 0.86) / (3033 / 595))} />
        </View>
        <View
          style={{
            maxWidth: Math.min(vmin * 1.6, 512 * unit),
            backgroundColor: colors.fill5,
            borderColor: colors.border10,
            borderWidth: 1,
            borderRadius: 12 * unit,
            paddingHorizontal: (compact ? 12 : 20) * unit,
            paddingVertical: (compact ? 8 : 12) * unit,
          }}
        >
          <Text style={[styles.text, { color: colors.text50, fontFamily: fonts.medium, fontSize: smallText, letterSpacing: 1, marginBottom: 2 * unit }]}>
            WATCHING
          </Text>
          <Text numberOfLines={2} style={[styles.text, { fontFamily: fonts.bold, fontSize: titleSize, lineHeight: titleSize * 1.25 }]}>
            {title || 'Loading program...'}
          </Text>
          {note ? (
            <Text style={[styles.text, { color: colors.text60, fontFamily: fonts.regular, fontSize: (compact ? 11 : 13) * unit, marginTop: 6 * unit }]}>
              {note}
            </Text>
          ) : null}
        </View>
        <SweepBar
          width={Math.max(96 * unit, Math.min(screenVmin * 0.25, 192 * unit))}
          height={4 * unit}
          durationMs={1200}
          color={colors.gold}
          trackColor={colors.fill10}
        />
      </View>
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
