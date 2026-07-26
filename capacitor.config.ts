import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.deeni.tv',
  appName: 'Deeni TV',
  // `next export` output directory — APK loads these local files
  webDir: 'out',
  // APK now runs fully offline from local assets on Android
  // Removed server.url to use local webDir instead (no network dependency)
  server: {
    // url: 'https://deeni-tv-fe-latest-web-view.vercel.app',  // DISABLED for local offline mode
    cleartext: false,
    androidScheme: 'https',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 3500,
      launchAutoHide: true,
      backgroundColor: '#09090b',
      androidSplashResourceName: 'splash_background',
      androidScaleType: 'FIT_CENTER',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: 'light',
      backgroundColor: '#09090b',
      overlaysWebView: false,
    },
  },
};

export default config;
