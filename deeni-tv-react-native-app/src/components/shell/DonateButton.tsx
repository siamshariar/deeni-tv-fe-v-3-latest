import { Heart } from 'lucide-react-native';
import { useState } from 'react';
import { Platform, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Focusable } from '@/components/common/Focusable';
import { ControlRing } from '@/components/common/Rings';
import { colors, fonts } from '@/lib/theme';
import { donate } from '@/player/actions';
import { useUiStore } from '@/store/useUiStore';

/**
 * The gold Donate pill, fixed top-right (web DonateButton): heights
 * 32 / 36 / 40 / 44 at <640 / ≥640 / ≥768 / ≥1024 px; safe-area aware.
 * Language-based page in the browser; a QR code on TV (plan D-24).
 * `blocked`: the Previous player covers the screen (no touch, no D-pad focus).
 * `preferFocus` (TV): the QR panel it opened has closed, so focus comes back here.
 */
export function DonateButton({ unit, blocked = false, preferFocus = false }: { unit: number; blocked?: boolean; preferFocus?: boolean }) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const tier = Platform.isTV ? 3 : width >= 1024 ? 3 : width >= 768 ? 2 : width >= 640 ? 1 : 0;
  const height = [32, 36, 40, 44][tier] * unit;
  const paddingH = [12, 16, 20, 24][tier] * unit;
  const icon = [14, 16, 20, 20][tier] * unit;
  const font = [12, 14, 16, 16][tier] * unit;
  // The pill (gold gradient) and its TV focus ring are SVG, sized from the
  // measured width: Android's rounded clip left jagged edges on TV.
  const [pillWidth, setPillWidth] = useState(0);
  return (
    <Focusable
      onPress={donate}
      onFocus={() => useUiStore.getState().setTvFocusArea('donate')}
      hasTVPreferredFocus={!blocked && preferFocus}
      focusable={!blocked}
      disabled={blocked}
      accessibilityRole="button"
      accessibilityLabel="Donate"
      onLayout={(e) => setPillWidth(e.nativeEvent.layout.width)}
      style={{
        position: 'absolute',
        top: Math.max(8 * unit, Platform.isTV ? 0 : insets.top),
        right: (width >= 640 ? 16 : 8) * unit,
        height,
        paddingHorizontal: paddingH,
        borderRadius: 999,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6 * unit,
      }}
      focusStyle={{}}
    >
      {({ focused }) => (
        <>
          {pillWidth > 0 ? (
            <View pointerEvents="none" style={StyleSheet.absoluteFill}>
              <Svg width={pillWidth} height={height}>
                <Defs>
                  <LinearGradient id="donatePill" x1="0" y1="0" x2="1" y2="0">
                    <Stop offset={0} stopColor={colors.gold} stopOpacity={1} />
                    <Stop offset={1} stopColor={colors.gold} stopOpacity={0.8} />
                  </LinearGradient>
                </Defs>
                <Rect x={0} y={0} width={pillWidth} height={height} rx={height / 2} ry={height / 2} fill="url(#donatePill)" />
              </Svg>
            </View>
          ) : null}
          {Platform.isTV && pillWidth > 0 ? (
            <ControlRing width={pillWidth} height={height} focused={focused} borderColor="transparent" focusColor={colors.white} />
          ) : null}
          <Heart size={icon} color={colors.goldForeground} fill={colors.goldForeground} />
          <Text style={{ color: colors.goldForeground, fontFamily: fonts.bold, fontSize: font }}>Donate</Text>
        </>
      )}
    </Focusable>
  );
}
