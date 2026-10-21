import { Geist_400Regular } from '@expo-google-fonts/geist/400Regular';
import { Geist_500Medium } from '@expo-google-fonts/geist/500Medium';
import { Geist_600SemiBold } from '@expo-google-fonts/geist/600SemiBold';
import { Geist_700Bold } from '@expo-google-fonts/geist/700Bold';
import { GeistMono_600SemiBold } from '@expo-google-fonts/geist-mono/600SemiBold';

/** iOS loads the fonts at start (Android builds them in: see appFonts.ts). */
export const APP_FONTS: Record<string, number> = {
  Geist_400Regular,
  Geist_500Medium,
  Geist_600SemiBold,
  Geist_700Bold,
  GeistMono_600SemiBold,
};
