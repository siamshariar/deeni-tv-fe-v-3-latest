import { useEffect, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { Gradient } from './Gradient';

/** Endless linear rotation (web: framer-motion rotate 360, repeat Infinity). */
export function Spin({ durationMs, style, children }: { durationMs: number; style?: StyleProp<ViewStyle>; children?: ReactNode }) {
  const angle = useSharedValue(0);
  useEffect(() => {
    angle.value = withRepeat(withTiming(360, { duration: durationMs, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(angle);
  }, [angle, durationMs]);
  const animated = useAnimatedStyle(() => ({ transform: [{ rotate: `${angle.value}deg` }] }));
  return <Animated.View style={[style, animated]}>{children}</Animated.View>;
}

/** Gentle pulse (web: scale [1, 1.1, 1]). */
export function Pulse({ durationMs = 1500, to = 1.1, children, style }: { durationMs?: number; to?: number; children?: ReactNode; style?: StyleProp<ViewStyle> }) {
  const scale = useSharedValue(1);
  useEffect(() => {
    scale.value = withRepeat(
      withSequence(withTiming(to, { duration: durationMs / 2 }), withTiming(1, { duration: durationMs / 2 })),
      -1,
      false,
    );
    return () => cancelAnimation(scale);
  }, [scale, durationMs, to]);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return <Animated.View style={[style, animated]}>{children}</Animated.View>;
}

/**
 * The web's gold sweep bar: a track with a transparent→gold→transparent band
 * sliding from -100 % to 100 %.
 */
export function SweepBar({
  width,
  height = 4,
  durationMs = 1200,
  color,
  trackColor,
}: {
  width: number;
  height?: number;
  durationMs?: number;
  color: string;
  trackColor: string;
}) {
  const x = useSharedValue(-width);
  useEffect(() => {
    x.value = -width;
    x.value = withRepeat(withTiming(width, { duration: durationMs, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(x);
  }, [x, width, durationMs]);
  const animated = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  return (
    <View style={{ width, height, borderRadius: height / 2, backgroundColor: trackColor, overflow: 'hidden' }}>
      <Animated.View style={[StyleSheet.absoluteFill, animated]}>
        <Gradient
          direction="r"
          stops={[
            { offset: 0, color, opacity: 0 },
            { offset: 0.5, color, opacity: 1 },
            { offset: 1, color, opacity: 0 },
          ]}
        />
      </Animated.View>
    </View>
  );
}

/** Fade a layer in and out (web AnimatePresence opacity 0.3 s). Stays mounted. */
export function Fade({ visible, durationMs = 300, style, children, pointerEventsWhenHidden = 'none' }: {
  visible: boolean;
  durationMs?: number;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
  pointerEventsWhenHidden?: 'none' | 'box-none';
}) {
  const opacity = useSharedValue(visible ? 1 : 0);
  useEffect(() => {
    opacity.value = withTiming(visible ? 1 : 0, { duration: durationMs });
  }, [opacity, visible, durationMs]);
  const animated = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Animated.View style={[style, animated]} pointerEvents={visible ? 'auto' : pointerEventsWhenHidden}>
      {children}
    </Animated.View>
  );
}
