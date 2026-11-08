import Wifi from 'lucide-react-native/icons/wifi';
import WifiOff from 'lucide-react-native/icons/wifi-off';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Fade } from '@/components/common/Motion';
import { useFrameLayout } from '@/hooks/useFrameLayout';
import { useNetworkStore } from '@/lib/network';
import { colors, fonts } from '@/lib/theme';

const BACK_ONLINE_MS = 3000;

/**
 * "No internet connection" while offline and "Back online" for a moment once it returns: a
 * snackbar at the bottom centre, over everything, as YouTube and Google's apps show it (user
 * request 2026-11-03). The players pause their recovery while offline and rejoin when back.
 */
export function NetworkBanner() {
  const online = useNetworkStore((s) => s.online);
  const backAt = useNetworkStore((s) => s.backOnlineAt);
  const { unit } = useFrameLayout();
  const insets = useSafeAreaInsets();
  const [, setTick] = useState(0);
  const showBack = online && backAt > 0 && Date.now() - backAt < BACK_ONLINE_MS;
  useEffect(() => {
    if (!showBack) return undefined;
    const t = setTimeout(() => setTick((n) => n + 1), Math.max(0, BACK_ONLINE_MS - (Date.now() - backAt)));
    return () => clearTimeout(t);
  }, [showBack, backAt]);

  const icon = 20 * unit;
  return (
    <View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { justifyContent: 'flex-end', alignItems: 'center', paddingBottom: insets.bottom + 24 * unit, paddingHorizontal: 16 * unit }]}
    >
      <Fade visible={!online || showBack} durationMs={250}>
        <View
          accessibilityLiveRegion="polite"
          accessibilityRole="alert"
          style={[
            styles.pill,
            {
              gap: 12 * unit,
              paddingVertical: 12 * unit,
              paddingHorizontal: 18 * unit,
              borderRadius: 14 * unit,
              maxWidth: 560 * unit,
              backgroundColor: online ? '#15803d' : '#18181b',
              borderColor: online ? 'rgba(255,255,255,0.18)' : 'rgba(239,68,68,0.45)',
            },
          ]}
        >
          {online ? <Wifi size={icon} color={colors.white} /> : <WifiOff size={icon} color={colors.red500} />}
          <View style={{ flexShrink: 1 }}>
            <Text style={{ color: colors.white, fontFamily: fonts.semibold, fontSize: 15 * unit }}>
              {online ? 'Back online' : 'No internet connection'}
            </Text>
            {online ? null : (
              <Text style={{ color: colors.text60, fontFamily: fonts.regular, fontSize: 13 * unit, marginTop: 2 * unit }}>
                Check your Wi-Fi or mobile data. Playback resumes when you're back online.
              </Text>
            )}
          </View>
        </View>
      </Fade>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
});
