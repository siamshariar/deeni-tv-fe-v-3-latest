// Design tokens from the Deeni web app (app/globals.css, component classes).

export const colors = {
  background: '#09090b', // html/body, theme-color
  zinc950: '#09090b',
  zinc900: '#18181b',
  black: '#000000',
  /** The rendered gold (Tailwind --color-primary). The CSS var --primary (#f4bf24) is not what renders. */
  gold: '#d9a514',
  goldForeground: '#020202',
  purple600: '#9333ea',
  purple500: '#a855f7',
  yellow300: '#fde047',
  yellow500: '#eab308',
  red500: '#ef4444',
  red600: '#dc2626',
  white: '#ffffff',
  text: '#ffffff',
  text60: 'rgba(255,255,255,0.6)',
  text50: 'rgba(255,255,255,0.5)',
  text40: 'rgba(255,255,255,0.4)',
  border10: 'rgba(255,255,255,0.1)',
  border20: 'rgba(255,255,255,0.2)',
  fill5: 'rgba(255,255,255,0.05)',
  fill10: 'rgba(255,255,255,0.1)',
  fill20: 'rgba(255,255,255,0.2)',
  black50: 'rgba(0,0,0,0.5)',
  black60: 'rgba(0,0,0,0.6)',
  black70: 'rgba(0,0,0,0.7)',
  black80: 'rgba(0,0,0,0.8)',
  black90: 'rgba(0,0,0,0.9)',
} as const;

export const fonts = {
  regular: 'Geist_400Regular',
  medium: 'Geist_500Medium',
  semibold: 'Geist_600SemiBold',
  bold: 'Geist_700Bold',
  mono: 'GeistMono_600SemiBold',
} as const;

export const radius = {
  modal: 16,
  item: 16,
  playerSmall: 16, // ≤768 px (rounded-t-2xl)
  playerLarge: 24, // ≥768 px (md:rounded-t-3xl)
} as const;
