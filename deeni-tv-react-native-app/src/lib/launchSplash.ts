import * as SplashScreen from 'expo-splash-screen';

let hidden = false;

/** Ends the launch splash, once: at the first screen (phones) or when its picture is there (TV). */
export function hideLaunchSplash(): void {
  if (hidden) return;
  hidden = true;
  SplashScreen.hideAsync().catch(() => {});
}
