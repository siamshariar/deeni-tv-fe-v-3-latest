import { useId, useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

export interface GradientStop {
  offset: number; // 0..1
  color: string;
  opacity?: number;
}

interface Props {
  stops: GradientStop[];
  /** Direction: 'br' = to bottom right (web bg-gradient-to-br), 'b' = down, 'r' = right. */
  direction?: 'br' | 'b' | 'r';
  style?: StyleProp<ViewStyle>;
}

/**
 * A linear gradient filling its parent, drawn with react-native-svg (Safe
 * Kids VerticalGradient pattern; no expo-linear-gradient). Display only.
 *
 * Sized in numbers from its own layout: with "100%" the SVG kept the drawing
 * it made before a rotation (phone fullscreen → portrait) and only covered the
 * old landscape height.
 */
export function Gradient({ stops, direction = 'br', style }: Props) {
  const id = `g${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const [x2, y2] = direction === 'br' ? ['1', '1'] : direction === 'b' ? ['0', '1'] : ['1', '0'];
  return (
    <View
      style={[StyleSheet.absoluteFill, style]}
      pointerEvents="none"
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        setSize((old) => (old && old.width === width && old.height === height ? old : { width, height }));
      }}
    >
      {size ? (
        <Svg width={size.width} height={size.height}>
          <Defs>
            <LinearGradient id={id} x1="0" y1="0" x2={x2} y2={y2}>
              {stops.map((s, i) => (
                <Stop key={i} offset={s.offset} stopColor={s.color} stopOpacity={s.opacity ?? 1} />
              ))}
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width={size.width} height={size.height} fill={`url(#${id})`} />
        </Svg>
      ) : null}
    </View>
  );
}

/** The page background: zinc-950 → zinc-900 → black, to bottom right (web). */
export function PageGradient() {
  return (
    <Gradient
      stops={[
        { offset: 0, color: '#09090b' },
        { offset: 0.5, color: '#18181b' },
        { offset: 1, color: '#000000' },
      ]}
    />
  );
}

/** Modal / drawer surface: zinc-900 → zinc-900 → zinc-950, to bottom right (web). */
export function SurfaceGradient() {
  return (
    <Gradient
      stops={[
        { offset: 0, color: '#18181b' },
        { offset: 0.5, color: '#18181b' },
        { offset: 1, color: '#09090b' },
      ]}
    />
  );
}
