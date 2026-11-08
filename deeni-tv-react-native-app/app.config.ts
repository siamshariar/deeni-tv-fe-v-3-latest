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
/**
 * Release number: raise it for every store upload. It must stay above the Capacitor
 * app's versionCode 2 (com.deeni.tv 1.0.1, web repo android/), or that app can't be
 * updated. The TV build gets its own code (Google Play needs a unique one per upload).
 */
const BUILD_NUMBER = 3;
const VERSION = '1.1.0';

export default ({ config }: ConfigContext): ExpoConfig => {
  const isTV = process.env.EXPO_TV === '1';

  return {
    ...config,
    name: 'Deeni TV',
    slug: 'deeni-tv',
    version: VERSION,
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
      buildNumber: String(BUILD_NUMBER),
    },
    android: {
      package: 'com.deeni.tv',
      versionCode: isTV ? 1_000_000 + BUILD_NUMBER : BUILD_NUMBER,
      adaptiveIcon: {
        backgroundColor: '#FFFFFF',
        foregroundImage: './assets/adaptive-icon.png',
      },
      predictiveBackGestureEnabled: false,
      // The app needs INTERNET, and ACCESS_NETWORK_STATE / ACCESS_WIFI_STATE (expo-network, the
      // offline banner; normal permissions). These come from libraries and Expo's template:
      // ACTIVITY_RECOGNITION from expo-sensors' pedometer (a "Physical activity"
      // runtime permission Google Play asks to justify; the rotation watch uses the
      // accelerometer, which needs none), the rest from the dev menu and old storage.
      blockedPermissions: [
        'android.permission.ACTIVITY_RECOGNITION',
        'android.permission.SYSTEM_ALERT_WINDOW',
        'android.permission.READ_EXTERNAL_STORAGE',
        'android.permission.WRITE_EXTERNAL_STORAGE',
        'android.permission.VIBRATE',
      ],
    },
    plugins: [
      'expo-router',
      // Android: the fonts are built in (assets/fonts, found by file name), so the first screen
      // and the players' WebViews don't wait for them to load at start (iOS loads them: appFonts).
      [
        'expo-font',
        {
          android: {
            fonts: [
              './node_modules/@expo-google-fonts/geist/400Regular/Geist_400Regular.ttf',
              './node_modules/@expo-google-fonts/geist/500Medium/Geist_500Medium.ttf',
              './node_modules/@expo-google-fonts/geist/600SemiBold/Geist_600SemiBold.ttf',
              './node_modules/@expo-google-fonts/geist/700Bold/Geist_700Bold.ttf',
              './node_modules/@expo-google-fonts/geist-mono/600SemiBold/GeistMono_600SemiBold.ttf',
            ],
          },
        },
      ],
      // Android: the WebView engine starts while React Native loads (see the plugin).
      './plugins/withWebViewWarmup',
      // Accelerometer only: no iOS motion permission, and the pedometer is left out.
      ['expo-sensors', { motionPermission: false }],
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
