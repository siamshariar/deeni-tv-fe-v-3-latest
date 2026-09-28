import type { CSSProperties } from 'react'

export type PlayerSize = 'desktop' | 'tablet' | 'mobile'

// Height reserved under the 16:9 frame: the bottom control bar (~60–70px)
// plus some breathing room.
const BAR_RESERVE_PX = 96

// Width of the player wrapper (16:9 frame + bottom bar). Shared by the main
// player and the Previous Programs player so they are always the exact same
// box — opening one over the other looks like a second screen stacked on top.
//
// Width alone isn't enough: on short screens (phones in landscape, small
// laptops) a width-based 16:9 frame is taller than the viewport and the page
// scrolls. So the width is also capped by what the visible height (dvh — the
// real visible height on iOS Safari, unlike vh) allows.
export function playerFrameStyle(size: PlayerSize): CSSProperties {
  const base =
    size === 'desktop' ? 'min(70vw, 1400px)' :
    size === 'tablet' ? '90vw' :
    '100%'
  // --app-vh (globals.css) is 1dvh, or 1dvw while the app is rotated for the
  // iPhone fullscreen — so the fit is always against the app's visible height.
  return { width: `min(${base}, calc((var(--app-vh) * 100 - ${BAR_RESERVE_PX}px) * 16 / 9))` }
}

// Nested page-scroll lock (main fullscreen and the Previous Programs player can
// overlap). On iOS a fixed full-screen layer does not stop the page behind it
// from scrolling, which revealed the other player's iframe underneath.
let scrollLocks = 0
let savedHtmlOverflow = ''
let savedBodyOverflow = ''

// iPhone rotated fullscreen: while any player is in it, the whole app root is
// rotated to landscape (globals.css, html[data-rotated-fs]). Counted because the
// main and previous players can both be fullscreen at once.
let rotatedHolds = 0
export function holdRotatedApp(): () => void {
  if (typeof document === 'undefined') return () => {}
  rotatedHolds += 1
  document.documentElement.setAttribute('data-rotated-fs', '')
  let released = false
  return () => {
    if (released) return
    released = true
    rotatedHolds = Math.max(0, rotatedHolds - 1)
    if (rotatedHolds === 0) document.documentElement.removeAttribute('data-rotated-fs')
  }
}

export function lockPageScroll(): () => void {
  if (typeof document === 'undefined') return () => {}
  if (scrollLocks === 0) {
    savedHtmlOverflow = document.documentElement.style.overflow
    savedBodyOverflow = document.body.style.overflow
    document.documentElement.style.overflow = 'hidden'
    document.body.style.overflow = 'hidden'
    window.scrollTo(0, 0)
  }
  scrollLocks += 1
  let released = false
  return () => {
    if (released) return
    released = true
    scrollLocks = Math.max(0, scrollLocks - 1)
    if (scrollLocks === 0) {
      document.documentElement.style.overflow = savedHtmlOverflow
      document.body.style.overflow = savedBodyOverflow
    }
  }
}
