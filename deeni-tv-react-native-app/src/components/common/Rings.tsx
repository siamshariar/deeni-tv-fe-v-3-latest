import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { colors } from '@/lib/theme';

import { Spin } from './Motion';

/**
 * Rings drawn with SVG. Android's own rounded borders (and rotated views with
 * one coloured border side) come out jagged and hard-cut on TV boxes; SVG
 * paths are antialiased.
 */

/**
 * The web's loading ring: a faint full ring plus a spinning gold arc. The arc
 * reproduces CSS `rounded-full border-t-2` on a circle: a crescent over the
 * top, `stroke` thick at 12 o'clock and tapering to nothing at 9 and 3.
 */
export function LoaderRing({ size, stroke, trackOpacity = 0.2, durationMs = 1500 }: { size: number; stroke: number; trackOpacity?: number; durationMs?: number }) {
  const r = size / 2;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width={size} height={size}>
        <Circle cx={r} cy={r} r={r - stroke / 2} stroke={colors.gold} strokeOpacity={trackOpacity} strokeWidth={stroke} fill="none" />
      </Svg>
      <Spin durationMs={durationMs} style={StyleSheet.absoluteFill}>
        <Svg width={size} height={size}>
          <Path d={`M 0 ${r} A ${r} ${r} 0 0 1 ${size} ${r} A ${r} ${r - stroke} 0 0 0 0 ${r} Z`} fill={colors.gold} />
        </Svg>
      </Spin>
    </View>
  );
}

/**
 * Border + TV focus ring for a round or pill-shaped control: 1 dp white/20
 * border; focused = the same 2 dp gold border as before (the background fill
 * is the control's own focus style), drawn antialiased. Render it inside the
 * control.
 */
export function ControlRing({
  width,
  height,
  focused,
  borderColor = colors.border20,
  focusColor = colors.gold,
}: {
  width: number;
  height: number;
  focused: boolean;
  borderColor?: string;
  focusColor?: string;
}) {
  const bw = focused ? 2 : 1;
  const radius = height / 2;
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, width, height }}>
      <Svg width={width} height={height}>
        <Rect
          x={bw / 2}
          y={bw / 2}
          width={width - bw}
          height={height - bw}
          rx={radius - bw / 2}
          ry={radius - bw / 2}
          stroke={focused ? focusColor : borderColor}
          strokeWidth={bw}
          fill="none"
        />
      </Svg>
    </View>
  );
}
