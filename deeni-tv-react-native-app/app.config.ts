import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Single Expo config for phone, tablet and Android TV.
 *
 * - `npm run prebuild && npm run android`       → Android phone / tablet
 * - `npm run prebuild && npm run ios`           → iPhone / iPad (macOS only)
 * - `npm run prebuild:tv && npm run android:tv` → Android TV (EXPO_TV=1)
 *
 * Switching EXPO_TV changes native config, so always run a clean prebuild.
 * Apple TV is not a target: react-native-webview (the YouTube player) has no
 * tvOS support.
 */
export default ({ config }: ConfigContext): ExpoConfig => {
  const isTV = process.env.EXPO_TV === '1';

  return {
    ...config,
    name: 'Deeni TV',
    slug: 'deeni-tv',
    version: '1.0.0',
    scheme: 'deenitv',
    // The web app works in both orientations (a landscape phone uses the
    // tablet layout); fullscreen locks landscape at runtime.
    orientation: 'default',
    icon: './assets/icon.png',
    userInterfaceStyle: 'dark',
    backgroundColor: '#09090b',
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.deeni.tv',
    },
    android: {
      package: 'com.deeni.tv',
      adaptiveIcon: {
        backgroundColor: '#FFFFFF',
        foregroundImage: './assets/adaptive-icon.png',
      },
      predictiveBackGestureEnabled: false,
    },
    plugins: [
      'expo-router',
      'expo-font',
      'expo-screen-orientation',
      'expo-sqlite',
      [
        'expo-splash-screen',
        {
          image: './assets/splash-icon.png',
          imageWidth: 240,
          resizeMode: 'contain',
          backgroundColor: '#09090b',
        },
      ],
      // No-op unless EXPO_TV=1: leanback launcher, banner, no portrait lock.
      [
        '@react-native-tvos/config-tv',
        {
          isTV,
          androidTVBanner: './assets/tv-banner.png',
        },
      ],
    ],
    extra: {
      isTV,
    },
  };
};
