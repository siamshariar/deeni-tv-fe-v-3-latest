import { StatusBar, Style } from '@capacitor/status-bar'
import { Capacitor } from '@capacitor/core'

/**
 * Shared app status bar color for web and native shells.
 * Kept in one place so all platforms stay visually aligned.
 */
export const APP_BG_COLOR = '#09090b'

/**
 * Update status bar color to match current context
 * On web: updates the theme-color meta tag
 * On iOS/Android: uses Capacitor's StatusBar plugin
 */
export async function updateStatusBarColor(color: string = APP_BG_COLOR) {
  try {
    // Update web meta theme-color
    updateWebThemeColor(color)

    // Update native status bar color for iOS and Android
    const platform = Capacitor.getPlatform()
    if (platform === 'ios' || platform === 'android') {
      await StatusBar.setBackgroundColor({
        color: color,
      })

      // Ensure status bar is visible and light text
      await StatusBar.setStyle({
        style: Style.Light,
      })
    }
  } catch (error) {
    console.warn('⚠️ Failed to update status bar color:', error)
  }
}

/**
 * Update the web theme-color meta tag for browser UI
 */
export function updateWebThemeColor(color: string = APP_BG_COLOR) {
  try {
    let metaThemeColor = document.querySelector('meta[name="theme-color"]')
    
    if (!metaThemeColor) {
      metaThemeColor = document.createElement('meta')
      metaThemeColor.setAttribute('name', 'theme-color')
      document.head.appendChild(metaThemeColor)
    }
    
    metaThemeColor.setAttribute('content', color)
  } catch (error) {
    console.warn('⚠️ Failed to update web theme color:', error)
  }
}

/**
 * Reset status bar to default app color.
 */
export async function resetStatusBarColor() {
  await updateStatusBarColor(APP_BG_COLOR)
}

/**
 * Initialize status bar on app launch
 * Should be called once when app starts
 */
export async function initializeStatusBar() {
  await resetStatusBarColor()
}
