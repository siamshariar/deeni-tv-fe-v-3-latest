'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { X, Calendar, History, Globe, RefreshCw, Info, Heart, ExternalLink, BookOpen, Smartphone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useMediaQuery } from '@/hooks/use-media-query'

export type MenuOption = 'schedule' | 'history' | 'language' | 'reload' | 'about' | 'donate'

interface MenuDrawerProps {
  isOpen: boolean
  onClose: () => void
  onSelectOption: (option: MenuOption) => void
}

const mainItems: { id: MenuOption; label: string; icon: React.ElementType }[] = [
  { id: 'schedule', label: "Programs Schedule", icon: Calendar },
  { id: 'history', label: 'Watched Program', icon: History },
  { id: 'language', label: 'Channel', icon: Globe },
  { id: 'reload', label: 'Refresh', icon: RefreshCw },
]

const bottomItems: { id: MenuOption; label: string; icon: React.ElementType }[] = [
  { id: 'about', label: 'About', icon: Info },
  { id: 'donate', label: 'Donate', icon: Heart },
]

export function MenuDrawer({ isOpen, onClose, onSelectOption }: MenuDrawerProps) {
  const isMobile = useMediaQuery('(max-width: 640px)')

  const handleSelect = (id: MenuOption) => {
    onSelectOption(id)
    onClose()
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/80 backdrop-blur-md z-50"
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 bottom-0 w-[88%] max-w-sm bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-950 border-l border-white/10 z-50 shadow-2xl"
          >
            <div className="flex flex-col h-full">
              {/* Header */}
              <div className="flex shrink-0 items-center justify-between px-4 py-3 md:p-6 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <img
                    src="/DeeniTV-V-2.png"
                    alt="Deeni.tv"
                    className={isMobile ? 'h-5' : 'h-6'}
                  />
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onClose}
                  className="text-white/60 hover:text-white hover:bg-white/10 rounded-xl h-10 w-10"
                  aria-label="Close menu"
                >
                  <X className={isMobile ? 'h-6 w-6' : 'h-5 w-5'} />
                </Button>
              </div>

              {/* Everything below the header scrolls as one area. min-h-0 lets the
                  flex child shrink and scroll — without it the list overflowed into
                  the About/Donate section on short screens (iPhone 7, rotated
                  fullscreen) and could not be scrolled. */}
              <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain touch-pan-y">
              <div className="flex min-h-full flex-col">
              {/* Main Menu Items */}
              <div className="p-3 md:p-4">
                <div className="space-y-2">
                  {mainItems.map((item) => {
                    const Icon = item.icon
                    return (
                      <button
                        key={item.id}
                        onClick={() => handleSelect(item.id)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 md:gap-4 md:p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-primary/30 transition-all text-left group"
                      >
                        <div className="p-1.5 md:p-2 rounded-lg bg-primary/20 text-primary group-hover:bg-primary/30 transition-colors flex-shrink-0">
                          <Icon className="h-4 w-4 md:h-5 md:w-5" />
                        </div>
                        <span className="text-white text-sm md:text-base font-medium">{item.label}</span>
                      </button>
                    )
                  })}
                </div>

                {/* Our Apps Section */}
                {/* <div className="mt-4 pt-4 border-t border-white/10">
                  <p className="text-white/40 text-xs font-medium uppercase tracking-wider mb-3 px-1">Our Apps & Links</p>
                  <div className="space-y-2">
                    {[
                      { label: 'Quran Bangla (VN)', url: 'https://play.google.com/store/apps/details?id=com.deeniinfotech.qurantube', icon: BookOpen },
                      { label: 'Deeni TV App', url: 'https://play.google.com/store/apps/details?id=com.deeniinfotech.deenitv', icon: Smartphone },
                      { label: 'Dr. Abdullah Jahangir', url: 'https://www.abdullahjahangir.com', icon: ExternalLink },
                      { label: 'Deeni Info Tech', url: 'https://www.deeniinfotech.com', icon: ExternalLink },
                    ].map((app) => {
                      const Icon = app.icon
                      return (
                        <a
                          key={app.label}
                          href={app.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full flex items-center gap-4 p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-primary/30 transition-all text-left group"
                        >
                          <div className="p-1.5 rounded-lg bg-white/10 text-white/60 group-hover:bg-primary/20 group-hover:text-primary transition-colors flex-shrink-0">
                            <Icon className="h-4 w-4" />
                          </div>
                          <span className="text-white/80 text-sm font-medium group-hover:text-white transition-colors">{app.label}</span>
                          <ExternalLink className="h-3 w-3 text-white/30 ml-auto flex-shrink-0" />
                        </a>
                      )
                    })}
                  </div>
                </div> */}
              </div>

              {/* Bottom Items — About (second last) + Donate (last); pushed to the
                  bottom when there's room, scrolled into view when there isn't */}
              <div className="mt-auto p-3 md:p-4 border-t border-white/10 space-y-2">
                {bottomItems.map((item) => {
                  const Icon = item.icon
                  const isDonate = item.id === 'donate'
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleSelect(item.id)}
                      className="w-full flex items-center bg-white/5 hover:bg-white/10 border border-white/10 hover:border-primary/30 gap-3 px-3 py-2.5 md:gap-4 md:p-4 rounded-xl transition-all text-left group"
                    >
                      <div className="p-1.5 md:p-2 rounded-lg bg-primary/20 text-primary group-hover:bg-primary/30 transition-colors flex-shrink-0">
                        <Icon className="h-4 w-4 md:h-5 md:w-5" />
                      </div>
                      <span className={`text-sm md:text-base font-medium ${isDonate ? '' : 'text-white'}`}>
                        {item.label}
                      </span>
                    </button>
                  )
                })}
              </div>
              </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
