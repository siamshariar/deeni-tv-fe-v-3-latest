'use client'

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { useMediaQuery } from '@/hooks/use-media-query'

export type FullscreenMode = 'none' | 'native' | 'pseudo'

const getFullscreenElement = (): Element | null =>
  document.fullscreenElement ?? (document as any).webkitFullscreenElement ?? null

// Fullscreen for a player wrapper element.
//
// The native Fullscreen API is requested on the whole page (<html>), not on the
// player, and the player wrapper is then pinned over the viewport via
// `fullscreenStyle`. That way modals opened from the player (schedule, history,
// channels, menu) still show on top without leaving fullscreen — with element
// fullscreen anything outside the element is hidden.
//
// iPhone Safari has no page fullscreen at all, so there (or whenever the native
// request fails, e.g. some WebViews) we fall back to a CSS "pseudo" fullscreen:
// the same pinned wrapper, rotated 90° to landscape while the phone is portrait.
export function useFullscreen({ zIndex }: { zIndex: number }) {
  const [fsMode, setFsMode] = useState<FullscreenMode>('none')
  const isPortrait = useMediaQuery('(orientation: portrait)')
  // False when the page was already fullscreen (another player owns it) —
  // then exiting only restores our layout and leaves the page fullscreen.
  const ownsNativeRef = useRef(false)

  const exitFullscreen = useCallback(() => {
    if (ownsNativeRef.current && getFullscreenElement()) {
      const doc = document as any
      try {
        const result = (doc.exitFullscreen ?? doc.webkitExitFullscreen)?.call(doc)
        result?.catch?.(() => {})
      } catch {}
    }
    if (ownsNativeRef.current) {
      try { (screen.orientation as any)?.unlock?.() } catch {}
    }
    ownsNativeRef.current = false
    setFsMode('none')
  }, [])

  const enterFullscreen = useCallback(async () => {
    if (getFullscreenElement()) {
      ownsNativeRef.current = false
      setFsMode('native')
      return
    }
    const el = document.documentElement as any
    const request = el.requestFullscreen ?? el.webkitRequestFullscreen
    if (request) {
      try {
        await request.call(el)
        ownsNativeRef.current = true
        setFsMode('native')
        try { await (screen.orientation as any)?.lock?.('landscape') } catch {}
        // Old WebKit's prefixed call returns nothing and may silently no-op.
        setTimeout(() => {
          if (!getFullscreenElement()) setFsMode((m) => (m === 'native' ? 'pseudo' : m))
        }, 400)
        return
      } catch {}
    }
    setFsMode('pseudo')
  }, [])

  const toggleFullscreen = useCallback(() => {
    if (fsMode === 'none') void enterFullscreen()
    else exitFullscreen()
  }, [fsMode, enterFullscreen, exitFullscreen])

  // User left native fullscreen via Esc / system gesture
  useEffect(() => {
    const onChange = () => {
      if (!getFullscreenElement()) {
        ownsNativeRef.current = false
        setFsMode((m) => (m === 'native' ? 'none' : m))
      }
    }
    document.addEventListener('fullscreenchange', onChange)
    document.addEventListener('webkitfullscreenchange', onChange)
    return () => {
      document.removeEventListener('fullscreenchange', onChange)
      document.removeEventListener('webkitfullscreenchange', onChange)
    }
  }, [])

  // Esc leaves pseudo fullscreen too (native handles its own Esc)
  useEffect(() => {
    if (fsMode !== 'pseudo') return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFsMode('none')
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [fsMode])

  // In rotated mode the element's horizontal axis runs down the screen —
  // anything measuring pointer position along it must use clientY.
  const rotated = fsMode === 'pseudo' && isPortrait

  // Apply to the player wrapper element
  const fullscreenStyle: CSSProperties | undefined = fsMode === 'none'
    ? undefined
    : rotated
      ? {
          position: 'fixed', top: 0, left: 0, zIndex,
          width: '100dvh', height: '100dvw',
          transform: 'translateX(100dvw) rotate(90deg)',
          transformOrigin: 'top left',
        }
      : { position: 'fixed', inset: 0, zIndex, width: '100%', height: '100dvh' }

  return {
    fsMode,
    isFullscreen: fsMode !== 'none',
    rotated,
    fullscreenStyle,
    enterFullscreen,
    exitFullscreen,
    toggleFullscreen,
  }
}
