import { Geist_400Regular, Geist_500Medium, Geist_600SemiBold, Geist_700Bold, useFonts } from '@expo-google-fonts/geist';
import { GeistMono_600SemiBold } from '@expo-google-fonts/geist-mono';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import * as SystemUI from 'expo-system-ui';
import { useEffect } from 'react';
import { AppState, LogBox } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { colors } from '@/lib/theme';
import { broadcast } from '@/player/broadcastController';
import { previousPlayer } from '@/player/previousController';

SplashScreen.preventAutoHideAsync().catch(() => {});

// Expected in local builds without the API secret (the web logs the same).
LogBox.ignoreLogs(['EXPO_PUBLIC_NP_AS_L is not set', 'External schedule API failed', 'Web schedule route failed']);

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Geist_400Regular,
    Geist_500Medium,
    Geist_600SemiBold,
    Geist_700Bold,
    GeistMono_600SemiBold,
  });

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(colors.background).catch(() => {});
  }, []);

  useEffect(() => {
    if (fontsLoaded || fontError) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded, fontError]);

  // Background → stop the sound; foreground → rejoin the live position (plan D-29).
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') broadcast.onAppForeground();
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
