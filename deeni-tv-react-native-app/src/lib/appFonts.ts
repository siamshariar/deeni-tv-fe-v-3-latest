/**
 * Fonts loaded at start (root layout). None on Android: the expo-font plugin builds them into
 * the app (app.config.ts), found by file name, so nothing waits for them; the iOS build loads
 * them (appFonts.ios.ts).
 */
export const APP_FONTS: Record<string, number> = {};
