import { useRef, useCallback, useEffect } from 'react'

export const YT_STATE = {
  UNSTARTED: -1,
  ENDED: 0,
  PLAYING: 1,
  PAUSED: 2,
  BUFFERING: 3,
  CUED: 5
} as const

interface YouTubePlayerOptions {
  videoId: string
  startSeconds?: number
  volume?: number
  muted?: boolean
  onReady?: (player: any) => void
  onStateChange?: (state: number) => void
  onError?: (errorCode: number, errorMessage: string) => void
  onDurationChange?: (duration: number) => void
}

declare global {
  interface Window {
    YT: any
    onYouTubeIframeAPIReady: () => void
  }
}

// A short, publicly available YouTube video used as a silent placeholder to
// prime the iOS WKWebView autoplay context before the real content loads.
// Using a well-known short video (YouTube's own "YouTube" channel intro clip).
const IOS_PRIMER_VIDEO_ID = 'flt8T_0CD1A'
const YT_EMBED_HOST = 'https://www.youtube.com'

export function useYouTubePlayer(opts: { autoLoad?: boolean } = { autoLoad: true }) {
  const playerRef = useRef<any>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const playerMountCounterRef = useRef<number>(0)
  const operationTokenRef = useRef<number>(0)
  const apiReadyRef = useRef<boolean>(false)
  const isMutedRef = useRef<boolean>(true)
  const volumeRef = useRef<number>(75)
  const durationRef = useRef<number>(0)
  const videoIdRef = useRef<string>('')
  // Tracks whether we have a silently primed player that hasn't been swapped yet
  const isPrimedRef = useRef<boolean>(false)
  // ── Transition mute state — prevents audio from playing during video switches ──
  const transitionMutedRef = useRef<boolean>(false)
  const shouldUnmuteAfterPlayingRef = useRef<boolean>(false)
  // ── Delegating event-handler refs ──
  // The primed player's YT.Player events are wired to these refs at construction
  // time.  Initially they are no-ops.  When the real video loads (iOS path), we
  // swap them to the real handlers via setPlayerCallbacks() — the same YT.Player
  // instance stays alive, preserving iOS's audio-unlock gesture context.
  const onStateChangeRef = useRef<((state: number) => void) | null>(null)
  const onErrorRef = useRef<((code: number, msg: string) => void) | null>(null)
  const onDurationChangeRef = useRef<((duration: number) => void) | null>(null)
  const onReadyRef = useRef<((player: any) => void) | null>(null)
  const apiLoadPromiseRef = useRef<Promise<void> | null>(null)
  // While true, nothing may unmute this player — set while another player
  // (the Previous Programs player) owns the audio. Buffering/stall recovery and
  // PLAYING handlers would otherwise unmute it underneath (double audio).
  const muteHoldRef = useRef<boolean>(false)

  // Every unmute in this hook goes through here so the mute hold is respected.
  const unMuteUnlessHeld = (player: any) => {
    if (muteHoldRef.current) {
      try { player?.mute?.() } catch (_) {}
      return
    }
    if (typeof player?.unMute === 'function') player.unMute()
  }

  const nextOperationToken = useCallback(() => {
    operationTokenRef.current += 1
    return operationTokenRef.current
  }, [])

  const isOperationStale = useCallback((token: number) => {
    return token !== operationTokenRef.current
  }, [])

  const nextPlayerMountId = useCallback((prefix: string) => {
    playerMountCounterRef.current += 1
    return `${prefix}-${Date.now()}-${playerMountCounterRef.current}`
  }, [])

  const purgeContainerEmbeds = useCallback((root: HTMLDivElement | null) => {
    if (!root) return

    // Forcefully detach old iframe nodes before creating a new YT widget.
    // This prevents stale iOS WebKit iframe processes from surviving reloads.
    const staleFrames = Array.from(root.querySelectorAll('iframe'))
    staleFrames.forEach((frame) => {
      try {
        frame.src = 'about:blank'
      } catch (_) {}
      try {
        frame.remove()
      } catch (_) {
        try {
          frame.parentNode?.removeChild(frame)
        } catch (_) {}
      }
    })

    while (root.firstChild) {
      root.removeChild(root.firstChild)
    }
  }, [])

  const hardResetPlayer = useCallback((options?: { invalidate?: boolean }) => {
    if (options?.invalidate !== false) {
      nextOperationToken()
    }

    if (playerRef.current) {
      try {
        if (typeof playerRef.current.mute === 'function') {
          playerRef.current.mute()
        }
      } catch (_) {}

      try {
        if (typeof playerRef.current.stopVideo === 'function') {
          playerRef.current.stopVideo()
        }
      } catch (_) {}

      try {
        if (typeof playerRef.current.destroy === 'function') {
          playerRef.current.destroy()
        }
      } catch (_) {}
    }

    playerRef.current = null
    durationRef.current = 0
    videoIdRef.current = ''
    isPrimedRef.current = false

    purgeContainerEmbeds(containerRef.current)
  }, [nextOperationToken, purgeContainerEmbeds])

  const createFreshPlayerMount = useCallback((prefix: string) => {
    const root = containerRef.current
    if (!root) return null

    purgeContainerEmbeds(root)

    const mount = document.createElement('div')
    mount.id = nextPlayerMountId(prefix)
    mount.style.width = '100%'
    mount.style.height = '100%'
    mount.style.position = 'absolute'
    mount.style.top = '0'
    mount.style.left = '0'
    root.appendChild(mount)
    return mount
  }, [nextPlayerMountId, purgeContainerEmbeds])
  
  const loadYouTubeAPI = useCallback((): Promise<void> => {
    if (apiReadyRef.current || (window.YT && window.YT.Player)) {
      apiReadyRef.current = true
      return Promise.resolve()
    }

    if (apiLoadPromiseRef.current) {
      return apiLoadPromiseRef.current
    }

    apiLoadPromiseRef.current = new Promise((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        apiLoadPromiseRef.current = null
        reject(new Error('YouTube API failed to load'))
      }, 10000)

      const markReady = () => {
        window.clearTimeout(timeout)
        apiReadyRef.current = true
        resolve()
      }

      const previousReadyHandler = window.onYouTubeIframeAPIReady
      window.onYouTubeIframeAPIReady = () => {
        if (typeof previousReadyHandler === 'function') {
          try {
            previousReadyHandler()
          } catch (_) {}
        }
        markReady()
      }

      const existingScript = document.querySelector<HTMLScriptElement>('script[src="https://www.youtube.com/iframe_api"]')
      if (!existingScript) {
        const script = document.createElement('script')
        script.src = 'https://www.youtube.com/iframe_api'
        script.async = true
        script.onerror = () => {
          window.clearTimeout(timeout)
          apiLoadPromiseRef.current = null
          reject(new Error('Failed to inject YouTube API script'))
        }
        document.head.appendChild(script)
      }
    })

    return apiLoadPromiseRef.current
  }, [])

  // Conditionally pre-load the YouTube iframe API on mount. Disabled by
  // default in components that need to delay API injection until user
  // interaction (e.g. channel selection) to avoid creating iframes early.
  useEffect(() => {
    if (opts.autoLoad === false) return
    loadYouTubeAPI().catch(() => {}) // fire-and-forget; errors handled per-init
  }, [loadYouTubeAPI, opts.autoLoad])
  
  const initializePlayer = useCallback(async (options: YouTubePlayerOptions) => {
    if (!containerRef.current) return

    const opToken = nextOperationToken()
    
    volumeRef.current = options.volume || 75
    isMutedRef.current = options.muted ?? true  // default muted; false is intentional
    videoIdRef.current = options.videoId
    
    try {
      await loadYouTubeAPI()
    } catch (err) {
      if (isOperationStale(opToken)) return
      options.onError?.(0, 'Failed to load YouTube API')
      return
    }

    if (isOperationStale(opToken)) return
    
    // Always force a full teardown + DOM purge before creating a new player.
    hardResetPlayer({ invalidate: false })

    if (isOperationStale(opToken)) return
    
    try {
      const playerDiv = createFreshPlayerMount('youtube-player')
      if (isOperationStale(opToken)) return
      if (!playerDiv) {
        options.onError?.(0, 'Failed to create player container')
        return
      }
      
      playerRef.current = new window.YT.Player(playerDiv.id, {
        host: YT_EMBED_HOST,
        // Without explicit width/height, the YT API defaults the injected
        // <iframe> to a fixed 640x390 box that doesn't fill the mount div,
        // leaving gaps around the video on other aspect ratios/screen sizes.
        width: '100%',
        height: '100%',
        videoId: options.videoId,
        playerVars: {
          autoplay: 1,
          // A held mute must win here too — this starts the iframe unmuted
          // without ever calling unMute()
          mute: options.muted || muteHoldRef.current ? 1 : 0,
          controls: 0,
          disablekb: 1,
          fs: 0,
          modestbranding: 1,
          rel: 0,
          showinfo: 0,
          iv_load_policy: 3,
          start: options.startSeconds || 0,
          playsinline: 1,
          origin: window.location.origin,
          enablejsapi: 1
        },
        events: {
          onReady: (event: any) => {
            if (isOperationStale(opToken)) {
              try {
                if (typeof event?.target?.destroy === 'function') {
                  event.target.destroy()
                }
              } catch (_) {}
              return
            }
            try {
              event.target.setVolume(volumeRef.current)
              if (isMutedRef.current || muteHoldRef.current) {
                event.target.mute()
              } else {
                unMuteUnlessHeld(event.target)
              }
              
              // Get video duration from YouTube API
              const duration = event.target.getDuration()
              if (duration && !isNaN(duration) && duration > 0) {
                durationRef.current = duration
                options.onDurationChange?.(duration)
              }
            } catch (err) {}
            options.onReady?.(event.target)
          },
          onStateChange: (event: any) => {
            if (isOperationStale(opToken)) return
            // When video is cued or playing, get duration
            if (event.data === YT_STATE.CUED || event.data === YT_STATE.PLAYING) {
              try {
                const duration = event.target.getDuration()
                if (duration && !isNaN(duration) && duration > 0 && duration !== durationRef.current) {
                  durationRef.current = duration
                  options.onDurationChange?.(duration)
                }
              } catch (err) {}
            }
            options.onStateChange?.(event.data)
          },
          onError: (event: any) => {
            if (isOperationStale(opToken)) return
            options.onError?.(event.data, `Error ${event.data}`)
          }
        }
      })
      // ── iOS Safari iframe attribute patch ──
      // The YT iFrame API creates the iframe asynchronously; iOS requires several
      // attributes to be present on the <iframe> element itself for autoplay and
      // inline playback to work.  We patch them as soon as the iframe appears.
      // Run immediately AND retry up to 3 times to cover slow iframe creation.
      const patchIframeForIOS = (attempt = 0) => {
        try {
          const iframe = containerRef.current?.querySelector('iframe')
          if (iframe) {
            // Inline playback — mandatory for iOS (prevents fullscreen takeover)
            iframe.setAttribute('playsinline', 'true')
            iframe.setAttribute('webkit-playsinline', 'webkit-playsinline')
            iframe.setAttribute('x-webkit-airplay', 'allow')
            // Allow list — must include autoplay for iOS WKWebView / Safari
            iframe.setAttribute(
              'allow',
              'autoplay; encrypted-media; picture-in-picture; fullscreen; accelerometer; gyroscope; clipboard-write'
            )
            iframe.setAttribute('allowfullscreen', 'true')
            iframe.setAttribute('allowtransparency', 'true')
            iframe.style.border = 'none'
            iframe.style.pointerEvents = 'none' // keep custom controls active
          } else if (attempt < 3) {
            // iframe not yet injected by YT API — retry
            setTimeout(() => patchIframeForIOS(attempt + 1), 300)
          }
        } catch (_) {}
      }
      setTimeout(() => patchIframeForIOS(), 100)
    } catch (err) {
      if (isOperationStale(opToken)) return
      options.onError?.(0, 'Failed to create player')
    }
  }, [createFreshPlayerMount, hardResetPlayer, isOperationStale, loadYouTubeAPI, nextOperationToken])

  // ── primePlayer ──────────────────────────────────────────────────────────────
  // Creates a MUTED, HIDDEN YouTube player on mount — no user gesture required.
  //
  // iOS Safari (WKWebView) permits muted autoplay without a gesture.  By creating
  // the player early, the browser's "this document has interacted with video"
  // flag is set, so when the user later taps "Start Watching" we can call
  // player.unMute() + player.setVolume() synchronously inside that gesture, then
  // swap the video with loadVideoById() — all without triggering the autoplay
  // restriction again.
  //
  // The container element is visually hidden via CSS (opacity-0 / pointer-events-none
  // applied by the caller) — the primer video never appears on screen.
  const primePlayer = useCallback(async (): Promise<void> => {
    if (!containerRef.current || isPrimedRef.current) return

    // Never clobber an active non-primed player with a background primer request.
    if (playerRef.current && !isPrimedRef.current) return

    const opToken = nextOperationToken()

    try {
      await loadYouTubeAPI()
    } catch {
      return // API failed — graceful degradation; normal init path will try again
    }

    if (isOperationStale(opToken)) return

    try {
      hardResetPlayer({ invalidate: false })

      if (isOperationStale(opToken)) return

      const playerDiv = createFreshPlayerMount('yt-primer')
      if (isOperationStale(opToken)) return
      if (!playerDiv) return

      playerRef.current = new window.YT.Player(playerDiv.id, {
        host: YT_EMBED_HOST,
        width: '100%',
        height: '100%',
        videoId: IOS_PRIMER_VIDEO_ID,
        playerVars: {
          autoplay: 1,
          mute: 1,           // muted — iOS allows this without gesture
          controls: 0,
          disablekb: 1,
          fs: 0,
          modestbranding: 1,
          rel: 0,
          showinfo: 0,
          iv_load_policy: 3,
          playsinline: 1,    // mandatory for iOS inline playback
          origin: typeof window !== 'undefined' ? window.location.origin : '',
          enablejsapi: 1,
        },
        events: {
          onReady: () => {
            if (isOperationStale(opToken)) return
            isPrimedRef.current = true
            isMutedRef.current = true
            // Patch iframe attributes so iOS respects playsinline / autoplay allow-list
            const patchPrimer = (attempt = 0) => {
              try {
                const iframe = containerRef.current?.querySelector('iframe')
                if (iframe) {
                  iframe.setAttribute('playsinline', 'true')
                  iframe.setAttribute('webkit-playsinline', 'webkit-playsinline')
                  iframe.setAttribute('allow',
                    'autoplay; encrypted-media; picture-in-picture; fullscreen; accelerometer; gyroscope'
                  )
                  iframe.style.border = 'none'
                  iframe.style.pointerEvents = 'none'
                } else if (attempt < 4) {
                  setTimeout(() => patchPrimer(attempt + 1), 250)
                }
              } catch (_) {}
            }
            setTimeout(() => patchPrimer(), 50)
            // Delegate to ref (if swapped by setPlayerCallbacks before onReady fires)
            onReadyRef.current?.(playerRef.current)
          },
          // Delegate through refs — initially no-ops; swapped by setPlayerCallbacks
          // when the real video loads, so we keep the same YT.Player instance.
          onStateChange: (event: any) => {
            if (isOperationStale(opToken)) return
            
            // ── Auto-unmute after transition when PLAYING starts ──
            // Only auto-unmute when the currently loaded video is NOT the iOS primer.
            if (
              event.data === YT_STATE.PLAYING &&
              transitionMutedRef.current &&
              shouldUnmuteAfterPlayingRef.current &&
              videoIdRef.current !== IOS_PRIMER_VIDEO_ID
            ) {
              try {
                // Small delay to ensure video is actually playing
                setTimeout(() => {
                  try {
                    unMuteUnlessHeld(playerRef.current)
                    transitionMutedRef.current = false
                    shouldUnmuteAfterPlayingRef.current = false
                  } catch (_) {}
                }, 100)
              } catch (_) {}
            }
            
            if (onStateChangeRef.current) {
              onStateChangeRef.current(event.data)
            }
            // Also track duration on PLAYING/CUED like initializePlayer does
            if (event.data === YT_STATE.CUED || event.data === YT_STATE.PLAYING) {
              try {
                const dur = event.target.getDuration()
                if (dur && !isNaN(dur) && dur > 0 && dur !== durationRef.current) {
                  durationRef.current = dur
                  onDurationChangeRef.current?.(dur)
                }
              } catch (_) {}
            }
          },
          onError: (event: any) => {
            if (isOperationStale(opToken)) return
            onErrorRef.current?.(event.data, `Error ${event.data}`)
          },
        },
      })
    } catch (_) {
      // Silently swallow — worst case the normal initializePlayer path runs on tap
    }
  }, [createFreshPlayerMount, hardResetPlayer, isOperationStale, loadYouTubeAPI, nextOperationToken])

  // ── unmuteAndResume ──────────────────────────────────────────────────────────
  // Call this SYNCHRONOUSLY inside a user-gesture handler (e.g. button onClick).
  // Unmutes the primed (or active) player and sets the desired volume level so
  // iOS grants audio permission for the current player instance.
  // Must be called before any async work (fetch, etc.) to stay inside the gesture.
  const unmuteAndResume = useCallback((targetVolume: number = 75) => {
    if (!playerRef.current) return
    try {
      isMutedRef.current = false
      volumeRef.current = targetVolume
      // Keep playback operations inside the same user gesture for iOS.
      if (typeof playerRef.current.playVideo === 'function') {
        playerRef.current.playVideo()
      }
      unMuteUnlessHeld(playerRef.current)
      if (typeof playerRef.current.setVolume === 'function') {
        playerRef.current.setVolume(targetVolume)
      }
    } catch (_) {}
  }, [])

  // Hold (or release) the mute: while held, every unmute path above is a no-op.
  // Releasing does not unmute by itself — callers unmute explicitly afterwards.
  const setMuteHold = useCallback((hold: boolean) => {
    muteHoldRef.current = hold
    if (hold) {
      try { playerRef.current?.mute?.() } catch (_) {}
    }
  }, [])

  // Expose the raw loader so callers can opt-in to loading the API on-demand
  const prepareApi = useCallback(() => loadYouTubeAPI(), [loadYouTubeAPI])

  // ── setPlayerCallbacks ──────────────────────────────────────────────────────
  // Swap the delegating-ref event handlers that the primed player calls.
  // Call this BEFORE loadVideoById so that state-change events from the real
  // video reach the caller's handlers (onReady, onStateChange, etc.).
  // This avoids destroying the primed YT.Player (which would lose the iOS
  // audio-unlock gesture context).
  const setPlayerCallbacks = useCallback((callbacks: {
    onReady?: (player: any) => void
    onStateChange?: (state: number) => void
    onError?: (code: number, msg: string) => void
    onDurationChange?: (duration: number) => void
  }) => {
    onReadyRef.current = callbacks.onReady ?? null
    onStateChangeRef.current = callbacks.onStateChange ?? null
    onErrorRef.current = callbacks.onError ?? null
    onDurationChangeRef.current = callbacks.onDurationChange ?? null
  }, [])

  // ── muteForTransition ────────────────────────────────────────────────────────
  // Mutes the player during video transitions to prevent old video audio from playing.
  // Sets a flag to unmute after the new video starts playing.
  // Call BEFORE loadVideoById to ensure silence during the transition.
  const muteForTransition = useCallback((shouldUnmuteAfterPlaying: boolean = true) => {
    if (!playerRef.current) return
    try {
      transitionMutedRef.current = true
      shouldUnmuteAfterPlayingRef.current = shouldUnmuteAfterPlaying
      if (typeof playerRef.current.mute === 'function') {
        playerRef.current.mute()
      }
    } catch (_) {}
  }, [])

  const loadVideo = useCallback((videoId: string, startSeconds?: number) => {
    if (!playerRef.current) return false
    
    try {
      // Always mute before loading new video to prevent old audio from playing
      if (typeof playerRef.current.mute === 'function') {
        playerRef.current.mute()
      }
      transitionMutedRef.current = true
      
      videoIdRef.current = videoId
      if (typeof playerRef.current.loadVideoById === 'function') {
        playerRef.current.loadVideoById({
          videoId,
          startSeconds: startSeconds || 0
        })
        
        // Try to get duration after load
        // setTimeout(() => {
        //   try {
        //     const duration = playerRef.current.getDuration()
        //     if (duration && !isNaN(duration) && duration > 0) {
        //       durationRef.current = duration
        //     }
        //   } catch (err) {}
        // }, 500)
        // TODO: Is this delay mandatory??
        try {
          const duration = playerRef.current.getDuration()
          if (duration && !isNaN(duration) && duration > 0) {
            durationRef.current = duration
          }
        } catch (err) {}
        
        return true
      }
    } catch (err) {
      console.error('Error loading video:', err)
    }
    return false
  }, [])
  
  const getDuration = useCallback((): number => {
    if (!playerRef.current) return 0
    try {
      const duration = playerRef.current.getDuration()
      return typeof duration === 'number' && !isNaN(duration) ? duration : 0
    } catch (err) {
      return durationRef.current
    }
  }, [])
  
  const setVolume = useCallback((volume: number) => {
    if (!playerRef.current) return
    
    try {
      const safeVolume = Math.max(0, Math.min(100, volume))
      volumeRef.current = safeVolume
      
      if (typeof playerRef.current.setVolume === 'function') {
        playerRef.current.setVolume(safeVolume)
      }
    } catch (err) {}
  }, [])
  
  const setMuted = useCallback((muted: boolean) => {
    if (!playerRef.current) return
    
    try {
      isMutedRef.current = muted
      
      if (muted) {
        if (typeof playerRef.current.mute === 'function') {
          playerRef.current.mute()
        }
      } else {
        unMuteUnlessHeld(playerRef.current)
      }
    } catch (err) {}
  }, [])
  
  const play = useCallback(() => {
    if (!playerRef.current) return false
    try {
      if (typeof playerRef.current.playVideo === 'function') {
        playerRef.current.playVideo()
        return true
      }
    } catch (err) {}
    return false
  }, [])

  const pause = useCallback(() => {
    if (!playerRef.current) return false
    try {
      if (typeof playerRef.current.pauseVideo === 'function') {
        playerRef.current.pauseVideo()
        return true
      }
    } catch (err) {}
    return false
  }, [])
  
  const seekTo = useCallback((seconds: number, allowSeekAhead: boolean = true) => {
    if (!playerRef.current) return false
    try {
      if (typeof playerRef.current.seekTo === 'function') {
        playerRef.current.seekTo(seconds, allowSeekAhead)
        return true
      }
    } catch (err) {}
    return false
  }, [])
  
  const getCurrentTime = useCallback((): number => {
    if (!playerRef.current) return 0
    try {
      const time = playerRef.current.getCurrentTime()
      return typeof time === 'number' && !isNaN(time) ? time : 0
    } catch (err) {}
    return 0
  }, [])

  const getCurrentVideoId = useCallback((): string => {
    if (!playerRef.current) return ''
    try {
      if (typeof playerRef.current.getVideoData === 'function') {
        const data = playerRef.current.getVideoData()
        if (data && typeof data.video_id === 'string') {
          return data.video_id
        }
      }
    } catch (err) {}
    return ''
  }, [])

  const getIsMuted = useCallback((): boolean => {
    if (!playerRef.current) return isMutedRef.current
    try {
      if (typeof playerRef.current.isMuted === 'function') {
        return !!playerRef.current.isMuted()
      }
    } catch (err) {}
    return isMutedRef.current
  }, [])
  
  const destroy = useCallback(() => {
    hardResetPlayer()
  }, [hardResetPlayer])

  // Safari/iOS hard reload can leave a zombie iframe/session unless we
  // explicitly tear down the player during page lifecycle events.
  useEffect(() => {
    if (typeof window === 'undefined') return

    const cleanupOnPageExit = () => {
      hardResetPlayer()
    }

    window.addEventListener('pagehide', cleanupOnPageExit)
    window.addEventListener('beforeunload', cleanupOnPageExit)

    return () => {
      window.removeEventListener('pagehide', cleanupOnPageExit)
      window.removeEventListener('beforeunload', cleanupOnPageExit)
    }
  }, [hardResetPlayer])
  
  useEffect(() => {
    return () => { destroy() }
  }, [destroy])
  
  return {
    containerRef,
    initializePlayer,
    primePlayer,
    unmuteAndResume,
    setPlayerCallbacks,
    isPrimedRef,
    loadVideo,
    prepareApi,
    muteForTransition,
    getDuration,
    setVolume,
    setMuted,
    setMuteHold,
    play,
    seekTo,
    getCurrentTime,
    getCurrentVideoId,
    getIsMuted,
    pause,
    destroy
  }
}