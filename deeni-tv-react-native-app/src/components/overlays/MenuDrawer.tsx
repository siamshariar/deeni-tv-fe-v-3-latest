import { Calendar, Globe, Heart, History, Info, RefreshCw, X, type LucideIcon } from 'lucide-react-native';
// Hidden for now (Privacy Policy item below): import { Shield } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, TVFocusGuideView, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Focusable } from '@/components/common/Focusable';
import { SurfaceGradient } from '@/components/common/Gradient';
import { Logo } from '@/components/common/Logo';
import { useFrameLayout } from '@/hooks/useFrameLayout';
import { colors, fonts } from '@/lib/theme';
import { focusWithRetry, requestTVFocus } from '@/lib/tvFocus';
import {
  MENU_TARGET_DELAY_MS,
  donate,
  openAbout,
  openChannelModal,
  openPreviousList,
  // openPrivacyPolicy, // hidden for now (see BOTTOM)
  openSchedule,
  refreshBroadcast,
} from '@/player/actions';
import { useUiStore } from '@/store/useUiStore';

interface Item {
  label: string;
  icon: LucideIcon;
  run: () => void;
  /** Donate and Privacy act at once; the others open after the drawer closes (web 300 ms). */
  immediate?: boolean;
}

const MAIN: Item[] = [
  { label: 'Programs Schedule', icon: Calendar, run: openSchedule },
  { label: 'Watched Program', icon: History, run: openPreviousList },
  { label: 'Channel', icon: Globe, run: openChannelModal },
  { label: 'Refresh', icon: RefreshCw, run: refreshBroadcast, immediate: true },
];

/** About and Donate, as on the web. */
const BOTTOM: Item[] = [
  { label: 'About', icon: Info, run: openAbout },
  { label: 'Donate', icon: Heart, run: donate, immediate: true },
  // Privacy Policy on phones (plan D-23): hidden for now at the product owner's request.
  // To bring it back, restore this line and the two commented imports above.
  // ...(Platform.isTV ? [] : [{ label: 'Privacy Policy', icon: Shield, run: openPrivacyPolicy, immediate: true }]),
];

// TV boxes draw a frame every ~50 ms while video plays: a slightly longer slide
// keeps enough frames for it to read as a slide.
const OPEN_MS = Platform.isTV ? 420 : 320;
const CLOSE_MS = Platform.isTV ? 260 : 220;

/**
 * The 3-dot menu (web W-11): slides in from the right, 88 % wide, max 384,
 * flush with the right edge, and slides out again on close.
 *
 * Mounted once and kept (off-screen, invisible, not focusable) while closed:
 * opening only animates it. Mounting it on open cost 200–250 ms frames on the
 * TV box, which ate the first part of the slide and made it look like a jump.
 */
export function MenuDrawer() {
  const open = useUiStore((st) => st.overlays.includes('menu'));
  const { unit, windowWidth, size } = useFrameLayout();
  const insets = useSafeAreaInsets();
  const compact = size === 'mobile';
  const width = Math.min(windowWidth * 0.88, 384 * unit);
  const x = useSharedValue(width);
  const fade = useSharedValue(0);
  // Shown while open and during the slide-out; otherwise hidden by a plain
  // (React-owned) opacity. The animated transform alone wasn't enough: after the
  // app came back from another app (e.g. the browser chooser) or the screen
  // rotated, Android showed the closed drawer at its open position.
  const [shown, setShown] = useState(false);
  // Eased slide (the web's spring overshoots; on a slow box that read as a bounce).
  useEffect(() => {
    if (open) {
      setShown(true);
      // Always slide in from the edge, whatever state the native view was left in.
      x.value = width;
      fade.value = 0;
      x.value = withTiming(0, { duration: OPEN_MS, easing: Easing.out(Easing.cubic) });
      fade.value = withTiming(1, { duration: OPEN_MS });
      return undefined;
    }
    x.value = withTiming(width, { duration: CLOSE_MS, easing: Easing.in(Easing.cubic) });
    fade.value = withTiming(0, { duration: CLOSE_MS });
    const t = setTimeout(() => setShown(false), CLOSE_MS + 50);
    return () => clearTimeout(t);
  }, [open, width, x, fade]);
  const drawerStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  const backdropStyle = useAnimatedStyle(() => ({ opacity: fade.value }));

  // TV: the first item takes focus when the slide has finished (moving the focus
  // ring mid-slide redraws the whole panel and cost frames); repeated once,
  // since Android TV can drop a request made while the opener still has focus.
  const firstRef = useRef<View>(null);
  useEffect(() => {
    if (!Platform.isTV || !open) return undefined;
    let cancelRetry: (() => void) | undefined;
    const t = setTimeout(() => {
      cancelRetry = focusWithRetry(() => requestTVFocus(firstRef.current), 150);
    }, OPEN_MS);
    return () => {
      clearTimeout(t);
      cancelRetry?.();
    };
  }, [open]);

  // Hardware Back is handled by the screen (closes the top overlay = this).
  const close = useCallback(() => useUiStore.getState().close('menu'), []);
  const choose = (item: Item) => {
    close();
    if (item.immediate) item.run();
    else setTimeout(item.run, MENU_TARGET_DELAY_MS);
  };

  const renderItem = (item: Item, index: number, preferFocus: boolean) => (
    <Focusable
      key={item.label}
      ref={preferFocus && index === 0 ? firstRef : undefined}
      onPress={() => choose(item)}
      focusable={open}
      accessibilityRole="button"
      accessibilityLabel={item.label}
      style={({ focused }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: (compact ? 12 : 16) * unit,
        paddingHorizontal: (compact ? 12 : 16) * unit,
        paddingVertical: (compact ? 10 : 16) * unit,
        borderRadius: 12 * unit,
        borderWidth: 1,
        backgroundColor: focused ? colors.fill10 : colors.fill5,
        borderColor: focused ? colors.gold : colors.border10,
      })}
    >
      <View style={{ padding: (compact ? 6 : 8) * unit, borderRadius: 8 * unit, backgroundColor: 'rgba(217,165,20,0.2)' }}>
        <item.icon size={(compact ? 16 : 20) * unit} color={colors.gold} />
      </View>
      <Text style={{ color: colors.white, fontFamily: fonts.medium, fontSize: (compact ? 14 : 16) * unit }}>{item.label}</Text>
    </Focusable>
  );

  const content = (
    <View style={{ flex: 1 }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: (compact ? 16 : 24) * unit,
          paddingTop: (compact ? 12 : 24) * unit + (Platform.isTV ? 0 : insets.top),
          paddingBottom: (compact ? 12 : 24) * unit,
          borderBottomWidth: 1,
          borderBottomColor: colors.border10,
        }}
      >
        <Logo height={(compact ? 20 : 24) * unit} />
        <Focusable
          onPress={close}
          focusable={open}
          accessibilityRole="button"
          accessibilityLabel="Close menu"
          style={{ width: 40 * unit, height: 40 * unit, borderRadius: 12 * unit, alignItems: 'center', justifyContent: 'center' }}
        >
          <X size={(compact ? 24 : 20) * unit} color={colors.text60} />
        </Focusable>
      </View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1 }}>
        <View style={{ padding: (compact ? 12 : 16) * unit, gap: 8 * unit }}>
          {MAIN.map((it, i) => renderItem(it, i, true))}
        </View>
        <View style={{ flex: 1 }} />
        <View
          style={{
            padding: (compact ? 12 : 16) * unit,
            paddingBottom: (compact ? 12 : 16) * unit + (Platform.isTV ? 0 : insets.bottom),
            gap: 8 * unit,
            borderTopWidth: 1,
            borderTopColor: colors.border10,
          }}
        >
          {BOTTOM.map((it, i) => renderItem(it, i, false))}
        </View>
      </ScrollView>
    </View>
  );

  return (
    <View
      collapsable={false}
      style={[StyleSheet.absoluteFill, { opacity: shown ? 1 : 0 }]}
      pointerEvents={open ? 'auto' : 'none'}
      accessibilityElementsHidden={!open}
      importantForAccessibility={open ? 'auto' : 'no-hide-descendants'}
    >
      {/* Web: black 80 % + blur; 90 % without a blur (see ModalCard). */}
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.9)' }, backdropStyle]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} focusable={false} accessible={false} />
      </Animated.View>
      <Animated.View
        // Drawn once into a texture and only moved while sliding (cheap on TV boxes).
        renderToHardwareTextureAndroid
        style={[
          { position: 'absolute', top: 0, bottom: 0, right: 0, width, borderLeftWidth: 1, borderLeftColor: colors.border10, backgroundColor: colors.zinc900 },
          drawerStyle,
        ]}
      >
        <SurfaceGradient />
        {Platform.isTV ? (
          // Closed: not focusable at all (the guide would otherwise be a D-pad target off-screen).
          <TVFocusGuideView focusable={open} autoFocus trapFocusUp trapFocusDown trapFocusLeft trapFocusRight style={{ flex: 1 }}>
            {content}
          </TVFocusGuideView>
        ) : (
          content
        )}
      </Animated.View>
    </View>
  );
}
