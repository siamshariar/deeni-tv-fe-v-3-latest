'use client'

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { Capacitor } from '@capacitor/core'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Volume2, VolumeX, Maximize, MoreHorizontal, Minimize, 
  Tv, Clock, ArrowRight, Eye, EyeOff, Repeat, Volume1, 
  Volume, AlertCircle, RefreshCw, Play, Loader2, Radio,
  WifiOff, Globe, X, Smartphone, Tablet, Laptop,
  Sparkles, Zap, Shield, Star, Heart, ChevronRight,
  ChevronLeft, Menu, Home, Settings, Info, Calendar,
  Moon, Sun, Battery, Wifi, Signal, Volume as VolumeIcon,
  ChevronUp, ChevronDown, TrendingUp, Radio as RadioIcon,
  PlayCircle, RefreshCcw, Timer, Hourglass, History
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { useMediaQuery } from '@/hooks/use-media-query'
import { CurrentVideoData, VideoProgram, Channel } from '@/types/schedule'
import { clientFetchWithAuth } from '@/lib/client-fetch'
import { 
  formatTime, 
  CHANNELS, 
  MASTER_EPOCH_START, 
  getTotalScheduleDuration,
  getChannelPrograms,
  getSavedChannel,
  saveChannel,
  addToPreviousVideos,
  getPreviousVideos,
  savePreviousVideos,
  STORAGE_KEY,
  ApiChannel,
  getStoredApiChannels,
  saveApiChannels,
  getFallbackApiChannels,
  buildLocalCurrentVideoResponse,
} from '@/lib/schedule-utils'
import { useYouTubePlayer, YT_STATE } from '@/hooks/use-youtube-player'
import { PreviousVideosModal } from './previous-videos-modal'

async function parseJsonSafely(response: Response) {
  const contentType = response.headers.get('content-type') || ''

  if (contentType.includes('application/json')) {
    try {
      return await response.json()
    } catch {
      return null
    }
  }

  try {
    const text = await response.text()
    return JSON.parse(text)
  } catch {
    return null
  }
}

function buildEmbeddedScheduleFallback(channelId: string) {
  return buildLocalCurrentVideoResponse(channelId, 15)
}

interface SyncedVideoPlayerProps {
  onMenuOpen: () => void
  initialChannelId?: string
  onChannelChange?: (channelId: string) => void
  showStartModal?: boolean
  onStartClick?: () => void
  openHistoryModal?: boolean
  onHistoryModalClose?: () => void
  onOpenSchedule?: () => void
  openChannelSelectorModal?: boolean
  onChannelSelectorModalClose?: () => void
  onReloadStart?: () => void
  hasUserSelectedChannel?: boolean
  /** Called whenever the current program / schedule changes (video transition, API sync, etc.) */
  onProgramChange?: (currentProgramId: string, schedule: VideoProgram[]) => void
  /** Increment this counter to trigger a channel reload (e.g. from the Reload menu option) */
  triggerReload?: number
}

// Channel Selector Modal Component
const ChannelSelectorModal = ({ 
  isOpen, 
  onClose, 
  channels, 
  onSelectChannel, 
  currentChannelId 
}: { 
  isOpen: boolean
  onClose: () => void
  channels: ApiChannel[]
  onSelectChannel: (channelId: string) => void
  currentChannelId?: string
}) => {
  const isMobile = useMediaQuery('(max-width: 640px)')
  const [searchTerm, setSearchTerm] = useState('')
  
  const filteredChannels = channels.filter(channel => 
    channel.title.toLowerCase().includes(searchTerm.toLowerCase())
  )
  
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/90 backdrop-blur-xl z-[60]"
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className={`fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full ${
              isMobile ? 'max-w-sm' : 'max-w-2xl'
            } bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-950 rounded-2xl shadow-2xl border border-white/10 z-[70] overflow-hidden`}
          >
            <div className="relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-primary/20 via-purple-500/20 to-primary/20 animate-gradient" />
              <div className="relative flex items-center justify-between p-6 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/20 rounded-xl">
                    <Globe className="h-5 w-5 text-primary" />
                  </div>
                  <h2 className="text-xl font-bold text-white">Select Channel</h2>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onClose}
                  className="text-white/60 hover:text-white hover:bg-white/10 rounded-xl"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </div>
            
            <div className="p-4 max-h-[60vh] overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filteredChannels.map((channel, index) => (
                  <motion.button
                    key={channel.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    whileHover={{ scale: 1.02, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      onSelectChannel(String(channel.id))
                      onClose()
                    }}
                    className={`relative group p-4 rounded-xl border transition-all ${
                      String(channel.id) === currentChannelId
                        ? 'bg-gradient-to-br from-primary/20 via-primary/10 to-transparent border-primary/50 shadow-lg shadow-primary/20'
                        : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
                    }`}
                  >
                    {String(channel.id) === currentChannelId && (
                      <motion.div
                        className="absolute inset-0 rounded-xl bg-primary/20"
                        animate={{
                          scale: [1, 1.05, 1],
                          opacity: [0.3, 0.5, 0.3],
                        }}
                        transition={{
                          duration: 2,
                          repeat: Infinity,
                          ease: "easeInOut",
                        }}
                      />
                    )}
                    
                    <div className="relative flex items-center gap-3">
                      <div className="flex-1 text-left">
                        <p className={`font-semibold ${
                          String(channel.id) === currentChannelId ? 'text-primary' : 'text-white'
                        }`}>
                          {channel.title}
                        </p>
                      </div>
                      {String(channel.id) === currentChannelId && (
                        <div className="px-2 py-1 bg-primary/20 rounded-full">
                          <span className="text-primary text-xs font-medium">Current</span>
                        </div>
                      )}
                    </div>
                  </motion.button>
                ))}
              </div>
            </div>
            
            <div className="p-4 border-t border-white/10 bg-white/5">
              <p className="text-center text-xs text-white/40">
                {filteredChannels.length} channels available • Select your preferred channel
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

// Start Screen Component - Fully responsive for all screen sizes
const StartScreen = ({
  onPlayClick,
  isStartDisabled = false,
  allowScreenTapStart = false,
  buttonLabel = 'Start Watching',
  helperText = 'Click to start your spiritual journey'
}: {
  onPlayClick: () => void
  isStartDisabled?: boolean
  allowScreenTapStart?: boolean
  buttonLabel?: string
  helperText?: string
}) => {
  const isMobile = useMediaQuery('(max-width: 640px)')
  const isTablet = useMediaQuery('(min-width: 641px) and (max-width: 1024px)')
  const startTapLockRef = useRef(false)

  const triggerStart = useCallback(() => {
    if (isStartDisabled || startTapLockRef.current) return

    startTapLockRef.current = true
    onPlayClick()

    // Prevent rapid double taps from racing iOS gesture/start state.
    setTimeout(() => {
      startTapLockRef.current = false
    }, 450)
  }, [isStartDisabled, onPlayClick])

  const handleScreenPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!allowScreenTapStart || isStartDisabled) return

    // Prevent double-trigger when user taps the start button itself.
    const target = event.target as HTMLElement | null
    if (target?.closest('[data-start-trigger="true"]')) return

    triggerStart()
  }
  
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onPointerUp={handleScreenPointerUp}
      className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-zinc-900 via-zinc-900 to-black z-50 overflow-hidden"
    >      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: "spring", damping: 20, stiffness: 200 }}
        className="relative w-full h-full flex items-center justify-center p-4 sm:p-6 md:p-8"
      >
        <div className="w-full max-w-xs sm:max-w-sm md:max-w-lg lg:max-w-2xl flex flex-col items-center gap-2 sm:gap-3 md:gap-4">
          {/* App Logo with Animation */}
          <div className="relative flex items-center justify-center">
            <div className={`relative flex items-center justify-center ${
              isMobile ? 'w-16 h-16' : isTablet ? 'w-24 h-24' : 'w-32 h-32'
            }`}>
              <motion.div
                animate={{ 
                  rotate: 360,
                  scale: [1, 1.03, 1],
                }}
                transition={{ 
                  rotate: { duration: 3, repeat: Infinity, ease: "linear" },
                  scale: { duration: 2, repeat: Infinity, ease: "easeInOut" }
                }}
                className="relative flex items-center justify-center"
              >
                <div className={`absolute rounded-full bg-primary/20 blur-xl animate-pulse ${
                  isMobile ? 'w-12 h-12' : isTablet ? 'w-20 h-20' : 'w-28 h-28'
                }`} />
                <Radio className={`${
                  isMobile ? 'h-8 w-8' : 
                  isTablet ? 'h-14 w-14' : 
                  'h-20 w-20'
                } text-primary relative z-10 flex-shrink-0`} />
                
                <motion.div
                  animate={{ y: ['-50%', '150%'] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                  className="absolute inset-0 w-full h-1 bg-gradient-to-r from-transparent via-primary/50 to-transparent blur-sm pointer-events-none"
                />
              </motion.div>
            </div>
          </div>
          
          {/* Logo with full branding */}
          <motion.div
            className="flex items-center justify-center"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <img 
              src="/DeeniTV-V-2.png" 
              alt="Deeni.tv - Your Spiritual TV Experience"
              className={isMobile ? 'h-8' : isTablet ? 'h-10' : 'h-12'}
            />
          </motion.div>
          
          <motion.p 
            className={`text-white/60 text-center ${
              isMobile ? 'text-xs' : isTablet ? 'text-sm' : 'text-base'
            }`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            Your Spiritual TV Experience
          </motion.p>
          
          {/* Feature badges - hidden on very small mobile, shown on larger */}
          {!isMobile && (
            <motion.div 
              className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              {[
                { icon: Zap, text: 'Live TV' },
                { icon: Shield, text: 'Halal Content' },
                { icon: Sparkles, text: 'Premium' },
              ].map((item, i) => (
                <motion.div
                  key={i}
                  whileHover={{ scale: 1.05 }}
                  className="flex items-center gap-1 px-2 py-1 sm:px-3 sm:py-1.5 bg-white/5 rounded-full border border-white/10"
                >
                  <item.icon className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-primary flex-shrink-0" />
                  <span className="text-[10px] sm:text-xs text-white/80 whitespace-nowrap">{item.text}</span>
                </motion.div>
              ))}
            </motion.div>
          )}
          
          {/* Start button - always visible */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="flex justify-center mt-1 sm:mt-2"
          >
            <Button
              data-start-trigger="true"
              onClick={(event) => {
                event.stopPropagation()
                triggerStart()
              }}
              onPointerUp={(event) => {
                event.stopPropagation()
                triggerStart()
              }}
              disabled={isStartDisabled}
              size={isMobile ? 'default' : 'lg'}
              className={`relative group bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90 text-white rounded-full shadow-2xl shadow-primary/30 overflow-hidden ${
                isMobile ? 'px-5 py-3 text-sm' : isTablet ? 'px-6 py-4 text-base' : 'px-8 py-5 text-lg'
              }`}
            >
              <span className="relative z-10 flex items-center gap-2">
                <PlayCircle className={isMobile ? 'h-4 w-4' : 'h-5 w-5'} />
                <span className="font-bold">{buttonLabel}</span>
              </span>
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                animate={{ x: ['-100%', '100%'] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
              />
            </Button>
          </motion.div>
          
          <motion.p 
            className={`text-white/40 text-center ${isMobile ? 'text-[9px]' : 'text-[11px]'}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
          >
            {helperText}
          </motion.p>
        </div>
      </motion.div>
    </motion.div>
  )
}

// Auto-Unmute Notification Component
// Visible fallback for when the player ends up muted mid-playback and the
// automatic unmute recovery didn't take effect — gives the user something
// to tap instead of silently watching a muted stream.
const AutoUnmuteNotification = ({ isVisible, onUnmute }: { isVisible: boolean; onUnmute: () => void }) => {
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.button
          type="button"
          onClick={onUnmute}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          className="absolute bottom-20 left-1/2 transform -translate-x-1/2 z-50 flex items-center gap-2 rounded-full bg-black/80 backdrop-blur-sm border border-white/20 px-4 py-2 text-sm font-medium text-white shadow-lg hover:bg-black/90 transition-colors"
        >
          <VolumeX className="h-4 w-4" />
          Tap to unmute
        </motion.button>
      )}
    </AnimatePresence>
  )
}

// Live Badge Component
const LiveBadge = ({ variant = 'default', isMobile = false }: { variant?: 'default' | 'transparent', isMobile?: boolean }) => {
  // Component is kept for potential future use but not displayed per requirements
  return null
}

// Branded Loading Overlay - Shows during YouTube iframe loading (event-based, not timer-based)
const BrandedLoadingOverlay = ({ 
  isVisible, 
  programName 
}: { 
  isVisible: boolean
  programName: string
}) => {
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="absolute inset-0 z-[45] flex flex-col items-center justify-center bg-gradient-to-br from-zinc-900 via-zinc-950 to-black"
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
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                className="absolute inset-0 rounded-full border-2 border-primary/20"
              />
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                className="absolute inset-0 rounded-full border-t-2 border-primary"
              />
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
            
            {/* Loading bar animation */}
            <motion.div 
              className="w-[25vmin] min-w-[6rem] max-w-[12rem] h-1 bg-white/10 rounded-full overflow-hidden"
            >
              <motion.div
                animate={{ x: ['-100%', '100%'] }}
                transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
                className="h-full w-full bg-gradient-to-r from-transparent via-primary to-transparent"
              />
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// Program Overlay Component - Auto-appearing Now Playing bar (ticker-style)
const ProgramOverlay = ({ 
  currentProgram, 
  nextProgram, 
  isVisible,
  isMobile 
}: { 
  currentProgram: VideoProgram | null
  nextProgram: VideoProgram | null
  isVisible: boolean
  isMobile: boolean
}) => {
  return (
    <AnimatePresence>
      {isVisible && currentProgram && (
        <motion.div
          initial={{ opacity: 0, x: isMobile ? 0 : 50, y: isMobile ? -20 : 0 }}
          animate={{ opacity: 1, x: 0, y: 0 }}
          exit={{ opacity: 0, x: isMobile ? 0 : 50, y: isMobile ? -20 : 0 }}
          transition={{ duration: 0.4 }}
          className={`absolute z-30 ${
            isMobile ? 'top-2 left-2 right-2' : 'top-4 left-4 right-1/3'
          }`}
        >
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// Deeni.tv Logo Component
const DeeniLogo = ({ isMobile = false }: { isMobile?: boolean }) => {
  return (
    <motion.div 
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex items-center"
    >
      <img 
        src="/DeeniTV-V-2.png" 
        alt="Deeni.tv"
        className={isMobile ? 'h-4' : 'h-6'}
      />
    </motion.div>
  )
}

// Desktop Ticker Component - Enhanced bold text, 360-degree infinite scroll
const DesktopTicker = ({ videos, currentIndex, totalPrograms, currentProgramId }: { 
  videos: VideoProgram[], 
  currentIndex: number,
  totalPrograms: number,
  currentProgramId?: string
}) => {
  if (videos.length === 0) {
    return (
      <div className="relative flex overflow-hidden h-full items-center">
        <motion.div 
          animate={{ x: [0, -500] }} 
          transition={{ duration: 20, repeat: Infinity, ease: "linear", repeatType: "loop" }}
          className="whitespace-nowrap"
        >
          <span className="text-white/90 font-bold px-4 text-sm">
            <RadioIcon className="inline h-3 w-3 mr-2 text-primary animate-pulse" />
            More content coming...
          </span>
        </motion.div>
      </div>
    )
  }

  const items: React.ReactElement[] = []
  const repeatCount = 40 // Very high for true 360-degree infinite loop
  
  for (let i = 0; i < repeatCount; i++) {
    videos.forEach((video, index) => {
      const isNextVideo = index === 0 // Only the first video in the list is "NEXT"
      const isCurrentVideo = video.id === currentProgramId
      const prefix = isNextVideo ? 'NEXT' : 'UP NEXT'
      const duration = formatTime(video.duration)
      
      if (isCurrentVideo) return;
      
      items.push(
        <div key={`${video.id}-${i}-${index}`} className="inline-flex items-center mx-5">
          <span className={`
            px-2 py-0.5 rounded-full text-xs font-black mr-3 whitespace-nowrap
            ${isNextVideo 
              ? 'bg-yellow-500/30 text-yellow-300 border border-yellow-500/70 shadow-lg shadow-yellow-500/30 font-extrabold' 
              : 'bg-white/30 text-white border border-white/40 shadow-lg font-bold'
            }
          `}>
            {prefix}
          </span>
          <span className={`font-black text-sm whitespace-nowrap tracking-wide ${
            isNextVideo ? 'text-yellow-300 font-extrabold' : 'text-white'
          }`}>
            {video.title}
          </span>
          <span className={`ml-3 font-mono text-sm font-black whitespace-nowrap ${
            isNextVideo ? 'text-yellow-300' : 'text-white/80'
          }`}>
            {duration}
          </span>
        </div>
      )
    })
  }

  return (
    <div className="relative flex overflow-hidden h-full items-center group">
      {/* Gradient Fades */}
      <div className="absolute left-0 top-0 bottom-0 w-16 bg-gradient-to-r from-black/95 to-transparent z-10 pointer-events-none" />
      <div className="absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-black/95 to-transparent z-10 pointer-events-none" />
      
      {/* Infinite Scrolling - 360-degree never ends */}
      <motion.div
        className="flex whitespace-nowrap"
        animate={{ x: [0, -20000] }}
        transition={{ 
          duration: 150, 
          repeat: Infinity, 
          ease: "linear",
          repeatType: "loop"
        }}
        style={{ willChange: "transform" }}
      >
        {items}
      </motion.div>
    </div>
  )
}

// Mobile Ticker Component - Ultra compact with more items
const MobileTicker = ({ videos, currentIndex, totalPrograms, currentProgramId }: { 
  videos: VideoProgram[], 
  currentIndex: number,
  totalPrograms: number,
  currentProgramId?: string
}) => {
  if (videos.length === 0) {
    return (
      <div className="relative flex overflow-hidden h-full items-center">
        <motion.div 
          animate={{ x: [0, -300] }} 
          transition={{ duration: 20, repeat: Infinity, ease: "linear", repeatType: "loop" }}
          className="whitespace-nowrap"
        >
          <span className="text-white/90 font-bold px-2 text-[10px]">
            More content coming...
          </span>
        </motion.div>
      </div>
    )
  }

  const items: React.ReactElement[] = []
  const repeatCount = 40 // Increased for smoother infinite loop
  
  for (let i = 0; i < repeatCount; i++) {
    videos.forEach((video, index) => {
      const isNextVideo = index === 0 // Only the first video in the list is "NEXT"
      const isCurrentVideo = video.id === currentProgramId
      const prefix = isNextVideo ? 'NEXT' : 'UP NEXT'
      const duration = formatTime(video.duration)
      
      if (isCurrentVideo) return;
      
      items.push(
        <div key={`${video.id}-${i}-${index}`} className="inline-flex items-center mx-2">
          <span className={`
            px-1.5 py-0.5 rounded-full text-[8px] font-black mr-1.5 whitespace-nowrap
            ${isNextVideo 
              ? 'bg-yellow-500/30 text-yellow-300 border border-yellow-500/70 shadow-sm font-extrabold' 
              : 'bg-white/30 text-white border border-white/40 shadow-sm font-bold'
            }
          `}>
            {prefix}
          </span>
          <span className={`font-black text-[10px] whitespace-nowrap tracking-wide ${
            isNextVideo ? 'text-yellow-300 font-extrabold' : 'text-white'
          }`}>
            {video.title}
          </span>
          <span className={`ml-1.5 font-mono text-[9px] font-black whitespace-nowrap ${
            isNextVideo ? 'text-yellow-300' : 'text-white/80'
          }`}>
            {duration}
          </span>
        </div>
      )
    })
  }

  return (
    <div className="relative flex overflow-hidden h-full items-center">
      {/* Gradient Fades - Smaller on mobile */}
      <div className="absolute left-0 top-0 bottom-0 w-6 bg-gradient-to-r from-black/95 to-transparent z-10 pointer-events-none" />
      <div className="absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-black/95 to-transparent z-10 pointer-events-none" />
      
      {/* Infinite Scrolling - 360-degree never ends - Standard TV news speed */}
      <motion.div
        className="flex whitespace-nowrap"
        animate={{ x: [0, -15000] }}
        transition={{ 
          duration: 180, 
          repeat: Infinity, 
          ease: "linear",
          repeatType: "loop"
        }}
        style={{ willChange: "transform" }}
      >
        {items}
      </motion.div>
    </div>
  )
}

// Modern Time Display Component
const ModernTimeDisplay = () => {
  const [time, setTime] = useState(new Date())
  
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])
  
  const formattedTime = time.toLocaleTimeString('en-US', { 
    hour: '2-digit', 
    minute: '2-digit',
    second: '2-digit',
    hour12: true 
  })
  
  const formattedDate = time.toLocaleDateString('en-US', { 
    weekday: 'short',
    month: 'short', 
    day: 'numeric'
  })
  
  return (
    <motion.div 
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="absolute top-4 right-4 z-40"
    >
      <div className="flex items-center gap-3 px-4 py-2 bg-black/60 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl">
        <Clock className="h-4 w-4 text-primary" />
        <span className="text-white font-semibold text-sm tracking-wide">
          {formattedTime}
        </span>
        <div className="w-px h-4 bg-white/20" />
        <span className="text-white/80 text-xs font-medium">
          {formattedDate}
        </span>
      </div>
    </motion.div>
  )
}

export function SyncedVideoPlayer({ 
  onMenuOpen, 
  initialChannelId = CHANNELS[0].id,
  onChannelChange,
  showStartModal = false,
  onStartClick,
  openHistoryModal = false,
  onHistoryModalClose,
  onOpenSchedule,
  openChannelSelectorModal = false,
  onChannelSelectorModalClose,
  onReloadStart,
  onProgramChange,
  triggerReload = 0,
  hasUserSelectedChannel = true
}: SyncedVideoPlayerProps) {
  const [isIOS, setIsIOS] = useState(false)
  const [isAndroid, setIsAndroid] = useState(false)
  const [isPlatformReady, setIsPlatformReady] = useState(false)

  useEffect(() => {
    if (typeof navigator === 'undefined') return

    const isApple =
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
    
    const isAndroidDevice =
      Capacitor.getPlatform() === 'android' ||
      /Android/.test(navigator.userAgent)
    
    setIsIOS(isApple)
    setIsAndroid(isAndroidDevice)
    setIsPlatformReady(true)
  }, [])

  useEffect(() => {
    setHasMounted(true)
  }, [])

  // UI State
  const [showControls, setShowControls] = useState(true)
  const [controlsVisible, setControlsVisible] = useState(true)
  // Always start muted initially - auto-unmute after delay
  const [isMuted, setIsMuted] = useState(true)
  const [volume, setVolume] = useState(75)
  const [showVolumeSlider, setShowVolumeSlider] = useState(false)
  const [showTicker, setShowTicker] = useState(true)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showPreviousModal, setShowPreviousModal] = useState(false)
  const [previousVideos, setPreviousVideos] = useState<VideoProgram[]>([])
  const [showProgramOverlay, setShowProgramOverlay] = useState(false)
  const [showAutoUnmuteNotification, setShowAutoUnmuteNotification] = useState(false)
  const [isVolumeControlsLocked, setIsVolumeControlsLocked] = useState(true)
  const [hasMounted, setHasMounted] = useState(false)
  
  // Branded loading overlay state - event-based, not timer-based
  const [showBrandedOverlay, setShowBrandedOverlay] = useState(false)
  const brandedOverlayProgramRef = useRef<string>('')
  // iframeVisible — keeps the iframe container at opacity:0 until the REAL video
  // fires its first PLAYING event.  Prevents the primer (zoo) video from flashing
  // on screen.  Once true it stays true; subsequent transitions are hidden by
  // BrandedLoadingOverlay sitting on top instead.
  const [iframeVisible, setIframeVisible] = useState(false)
  
  // Channel State
  const [apiChannels, setApiChannels] = useState<ApiChannel[]>([])
  const [currentChannelId, setCurrentChannelId] = useState<string>(initialChannelId)
  const [showChannelSelector, setShowChannelSelector] = useState(false)
  
  // Player State
  const [currentProgram, setCurrentProgram] = useState<VideoProgram | null>(null)
  const [nextProgram, setNextProgram] = useState<VideoProgram | null>(null)
  const [currentTime, setCurrentTime] = useState(0)
  const [timeRemaining, setTimeRemaining] = useState('0:00')
  const [displayTime, setDisplayTime] = useState('0:00')
  const [videoDuration, setVideoDuration] = useState(0)
  const [cycleInfo, setCycleInfo] = useState({ current: 1, total: 1 })
  const [upcomingVideos, setUpcomingVideos] = useState<VideoProgram[]>([])
  
  // App State
  const [isLoading, setIsLoading] = useState(false)
  const [showStartScreen, setShowStartScreen] = useState(() => isIOS)
  const [iosPrimerReady, setIosPrimerReady] = useState(false)
  const [playerReady, setPlayerReady] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)
  const [serverTimeOffset, setServerTimeOffset] = useState(0)
  
  // Refs
  const playerRef = useRef<HTMLDivElement>(null)
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const volumeHideTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const autoUnmuteTimerRef = useRef<NodeJS.Timeout | null>(null)
  const hasAutoUnmutedRef = useRef(false)
  const iosAudioUnlockedRef = useRef(false)
  const iosUnmuteRetryRef = useRef(false)
  const initialStartFlowRef = useRef(false)
  const reloadStartFlowRef = useRef(false)
  const startInProgressRef = useRef(false)
  const hasPressedStartRef = useRef(false)
  const isLoadingRef = useRef(false)
  const playerReadyRef = useRef(false)
  const iframeVisibleRef = useRef(false)
  const showStartScreenRef = useRef(false)
  const apiErrorRef = useRef<string | null>(null)
  const brandedOverlayHideTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const playbackStartWatchdogRef = useRef<NodeJS.Timeout | null>(null)
  const playbackRecoveryAttemptRef = useRef(0)
  const playbackStateRef = useRef<number>(YT_STATE.UNSTARTED)
  const bufferingStartedAtRef = useRef(0)
  const bufferingRecoveryStepRef = useRef(0)
  const lastHardRecoveryAtRef = useRef(0)
  const playbackProgressWatchTimeRef = useRef(0)
  const playbackProgressWatchAtRef = useRef(0)
  const currentLoadAttemptRef = useRef(0)
  const channelLoadTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const playEventsSinceLoadRef = useRef(0)

  const isMobile = useMediaQuery('(max-width: 768px)')
  const isTablet = useMediaQuery('(min-width: 769px) and (max-width: 1024px)')
  const isDesktop = useMediaQuery('(min-width: 1025px)')
  const lastVideoIdRef = useRef<string>('')
  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const mountedRef = useRef(true)
  const masterEpochRef = useRef<number>(MASTER_EPOCH_START)
  const timeUpdateIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const videoEndTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isTransitioningRef = useRef(false)
  // "Latest value" refs — used inside syncWithServer so we don't need those values
  // in the useCallback dependency array (which would reset the 5-min interval on each video change)
  const currentProgramRef = useRef<VideoProgram | null>(null)
  const upcomingVideosRef = useRef<VideoProgram[]>([])
  // playNextVideoRef — always holds the latest playNextVideo closure.
  // onStateChange (ENDED) and the time-update check both call this so they always
  // advance the CURRENT queue, not the stale one captured at initializePlayer time.
  const playNextVideoRef = useRef<() => void>(() => {})
  // syncImmediateAfterTransitionRef — holds the latest closure so playNextVideo
  // (defined before syncImmediateAfterTransition) can call it without a TDZ error.
  const syncImmediateAfterTransitionRef = useRef<(channelId: string) => Promise<void>>(async () => {})
  
  // YouTube player hook
  const { 
    containerRef: youtubeContainerRef, 
    initializePlayer, 
    primePlayer,
    unmuteAndResume,
    setPlayerCallbacks,
    isPrimedRef,
    loadVideo, 
    muteForTransition,
    getDuration,
    setVolume: setYouTubeVolume,
    setMuted: setYouTubeMuted,
    seekTo,
    getCurrentTime,
    getIsMuted,
    play,
    destroy
  } = useYouTubePlayer()

  // ── Helper: build schedule array from current state and notify parent ──
  // Deduplicates: ensures the currently-playing video never also appears in upcoming.
  const notifyParentScheduleChange = useCallback((
    nowPlaying: VideoProgram,
    upcoming: VideoProgram[]
  ) => {
    if (!onProgramChange) return
    // Remove the now-playing video from the upcoming list to avoid duplicates
    const dedupedUpcoming = upcoming.filter(p => p.videoId !== nowPlaying.videoId)
    const schedule: VideoProgram[] = [nowPlaying, ...dedupedUpcoming]
    onProgramChange(nowPlaying.id, schedule)
  }, [onProgramChange])

  // Load stored API channels from localStorage on mount
  useEffect(() => {
    const stored = getStoredApiChannels()
    if (stored.length > 0) {
      setApiChannels(stored)
      return
    }

    setApiChannels(getFallbackApiChannels())
  }, [])

  // Load previous videos when channel changes
  useEffect(() => {
    if (currentChannelId) {
      const saved = getPreviousVideos(currentChannelId)
      setPreviousVideos(saved)
    }
  }, [currentChannelId])

  // Keep "latest value" refs in sync — allows syncWithServer to read current state
  // without being in its dependency array (which would reset the 5-min interval)
  useEffect(() => { currentProgramRef.current = currentProgram }, [currentProgram])
  useEffect(() => { upcomingVideosRef.current = upcomingVideos }, [upcomingVideos])
  useEffect(() => { isLoadingRef.current = isLoading }, [isLoading])
  useEffect(() => { playerReadyRef.current = playerReady }, [playerReady])
  useEffect(() => { iframeVisibleRef.current = iframeVisible }, [iframeVisible])
  useEffect(() => { showStartScreenRef.current = showStartScreen }, [showStartScreen])
  useEffect(() => { apiErrorRef.current = apiError }, [apiError])

  const clearPlaybackStartWatchdog = useCallback(() => {
    if (playbackStartWatchdogRef.current) {
      clearTimeout(playbackStartWatchdogRef.current)
      playbackStartWatchdogRef.current = null
    }
  }, [])

  const clearBrandedOverlayHideTimeout = useCallback(() => {
    if (brandedOverlayHideTimeoutRef.current) {
      clearTimeout(brandedOverlayHideTimeoutRef.current)
      brandedOverlayHideTimeoutRef.current = null
    }
  }, [])

  const hideBrandedOverlayAfterDelay = useCallback((delayMs: number = 3500) => {
    clearBrandedOverlayHideTimeout()
    brandedOverlayHideTimeoutRef.current = setTimeout(() => {
      if (!mountedRef.current) return
      setShowBrandedOverlay(false)
    }, delayMs)
  }, [clearBrandedOverlayHideTimeout])

  const clearChannelLoadTimeout = useCallback(() => {
    if (channelLoadTimeoutRef.current) {
      clearTimeout(channelLoadTimeoutRef.current)
      channelLoadTimeoutRef.current = null
    }
  }, [])

  // Ensure player is muted on mount and page reload to prevent default video sound
  useEffect(() => {
    if (mountedRef.current) {
      setIsMuted(true)
      setYouTubeMuted(true)
      console.log('🔇 Muted on mount - preventing default video audio')
    }
  }, [setYouTubeMuted])

  // iOS only: keep start screen with explicit user gesture.
  useEffect(() => {
    setShowStartScreen(isIOS && !hasPressedStartRef.current)
    if (!isIOS) {
      setIosPrimerReady(true)
    }
  }, [isIOS])

  // Keep local iOS primer-ready state in sync with the primed player ref.
  useEffect(() => {
    if (!isIOS) return

    const timer = setInterval(() => {
      if (isPrimedRef.current) {
        setIosPrimerReady(true)
      }
    }, 150)

    return () => clearInterval(timer)
  }, [isIOS, isPrimedRef])

  // Prime a hidden muted player early on iOS so the first user tap can reliably
  // unlock audio and swap into the real stream without rebuilding the iframe.
  useEffect(() => {
    if (!isIOS) return

    let cancelled = false
    const ensurePrimer = async (attempt: number = 0) => {
      if (cancelled) return
      if (isPrimedRef.current) {
        setIosPrimerReady(true)
        return
      }

      await primePlayer()

      if (cancelled) return
      if (isPrimedRef.current) {
        setIosPrimerReady(true)
        return
      }

      if (!cancelled && !isPrimedRef.current && attempt < 6) {
        setTimeout(() => ensurePrimer(attempt + 1), 250)
      }
    }

    ensurePrimer()

    return () => {
      cancelled = true
    }
  }, [isIOS, primePlayer, isPrimedRef])

  // Production hardening: keep trying to prime on iOS until ready.
  // This avoids rare cold-start cases where one initial priming burst fails.
  useEffect(() => {
    if (!isIOS || iosPrimerReady) return

    const retryTimer = setInterval(() => {
      if (isPrimedRef.current) {
        setIosPrimerReady(true)
        return
      }
      primePlayer().catch(() => {})
    }, 2500)

    return () => clearInterval(retryTimer)
  }, [isIOS, iosPrimerReady, isPrimedRef, primePlayer])

  // Handle external openHistoryModal prop
  useEffect(() => {
    if (openHistoryModal && !showPreviousModal) {
      setShowPreviousModal(true)
    }
  }, [openHistoryModal, showPreviousModal])

  // Handle external openChannelSelectorModal trigger (from 3-dot menu)
  useEffect(() => {
    if (openChannelSelectorModal && !showChannelSelector) {
      setShowChannelSelector(true)
    }
  }, [openChannelSelectorModal, showChannelSelector])

  // Update currentChannelId when initialChannelId changes
  useEffect(() => {
    if (initialChannelId && initialChannelId !== currentChannelId) {
      setCurrentChannelId(initialChannelId)
    }
  }, [initialChannelId, currentChannelId])

  // Keep initial playback muted on all platforms.
  // Real content is unmuted only after a transition enters PLAYING.
  useEffect(() => {
    if (autoUnmuteTimerRef.current) {
      clearTimeout(autoUnmuteTimerRef.current)
      autoUnmuteTimerRef.current = null
    }
    setShowAutoUnmuteNotification(false)
  }, [playerReady, currentProgram, showStartScreen, isMuted])

  useEffect(() => {
    if (!isMuted) {
      hasAutoUnmutedRef.current = true
    }
  }, [isMuted])

  // Play next video function - CRITICAL for continuous playback
  const playNextVideo = useCallback(() => {
    if (isTransitioningRef.current || !currentProgram || !nextProgram || !currentChannelId) {
      console.log('❌ Cannot play next video: missing program or channel')
      return
    }
    
    isTransitioningRef.current = true
    
    console.log('▶️ Playing next video:', nextProgram.title)
    
    // Show branded overlay during loading transition
    brandedOverlayProgramRef.current = nextProgram.title
    setShowBrandedOverlay(true)
    
    // Add current video to previous list
    if (currentProgram) {
      const updatedPrevious = addToPreviousVideos(currentChannelId, currentProgram)
      setPreviousVideos(updatedPrevious)
    }
    
    const startTime = 0
    
    // Update state with next program
    setCurrentProgram(nextProgram)
    setCurrentTime(startTime)
    setDisplayTime(formatTime(startTime))
    setVideoDuration(nextProgram.duration)
    
    // Shift the API-populated upcoming queue: nextProgram is now playing,
    // so remove it from the front and promote the rest
    const newUpcomingQueue = upcomingVideos.slice(1)
    const newNextProgram = newUpcomingQueue[0] || null

    if (newNextProgram) {
      // Still have API queue items
      setNextProgram(newNextProgram)
      setUpcomingVideos(newUpcomingQueue)
      // Instantly notify parent so ScheduleModal / UI reflects the change
      notifyParentScheduleChange(nextProgram, newUpcomingQueue)
    } else {
      // API queue exhausted — fall back to local schedule data
      const programs = getChannelPrograms(currentChannelId)
      const currentIndex = programs.findIndex(p => p.id === nextProgram.id)
      if (programs.length > 0 && currentIndex >= 0) {
        const fallbackNext = programs[(currentIndex + 1) % programs.length]
        setNextProgram(fallbackNext)
        const fallbackUpcoming: VideoProgram[] = []
        for (let i = 1; i <= 15; i++) {
          fallbackUpcoming.push(programs[(currentIndex + i) % programs.length])
        }
        setUpcomingVideos(fallbackUpcoming)
        // Notify parent with fallback data
        notifyParentScheduleChange(nextProgram, fallbackUpcoming)
      } else {
        setNextProgram(null)
        setUpcomingVideos([])
        notifyParentScheduleChange(nextProgram, [])
      }
    }
    
    // Update cycle info
    setCycleInfo(prev => ({ 
      current: prev.total > 0 ? (prev.current % prev.total) + 1 : 1, 
      total: prev.total 
    }))
    
    // Clear any existing timeout
    if (videoEndTimeoutRef.current) {
      clearTimeout(videoEndTimeoutRef.current)
      videoEndTimeoutRef.current = null
    }
    
    // ── Update currentProgramRef inline so syncImmediateAfterTransition gets the
    // correct value immediately (don't wait for the useEffect after render). ──
    currentProgramRef.current = nextProgram

    // Load and play the next video
    lastVideoIdRef.current = nextProgram.videoId
    // Ensure transition is muted and schedule auto-unmute when real video starts
    try { muteForTransition(true) } catch (_) {}
    setIsVolumeControlsLocked(true)
    const loaded = loadVideo(nextProgram.videoId, startTime)
    
    if (loaded) {
      console.log('✅ Next video loaded successfully')
      setYouTubeVolume(volume)
      setYouTubeMuted(isMuted)
      
      play()
      console.log('▶️ Playing next video now')
      isTransitioningRef.current = false
      
      // Get duration from YouTube API
      const duration = getDuration()
      if (duration && duration > 0) {
        setVideoDuration(duration)
      }

      // ── Immediate API sync to replenish queue with authoritative data ──
      // Runs quickly after transition so the schedule / previous list updates fast.
      // This refreshes upcoming list, previous videos, and notifies parent.
      const channelForSync = currentChannelId
      setTimeout(() => {
        syncImmediateAfterTransitionRef.current(channelForSync)
      }, 500)
    } else {
      console.error('❌ Failed to load next video')
      isTransitioningRef.current = false
    }
    
  }, [currentProgram, nextProgram, currentChannelId, upcomingVideos, loadVideo, volume, isMuted, setYouTubeVolume, setYouTubeMuted, play, getDuration, notifyParentScheduleChange])

  // Keep playNextVideoRef always pointing at the freshest closure.
  // onStateChange (ENDED) and updateTimeDisplay both call this so they always
  // advance the CURRENT queue, never a stale one captured at initializePlayer time.
  useEffect(() => { playNextVideoRef.current = playNextVideo }, [playNextVideo])

  // Update time display - uses actual video time from YouTube
  const updateTimeDisplay = useCallback(() => {
    if (!currentProgram || isTransitioningRef.current) return
    
    // Get current time from YouTube player
    const playerTime = getCurrentTime()
    
    if (playerTime !== undefined && !isNaN(playerTime)) {
      setCurrentTime(playerTime)
      setDisplayTime(formatTime(playerTime))
      
      // Use video duration from YouTube API if available, otherwise use program duration
      const duration = getDuration()
      const actualDuration = duration > 0 ? duration : videoDuration
      
      const remaining = Math.max(0, actualDuration - playerTime)
      setTimeRemaining(formatTime(remaining))
      
      // Check if video is near the end (less than 0.5 seconds remaining)
      if (actualDuration > 0 && remaining <= 0.5 && !isTransitioningRef.current && nextProgram) {
        console.log('⚠️ Video ending soon, preparing next video...')
        setShowBrandedOverlay(true)
        setIsLoading(false)
        setShowStartScreen(false)
        
        if (videoEndTimeoutRef.current) {
          clearTimeout(videoEndTimeoutRef.current)
        }
        // Use ref so we always call the latest closure (queue already shifted correctly)
        playNextVideoRef.current()
      }
    }
  }, [currentProgram, getCurrentTime, getDuration, videoDuration, nextProgram])

  // ── Browser-side external API call (bypasses Cloudflare) ──
  const EXTERNAL_API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'https://api.deeniinfotech.com/api/tv-schedules'

  const fetchFromBrowserAPI = useCallback(async (channelId: string): Promise<any | null> => {
    try {
      // Look up channel from localStorage — no static mapping needed
      const storedChannels = getStoredApiChannels()
      const channel = storedChannels.find(c => String(c.id) === channelId)
      const lid = channel?.localizationId || '5'

      let apiUrl = `${EXTERNAL_API_BASE}/live?lid=${lid}`
      if (channel?.isQuran === true) {
        apiUrl += '&iq=true'
      }

      console.log('📡 Browser → External API:', apiUrl)
      const data: any = await Promise.race([
        clientFetchWithAuth(apiUrl),
        new Promise((_, reject) => {
          setTimeout(() => reject(new Error('External API timeout')), 120000)
        }),
      ])

      // Normalise the response shape coming from the real API
      const curr = data?.currentProgram || data?.current || data?.data?.currentProgram
      if (!curr) return null

      const serverTime = data?.serverTime || Date.now()

      const currentProgram = {
        ytVideoId: curr.ytVideoId || curr.videoId || curr.yt_video_id,
        title: curr.title || curr.name,
        startTime: curr.startTime || curr.start_time || serverTime,
        endTime: curr.endTime || curr.end_time || (serverTime + (curr.duration || 3600) * 1000),
        duration: curr.duration || 3600,
        seekTo: curr.seekTo || curr.seek_to || 0,
      }

      const mapProg = (prog: any) => ({
        ytVideoId: prog.ytVideoId || prog.videoId || prog.yt_video_id,
        title: prog.title || prog.name,
        startTime: prog.startTime || prog.start_time,
        endTime: prog.endTime || prog.end_time,
        duration: prog.duration,
      })

      const prevList = data?.previousPrograms || data?.previous || data?.data?.previousPrograms || []
      const upList = data?.upcomingPrograms || data?.upcoming || data?.data?.upcomingPrograms || []

      console.log('✅ External API OK — video:', currentProgram.ytVideoId)
      return {
        serverTime,
        currentProgram,
        previousPrograms: (Array.isArray(prevList) ? prevList : []).map(mapProg),
        upcomingPrograms: (Array.isArray(upList) ? upList : []).map(mapProg),
        _source: 'external-api',
      }
    } catch (err) {
      console.warn('⚠️ Browser API call failed, will use local fallback:', err)
      return null
    }
  }, [])

  // ── Immediate API refresh after a video ends ──
  // Runs once right after playNextVideo shifts the queue locally.
  // Replenishes all three sections from the server so the user always sees fresh data.
  const syncImmediateAfterTransition = useCallback(async (channelId: string) => {
    try {
      console.log('🔄 Immediate API sync after video transition...')

      let result = await fetchFromBrowserAPI(channelId)

      if (!result) {
        const response = await fetch(`/api/current-video?channel=${channelId}`, {
          headers: { 'Cache-Control': 'no-cache' }
        })
        if (response.ok) {
          result = await parseJsonSafely(response)
        }
      }

      if (!result || !result.serverTime || !result.currentProgram) {
        result = buildEmbeddedScheduleFallback(channelId)
      }

      // Update server time offset
      if (result.serverTime) {
        setServerTimeOffset(result.serverTime - Date.now())
      }

      // ── Section 1: Previous videos — always re-read from localStorage ──
      // localStorage was already written synchronously in playNextVideo.
      // Re-reading here ensures the modal reflects the absolute latest list.
      const latestPrevious = getPreviousVideos(channelId)
      if (latestPrevious.length > 0) {
        setPreviousVideos(latestPrevious)
      }

      // ── Section 2 & 3: Upcoming queue + schedule notification ──
      // The API may LAG: it might still report the OLD video as "currentProgram"
      // and include the NEW current video in "upcomingPrograms".
      // Strategy: always trust our local currentProgramRef as ground truth for
      // what is NOW playing, and strip any matching ID from upcoming.
      if (result.upcomingPrograms && Array.isArray(result.upcomingPrograms)) {
        const localCurrentId = currentProgramRef.current?.videoId
        const apiCurrentId   = result.currentProgram?.ytVideoId

        // Build the mapped upcoming list
        const mapped: VideoProgram[] = result.upcomingPrograms.map(
          (prog: { ytVideoId: string; title: string; duration: number }) => ({
            id: prog.ytVideoId,
            videoId: prog.ytVideoId,
            title: prog.title,
            description: prog.title,
            duration: prog.duration,
            category: 'Lecture',
            language: 'Bengali',
            channelId,
            thumbnail: `https://img.youtube.com/vi/${prog.ytVideoId}/maxresdefault.jpg`
          })
        )

        // Strip BOTH the local current video AND (if API is lagging) also the
        // API-reported current video so neither appears in the upcoming queue.
        const upcoming = mapped.filter(
          (p: VideoProgram) => p.videoId !== localCurrentId && p.videoId !== apiCurrentId
        )

        // If the API has caught up (apiCurrentId === localCurrentId), include
        // everything that comes after — the filter above already handles that.
        // If the API is still lagging (apiCurrentId !== localCurrentId), the API's
        // currentProgram is the old video; it won't appear in upcoming anyway.
        // Either way, the result is correct.

        setUpcomingVideos(upcoming)
        if (upcoming[0]) setNextProgram(upcoming[0])

        // Notify parent (schedule modal + current-program indicator) with fresh data
        if (currentProgramRef.current) {
          notifyParentScheduleChange(currentProgramRef.current, upcoming)
        }
      }

      console.log('✅ Immediate post-transition sync complete — all sections updated')
    } catch (error) {
      console.error('⚠️ Immediate post-transition sync failed (non-critical):', error)
    }
  }, [fetchFromBrowserAPI, notifyParentScheduleChange])

  // Keep the ref in sync with the latest closure
  useEffect(() => { syncImmediateAfterTransitionRef.current = syncImmediateAfterTransition }, [syncImmediateAfterTransition])

  const loadChannel = useCallback(async (channelId: string, options?: { preferUnmutedStart?: boolean; isRecoveryRetry?: boolean }) => {
    const loadAttemptId = currentLoadAttemptRef.current + 1
    currentLoadAttemptRef.current = loadAttemptId
    const isStaleLoadAttempt = () => !mountedRef.current || currentLoadAttemptRef.current !== loadAttemptId
    const shouldStartUnmuted = Boolean(options?.preferUnmutedStart)
    const shouldStartUnmutedOnAndroid = shouldStartUnmuted && isAndroid

    clearPlaybackStartWatchdog()
    clearChannelLoadTimeout()

    channelLoadTimeoutRef.current = setTimeout(() => {
      if (!mountedRef.current) return
      if (currentLoadAttemptRef.current !== loadAttemptId) return
      if (playerReadyRef.current || iframeVisibleRef.current) return

      console.warn('⚠️ Channel load timeout: attempting one automatic recovery reload')

      if (playbackRecoveryAttemptRef.current >= 1) {
        startInProgressRef.current = false
        setIsLoading(false)
        setShowBrandedOverlay(false)
        setApiError('Playback is taking longer than expected. Please tap Refresh.')
        return
      }

      playbackRecoveryAttemptRef.current += 1
      startInProgressRef.current = false
      setIsLoading(false)
      setShowStartScreen(false)
      setShowBrandedOverlay(true)
      setApiError(null)
      setPlayerReady(false)
      setIframeVisible(false)

      try {
        destroy()
      } catch (_) {}

      setTimeout(() => {
        if (!mountedRef.current) return
        if (currentLoadAttemptRef.current !== loadAttemptId) return

        loadChannel(channelId, {
          preferUnmutedStart: shouldStartUnmuted,
          isRecoveryRetry: true,
        })
      }, 700)
    }, 20000)

    if (!options?.isRecoveryRetry) {
      playbackRecoveryAttemptRef.current = 0
    }

    if (shouldStartUnmuted && isIOS) {
      iosAudioUnlockedRef.current = true
    }
    iosUnmuteRetryRef.current = false
    playEventsSinceLoadRef.current = 0
    setIsVolumeControlsLocked(!shouldStartUnmutedOnAndroid)
    
    setIsLoading(true)
    setApiError(null)
    setIsMuted(!shouldStartUnmutedOnAndroid)
    setYouTubeMuted(!shouldStartUnmutedOnAndroid)
    playbackStateRef.current = YT_STATE.UNSTARTED
    bufferingStartedAtRef.current = 0
    bufferingRecoveryStepRef.current = 0
    playbackProgressWatchTimeRef.current = 0
    playbackProgressWatchAtRef.current = Date.now()
    setShowAutoUnmuteNotification(false)
    hasAutoUnmutedRef.current = shouldStartUnmutedOnAndroid

    if (autoUnmuteTimerRef.current) {
      clearTimeout(autoUnmuteTimerRef.current)
    }

    setCurrentChannelId(channelId)
    onChannelChange?.(channelId)
    
    saveChannel(channelId)
    
    // Load previous videos for this channel
    const savedPrevious = getPreviousVideos(channelId)
    setPreviousVideos(savedPrevious)
    
    try {
      console.log('🎬 Loading channel:', channelId)
      
      const clientTime = Date.now()

      // 1️⃣ Try external API directly from browser (bypasses Cloudflare)
      let result = await fetchFromBrowserAPI(channelId)

      // 2️⃣ Fallback to our own Next.js API route (local schedule data)
      if (!result) {
        console.log('📋 Falling back to local /api/current-video route...')
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 10000)
        const response = await fetch(`/api/current-video?channel=${channelId}`, {
          headers: { 
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          },
          signal: controller.signal,
        })
        clearTimeout(timeoutId)

        if (response.ok) {
          result = await parseJsonSafely(response)
        }
      }

      if (!result || !result.serverTime || !result.currentProgram) {
        console.warn('⚠️ API response unavailable; using embedded schedule fallback')
        result = buildEmbeddedScheduleFallback(channelId)
      }
      
      // Unified format: { serverTime, currentProgram, previousPrograms, upcomingPrograms }
      if (!result.serverTime || !result.currentProgram) {
        throw new Error('Invalid API response')
      }

      if (isStaleLoadAttempt()) return

      const offset = result.serverTime - clientTime
      setServerTimeOffset(offset)
      
      // Convert new API format to internal program format
      const program: VideoProgram = {
        id: result.currentProgram.ytVideoId,
        videoId: result.currentProgram.ytVideoId,
        title: result.currentProgram.title,
        description: result.currentProgram.title,
        duration: result.currentProgram.duration,
        category: 'Lecture',
        language: 'Bengali',
        channelId: channelId,
        thumbnail: `https://img.youtube.com/vi/${result.currentProgram.ytVideoId}/maxresdefault.jpg`
      }
      
      const startTime = result.currentProgram.seekTo
      const timeRemaining = result.currentProgram.duration - result.currentProgram.seekTo
      
      brandedOverlayProgramRef.current = program.title

      setIsLoading(false)
      setShowStartScreen(false)
      clearBrandedOverlayHideTimeout()
      setShowBrandedOverlay(true)
      setCurrentProgram(program)
      setCurrentTime(startTime)
      setDisplayTime(formatTime(startTime))
      setTimeRemaining(formatTime(timeRemaining))
      setVideoDuration(program.duration)
      
      // Get next program from upcomingPrograms
      if (result.upcomingPrograms && result.upcomingPrograms.length > 0) {
        const nextProg = result.upcomingPrograms[0]
        const nextProgram: VideoProgram = {
          id: nextProg.ytVideoId,
          videoId: nextProg.ytVideoId,
          title: nextProg.title,
          description: nextProg.title,
          duration: nextProg.duration,
          category: 'Lecture',
          language: 'Bengali',
          channelId: channelId,
          thumbnail: `https://img.youtube.com/vi/${nextProg.ytVideoId}/maxresdefault.jpg`
        }
        setNextProgram(nextProgram)
      }
      
      // Set cycle info from schedule
      const programs = getChannelPrograms(channelId)
      const currentIndex = programs.findIndex(p => p.videoId === result.currentProgram.ytVideoId)
      setCycleInfo({ 
        current: currentIndex >= 0 ? currentIndex + 1 : 1, 
        total: programs.length 
      })
      
      // Set upcoming videos from API response — filter out the currently-playing video
      const upcoming: VideoProgram[] = (result.upcomingPrograms || [])
        .map((prog: { ytVideoId: string; title: string; duration: number }) => ({
          id: prog.ytVideoId,
          videoId: prog.ytVideoId,
          title: prog.title,
          description: prog.title,
          duration: prog.duration,
          category: 'Lecture',
          language: 'Bengali',
          channelId: channelId,
          thumbnail: `https://img.youtube.com/vi/${prog.ytVideoId}/maxresdefault.jpg`
        }))
        .filter((p: VideoProgram) => p.videoId !== program.videoId)
      setUpcomingVideos(upcoming)
      
      // Notify parent with fresh schedule data so ScheduleModal is up-to-date
      notifyParentScheduleChange(program, upcoming)
      
      // Previous videos: localStorage (real user history) always takes priority.
      // API previousPrograms are only schedule-calculated — treat them as optional extras.
      const existingPrevious = getPreviousVideos(channelId)
      if (existingPrevious.length > 0) {
        // User has real watch history — use it as-is, don't let API overwrite order
        setPreviousVideos(existingPrevious)
      } else if (result.previousPrograms && result.previousPrograms.length > 0) {
        // No local history yet — seed from API schedule data as a starting point
        const apiPrevious: VideoProgram[] = result.previousPrograms.map((prog: { ytVideoId: string; title: string; duration: number }) => ({
          id: prog.ytVideoId,
          videoId: prog.ytVideoId,
          title: prog.title,
          description: prog.title,
          duration: prog.duration,
          category: 'Lecture',
          language: 'Bengali',
          channelId: channelId,
          thumbnail: `https://img.youtube.com/vi/${prog.ytVideoId}/maxresdefault.jpg`
        }))
        setPreviousVideos(apiPrevious.slice(0, 30))
        savePreviousVideos(channelId, apiPrevious.slice(0, 30))
      }
      
      lastVideoIdRef.current = program.videoId
      
      const startPlayback = () => {
        if (isStaleLoadAttempt()) return
        console.log('✅ Player ready - starting playback')
        clearChannelLoadTimeout()
        setPlayerReady(true)
        setIsLoading(false)
        setShowStartScreen(false)
        onStartClick?.()

        seekTo(startTime, true)
        play()

        const duration = getDuration()
        if (duration && duration > 0) {
          setVideoDuration(duration)
        }

        setYouTubeVolume(volume)
        if (isIOS && initialStartFlowRef.current) {
          setYouTubeMuted(false)
          setIsMuted(false)
        } else if (shouldStartUnmutedOnAndroid) {
          setYouTubeMuted(false)
          setIsMuted(false)
        } else {
          setYouTubeMuted(true)
          setIsMuted(true)
        }

        // Some iOS/Safari sessions play video but miss PLAYING callback.
        // If time progresses, force-restore visuals to avoid black-screen hang.
        const recoverVisualPlaybackIfNeeded = () => {
          if (!mountedRef.current) return
          if (currentLoadAttemptRef.current !== loadAttemptId) return
          if (iframeVisibleRef.current) return

          const progress = getCurrentTime()
          if (progress > 0.1) {
            console.log('✅ Playback progress detected without PLAYING callback; restoring visuals')
            setIframeVisible(true)
            setIsLoading(false)
            hideBrandedOverlayAfterDelay(3500)
            clearPlaybackStartWatchdog()
            playbackRecoveryAttemptRef.current = 0
          }
        }

        setTimeout(recoverVisualPlaybackIfNeeded, 1500)
        setTimeout(recoverVisualPlaybackIfNeeded, 3200)

        // Some Safari/iOS reloads miss PLAYING callbacks; watchdog recovers once.
        clearPlaybackStartWatchdog()
        playbackStartWatchdogRef.current = setTimeout(() => {
          if (!mountedRef.current) return
          if (currentLoadAttemptRef.current !== loadAttemptId) return
          if (playerReadyRef.current && iframeVisibleRef.current) return

          const progress = getCurrentTime()
          if (progress > 0.1) {
            console.log('✅ Watchdog found active playback; restoring visuals without reload')
            setIframeVisible(true)
            setIsLoading(false)
            hideBrandedOverlayAfterDelay(3500)
            playbackRecoveryAttemptRef.current = 0
            clearPlaybackStartWatchdog()
            return
          }

          console.warn('⚠️ Startup watchdog fired: forcing one recovery reload')
          setShowStartScreen(false)
          setIsLoading(false)
          setShowBrandedOverlay(true)
          play()

          if (playbackRecoveryAttemptRef.current >= 1) {
            clearBrandedOverlayHideTimeout()
            setShowBrandedOverlay(false)
            setApiError('Playback is taking longer than expected. Please tap Refresh.')
            return
          }

          playbackRecoveryAttemptRef.current += 1

          // Hard reset stale iframe/API state before retrying the same channel.
          try {
            destroy()
          } catch (_) {}
          setIframeVisible(false)
          setPlayerReady(false)

          setTimeout(() => {
            if (!mountedRef.current) return
            if (currentLoadAttemptRef.current !== loadAttemptId) return
            loadChannel(channelId, {
              preferUnmutedStart: shouldStartUnmuted,
              isRecoveryRetry: true,
            })
          }, 900)
        }, 12000)
      }

      const onPlayerStateChange = (state: number) => {
        if (isStaleLoadAttempt()) return

        console.log('🎬 YouTube state changed:', state)
        playbackStateRef.current = state

        if (state === YT_STATE.ENDED) {
          console.log('📺 Video ended event received - playing next')
          setShowBrandedOverlay(true)
          setIsLoading(false)
          setShowStartScreen(false)
          if (videoEndTimeoutRef.current) {
            clearTimeout(videoEndTimeoutRef.current)
          }
          playNextVideoRef.current()
        } else if (state === YT_STATE.PLAYING) {
          console.log('▶️ Video is now playing')
          clearPlaybackStartWatchdog()
          playbackRecoveryAttemptRef.current = 0
          bufferingStartedAtRef.current = 0
          bufferingRecoveryStepRef.current = 0
          playbackProgressWatchTimeRef.current = getCurrentTime()
          playbackProgressWatchAtRef.current = Date.now()
          playEventsSinceLoadRef.current += 1

          // Keep the first/default clip muted until the active flow reaches the real stream.
          if (isIOS && initialStartFlowRef.current) {
            initialStartFlowRef.current = false
            iosAudioUnlockedRef.current = true
            unmuteAndResume(volume)
            setYouTubeMuted(false)
            setIsMuted(false)
            setIsVolumeControlsLocked(false)
          } else if (isIOS && reloadStartFlowRef.current) {
            reloadStartFlowRef.current = false
            iosAudioUnlockedRef.current = true
            unmuteAndResume(volume)
            setYouTubeMuted(false)
            setIsMuted(false)
            setIsVolumeControlsLocked(false)
          } else if (isAndroid && playEventsSinceLoadRef.current === 1) {
            // 🤖 Android: Auto-unmute on first PLAYING event (same as initial iOS flow)
            console.log('🤖 Android first PLAYING - auto-unmuting')
            unmuteAndResume(volume)
            setYouTubeMuted(false)
            setIsMuted(false)
            setIsVolumeControlsLocked(false)
          } else if (shouldStartUnmuted) {
            // Unmute on the first PLAYING event — don't wait for a second one,
            // since a correctly-resumed video (mid-position seekTo) may only
            // ever emit a single PLAYING event per load.
            if (!iosUnmuteRetryRef.current || getIsMuted()) {
              iosUnmuteRetryRef.current = true
              unmuteAndResume(volume)
              setYouTubeMuted(false)
              setIsMuted(false)
              setIsVolumeControlsLocked(false)

              if (getIsMuted()) {
                setTimeout(() => {
                  if (!mountedRef.current || isStaleLoadAttempt()) return
                  unmuteAndResume(volume)
                  setYouTubeMuted(false)
                  setIsMuted(false)
                  setIsVolumeControlsLocked(false)
                }, 220)
              }
            }
          }

          // Ensure UI reflects actual player mute status (fix iOS icon mismatch)
          try {
            if (!getIsMuted()) {
              setYouTubeMuted(false)
              setIsMuted(false)
              setIsVolumeControlsLocked(false)
              setShowAutoUnmuteNotification(false)
            } else if (shouldStartUnmuted) {
              // Still muted right after the unmute attempts above — but the
              // native unmute (e.g. the iOS Start-button gesture unlock) can
              // lag a beat behind the API call that requested it, so give it
              // a moment to actually take effect before concluding it's
              // stuck and surfacing the recovery prompt.
              setTimeout(() => {
                if (!mountedRef.current || isStaleLoadAttempt()) return
                if (getIsMuted()) {
                  setShowAutoUnmuteNotification(true)
                }
              }, 500)
            }
          } catch (_) {}

          setIsLoading(false)
          setIframeVisible(true)
          hideBrandedOverlayAfterDelay(3500)
        } else if (state === YT_STATE.PAUSED) {
          console.log('⏸️ Video paused - resuming')
          play()
          if (isIOS && shouldStartUnmuted && playEventsSinceLoadRef.current >= 2) {
            unmuteAndResume(volume)
            setYouTubeMuted(false)
            setIsMuted(false)
            setIsVolumeControlsLocked(false)
          }
        } else if (state === YT_STATE.BUFFERING) {
          console.log('⏳ Video buffering...')
          if (!bufferingStartedAtRef.current) {
            bufferingStartedAtRef.current = Date.now()
          }
        } else if (state === YT_STATE.CUED) {
          console.log('🎬 Video cued - playing')
          play()
        }
      }

      const onDurationChange = (duration: number) => {
        if (duration && duration > 0) {
          console.log('📏 Video duration:', duration)
          setVideoDuration(duration)
        }
      }

      const onPlayerError = (code: number, msg: string) => {
        if (isStaleLoadAttempt()) return
        console.error('Player error:', code, msg)
        clearChannelLoadTimeout()
        clearPlaybackStartWatchdog()
        clearBrandedOverlayHideTimeout()
        setShowBrandedOverlay(false)
        if (code === 2 || code === 5 || code === 100) {
          setApiError(`Playback error: ${msg}`)
          setIsLoading(false)
        } else {
          console.log('⚠️ Non-critical error, continuing playback')
          setIsLoading(false)
        }
      }

      if (isIOS && isPrimedRef.current) {
        if (isStaleLoadAttempt()) return
        // Reuse the already-primed iOS player instance to preserve audio unlock.
        setPlayerCallbacks({
          onStateChange: onPlayerStateChange,
          onDurationChange,
          onError: onPlayerError,
        })

        // Ensure transition mute is applied; real video will unmute only on PLAYING.
        try { muteForTransition(shouldStartUnmuted) } catch (_) {}
        const durationBeforeLoad = getDuration()
        const loaded = loadVideo(program.videoId, Math.floor(startTime))
        if (!loaded) {
          throw new Error('Failed to load video in primed iOS player')
        }

        // loadVideoById is async — the primed iframe hasn't swapped to the new
        // video yet, so seeking/playing immediately can target the still-loading
        // previous video and get silently dropped (playback stuck, not resuming
        // at the live position). Wait for the duration to change (a proxy for
        // "new video actually loaded") before seeking, with a bounded fallback
        // so we never hang forever.
        let readyCheckAttempt = 0
        const waitForPrimedVideoReady = () => {
          if (isStaleLoadAttempt()) return
          const currentDuration = getDuration()
          const videoSwapped = currentDuration > 0 && currentDuration !== durationBeforeLoad
          if (videoSwapped || readyCheckAttempt >= 20) {
            startPlayback()
            return
          }
          readyCheckAttempt += 1
          setTimeout(waitForPrimedVideoReady, 100)
        }
        waitForPrimedVideoReady()
      } else {
        if (isStaleLoadAttempt()) return
        await initializePlayer({
          videoId: program.videoId,
          startSeconds: Math.floor(startTime),
          volume: volume,
          muted: !shouldStartUnmutedOnAndroid,
          onReady: () => {
            startPlayback()
          },
          onStateChange: onPlayerStateChange,
          onDurationChange,
          onError: onPlayerError,
        })
      }
      
    } catch (error) {
      if (isStaleLoadAttempt()) return
      console.error('API call failed:', error)
      clearChannelLoadTimeout()
      clearPlaybackStartWatchdog()
      clearBrandedOverlayHideTimeout()
      setShowBrandedOverlay(false)
      setApiError(error instanceof Error ? error.message : 'Failed to load video')
      setIsLoading(false)
    }
  }, [volume, isIOS, isAndroid, initializePlayer, loadVideo, seekTo, play, setYouTubeVolume, setYouTubeMuted, onChannelChange, onStartClick, getDuration, getCurrentTime, getIsMuted, fetchFromBrowserAPI, notifyParentScheduleChange, isPrimedRef, setPlayerCallbacks, unmuteAndResume, destroy, clearPlaybackStartWatchdog, clearBrandedOverlayHideTimeout, hideBrandedOverlayAfterDelay, clearChannelLoadTimeout, primePlayer])

  const handleFirstTimeStart = useCallback(() => {
    if (startInProgressRef.current) return
    if (isLoadingRef.current) return

    // Once user presses Start, do not show Start screen again in this page session.
    hasPressedStartRef.current = true

    let unlockReady = true

    if (isIOS) {
      if (!iosPrimerReady || !isPrimedRef.current) {
        // Do not defer-start outside user gesture on iOS.
        // Keep start screen visible and ask for tap after primer is ready.
        setShowStartScreen(true)
        setIsLoading(false)
        clearBrandedOverlayHideTimeout()
        setShowBrandedOverlay(false)
        primePlayer()
        return
      }

      // Keep this synchronous in the tap event to satisfy iOS audio gesture rules.
      unlockReady = true
      iosAudioUnlockedRef.current = true
      initialStartFlowRef.current = true

      try {
        unmuteAndResume(volume)
        setYouTubeMuted(false)
        setIsMuted(false)
      } catch (_) {}
    }

    startInProgressRef.current = true

    const completeStartAttempt = () => {
      startInProgressRef.current = false
    }

    const refreshChannelListInBackground = async () => {
      // Channel metadata must not block the first playback start on iOS.
      let channels = getStoredApiChannels()

      if (channels.length === 0) {
        try {
          const live = await clientFetchWithAuth('https://api.deeniinfotech.com/api/tv-channels')
          if (live?.data?.length) {
            saveApiChannels(live.data)
            channels = live.data
          }
        } catch {
          // ignore
        }

        if (channels.length === 0) {
          try {
            const res = await fetch('/api/tv-channels')
            const json = await res.json()
            if (json?.data?.length) {
              saveApiChannels(json.data)
              channels = json.data
            }
          } catch {
            // ignore
          }
        }
      }

      if (channels.length > 0 && mountedRef.current) {
        setApiChannels(channels)
      }
    }

    void refreshChannelListInBackground()

    // Start playback first; do not wait for channel metadata APIs.
    if (!currentChannelId) {
      setShowChannelSelector(true)
      completeStartAttempt()
    } else {
      // Immediately hide the start screen and show the loading overlay
      setShowStartScreen(false)
      setIsLoading(true)
      loadChannel(currentChannelId, { preferUnmutedStart: unlockReady }).finally(() => {
        if (!mountedRef.current) return
        if (!playerReadyRef.current) {
          initialStartFlowRef.current = false
        }
        completeStartAttempt()
      })
    }
  }, [currentChannelId, iosPrimerReady, isIOS, isPrimedRef, loadChannel, primePlayer, unmuteAndResume, volume, clearBrandedOverlayHideTimeout])

  // iOS guard: never leave a blank/black frame while waiting for first visible frame.
  useEffect(() => {
    if (!isIOS) return
    if (showStartScreen || isLoading || apiError) return
    if (!playerReady) return
    if (iframeVisible) return
    if (showBrandedOverlay) return

    setShowBrandedOverlay(true)
  }, [isIOS, showStartScreen, isLoading, apiError, playerReady, iframeVisible, showBrandedOverlay])

  const handleSelectChannel = useCallback((channelId: string) => {
    setShowChannelSelector(false)

    // Keep muted during switch; real video will unmute on PLAYING.
    if (isIOS) {
      // Treat channel selection as a user gesture on iOS: unlock audio now
      iosAudioUnlockedRef.current = true
      reloadStartFlowRef.current = true
      try {
        unmuteAndResume(volume)
        setYouTubeMuted(false)
        setIsMuted(false)
      } catch (_) {}
    }

    // Keep UI muted until the new iframe is ready; the iOS flow above will
    // have already performed a synchronous unmute inside the gesture so the
    // player can remain audible once PLAYING fires.
    setIsVolumeControlsLocked(true)
    setIsMuted(true)
    setYouTubeMuted(true)
    hasAutoUnmutedRef.current = false
    loadChannel(channelId, { preferUnmutedStart: true })
  }, [isIOS, loadChannel, setYouTubeMuted])

  const handleOpenChannelSelector = useCallback(async () => {
    // First, show the modal with current channels
    setShowChannelSelector(true)

    // Then, try to refresh channels from API
    try {
      const res = await clientFetchWithAuth('https://api.deeniinfotech.com/api/tv-channels')
      if (res?.data?.length) {
        const freshChannels = res.data
        const storedChannels = getStoredApiChannels()

        // Check if there are differences
        const hasChanges = freshChannels.length !== storedChannels.length ||
          freshChannels.some((fresh: any, index: number) => {
            const stored = storedChannels[index]
            return !stored || fresh.id !== stored.id || fresh.title !== stored.title
          })

        if (hasChanges) {
          saveApiChannels(freshChannels)
          setApiChannels(freshChannels)
        }
      }
    } catch (error) {
      // Ignore API failure and keep stored channels
      console.error('Failed to refresh channels', error)
    }
  }, [])

  const syncWithServer = useCallback(async () => {
    if (!playerReady || !mountedRef.current || !currentChannelId) return
    
    try {
      console.log('🔄 Syncing with server (5-minute interval)...')

      // ── Ping our own server so we have a server-side timestamp for verifying the interval ──
      fetch('/api/sync-ping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelId: currentChannelId, source: 'browser-sync' })
      }).catch(() => {}) // fire-and-forget, don't block main sync
      
      // 1️⃣ Try external API directly from browser
      let result = await fetchFromBrowserAPI(currentChannelId)
      
      // 2️⃣ Fallback to local API route
      if (!result) {
        const response = await fetch(`/api/current-video?channel=${currentChannelId}`, {
          headers: { 'Cache-Control': 'no-cache' }
        })
        if (response.ok) {
          result = await parseJsonSafely(response)
        }
      }
      
      if (!result || !result.serverTime || !result.currentProgram) {
        result = buildEmbeddedScheduleFallback(currentChannelId)
      }
      
      // Update server time offset
      if (result.serverTime) {
        const offset = result.serverTime - Date.now()
        setServerTimeOffset(offset)
      }
      
      // ── Previous videos: always use localStorage order (real user history) ──
      const latestPrevious = getPreviousVideos(currentChannelId)
      if (latestPrevious.length > 0) {
        setPreviousVideos(latestPrevious)
      }
      
      // ── Upcoming queue: smart update — DO NOT blast the whole list every sync ──
      // Only update if:
      //   A) The server's current video differs from what's locally playing (drift), OR
      //   B) The local queue is empty (exhausted)
      // Otherwise leave the queue alone — it shifts naturally one-at-a-time via playNextVideo()
      if (result.upcomingPrograms && Array.isArray(result.upcomingPrograms)) {
        const apiCurrentId  = result.currentProgram?.ytVideoId
        const localCurrentId = currentProgramRef.current?.videoId
        // ── DRIFT DETECTION TEMPORARILY DISABLED ──
        // The drift logic forcefully replaces the current video when the API returns a
        // different ytVideoId. Re-enable when ready to allow mid-session resyncs.
        // Original condition: !!(apiCurrentId && localCurrentId && apiCurrentId !== localCurrentId)
        const hasDrifted    = false
        const queueEmpty    = upcomingVideosRef.current.length === 0

        // Helper: map + filter out the currently-playing video to prevent duplicates
        const mapAndFilter = () => {
          return result.upcomingPrograms
            .map((prog: { ytVideoId: string; title: string; duration: number }) => ({
              id: prog.ytVideoId,
              videoId: prog.ytVideoId,
              title: prog.title,
              description: prog.title,
              duration: prog.duration,
              category: 'Lecture',
              language: 'Bengali',
              channelId: currentChannelId,
              thumbnail: `https://img.youtube.com/vi/${prog.ytVideoId}/maxresdefault.jpg`
            }))
            .filter((p: VideoProgram) => p.videoId !== localCurrentId)
        }

        if (hasDrifted) {
          // Player has drifted from the broadcast schedule — hard-resync the current video
          console.log('⚠️ Player drifted from server schedule. Loading new current video and resyncing all sections...')

          // 1. Save the currently-playing video to previous history before replacing it
          if (currentProgramRef.current) {
            const updatedPrevious = addToPreviousVideos(currentChannelId, currentProgramRef.current)
            setPreviousVideos(updatedPrevious)
          }

          // 2. Build new current program object from API data
          const newCurrentProgram: VideoProgram = {
            id: apiCurrentId!,
            videoId: apiCurrentId!,
            title: result.currentProgram.title,
            description: result.currentProgram.title,
            duration: result.currentProgram.duration,
            category: 'Lecture',
            language: 'Bengali',
            channelId: currentChannelId,
            thumbnail: `https://img.youtube.com/vi/${apiCurrentId}/maxresdefault.jpg`
          }
          const seekOffset = result.currentProgram.seekTo || 0
          const remaining = result.currentProgram.duration - seekOffset

          // 3. Update all player state to reflect the new current program
          setCurrentProgram(newCurrentProgram)
          setCurrentTime(seekOffset)
          setDisplayTime(formatTime(seekOffset))
          setTimeRemaining(formatTime(remaining))
          setVideoDuration(newCurrentProgram.duration)
          lastVideoIdRef.current = apiCurrentId!

          // 4. Replace the iframe content immediately with the new video
          try { muteForTransition(true) } catch (_) {}
          const loaded = loadVideo(apiCurrentId!, seekOffset)
          if (loaded) {
            setTimeout(() => { play() }, 200)
          }

          // 5. Update upcoming queue — filter out the NEW current video to prevent duplicates
          const upcoming = result.upcomingPrograms
            .map((prog: { ytVideoId: string; title: string; duration: number }) => ({
              id: prog.ytVideoId,
              videoId: prog.ytVideoId,
              title: prog.title,
              description: prog.title,
              duration: prog.duration,
              category: 'Lecture',
              language: 'Bengali',
              channelId: currentChannelId,
              thumbnail: `https://img.youtube.com/vi/${prog.ytVideoId}/maxresdefault.jpg`
            }))
            .filter((p: VideoProgram) => p.videoId !== apiCurrentId)
          setUpcomingVideos(upcoming)
          if (upcoming[0]) setNextProgram(upcoming[0])

          // 6. Notify parent so schedule modal and current program indicator reflect new state
          notifyParentScheduleChange(newCurrentProgram, upcoming)
        } else if (queueEmpty) {
          // Local queue is exhausted — refill from API so playback can continue
          console.log('📋 Queue exhausted — refilling from server...')
          const upcoming = mapAndFilter()
          setUpcomingVideos(upcoming)
          if (upcoming[0]) setNextProgram(upcoming[0])
          // Notify parent about the queue refill
          if (currentProgramRef.current) {
            notifyParentScheduleChange(currentProgramRef.current, upcoming)
          }
        } else {
          // In sync: local current video matches API — refresh upcoming + notify on every tick.
          // We always refresh from the API so the schedule modal shows authoritative data.
          console.log('✅ In sync with server — refreshing upcoming queue and notifying parent')
          const upcoming = mapAndFilter()
          if (upcoming.length > 0) {
            // Only replace the queue if the API returned a non-empty list.
            // This prevents accidentally wiping a valid queue on a transient empty response.
            setUpcomingVideos(upcoming)
            if (upcoming[0]) setNextProgram(upcoming[0])
          }
          // Always notify parent so schedule modal is up-to-date
          if (currentProgramRef.current) {
            notifyParentScheduleChange(
              currentProgramRef.current,
              upcoming.length > 0 ? upcoming : upcomingVideosRef.current
            )
          }
        }
      }
      
    } catch (error) {
      console.error('Sync failed:', error)
    }
  }, [playerReady, currentChannelId, fetchFromBrowserAPI, notifyParentScheduleChange, loadVideo, play])

  const handleReload = useCallback(() => {
    if (!currentChannelId) return
    console.log('🔄 Reloading channel:', currentChannelId)
    onReloadStart?.()
    clearPlaybackStartWatchdog()
    clearBrandedOverlayHideTimeout()
    playbackRecoveryAttemptRef.current = 0

    const preferUnmutedStart = true

    if (isIOS) {
      iosAudioUnlockedRef.current = true
      reloadStartFlowRef.current = true

      try {
        unmuteAndResume(volume)
        setYouTubeMuted(false)
        setIsMuted(false)
      } catch (_) {}
    }
    
    // Save currently-playing video to history BEFORE reload so it appears in the list
    if (currentProgram) {
      const updated = addToPreviousVideos(currentChannelId, currentProgram)
      setPreviousVideos(updated)
    }

    // Keep UI in loading wrapper state during reload.
    setShowControls(false)
    setControlsVisible(false)
    setPlayerReady(false)
    setApiError(null)
    setIframeVisible(false) // hide iframe until next real PLAYING event
    setShowStartScreen(false)
    setIsLoading(true)
    setShowBrandedOverlay(false)
    setShowProgramOverlay(false)
    setShowChannelSelector(false)
    setShowPreviousModal(false)
    setIsVolumeControlsLocked(true)

    // Preserve iOS player instance to keep gesture-unlocked audio context.
    if (!isIOS) {
      // Reset player state only on non-iOS — do NOT touch previousVideos or localStorage
      destroy()
      setCurrentProgram(null)
    }

    // Keep muted during reload; real video will unmute on PLAYING.
    setIsMuted(true)
    setYouTubeMuted(true)
    setShowAutoUnmuteNotification(false)
    hasAutoUnmutedRef.current = false

    // Reload same channel immediately; iOS keeps wrapper flow without Start screen.
    loadChannel(currentChannelId, { preferUnmutedStart })
  }, [currentChannelId, currentProgram, isIOS, loadChannel, setYouTubeMuted, setIsMuted, unmuteAndResume, volume, destroy, clearPlaybackStartWatchdog, clearBrandedOverlayHideTimeout])

  // Auto-start on web/android once a channel has been explicitly selected
  // (first-time users must pick a language/channel first). iOS waits for
  // explicit Start button click. Uses initialChannelId (not currentChannelId,
  // which defaults to CHANNELS[0].id before any selection is made) so the
  // channel actually chosen by the user is the one that gets loaded.
  useEffect(() => {
    if (!isPlatformReady) return
    if (isIOS) return
    if (!hasUserSelectedChannel) return
    if (!initialChannelId) return
    if (showStartScreen) return
    if (playerReady || isLoading || currentProgram || apiError) return

    loadChannel(initialChannelId, { preferUnmutedStart: true })
  }, [isPlatformReady, isIOS, hasUserSelectedChannel, initialChannelId, showStartScreen, playerReady, isLoading, currentProgram, apiError, loadChannel])

  // Trigger reload when parent increments the counter (e.g. Reload menu option)
  useEffect(() => {
    if (triggerReload > 0) {
      handleReload()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [triggerReload])

  // Handle playing from previous videos
  const handlePlayFromPrevious = useCallback((video: VideoProgram) => {
    if (!currentChannelId || !playerReady || isTransitioningRef.current) return
    
    isTransitioningRef.current = true
    
    console.log('▶️ Playing from previous list:', video.title)
    
    brandedOverlayProgramRef.current = video.title
    setShowBrandedOverlay(true)
    
    // Add current video to previous before switching
    if (currentProgram) {
      addToPreviousVideos(currentChannelId, currentProgram)
    }
    
    // Update state
    setCurrentProgram(video)
    setCurrentTime(0)
    setDisplayTime(formatTime(0))
    setVideoDuration(video.duration)
    
    // Find next program
    const programs = getChannelPrograms(currentChannelId)
    const currentIndex = programs.findIndex(p => p.id === video.id)
    const nextIndex = (currentIndex + 1) % programs.length
    setNextProgram(programs[nextIndex])
    
    // Update upcoming
    const upcoming: VideoProgram[] = []
    for (let i = 1; i <= 15; i++) {
      upcoming.push(programs[(currentIndex + i) % programs.length])
    }
    setUpcomingVideos(upcoming)
    
    // Update cycle info
    setCycleInfo({ current: currentIndex + 1, total: programs.length })
    
    // Load and play
    lastVideoIdRef.current = video.videoId
    try { muteForTransition(true) } catch (_) {}
    loadVideo(video.videoId, 0)
    
    setTimeout(() => {
      play()
      isTransitioningRef.current = false
    }, 200)
    
  }, [currentChannelId, playerReady, currentProgram, loadVideo, play])

  // Fullscreen handlers
  const handleFullscreen = async () => {
    if (!playerRef.current) return
    
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen()
        setIsFullscreen(false)
      } else {
        await playerRef.current.requestFullscreen()
        setIsFullscreen(true)
      }
    } catch (err) {
      console.error('Fullscreen error:', err)
    }
  }

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }
    
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  // Time update interval - runs every 100ms for smooth display
  useEffect(() => {
    if (!playerReady || !currentProgram || isTransitioningRef.current) return
    
    timeUpdateIntervalRef.current = setInterval(() => {
      updateTimeDisplay()
    }, 100)
    
    return () => {
      if (timeUpdateIntervalRef.current) {
        clearInterval(timeUpdateIntervalRef.current)
      }
    }
  }, [playerReady, currentProgram, updateTimeDisplay, isTransitioningRef.current])

  // Recover from silent iOS/WebKit stalls by forcing resume when progress freezes.
  useEffect(() => {
    if (!playerReady || !currentProgram || isLoading || showStartScreen || !!apiError) return
    if (!currentChannelId) return

    const stallTimer = setInterval(() => {
      if (!mountedRef.current || isTransitioningRef.current) return

      const now = Date.now()
      const current = getCurrentTime()
      const duration = getDuration()

      if (!Number.isFinite(current) || current < 0) return

      // Near-end transitions are already handled by playNextVideo logic.
      if (duration > 0 && duration - current < 1.5) return

      if (current > playbackProgressWatchTimeRef.current + 0.35) {
        playbackProgressWatchTimeRef.current = current
        playbackProgressWatchAtRef.current = now
        if (playbackStateRef.current === YT_STATE.PLAYING) {
          bufferingStartedAtRef.current = 0
          bufferingRecoveryStepRef.current = 0
        }
        return
      }

      if (!playbackProgressWatchAtRef.current) {
        playbackProgressWatchAtRef.current = now
        return
      }

      const stalledFor = now - playbackProgressWatchAtRef.current
      const isBuffering = playbackStateRef.current === YT_STATE.BUFFERING

      if (isBuffering && !bufferingStartedAtRef.current) {
        bufferingStartedAtRef.current = now
      }

      const bufferingFor = bufferingStartedAtRef.current
        ? now - bufferingStartedAtRef.current
        : 0

      if (stalledFor < 6000 && bufferingFor < 6000) return

      if (bufferingRecoveryStepRef.current === 0) {
        console.warn('⚠️ Playback stall detected, forcing resume')
        play()

        if (isIOS) {
          unmuteAndResume(volume)
          setYouTubeMuted(false)
          setIsMuted(false)
        }

        bufferingRecoveryStepRef.current = 1
        playbackProgressWatchAtRef.current = now
        return
      }

      if (
        bufferingRecoveryStepRef.current === 1 &&
        (stalledFor >= 10000 || bufferingFor >= 9500)
      ) {
        console.warn('⚠️ Stall persists, applying small seek nudge')

        const nudgedTo = Math.max(0, current + 0.6)
        seekTo(nudgedTo, true)
        play()

        if (isIOS) {
          unmuteAndResume(volume)
          setYouTubeMuted(false)
          setIsMuted(false)
        }

        bufferingRecoveryStepRef.current = 2
        playbackProgressWatchAtRef.current = now
        return
      }

      if (
        bufferingRecoveryStepRef.current >= 2 &&
        (stalledFor >= 17000 || bufferingFor >= 16000)
      ) {
        // Cooldown avoids hard-reload loops on unstable networks.
        if (now - lastHardRecoveryAtRef.current < 25000) {
          playbackProgressWatchAtRef.current = now
          return
        }

        console.warn('⚠️ Stall persists after soft recovery, reloading current channel')
        lastHardRecoveryAtRef.current = now
        bufferingRecoveryStepRef.current = 0
        bufferingStartedAtRef.current = 0
        playbackProgressWatchAtRef.current = now
        setShowBrandedOverlay(true)
        loadChannel(currentChannelId, { preferUnmutedStart: true, isRecoveryRetry: true })
      }
    }, 1500)

    return () => clearInterval(stallTimer)
  }, [
    apiError,
    currentChannelId,
    currentProgram,
    getCurrentTime,
    getDuration,
    isIOS,
    isLoading,
    loadChannel,
    play,
    playerReady,
    seekTo,
    showStartScreen,
    unmuteAndResume,
    volume,
    setYouTubeMuted,
  ])

  // 1-minute sync interval
  useEffect(() => {
    if (!playerReady) return    
    if (syncIntervalRef.current) {
      clearInterval(syncIntervalRef.current)
    }    
    syncIntervalRef.current = setInterval(() => {
      syncWithServer()
    }, 60000) // 1 minute     
    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current)
      }
    }
  }, [playerReady, syncWithServer])

  // Program Overlay - Shows every 2-3 minutes for a few seconds
  useEffect(() => {
    if (!playerReady || !currentProgram || showStartScreen) return
    
    // Show overlay every 2.5 minutes (150 seconds)
    const overlayInterval = setInterval(() => {
      setShowProgramOverlay(true)
      // Hide after 8-10 seconds
      const hideDelay = 8000 + Math.random() * 2000 // Random 8-10 seconds
      setTimeout(() => {
        setShowProgramOverlay(false)
      }, hideDelay)
    }, 150000) // 2.5 minutes
    
    // Show initial overlay after 10 seconds
    const initialTimeout = setTimeout(() => {
      setShowProgramOverlay(true)
      // Hide after 8-10 seconds
      const hideDelay = 8000 + Math.random() * 2000 // Random 8-10 seconds
      setTimeout(() => {
        setShowProgramOverlay(false)
      }, hideDelay)
    }, 10000)
    
    return () => {
      clearInterval(overlayInterval)
      clearTimeout(initialTimeout)
    }
  }, [playerReady, currentProgram, showStartScreen])

  // Cleanup
  useEffect(() => {
    mountedRef.current = true
    
    return () => {
      mountedRef.current = false
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current)
      }
      if (timeUpdateIntervalRef.current) {
        clearInterval(timeUpdateIntervalRef.current)
      }
      if (videoEndTimeoutRef.current) {
        clearTimeout(videoEndTimeoutRef.current)
      }
      if (volumeHideTimeoutRef.current) {
        clearTimeout(volumeHideTimeoutRef.current)
      }
      if (autoUnmuteTimerRef.current) {
        clearTimeout(autoUnmuteTimerRef.current)
      }
      if (brandedOverlayHideTimeoutRef.current) {
        clearTimeout(brandedOverlayHideTimeoutRef.current)
      }
      if (channelLoadTimeoutRef.current) {
        clearTimeout(channelLoadTimeoutRef.current)
      }
      if (playbackStartWatchdogRef.current) {
        clearTimeout(playbackStartWatchdogRef.current)
      }
    }
  }, [])

  const toggleMute = useCallback(() => {
    // Prevent muting/unmuting until the real scheduled video is playing
    if (isVolumeControlsLocked) return

    setIsMuted(prev => {
      const newMuted = !prev
      setYouTubeMuted(newMuted)
      if (!newMuted) {
        setYouTubeVolume(volume)
        setShowAutoUnmuteNotification(false)
      }
      return newMuted
    })
  }, [volume, setYouTubeMuted, setYouTubeVolume, isVolumeControlsLocked])

  const handleVolumeChange = useCallback((value: number[]) => {
    // Prevent volume changes until the real scheduled video is playing
    if (isVolumeControlsLocked) return

    const newVolume = value[0] ?? 0
    setVolume(newVolume)
    setYouTubeVolume(newVolume)

    if (newVolume === 0) {
      setIsMuted(true)
      setYouTubeMuted(true)
      return
    }

    if (isMuted) {
      setIsMuted(false)
      setYouTubeMuted(false)
    }
  }, [isMuted, setYouTubeMuted, setYouTubeVolume, isVolumeControlsLocked])

  const handleDesktopVolumeMouseEnter = useCallback(() => {
    if (isVolumeControlsLocked) return
    if (isMobile) return
    if (volumeHideTimeoutRef.current) {
      clearTimeout(volumeHideTimeoutRef.current)
      volumeHideTimeoutRef.current = null
    }
    setShowVolumeSlider(true)
  }, [isMobile, isVolumeControlsLocked])

  const handleDesktopVolumeMouseLeave = useCallback(() => {
    if (isVolumeControlsLocked) return
    if (isMobile) return
    if (volumeHideTimeoutRef.current) {
      clearTimeout(volumeHideTimeoutRef.current)
    }
    volumeHideTimeoutRef.current = setTimeout(() => {
      setShowVolumeSlider(false)
    }, 120)
  }, [isMobile, isVolumeControlsLocked])

  const handleActivity = useCallback(() => {
    if (showStartScreenRef.current || isLoadingRef.current || !!apiErrorRef.current) return

    setControlsVisible(true)
    setShowControls(true)
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current)
    controlsTimeoutRef.current = setTimeout(() => {
      setControlsVisible(false)
      setShowControls(false)
    }, 3000)
  }, [])

  useEffect(() => {
    if (showStartScreen || isLoading || !!apiError) return

    const el = playerRef.current
    if (el) {
      el.addEventListener('mousemove', handleActivity)
      el.addEventListener('touchstart', handleActivity)
      return () => {
        el.removeEventListener('mousemove', handleActivity)
        el.removeEventListener('touchstart', handleActivity)
      }
    }
  }, [handleActivity, showStartScreen, isLoading, apiError])

  const isLastInCycle = currentProgram && cycleInfo.total ? cycleInfo.current === cycleInfo.total : false

  return (
    <div className="relative flex items-center justify-center bg-gradient-to-br from-zinc-950 via-zinc-900 to-black min-h-screen w-full overflow-hidden" suppressHydrationWarning>
      <div className={`relative w-full ${
        isDesktop ? 'md:w-[70vw] md:max-w-[1400px]' :
        isTablet ? 'w-[90vw]' :
        'w-full'
      }`}>
        <div 
          ref={playerRef}
          className={`relative w-full aspect-video bg-black/50 backdrop-blur-sm overflow-hidden shadow-2xl border border-white/10 border-b-0 transition-all duration-300 rounded-t-2xl md:rounded-t-3xl rounded-b-none
          }`}
        >
          {/* YouTube iframe container — stays opacity:0 until the real video fires
              its first PLAYING event (iframeVisible).  This hides the primer video
              AND the brief blank iframe during player init.  Subsequent video
              transitions are covered by BrandedLoadingOverlay instead. */}
          <div
            ref={youtubeContainerRef}
            className="absolute inset-0 w-full h-full"
            style={{ opacity: iframeVisible ? 1 : 0 }}
          />
          <div className="absolute inset-0 w-full h-full pointer-events-auto" />
          
          {/* Branded Loading Overlay - Shows during YouTube loading, hides on PLAYING event */}
          <BrandedLoadingOverlay
            isVisible={showBrandedOverlay && !showStartScreen && !isLoading}
            programName={brandedOverlayProgramRef.current || currentProgram?.title || ''}
          />
          
          {/* START SCREEN */}
          {showStartScreen && !isLoading && !apiError && (
            <StartScreen
              onPlayClick={handleFirstTimeStart}
              isStartDisabled={isIOS && !iosPrimerReady}
              allowScreenTapStart={false}
              buttonLabel={isIOS ? 'Start Watching' : 'Start Watching'}
              helperText={
                isIOS
                  ? (iosPrimerReady
                    ? 'Tap Start Watching to start with audio'
                    : 'Preparing secure iOS playback... please wait 1-2 seconds')
                  : 'Click to start your spiritual journey'
              }
            />
          )}

          {/* Auto-Unmute Notification */}
          <AutoUnmuteNotification
            isVisible={showAutoUnmuteNotification && !showStartScreen && playerReady && !apiError}
            onUnmute={() => {
              unmuteAndResume(volume)
              setYouTubeMuted(false)
              setIsMuted(false)
              setIsVolumeControlsLocked(false)
              setShowAutoUnmuteNotification(false)
            }}
          />
          
          {/* Loading overlay */}
          {isLoading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex items-center justify-center bg-black/90 backdrop-blur-xl z-40 p-4"
            >
              <div className="text-center w-full max-w-xs mx-auto px-4 sm:px-6">
                <div className={`relative flex items-center justify-center mb-6 ${
                  isMobile ? 'w-20 h-20' : 'w-24 h-24'
                } mx-auto`}>
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                    className="relative flex items-center justify-center w-full h-full"
                  >
                    <div className="absolute inset-0 rounded-full border-4 border-primary/30" />
                    <div className="absolute inset-0 rounded-full border-t-4 border-primary animate-spin" />
                    <motion.div
                      animate={{ scale: [1, 1.1, 1] }}
                      transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                      className="relative flex items-center justify-center"
                    >
                      <Tv className={`${isMobile ? 'h-10 w-10' : 'h-12 w-12'} text-primary relative z-10`} />
                    </motion.div>
                    <motion.div
                      animate={{ y: ['-100%', '200%'] }}
                      transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                      className="absolute inset-0 w-full h-1 bg-gradient-to-r from-transparent via-primary/30 to-transparent blur-sm pointer-events-none"
                    />
                  </motion.div>
                </div>
                
                <motion.p 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className={`text-white ${isMobile ? 'text-base' : 'text-lg'} mb-2 font-medium`}
                >
                  Tuning into your broadcast...
                </motion.p>
                
                <motion.p 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className={`text-white/60 ${isMobile ? 'text-xs' : 'text-sm'}`}
                >
                  Please wait while we connect
                </motion.p>

                <motion.div 
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="mt-6 h-1 w-48 bg-primary/20 rounded-full overflow-hidden mx-auto"
                >
                  <motion.div
                    animate={{ x: ['-100%', '100%'] }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                    className="h-full w-full bg-gradient-to-r from-transparent via-primary to-transparent"
                  />
                </motion.div>
              </div>
            </motion.div>
          )}
          
          {/* Error overlay */}
          {apiError && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex items-center justify-center bg-black/90 backdrop-blur-xl z-40"
            >
              <motion.div 
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                className="text-center max-w-md px-6"
              >
                <motion.div
                  animate={{ 
                    scale: [1, 1.1, 1],
                    rotate: [0, 5, -5, 0],
                  }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="mb-6"
                >
                  <AlertCircle className="h-20 w-20 text-red-500 mx-auto" />
                </motion.div>
                <h3 className="text-white text-xl font-bold mb-2">Failed to Load</h3>
                <p className="text-white/60 text-sm mb-6">{apiError}</p>
                <div className="flex gap-3 justify-center">
                  <Button onClick={handleReload} className="bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90 text-white rounded-full px-6 py-3">
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Try Again
                  </Button>
                  <Button onClick={handleOpenChannelSelector} variant="outline" className="border-white/20 text-white hover:bg-white/10 rounded-full px-6 py-3">
                    Change Channel
                  </Button>
                </div>
              </motion.div>
            </motion.div>
          )}

          {/* Player UI */}
          {!showStartScreen && !isLoading && !apiError && playerReady && currentProgram && (
            <>
              {/* Top-right remaining timer only */}
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="absolute top-3 right-3 z-30"
              >
                <div className={`flex items-center gap-1.5 bg-black/70 backdrop-blur-xl rounded-full border border-white/20 ${
                  isMobile ? 'px-2.5 py-1' : 'px-3 py-1.5'
                }`}>
                  <Clock className={isMobile ? 'h-3 w-3 text-white/80' : 'h-3.5 w-3.5 text-white/80'} />
                  <span className={`font-mono tabular-nums text-white ${isMobile ? 'text-[11px]' : 'text-xs'} font-semibold`}>
                    {timeRemaining || '0:00'}
                  </span>
                </div>
              </motion.div>

              {/* TOP LEFT SECTION - Deeni.tv Logo */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
                className="absolute top-4 left-4 z-30 flex items-center gap-3"
              >
              </motion.div>
              
              {/* Program Overlay - Shows every 2-3 minutes */}
          <ProgramOverlay
            currentProgram={currentProgram}
            nextProgram={nextProgram}
            isVisible={showProgramOverlay}
            isMobile={isMobile}
          />

              {/* BOTTOM TICKER - Commented out per requirements */}
              {false && showTicker && (
                <motion.div
                  initial={{ y: 100 }}
                  animate={{ y: 0 }}
                  transition={{ type: "spring", damping: 20, delay: 0.1 }}
                  className="absolute bottom-0 left-0 right-0 z-30"
                >
                  <div className={`relative overflow-hidden bg-gradient-to-r from-black/95 via-black/90 to-black/95 backdrop-blur-xl border-t border-white/10 ${
                    isMobile ? 'h-10' : 'h-20'
                  }`}>
                    <div className="relative h-full flex items-center px-2 md:px-4">
                      <div className="flex items-center gap-2 md:gap-4 flex-shrink-0">
        </div>

                      {!isMobile && (
                        <>
                          <div className="flex-1 min-w-0 overflow-hidden mx-4">
                            <DesktopTicker 
                              key={currentProgram?.id}
                              videos={upcomingVideos} 
                              currentIndex={cycleInfo.current - 1}
                              totalPrograms={cycleInfo.total}
                              currentProgramId={currentProgram?.id ?? ''}
                            />
                          </div>
                          
                          <div className="flex items-center gap-3 flex-shrink-0">
                            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 backdrop-blur-sm rounded-lg border border-white/20">
                              <Clock className="h-3.5 w-3.5 text-primary" />
                              <span className="text-white font-black text-xs whitespace-nowrap">
                                {displayTime} / {formatTime(videoDuration)}
                              </span>
                            </div>
                            
                            {timeRemaining && (
                              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 backdrop-blur-sm rounded-lg border border-white/20">
                                <Hourglass className="h-3.5 w-3.5 text-primary" />
                                <span className="text-primary font-black text-xs whitespace-nowrap">
                                  {timeRemaining}
                                </span>
                              </div>
                            )}
                          </div>
                        </>
                      )}
                      
                      {isMobile && (
                        <>
                          <div className="flex-1 min-w-0 overflow-hidden ml-1">
                            <MobileTicker 
                              key={currentProgram?.id}
                              videos={upcomingVideos} 
                              currentIndex={cycleInfo.current - 1}
                              totalPrograms={cycleInfo.total}
                              currentProgramId={currentProgram?.id ?? ''}
                            />
                          </div>
                          
                          <div className="flex items-center gap-0 ml-1 flex-shrink-0">
                            <div className="flex items-center gap-0.5 px-1 py-0.5 bg-black/70 backdrop-blur-sm rounded-l border border-white/20">
                              <Clock className="h-2 w-2 text-primary" />
                              <span className="text-white font-black text-[7px] whitespace-nowrap">
                                {displayTime}
                              </span>
                            </div>
                            {nextProgram && (
                              <div className="flex items-center gap-0.5 px-1 py-0.5 bg-yellow-500/20 backdrop-blur-sm rounded-r border border-yellow-500/30 border-l-0">
                                <ArrowRight className="h-2 w-2 text-yellow-300" />
                                <span className="text-yellow-300 font-black text-[7px] whitespace-nowrap">
                                  {formatTime(nextProgram?.duration ?? 0)}
                                </span>
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </>
          )}
        </div>

        {/* Bottom Controls - OUTSIDE video frame - ALWAYS VISIBLE - Unified with iframe */}
        <div className="w-full">
          <div className="bg-black/60 backdrop-blur-xl border border-white/10 border-t-0 rounded-b-2xl md:rounded-b-3xl px-6 py-4">
            <div className="flex items-center justify-between gap-2 md:gap-4">
                    {/* Logo Section - Replaces sound bar */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <img 
                  src="/DeeniTV-V-2.png" 
                  alt="Deeni.tv"
                  className={isMobile ? 'h-5' : 'h-7'}
                />
              </div>

                    {/* Action Buttons - Order: Schedule, History, Channel, Refresh, Menu */}
              <div className="flex items-center gap-1 md:gap-1.5">
<div
  className="flex items-center"
  onMouseEnter={handleDesktopVolumeMouseEnter}
  onMouseLeave={handleDesktopVolumeMouseLeave}
>
  <motion.div
    whileHover={{ scale: isVolumeControlsLocked ? 1 : 1.08 }}
    whileTap={{ scale: isVolumeControlsLocked ? 1 : 0.95 }}
    animate={{ x: !isMobile && showVolumeSlider ? -6 : 0 }}
    transition={{ duration: 0.18, ease: 'easeOut' }}
  >
    <Button
      variant="ghost"
      size="icon"
      onClick={() => !isVolumeControlsLocked && toggleMute()}
      className={`text-white/90 hover:text-white hover:bg-white/20 rounded-full backdrop-blur-sm border bg-white/10 border-white/20 ${
        isVolumeControlsLocked ? 'pointer-events-none' : ''
      } ${
        isMobile ? 'h-7 w-7' : 'h-9 w-9'
      }`}
      title={isVolumeControlsLocked ? 'Volume becomes available after the real video starts' : isMuted ? 'Unmute' : 'Mute'}
    >
      {isMuted ? (
        <VolumeX className={isMobile ? 'h-3.5 w-3.5' : 'h-4.5 w-4.5'} />
      ) : (
        <Volume2 className={isMobile ? 'h-3.5 w-3.5' : 'h-4.5 w-4.5'} />
      )}
    </Button>
  </motion.div>

  {!isMobile && (
    <div
      className={`flex items-center justify-start overflow-visible transition-all duration-200 origin-left ${
        showVolumeSlider && !isVolumeControlsLocked ? 'w-28 opacity-100 ml-2 scale-x-100' : 'w-0 opacity-0 ml-0 scale-x-90'
      }`}
    >
      <Slider
        value={[isMuted ? 0 : volume]}
        onValueChange={handleVolumeChange}
        max={100}
        step={1}
        className="w-full py-2 [&_[data-slot=slider-track]]:h-1 [&_[data-slot=slider-track]]:rounded-full [&_[data-slot=slider-track]]:bg-white/35 [&_[data-slot=slider-range]]:bg-red-600 [&_[data-slot=slider-thumb]]:block [&_[data-slot=slider-thumb]]:size-3 [&_[data-slot=slider-thumb]]:rounded-full [&_[data-slot=slider-thumb]]:border-0 [&_[data-slot=slider-thumb]]:bg-white [&_[data-slot=slider-thumb]]:shadow-[0_0_0_2px_rgba(0,0,0,0.3)] [&_[data-slot=slider-thumb]]:hover:scale-110 [&_[data-slot=slider-thumb]]:transition-transform [&_[data-slot=slider-thumb]]:cursor-pointer [&_[data-slot=slider-track]]:cursor-pointer"
      />
    </div>
  )}
</div>

                {hasMounted && [
                  { icon: Calendar, onClick: () => onOpenSchedule?.(), title: "Programs Schedule" },
                  { icon: History, onClick: () => setShowPreviousModal(true), title: 'Watched Program' },
                  { icon: Globe, onClick: () => handleOpenChannelSelector(), title: 'Channel' },
                  { icon: RefreshCw, onClick: handleReload, title: 'Refresh' },
                  { icon: MoreHorizontal, onClick: onMenuOpen, title: 'Menu' },
                ].map((item, index) => (
                  <motion.div
                    key={index}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={item.onClick}
                      className={`text-white/90 hover:text-white hover:bg-white/20 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 ${
                        isMobile ? 'h-7 w-7' : 'h-9 w-9'
                      }`}
                      title={item.title}
                    >
                      <item.icon className={isMobile ? 'h-3.5 w-3.5' : 'h-4.5 w-4.5'} />
                    </Button>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Channel Selector Modal */}
      <ChannelSelectorModal
        isOpen={showChannelSelector}
        onClose={() => { setShowChannelSelector(false); onChannelSelectorModalClose?.() }}
        channels={apiChannels}
        onSelectChannel={handleSelectChannel}
        currentChannelId={currentChannelId}
      />

      {/* Previous Videos Modal - Mute main player when watching, unmute when done */}
      <PreviousVideosModal
        isOpen={showPreviousModal}
        onClose={() => {
          setShowPreviousModal(false)
          onHistoryModalClose?.()
        }}
        videos={previousVideos}
        onPlayVideo={handlePlayFromPrevious}
        currentChannelId={currentChannelId}
        onPauseMainPlayer={() => {
          // MUTE main player when watching from history (don't destroy)
          setYouTubeMuted(true)
          setIsMuted(true)
        }}
        onResumeMainPlayer={() => {
          // UNMUTE main player when history video closes
          setYouTubeMuted(false)
          setIsMuted(false)
          // Do NOT close the Previous Programs modal - it stays open
          // Do NOT reload or restart the live TV
        }}
      />
    </div>
  )
}