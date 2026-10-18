import { X } from 'lucide-react-native';
import { useEffect, type ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, Text, TVFocusGuideView, View, useWindowDimensions } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { Focusable } from '@/components/common/Focusable';
import { SurfaceGradient } from '@/components/common/Gradient';
import { useFrameLayout } from '@/hooks/useFrameLayout';
import { colors, fonts } from '@/lib/theme';

/**
 * The web's centred modal: backdrop (web black 80 % + blur; here 90 %, since
 * there is no blur and the page behind would stay readable), card
 * `calc(100% − 2rem)` wide (max 384 / 672), zinc gradient, white/10 border,
 * rounded 16, opening with a fade + 0.95 → 1 scale. On TV, focus is trapped
 * inside the card (web I-28).
 */
export function ModalCard({
  backdropOpacity = 0.9,
  onBackdropPress,
  maxHeightRatio = 0.8,
  children,
  wide,
}: {
  backdropOpacity?: number;
  /** Undefined = the backdrop doesn't close (first-visit picker, Previous list). */
  onBackdropPress?: () => void;
  maxHeightRatio?: number;
  children: ReactNode;
  /** Force the wide (672) card even on narrow screens. */
  wide?: boolean;
}) {
  const layout = useFrameLayout();
  const { height } = useWindowDimensions();
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withTiming(1, { duration: 200 });
  }, [progress]);
  const cardStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scale: 0.95 + 0.05 * progress.value }, { translateY: 20 * (1 - progress.value) }],
  }));
  const backdropStyle = useAnimatedStyle(() => ({ opacity: progress.value }));
  const width = wide ? Math.min(672 * layout.unit, layout.windowWidth - 32 * layout.unit) : layout.modalWidth;

  const card = (
    <Animated.View
      style={[
        styles.card,
        { width, maxHeight: height * maxHeightRatio, borderRadius: 16 * layout.unit },
        cardStyle,
      ]}
    >
      <SurfaceGradient />
      {children}
    </Animated.View>
  );

  return (
    <View style={[StyleSheet.absoluteFill, styles.center]}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: `rgba(0,0,0,${backdropOpacity})` }, backdropStyle]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onBackdropPress} focusable={false} accessible={false} />
      </Animated.View>
      {Platform.isTV ? (
        <TVFocusGuideView autoFocus trapFocusUp trapFocusDown trapFocusLeft trapFocusRight>
          {card}
        </TVFocusGuideView>
      ) : (
        card
      )}
    </View>
  );
}

/**
 * Wrap a FlatList inside a ModalCard. On TV, react-native-tvos puts every
 * FlatList's scroll view inside an unstyled focus guide that doesn't shrink,
 * so the list overflowed the card's max height under the header: its last rows
 * (and the focused row while scrolling) sat below the card's bottom edge.
 */
export function ModalList({ children }: { children: ReactNode }) {
  return <View style={{ flexShrink: 1 }}>{children}</View>;
}

/** Modal header: icon tile + title (+ subtitle) + optional X (web pattern). */
export function ModalHeader({
  icon,
  title,
  subtitle,
  onClose,
  big,
  preferCloseFocus,
}: {
  icon: ReactNode;
  title: string;
  subtitle?: ReactNode;
  onClose?: () => void;
  /** 20 px bold title (Select Channel) instead of 18 px semibold. */
  big?: boolean;
  preferCloseFocus?: boolean;
}) {
  const { unit, size } = useFrameLayout();
  const compact = size === 'mobile';
  const closeSize = (compact ? 48 : 40) * unit;
  return (
    <View style={[styles.header, { padding: (big ? 24 : 16) * unit }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 * unit, flex: 1 }}>
        <View style={{ padding: 8 * unit, borderRadius: 10 * unit, backgroundColor: 'rgba(217,165,20,0.2)' }}>{icon}</View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.white, fontFamily: big ? fonts.bold : fonts.semibold, fontSize: (big ? 20 : 18) * unit }}>{title}</Text>
          {typeof subtitle === 'string' ? (
            <Text style={{ color: colors.text40, fontFamily: fonts.regular, fontSize: 12 * unit, marginTop: 2 * unit }}>{subtitle}</Text>
          ) : (
            subtitle ?? null
          )}
        </View>
      </View>
      {onClose ? (
        <Focusable
          onPress={onClose}
          hasTVPreferredFocus={preferCloseFocus}
          accessibilityRole="button"
          accessibilityLabel="Close"
          style={{ width: closeSize, height: closeSize, borderRadius: 12 * unit, alignItems: 'center', justifyContent: 'center' }}
        >
          <X size={(compact ? 28 : 20) * unit} color={colors.text60} />
        </Focusable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  card: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border10,
    backgroundColor: colors.zinc900,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: colors.border10,
  },
});
