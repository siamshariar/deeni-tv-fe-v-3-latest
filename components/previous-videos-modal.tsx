'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { X, Clock, History, Play, Pause, Volume2, Volume1, Volume, VolumeX, Maximize, Minimize, RotateCcw, RotateCw, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { VideoProgram } from '@/types/schedule'
import { formatDuration } from '@/lib/schedule-utils'
import { useState, useEffect, useRef, useCallback, useImperativeHandle } from 'react'
import { useMediaQuery } from '@/hooks/use-media-query'
import { useFullscreen } from '@/hooks/use-fullscreen'
import { playerFrameStyle, lockPageScroll } from '@/lib/player-layout'

interface PreviousVideosModalProps {
  isOpen: boolean
  onClose: () => void
  videos: VideoProgram[]
  onPlayVideo?: (video: VideoProgram) => void
  currentChannelId?: string
  onPauseMainPlayer?: () => void
  onResumeMainPlayer?: () => void
  // Main player is fullscreen → open the previous player fullscreen too
  openFullscreen?: boolean
}

// Branded Loading Overlay - Shows during YouTube iframe loading. Same look as
// the main player's. With `onTap` it becomes the (iOS-only, one-time) Tap to
// Play screen: identical branded screen, a play button instead of the loading
// bar — so iOS shows the same UI as web/Android instead of a separate screen.
const BrandedLoadingOverlay = ({ 
  isVisible, 
  programName,
  onTap,
}: { 
  isVisible: boolean
  programName: string
  onTap?: () => void
}) => {
  const isTapMode = !!onTap
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          onClick={onTap}
          role={isTapMode ? 'button' : undefined}
          aria-label={isTapMode ? 'Tap to play' : undefined}
          className={`absolute inset-0 z-[45] flex flex-col items-center justify-center bg-gradient-to-br from-zinc-900 via-zinc-950 to-black ${isTapMode ? 'cursor-pointer' : ''}`}
        >
          {/* Background pattern */}
          <div className="absolute inset-0 opacity-5">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.1)_0%,transparent_50%)]" />
          </div>
          
          {/* Logo and branding — fully responsive sizing */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1, type: "spring", damping: 20 }}
            className="relative flex flex-col items-center gap-2.5 sm:gap-3 md:gap-4"
          >
            {/* Spinning loader ring + logo — scales with viewport */}
            <div className="relative flex items-center justify-center w-[14vmin] h-[14vmin] min-w-[3.5rem] min-h-[3.5rem] max-w-[7rem] max-h-[7rem] sm:min-w-[4.5rem] sm:min-h-[4.5rem] sm:max-w-[8rem] sm:max-h-[8rem] md:max-w-[9rem] md:max-h-[9rem]">
              <motion.div
                animate={isTapMode ? { rotate: 0 } : { rotate: 360 }}
                transition={{ duration: 2, repeat: isTapMode ? 0 : Infinity, ease: "linear" }}
                className="absolute inset-0 rounded-full border-2 border-primary/20"
              />
              {!isTapMode && (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                  className="absolute inset-0 rounded-full border-t-2 border-primary"
                />
              )}
              {/* Logo image — 40% of the spinner circle */}
              <img 
                src="/DeeniTV-V-2.png" 
                alt="Deeni.tv"
                className="h-[40%] w-auto object-contain"
              />
            </div>
            
            {/* Program name banner */}
            <div className="max-w-[85%] sm:max-w-md md:max-w-lg text-center px-3 sm:px-5 md:px-6">
              <motion.div
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl px-3 py-2 sm:px-4 sm:py-2.5 md:px-5 md:py-3"
              >
                <p className="text-white/50 uppercase tracking-wider font-medium text-[7px] sm:text-[9px] md:text-[10px] mb-0.5 sm:mb-1">
                  Watching
                </p>
                <h3 className="text-white font-bold leading-tight line-clamp-2 text-sm sm:text-base md:text-lg lg:text-xl">
                  {programName || 'Loading program...'}
                </h3>
              </motion.div>
            </div>
            
            {isTapMode ? (
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', damping: 15 }}
                className="flex items-center gap-2 rounded-full bg-white/15 border border-white/20 backdrop-blur-md px-4 py-2 sm:px-5 sm:py-2.5 text-white shadow-2xl"
              >
                <Play className="h-4 w-4 sm:h-5 sm:w-5 fill-white" />
                <span className="text-xs sm:text-sm font-semibold">Tap to Play</span>
              </motion.div>
            ) : (
              /* Loading bar animation */
              <motion.div 
                className="w-[25vmin] min-w-[6rem] max-w-[12rem] h-1 bg-white/10 rounded-full overflow-hidden"
              >
                <motion.div
                  animate={{ x: ['-100%', '100%'] }}
                  transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
                  className="h-full w-full bg-gradient-to-r from-transparent via-primary to-transparent"
                />
              </motion.div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// Breaking News Style Ticker Component - Infinite 360-degree scroll
const BreakingNewsTicker = ({ 
  videos, 
  currentVideoId 
}: { 
  videos: VideoProgram[]
  currentVideoId?: string 
}) => {
  const isMobile = useMediaQuery('(max-width: 640px)')
  
  // Filter out current video and get remaining videos
  const remainingVideos = videos.filter(v => v.id !== currentVideoId)
  
  if (remainingVideos.length === 0) return null
  
  const items: React.ReactElement[] = []
  const repeatCount = 30 // High count for smooth infinite loop
  
  for (let i = 0; i < repeatCount; i++) {
    remainingVideos.forEach((video, videoIndex) => {
      // Only the FIRST video in the original list is "NEXT" - not all index 0s in repeats
      const isNextVideo = videoIndex === 0
      const duration = formatDuration(video.duration)
      
      items.push(
        <div 
          key={`ticker-${video.id}-${i}-${videoIndex}`} 
          className={`inline-flex items-center ${isMobile ? 'mx-4' : 'mx-8'}`}
        >
          {/* Badge - NEXT is very prominent, UP NEXT is subtle */}
          {isNextVideo ? (
            <span className={`
              rounded-full font-black mr-3 whitespace-nowrap uppercase tracking-wider
              bg-gradient-to-r from-yellow-400 to-yellow-500 text-black
              border-2 border-yellow-300 shadow-xl shadow-yellow-400/60
              ${isMobile ? 'px-3 py-1 text-[11px]' : 'px-4 py-1.5 text-sm'}
            `}>
              ▶ NEXT
            </span>
          ) : (
            <span className={`
              rounded-full font-medium mr-2 whitespace-nowrap uppercase tracking-wider
              bg-white/10 text-white/60 border border-white/20
              ${isMobile ? 'px-2 py-0.5 text-[9px]' : 'px-2.5 py-0.5 text-[10px]'}
            `}>
              UP NEXT
            </span>
          )}
          
          {/* Title - Full text visible, no truncation */}
          <span className={`
            tracking-wide whitespace-nowrap
            ${isMobile ? 'text-sm' : 'text-base'}
            ${isNextVideo 
              ? 'text-yellow-200 font-black text-shadow-lg' 
              : 'text-white/80 font-semibold'
            }
          `}>
            {video.title}
          </span>
          
          {/* Duration */}
          <span className={`
            font-mono whitespace-nowrap
            ${isMobile ? 'ml-2 text-[11px]' : 'ml-3 text-sm'}
            ${isNextVideo ? 'text-yellow-300 font-bold' : 'text-white/50 font-medium'}
          `}>
            • {duration}
          </span>
        </div>
      )
    })
  }
  
  // Calculate animation distance based on content - much longer distance for continuous loop
  const totalVideos = remainingVideos.length * repeatCount
  const animationDistance = isMobile ? -(totalVideos * 400) : -(totalVideos * 500)
  const animationDuration = isMobile ? totalVideos * 6 : totalVideos * 5 // Consistent speed per video
  
  return (
    <div className={`
      absolute left-0 right-0 z-20 overflow-hidden
      bg-gradient-to-r from-black via-black/95 to-black
      border-t border-white/10
      ${isMobile ? 'bottom-16 h-12' : 'bottom-18 h-14'}
    `}>
      {/* Gradient Fades */}
      <div className={`absolute left-0 top-0 bottom-0 ${isMobile ? 'w-8' : 'w-16'} bg-gradient-to-r from-black to-transparent z-10 pointer-events-none`} />
      <div className={`absolute right-0 top-0 bottom-0 ${isMobile ? 'w-8' : 'w-16'} bg-gradient-to-l from-black to-transparent z-10 pointer-events-none`} />
      
      {/* Infinite Scrolling Content - 360-degree continuous loop */}
      <motion.div
        className="flex items-center h-full whitespace-nowrap"
        animate={{ x: [0, animationDistance] }}
        transition={{ 
          duration: animationDuration,
          repeat: Infinity, 
          ease: "linear"
        }}
        style={{ willChange: "transform" }}
      >
        {items}
      </motion.div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Previous-program player
//
// ONE YT.Player instance is created the first time the Previous Programs list
// opens and is then kept alive for the rest of the page session. Closing the
// player only pauses it and hides it; picking another program just calls
// loadVideoById() on the same instance. iOS ties its "user allowed playback
// with sound" permission to the media element inside that iframe, so reusing
// the instance means the Tap-to-Play step is needed at most once (the same
// trick the main player and Quran Tube rely on). Never destroy it on close.
// ─────────────────────────────────────────────────────────────────────────────

export interface PreviousPlayerHandle {
  // Must be called synchronously from the user's tap so iOS sees a gesture.
  play: (video: VideoProgram) => void
}

const YT_STATE = { ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 } as const
// If playback hasn't actually started by then (autoplay blocked), show Tap to Play.
const PLAY_WATCHDOG_MS = 4000
// A player that keeps reporting BUFFERING without ever playing gets Tap to Play
// after this long instead of an endless loading screen.
const MAX_BUFFERING_WAIT_MS = 12000
// Keep the branded loading screen up this long after playback starts so
// YouTube's start overlay (title bar, "More videos") never shows.
const REVEAL_AFTER_PLAYING_MS = 3500
// Safety cap only — normally the reveal waits for time to actually advance
// (a short cap revealed YouTube's own spinner on iOS)
const REVEAL_MAX_WAIT_MS = 20000
// Playback frozen this long (not paused by the user) → branded screen covers
// YouTube's buffering spinner until it moves again
const STALL_COVER_MS = 1200
const CONTROLS_HIDE_MS = 3500
const SKIP_SECONDS = 10

// Format seconds → M:SS or H:MM:SS
const fmtTime = (sec: number): string => {
  if (!sec || isNaN(sec) || sec < 0) return '0:00'
  const hours = Math.floor(sec / 3600)
  const minutes = Math.floor((sec % 3600) / 60)
  const seconds = Math.floor(sec % 60)
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

// Chains window.onYouTubeIframeAPIReady instead of overwriting it — the main
// player loads the same API independently.
const loadYouTubeApi = (): Promise<void> => {
  if (window.YT?.Player) return Promise.resolve()
  return new Promise((resolve) => {
    if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
      const tag = document.createElement('script')
      tag.src = 'https://www.youtube.com/iframe_api'
      document.head.appendChild(tag)
    }
    const prevCallback = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      prevCallback?.()
      resolve()
    }
  })
}

// Custom seek bar (instead of the Radix slider) so it keeps working when the
// iPhone pseudo-fullscreen rotates the player 90°: in that case the bar's
// horizontal axis runs down the screen, so we measure along clientY.
const SeekBar = ({
  currentTime,
  duration,
  rotated,
  onSeek,
}: {
  currentTime: number
  duration: number
  rotated: boolean
  onSeek: (seconds: number) => void
}) => {
  const trackRef = useRef<HTMLDivElement>(null)
  const [dragValue, setDragValue] = useState<number | null>(null)

  const valueFromPointer = (e: React.PointerEvent) => {
    const rect = trackRef.current?.getBoundingClientRect()
    if (!rect || duration <= 0) return 0
    const fraction = rotated
      ? (e.clientY - rect.top) / rect.height
      : (e.clientX - rect.left) / rect.width
    return Math.min(1, Math.max(0, fraction)) * duration
  }

  const shown = dragValue ?? currentTime
  const pct = duration > 0 ? Math.min(100, (shown / duration) * 100) : 0

  return (
    <div
      ref={trackRef}
      role="slider"
      aria-label="Seek"
      aria-valuemin={0}
      aria-valuemax={Math.round(duration)}
      aria-valuenow={Math.round(shown)}
      className={`group relative flex h-5 w-full items-center touch-none ${duration > 0 ? 'cursor-pointer' : 'opacity-50'}`}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => {
        if (duration <= 0) return
        e.stopPropagation()
        e.currentTarget.setPointerCapture(e.pointerId)
        setDragValue(valueFromPointer(e))
      }}
      onPointerMove={(e) => {
        if (dragValue === null) return
        setDragValue(valueFromPointer(e))
      }}
      onPointerUp={(e) => {
        if (dragValue === null) return
        onSeek(valueFromPointer(e))
        setDragValue(null)
      }}
      onPointerCancel={() => setDragValue(null)}
    >
      <div className="relative h-1 w-full rounded-full bg-white/30 transition-[height] duration-150 group-hover:h-1.5">
        <div className="absolute inset-y-0 left-0 rounded-full bg-red-600" style={{ width: `${pct}%` }} />
        <div
          className={`absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_0_0_2px_rgba(0,0,0,0.3)] transition-transform ${
            dragValue !== null ? 'scale-125' : 'group-hover:scale-110'
          }`}
          style={{ left: `${pct}%` }}
        />
      </div>
    </div>
  )
}

// Same size/shape as the main player (synced-video-player.tsx) so opening it
// looks like a second screen stacked exactly on top of the live one.
const PreviousVideoPlayer = ({
  video,
  isOpen,
  warmVideoId,
  openFullscreen = false,
  onClose,
  controllerRef,
}: {
  video: VideoProgram | null
  isOpen: boolean
  // When set, the persistent player is created ahead of time (cued, not playing)
  // so the first pick can start playback inside the tap itself.
  warmVideoId?: string
  openFullscreen?: boolean
  onClose: () => void
  controllerRef: React.Ref<PreviousPlayerHandle>
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const ytPlayerRef = useRef<any>(null)
  const creatingRef = useRef(false)
  const unmountedRef = useRef(false)
  const playerReadyRef = useRef(false)
  const pendingVideoIdRef = useRef<string | null>(null)
  const isOpenRef = useRef(isOpen)
  const volumeRef = useRef(75)
  const isMutedRef = useRef(false)
  const watchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const controlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const volumeHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Same breakpoints as the main player
  const isMobile = useMediaQuery('(max-width: 768px)')
  const isTablet = useMediaQuery('(min-width: 769px) and (max-width: 1024px)')
  const isDesktop = useMediaQuery('(min-width: 1025px)')
  const isCoarsePointer = useMediaQuery('(pointer: coarse)')

  const [playerReady, setPlayerReady] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isBuffering, setIsBuffering] = useState(false)
  const [isVideoLoading, setIsVideoLoading] = useState(false)
  const [needsTap, setNeedsTap] = useState(false)
  const [isEnded, setIsEnded] = useState(false)
  // The iframe stays invisible (branded loading screen on top) until the new
  // video is really moving — otherwise YouTube's own spinner/title screen (and,
  // on iOS, the previously cued video) shows through.
  const [iframeShown, setIframeShown] = useState(false)
  const [isStalled, setIsStalled] = useState(false)
  const lastTimeRef = useRef(0)
  const lastMoveAtRef = useRef(0)
  const revealPendingRef = useRef(false)
  const playingSinceRef = useRef(0)
  const playStartTimeRef = useRef(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(75)
  const [isMuted, setIsMuted] = useState(false)
  const [showVolumeSlider, setShowVolumeSlider] = useState(false)
  const [controlsVisible, setControlsVisible] = useState(true)
  const { fsMode, isFullscreen, rotated, fullscreenStyle, enterFullscreen, exitFullscreen, toggleFullscreen } = useFullscreen({ zIndex: 100 })

  useEffect(() => {
    isOpenRef.current = isOpen
  }, [isOpen])

  // No page scrolling behind the player (iOS let the page — and the main
  // player's iframe — scroll into view underneath)
  useEffect(() => {
    if (!isOpen) return
    return lockPageScroll()
  }, [isOpen])

  const clearWatchdog = useCallback(() => {
    if (watchdogRef.current) {
      clearTimeout(watchdogRef.current)
      watchdogRef.current = null
    }
  }, [])

  // Only give up once the player is still idle (never reached BUFFERING/PLAYING),
  // which is what a blocked autoplay looks like. Slow networks keep buffering
  // and must not get the Tap to Play prompt.
  const armWatchdog = useCallback(() => {
    clearWatchdog()
    const armedAt = Date.now()
    const check = () => {
      let state: number | undefined
      try { state = ytPlayerRef.current?.getPlayerState?.() } catch {}
      if (state === YT_STATE.PLAYING) return
      if (state === YT_STATE.BUFFERING && Date.now() - armedAt < MAX_BUFFERING_WAIT_MS) {
        watchdogRef.current = setTimeout(check, PLAY_WATCHDOG_MS)
        return
      }
      if (!isOpenRef.current) return
      setIsVideoLoading(false)
      setNeedsTap(true)
    }
    watchdogRef.current = setTimeout(check, PLAY_WATCHDOG_MS)
  }, [clearWatchdog])

  const bumpControls = useCallback(() => {
    setControlsVisible(true)
    if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current)
    controlsTimerRef.current = setTimeout(() => setControlsVisible(false), CONTROLS_HIDE_MS)
  }, [])

  // Starts a video on the existing player. Everything up to playVideo() is
  // synchronous so it stays inside the caller's user gesture on iOS.
  const startVideo = useCallback((videoId: string) => {
    const player = ytPlayerRef.current
    if (!player) return
    pendingVideoIdRef.current = null
    setIsEnded(false)
    setNeedsTap(false)
    setIsPlaying(false)
    setIsBuffering(false)
    setIsVideoLoading(true)
    setIframeShown(false)
    setIsStalled(false)
    revealPendingRef.current = true
    playingSinceRef.current = 0
    setCurrentTime(0)
    setDuration(0)
    try {
      player.loadVideoById({ videoId, startSeconds: 0 })
      if (isMutedRef.current) {
        player.mute()
      } else {
        player.unMute()
        player.setVolume(volumeRef.current)
      }
      player.playVideo()
    } catch {}
    armWatchdog()
  }, [armWatchdog])

  const ensurePlayer = useCallback((initialVideoId: string) => {
    if (creatingRef.current || ytPlayerRef.current) return
    creatingRef.current = true

    loadYouTubeApi().then(() => {
      if (unmountedRef.current || !containerRef.current || !window.YT?.Player) {
        creatingRef.current = false
        return
      }
      containerRef.current.innerHTML = ''
      const div = document.createElement('div')
      div.id = `previous-yt-${Date.now()}`
      containerRef.current.appendChild(div)

      ytPlayerRef.current = new window.YT.Player(div.id, {
        width: '100%',
        height: '100%',
        videoId: initialVideoId,
        playerVars: {
          autoplay: 0,
          controls: 0,
          modestbranding: 1,
          rel: 0,
          showinfo: 0,
          iv_load_policy: 3,
          cc_load_policy: 0, // no auto captions
          disablekb: 1,
          fs: 0,
          enablejsapi: 1,
          origin: window.location.origin,
          playsinline: 1,
        },
        events: {
          onReady: (event: any) => {
            if (unmountedRef.current) return
            playerReadyRef.current = true
            setPlayerReady(true)
            try { event.target.setVolume(volumeRef.current) } catch {}
            // A program was picked before the player finished booting. This is
            // outside the tap, so iOS may block it — the watchdog then shows
            // Tap to Play (first time only).
            if (pendingVideoIdRef.current && isOpenRef.current) {
              startVideo(pendingVideoIdRef.current)
            }
          },
          onStateChange: (event: any) => {
            if (unmountedRef.current) return
            switch (event.data) {
              case YT_STATE.PLAYING: {
                clearWatchdog()
                // YouTube may still turn auto-captions on — keep them off
                try { event.target.unloadModule?.('captions'); event.target.unloadModule?.('cc') } catch {}
                // Closed while it was still loading — don't play in the background.
                if (!isOpenRef.current) {
                  try { event.target.pauseVideo() } catch {}
                  return
                }
                setIsPlaying(true)
                setIsBuffering(false)
                setNeedsTap(false)
                setIsEnded(false)
                bumpControls()
                // YouTube (iOS especially) reports PLAYING while still showing
                // its own spinner — reveal only once time actually advances
                // (see the polling effect), with a time cap as a fallback.
                if (revealPendingRef.current && !playingSinceRef.current) {
                  playingSinceRef.current = Date.now()
                  try { playStartTimeRef.current = event.target.getCurrentTime() || 0 } catch {}
                }
                try {
                  const d = event.target.getDuration()
                  if (typeof d === 'number' && d > 0) setDuration(d)
                } catch {}
                break
              }
              case YT_STATE.PAUSED:
                setIsPlaying(false)
                setIsBuffering(false)
                break
              case YT_STATE.BUFFERING:
                setIsBuffering(true)
                break
              case YT_STATE.ENDED:
                setIsPlaying(false)
                setIsBuffering(false)
                setIsEnded(true)
                break
            }
          },
          onError: () => {
            if (unmountedRef.current) return
            clearWatchdog()
            revealPendingRef.current = false
            setIsVideoLoading(false)
            setIframeShown(true)
            setIsBuffering(false)
          },
        },
      })

      // Patch iframe attributes for iOS inline playback; our own overlay
      // receives all taps.
      const patchIframe = (attempt = 0) => {
        if (unmountedRef.current) return
        const iframe = containerRef.current?.querySelector('iframe')
        if (iframe) {
          iframe.setAttribute('playsinline', 'true')
          iframe.setAttribute('webkit-playsinline', 'webkit-playsinline')
          iframe.setAttribute('allow', 'autoplay; encrypted-media; fullscreen')
          Object.assign(iframe.style, {
            border: 'none', pointerEvents: 'none',
            width: '100%', height: '100%',
            position: 'absolute', top: '0', left: '0',
          })
        } else if (attempt < 5) {
          setTimeout(() => patchIframe(attempt + 1), 300)
        }
      }
      setTimeout(() => patchIframe(), 100)
    })
  }, [bumpControls, clearWatchdog, startVideo])

  // Warm up the persistent player as soon as the Previous Programs list opens.
  useEffect(() => {
    if (warmVideoId) ensurePlayer(warmVideoId)
  }, [warmVideoId, ensurePlayer])

  // Destroy only when the whole page unmounts — never on close.
  useEffect(() => {
    unmountedRef.current = false
    return () => {
      unmountedRef.current = true
      if (watchdogRef.current) clearTimeout(watchdogRef.current)
      if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current)
      if (volumeHideTimerRef.current) clearTimeout(volumeHideTimerRef.current)
      if (ytPlayerRef.current?.destroy) {
        try { ytPlayerRef.current.destroy() } catch {}
      }
      ytPlayerRef.current = null
      playerReadyRef.current = false
      creatingRef.current = false
    }
  }, [])

  useImperativeHandle(controllerRef, () => ({
    play: (v: VideoProgram) => {
      setControlsVisible(true)
      // Match the main player: fullscreen there → fullscreen here, else normal
      if (openFullscreen && fsMode === 'none') void enterFullscreen()
      if (playerReadyRef.current) {
        startVideo(v.videoId)
      } else {
        pendingVideoIdRef.current = v.videoId
        setIsVideoLoading(true)
        setIframeShown(false)
        ensurePlayer(v.videoId)
      }
    },
  }), [ensurePlayer, enterFullscreen, fsMode, openFullscreen, startVideo])

  // Progress polling while visible
  useEffect(() => {
    if (!isOpen || !playerReady) return
    const interval = setInterval(() => {
      const player = ytPlayerRef.current
      if (!player) return
      try {
        const t = player.getCurrentTime?.() ?? 0
        const d = player.getDuration?.() ?? 0
        if (typeof t === 'number') setCurrentTime(t)
        if (typeof d === 'number' && d > 0) setDuration(d)

        // Movement is the source of truth — iOS drops/delays state events.
        const now = Date.now()
        const state = player.getPlayerState?.()
        if (typeof t === 'number' && t > lastTimeRef.current + 0.1) {
          lastTimeRef.current = t
          lastMoveAtRef.current = now
          setIsStalled(false)
          if (state !== YT_STATE.PAUSED && state !== YT_STATE.ENDED) {
            setIsPlaying(true) // so auto-hide etc. work even without PLAYING
            setIsBuffering(false)
          }
        } else {
          if (typeof t === 'number' && t < lastTimeRef.current - 1) lastTimeRef.current = t // seek back / new video
          const userStopped = state === YT_STATE.PAUSED || state === YT_STATE.ENDED || state === YT_STATE.CUED
          if (!revealPendingRef.current && !userStopped && now - lastMoveAtRef.current > STALL_COVER_MS) {
            setIsStalled(true)
          } else if (userStopped) {
            setIsStalled(false)
          }
        }
        // Reveal the iframe once playback is really moving AND YouTube's own
        // start-of-playback overlay (channel/title bar, "More videos", logo —
        // shown ~3s even with controls off) has faded; same as the main
        // player's 3.5s branded-overlay delay. Hard cap as a fallback.
        if (revealPendingRef.current && playingSinceRef.current) {
          const moving = typeof t === 'number' && t > playStartTimeRef.current + 0.3
          const playingFor = Date.now() - playingSinceRef.current
          if ((moving && playingFor >= REVEAL_AFTER_PLAYING_MS) || playingFor > REVEAL_MAX_WAIT_MS) {
            revealPendingRef.current = false
            setIsVideoLoading(false)
            setIframeShown(true)
          }
        }
      } catch {}
    }, 250)
    return () => clearInterval(interval)
  }, [isOpen, playerReady])

  // ── Playback controls ──
  const togglePlayback = useCallback(() => {
    const player = ytPlayerRef.current
    if (!player || !playerReady) return
    try {
      if (isEnded) {
        player.seekTo(0, true)
        player.playVideo()
        setIsEnded(false)
      } else if (isPlaying) {
        player.pauseVideo()
        setIsPlaying(false)
      } else {
        player.playVideo()
      }
    } catch {}
  }, [isEnded, isPlaying, playerReady])

  const seekTo = useCallback((seconds: number) => {
    const clamped = Math.max(0, duration > 0 ? Math.min(seconds, duration - 0.5) : seconds)
    setCurrentTime(clamped)
    setIsEnded(false)
    try { ytPlayerRef.current?.seekTo(clamped, true) } catch {}
  }, [duration])

  const skip = useCallback((delta: number) => {
    seekTo(currentTime + delta)
  }, [currentTime, seekTo])

  const handleTapToPlay = useCallback(() => {
    const player = ytPlayerRef.current
    if (!player) return
    try {
      if (!isMutedRef.current) {
        player.unMute()
        player.setVolume(volumeRef.current)
      }
      player.playVideo()
    } catch {}
    setNeedsTap(false)
    setIsVideoLoading(true)
    revealPendingRef.current = true
    playingSinceRef.current = 0
    armWatchdog()
  }, [armWatchdog])

  const resetVolumeHideTimer = useCallback(() => {
    if (volumeHideTimerRef.current) clearTimeout(volumeHideTimerRef.current)
    volumeHideTimerRef.current = setTimeout(() => setShowVolumeSlider(false), 1500)
  }, [])

  const handleVolumeChange = useCallback((values: number[]) => {
    const v = values[0]
    volumeRef.current = v
    isMutedRef.current = v === 0
    setVolume(v)
    setIsMuted(v === 0)
    try {
      ytPlayerRef.current?.setVolume(v)
      if (v === 0) ytPlayerRef.current?.mute()
      else ytPlayerRef.current?.unMute()
    } catch {}
  }, [])

  const toggleMute = useCallback(() => {
    const newMuted = !isMutedRef.current
    isMutedRef.current = newMuted
    setIsMuted(newMuted)
    try {
      if (newMuted) {
        ytPlayerRef.current?.mute()
      } else {
        if (volumeRef.current === 0) {
          volumeRef.current = 75
          setVolume(75)
        }
        ytPlayerRef.current?.unMute()
        ytPlayerRef.current?.setVolume(volumeRef.current)
      }
    } catch {}
  }, [])

  const handleClose = useCallback(() => {
    clearWatchdog()
    // Stop (not just pause) and mute. A paused video keeps its loaded stream
    // and decoder, which starved the main player: after a previous program had
    // played, every Refresh left the main video frozen on YouTube's spinner.
    // stopVideo() releases them but keeps this same player/iframe (and so the
    // iOS playback unlock) for the next loadVideoById(). Mute keeps it silent
    // even if something resumes it; startVideo()/Tap to Play unmute again.
    try {
      ytPlayerRef.current?.stopVideo?.()
      ytPlayerRef.current?.mute?.()
    } catch {}
    setIsPlaying(false)
    setNeedsTap(false)
    setIsVideoLoading(false)
    setIframeShown(false)
    setIsStalled(false)
    revealPendingRef.current = false
    if (fsMode !== 'none') exitFullscreen()
    onClose()
  }, [clearWatchdog, exitFullscreen, fsMode, onClose])

  // Tap on the video: touch devices show/hide controls, mouse toggles play.
  const handleSurfaceClick = useCallback(() => {
    if (needsTap || isVideoLoading) return
    const shown = controlsVisible || !isPlaying
    if (isCoarsePointer) {
      if (shown && isPlaying) {
        if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current)
        setControlsVisible(false)
      } else {
        bumpControls()
      }
      return
    }
    togglePlayback()
    bumpControls()
  }, [bumpControls, controlsVisible, isCoarsePointer, isPlaying, isVideoLoading, needsTap, togglePlayback])

  // Keyboard shortcuts (desktop)
  useEffect(() => {
    if (!isOpen) return
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return
      switch (e.key) {
        case ' ':
        case 'k':
          e.preventDefault()
          togglePlayback()
          bumpControls()
          break
        case 'ArrowLeft':
          e.preventDefault()
          skip(-SKIP_SECONDS)
          bumpControls()
          break
        case 'ArrowRight':
          e.preventDefault()
          skip(SKIP_SECONDS)
          bumpControls()
          break
        case 'm':
          toggleMute()
          break
        case 'f':
          toggleFullscreen()
          break
        case 'Escape':
          // Fullscreen (native or pseudo) consumes Escape itself.
          if (fsMode === 'none') handleClose()
          break
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isOpen, fsMode, bumpControls, handleClose, skip, toggleFullscreen, toggleMute, togglePlayback])

  const getVolumeIcon = (cls: string) => {
    if (isMuted || volume === 0) return <VolumeX className={cls} />
    if (volume < 30) return <Volume className={cls} />
    if (volume < 70) return <Volume1 className={cls} />
    return <Volume2 className={cls} />
  }

  const controlsShown = controlsVisible || !isPlaying || isEnded
  const title = video?.title ?? ''
  const iconCls = isMobile ? 'h-3.5 w-3.5' : 'h-4.5 w-4.5'
  // Identical to the main player's action buttons
  const buttonCls = `text-white/90 hover:text-white hover:bg-white/20 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 ${
    isMobile ? 'h-7 w-7' : 'h-9 w-9'
  }`

  // Centre of the bar: back 10s / play-pause / forward 10s
  const playbackButtons = (
    <div className="flex items-center gap-1 md:gap-1.5">
      <Button variant="ghost" size="icon" onClick={() => { skip(-SKIP_SECONDS); bumpControls() }} className={buttonCls} title="Back 10 seconds" aria-label="Back 10 seconds">
        <RotateCcw className={iconCls} />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => { togglePlayback(); bumpControls() }}
        className={`${buttonCls} bg-white/20`}
        title={isEnded ? 'Replay' : isPlaying ? 'Pause' : 'Play'}
        aria-label={isEnded ? 'Replay' : isPlaying ? 'Pause' : 'Play'}
      >
        {isEnded ? (
          <RotateCcw className={iconCls} />
        ) : isPlaying ? (
          <Pause className={`${iconCls} fill-current`} />
        ) : (
          <Play className={`${iconCls} fill-current`} />
        )}
      </Button>
      <Button variant="ghost" size="icon" onClick={() => { skip(SKIP_SECONDS); bumpControls() }} className={buttonCls} title="Forward 10 seconds" aria-label="Forward 10 seconds">
        <RotateCw className={iconCls} />
      </Button>
    </div>
  )

  // Right of the bar: volume / fullscreen / close
  const controlButtons = (
    <div className="flex items-center justify-end gap-1 md:gap-1.5">
      {/* Volume — same behaviour as the main player: hover slider on desktop, mute toggle on mobile */}
      <div
        className="flex items-center"
        onMouseEnter={() => {
          if (isMobile) return
          if (volumeHideTimerRef.current) clearTimeout(volumeHideTimerRef.current)
          setShowVolumeSlider(true)
        }}
        onMouseLeave={() => {
          if (!isMobile) resetVolumeHideTimer()
        }}
      >
        <Button variant="ghost" size="icon" onClick={toggleMute} className={buttonCls} title={isMuted ? 'Unmute' : 'Mute'} aria-label={isMuted ? 'Unmute' : 'Mute'}>
          {getVolumeIcon(iconCls)}
        </Button>
        {!isMobile && (
          <div
            className={`flex items-center justify-start overflow-visible transition-all duration-200 origin-left ${
              showVolumeSlider ? 'w-24 opacity-100 ml-2 scale-x-100' : 'w-0 opacity-0 ml-0 scale-x-90'
            }`}
          >
            <Slider
              value={[isMuted ? 0 : volume]}
              onValueChange={handleVolumeChange}
              max={100}
              step={1}
              className="w-full py-2 [&_[data-slot=slider-track]]:h-1 [&_[data-slot=slider-track]]:rounded-full [&_[data-slot=slider-track]]:bg-white/35 [&_[data-slot=slider-range]]:bg-red-600 [&_[data-slot=slider-thumb]]:block [&_[data-slot=slider-thumb]]:size-3 [&_[data-slot=slider-thumb]]:rounded-full [&_[data-slot=slider-thumb]]:border-0 [&_[data-slot=slider-thumb]]:bg-white [&_[data-slot=slider-thumb]]:shadow-[0_0_0_2px_rgba(0,0,0,0.3)] [&_[data-slot=slider-track]]:cursor-pointer [&_[data-slot=slider-thumb]]:cursor-pointer"
            />
          </div>
        )}
      </div>

      <Button variant="ghost" size="icon" onClick={() => { toggleFullscreen(); bumpControls() }} className={buttonCls} title={isFullscreen ? 'Exit full screen' : 'Full screen'} aria-label={isFullscreen ? 'Exit full screen' : 'Full screen'}>
        {isFullscreen ? <Minimize className={iconCls} /> : <Maximize className={iconCls} />}
      </Button>
      <Button variant="ghost" size="icon" onClick={handleClose} className={buttonCls} title="Close" aria-label="Close previous program">
        <X className={iconCls} />
      </Button>
    </div>
  )

  // Same bar as the main player (logo left, round buttons), with the playback
  // buttons centred
  const controlBar = (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-1 md:gap-4 px-3 py-3 sm:px-6 sm:py-4">
      <div className="flex items-center gap-2 min-w-0">
        <img src="/DeeniTV-V-2.png" alt="Deeni.tv" className={isMobile ? 'h-5' : 'h-7'} />
      </div>
      {playbackButtons}
      {controlButtons}
    </div>
  )

  // Title sits directly above the progress bar (YouTube style)
  const infoBlock = (
    <div className="px-3 pt-10 pb-1 md:px-5">
      <div className="mb-1 flex items-end justify-between gap-3">
        <h3 className={`min-w-0 truncate font-semibold text-white drop-shadow-md ${isMobile ? 'text-xs' : 'text-sm md:text-base'}`}>
          {title}
        </h3>
        <span className={`flex-shrink-0 font-mono tabular-nums text-white/80 ${isMobile ? 'text-[10px]' : 'text-xs'}`}>
          {fmtTime(currentTime)} / {fmtTime(duration)}
        </span>
      </div>
      <SeekBar
        currentTime={currentTime}
        duration={duration}
        rotated={rotated}
        onSeek={(s) => { seekTo(s); bumpControls() }}
      />
    </div>
  )

  const fadeCls = `transition-opacity duration-300 ${controlsShown ? 'opacity-100' : 'opacity-0 pointer-events-none'}`

  return (
    <div
      aria-hidden={!isOpen}
      className={`fixed inset-0 z-[90] flex items-center justify-center bg-gradient-to-br from-zinc-950 via-zinc-900 to-black transition-[opacity,visibility] duration-200 ${
        isOpen ? 'opacity-100 visible' : 'opacity-0 invisible pointer-events-none'
      }`}
    >
      <div
        style={fullscreenStyle ?? playerFrameStyle(isDesktop ? 'desktop' : isTablet ? 'tablet' : 'mobile')}
        onMouseMove={() => { if (!isCoarsePointer) bumpControls() }}
        className={
          isFullscreen
            ? `relative overflow-hidden bg-black ${controlsShown ? '' : 'cursor-none'}`
            : 'relative'
        }
      >
        {/* Video area — same frame as the main player */}
        <div
          className={
            isFullscreen
              ? 'absolute inset-0 bg-black select-none'
              : 'relative w-full aspect-video bg-black overflow-hidden isolate transform-gpu shadow-2xl border border-white/10 border-b-0 rounded-t-2xl md:rounded-t-3xl select-none'
          }
        >
          {/* Persistent YT.Player mounts here — never cleared on close */}
          <div
            ref={containerRef}
            className="absolute inset-0 w-full h-full"
            style={{ opacity: iframeShown ? 1 : 0 }}
          />

          {/* Cover YouTube's own paused / end screens (title bar, "More videos",
              suggestions) with the program thumbnail */}
          {iframeShown && !isPlaying && !isBuffering && !needsTap && video && (
            <div
              className="absolute inset-0 z-10 bg-black bg-cover bg-center"
              style={{ backgroundImage: `url(https://i.ytimg.com/vi/${video.videoId}/hqdefault.jpg)` }}
            >
              <div className="absolute inset-0 bg-black/55" />
            </div>
          )}

          {/* Tap surface */}
          <button
            type="button"
            onClick={handleSurfaceClick}
            onDoubleClick={() => { if (!isCoarsePointer) toggleFullscreen() }}
            className="absolute inset-0 z-20 w-full h-full cursor-pointer"
            aria-label={isPlaying ? 'Pause previous program video' : 'Play previous program video'}
          />

          {/* Top-right badge */}
          <div className={`absolute top-3 right-3 z-30 ${fadeCls}`}>
            <div className={`flex items-center gap-1.5 bg-black/70 backdrop-blur-xl rounded-full border border-white/20 ${isMobile ? 'px-2.5 py-1' : 'px-3 py-1.5'}`}>
              <History className={isMobile ? 'h-3 w-3 text-white/80' : 'h-3.5 w-3.5 text-white/80'} />
              <span className={`text-white font-semibold ${isMobile ? 'text-[11px]' : 'text-xs'}`}>Previous Program</span>
            </div>
          </div>

          {/* Buffering spinner (controls live in the bottom bar, not on the video) */}
          {isBuffering && isPlaying && !isVideoLoading && !needsTap && (
            <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none">
              <Loader2 className="h-12 w-12 animate-spin text-white/90 md:h-14 md:w-14" />
            </div>
          )}

          {/* Title + progress (inside the video when not fullscreen) */}
          {!isFullscreen && (
            <div className={`absolute inset-x-0 bottom-0 z-30 bg-gradient-to-t from-black/90 via-black/50 to-transparent ${fadeCls}`}>
              {infoBlock}
            </div>
          )}

          {/* Branded loading overlay — also the Tap to Play screen (same UI on
              iOS as web/Android; Tap to Play appears at most the first time) */}
          <BrandedLoadingOverlay
            isVisible={isOpen && (isVideoLoading || needsTap || isStalled)}
            programName={title}
            onTap={needsTap ? handleTapToPlay : undefined}
          />
        </div>

        {/* Bottom bar — same as the main player; floats and auto-hides in fullscreen */}
        {isFullscreen ? (
          <div className={`absolute inset-x-0 bottom-0 z-40 bg-gradient-to-t from-black/95 via-black/70 to-transparent ${fadeCls}`}>
            {infoBlock}
            {controlBar}
          </div>
        ) : (
          <div className="w-full bg-black/60 backdrop-blur-xl border border-white/10 border-t-0 rounded-b-2xl md:rounded-b-3xl">
            {controlBar}
          </div>
        )}
      </div>
    </div>
  )
}

export function PreviousVideosModal({
  isOpen,
  onClose,
  videos,
  onPlayVideo,
  currentChannelId,
  onPauseMainPlayer,
  onResumeMainPlayer,
  openFullscreen = false,
}: PreviousVideosModalProps) {
  const isMobile = useMediaQuery('(max-width: 640px)')
  const [mounted, setMounted] = useState(false)
  const [selectedVideo, setSelectedVideo] = useState<VideoProgram | null>(null)
  const [showVideoPlayer, setShowVideoPlayer] = useState(false)
  const playerControllerRef = useRef<PreviousPlayerHandle>(null)

  // Handle mounting for animations
  useEffect(() => {
    setMounted(true)
    return () => setMounted(false)
  }, [])

  const handlePlayVideo = useCallback((video: VideoProgram) => {
    // Pause main TV player
    onPauseMainPlayer?.()

    setSelectedVideo(video)
    setShowVideoPlayer(true)
    // Synchronous, inside the tap — lets iOS start playback with sound on the
    // reused player without asking for another Tap to Play.
    playerControllerRef.current?.play(video)
  }, [onPauseMainPlayer])

  const handleCloseVideoPlayer = useCallback(() => {
    // Keep selectedVideo so the title stays during the fade-out; the player
    // itself is only paused + hidden, never destroyed.
    setShowVideoPlayer(false)
    // Resume/unmute main player
    onResumeMainPlayer?.()
    // Go straight back to the live TV — close the Previous Programs list too
    onClose()
  }, [onClose, onResumeMainPlayer])

  if (!mounted) return null

  return (
    <>
      <AnimatePresence>
        {/* Unmounted while the player is open, so it never flashes on close */}
        {isOpen && !showVideoPlayer && (
          <>
            {/* Backdrop - Not clickable */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/80 backdrop-blur-md z-[60]"
            />

            {/* Modal - Same style as Schedule Modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.2 }}
              className={`fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-h-[80vh] bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-950 rounded-2xl shadow-2xl border border-white/10 z-[70] overflow-hidden ${isMobile ? 'max-w-sm' : 'max-w-2xl'}`}
            >
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-primary/20 rounded-lg">
                    <History className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-white">
                      Previous Programs
                    </h2>
                    <p className="text-xs text-white/40">
                      {videos.length} {videos.length === 1 ? 'video' : 'videos'}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onClose}
                  className={`text-white/60 hover:text-white hover:bg-white/10 rounded-xl ${
                    isMobile ? 'h-12 w-12' : 'h-10 w-10'
                  }`}
                >
                  <X className={isMobile ? 'h-7 w-7' : 'h-5 w-5'} />
                </Button>
              </div>

              {/* Videos List - Simplified UI */}
              <div className="overflow-y-auto max-h-[calc(80vh-80px)] p-4">
                {videos.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 px-4">
                    <History className="h-8 w-8 text-white/20 mb-4" />
                    <p className="text-white/60 text-sm mb-2">No Previous Programs videos</p>
                    <p className="text-white/40 text-xs text-center">
                      Videos you watch will appear here
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {videos.map((video, index) => (
                      <motion.button
                        key={`${video.id}-${index}`}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.03 }}
                        onClick={() => handlePlayVideo(video)}
                        className="w-full p-4 rounded-xl border bg-white/5 border-white/10 hover:bg-white/10 hover:border-primary/30 transition-all group text-left"
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center group-hover:bg-primary/30 transition-colors mt-0.5">
                            <Play className="h-2.5 w-2.5 text-primary fill-primary" />
                          </div>

                          <div className="flex-1 min-w-0">
                            <h3 className="text-white font-semibold text-sm leading-snug group-hover:text-primary transition-colors">
                              {video.title}
                            </h3>
                            <p className="text-white/40 text-xs mt-1.5 flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatDuration(video.duration)}
                            </p>
                          </div>
                        </div>
                      </motion.button>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Persistent previous-program player (always mounted, hidden when closed) */}
      <PreviousVideoPlayer
        video={selectedVideo}
        isOpen={showVideoPlayer}
        warmVideoId={isOpen ? videos[0]?.videoId : undefined}
        openFullscreen={openFullscreen}
        onClose={handleCloseVideoPlayer}
        controllerRef={playerControllerRef}
      />
    </>
  )
}
