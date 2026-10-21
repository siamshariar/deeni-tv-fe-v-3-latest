import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import * as SystemUI from 'expo-system-ui';
import { useEffect } from 'react';
import { AppState, LogBox, Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { APP_FONTS } from '@/lib/appFonts';
import { hideLaunchSplash } from '@/lib/launchSplash';
import { onConnectivityChange, recheckNetwork, startNetworkWatch } from '@/lib/network';
import { colors } from '@/lib/theme';
import { broadcast } from '@/player/broadcastController';
import { previousPlayer } from '@/player/previousController';
import { useChannelStore } from '@/store/useChannelStore';

SplashScreen.preventAutoHideAsync().catch(() => {});

const TV_SPLASH_MAX_MS = 4000;

// Expected in local builds without the API secret (the web logs the same).
LogBox.ignoreLogs(['EXPO_PUBLIC_NP_AS_L is not set', 'External schedule API failed', 'Web schedule route failed']);

export default function RootLayout() {
  // Android: none to load (built in), so the app renders at once (see appFonts).
  const [fontsLoaded, fontError] = useFonts(APP_FONTS);

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(colors.background).catch(() => {});
  }, []);

  // TV with a channel: the splash stays until the loading screen has its picture (TvCover), so a
  // black screen never comes between them (user request 2026-11-04), within a limit.
  useEffect(() => {
    if (!fontsLoaded && !fontError) return undefined;
    if (!Platform.isTV || !useChannelStore.getState().selectedId) {
      hideLaunchSplash();
      return undefined;
    }
    const t = setTimeout(hideLaunchSplash, TV_SPLASH_MAX_MS);
    return () => clearTimeout(t);
  }, [fontsLoaded, fontError]);

  // Offline → the players hold their recovery; back online → they rejoin (NetworkBanner shows it).
  useEffect(() => {
    const stop = startNetworkWatch();
    const off = onConnectivityChange((online) => {
      broadcast.setOnline(online);
      previousPlayer.setOnline(online);
    });
    return () => {
      off();
      stop();
    };
  }, []);

  // Background → stop the sound; foreground → rejoin the live position (plan D-29).
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        recheckNetwork();
        broadcast.onAppForeground();
      }
      else if (state === 'background') {
        broadcast.onAppBackground();
        previousPlayer.onAppBackground();
      }
    });
    return () => sub.remove();
  }, []);

  if (!fontsLoaded && !fontError) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.background }}>
      <SafeAreaProvider>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background }, animation: 'none' }} />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
