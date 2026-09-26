'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Globe, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ApiChannel } from '@/lib/schedule-utils'
import { useMediaQuery } from '@/hooks/use-media-query'

interface ChannelSelectorProps {
  isOpen: boolean
  onClose: () => void
  channels: ApiChannel[]
  onSelectChannel: (channelId: string) => void
  currentChannelId?: string
  isFirstTime?: boolean
}

export function ChannelSelector({
  isOpen,
  onClose,
  channels,
  onSelectChannel,
  currentChannelId,
  isFirstTime = false,
}: ChannelSelectorProps) {
  const isMobile = useMediaQuery('(max-width: 640px)')
  const [searchTerm, setSearchTerm] = useState('')

  const filtered = channels.filter((ch) =>
    ch.title.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleSelect = (channelId: string) => {
    onSelectChannel(channelId)
    if (!isFirstTime) onClose()
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop — not dismissable on first visit */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={isFirstTime ? undefined : onClose}
            className="fixed inset-0 bg-black/90 backdrop-blur-xl z-[60]"
          />

          {/* Modal — identical style to the internal ChannelSelectorModal (globe icon) */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className={`fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full ${
              isMobile ? 'max-w-sm' : 'max-w-2xl'
            } bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-950 rounded-2xl shadow-2xl border border-white/10 z-[70] overflow-hidden`}
          >
            {/* Header */}
            <div className="relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-primary/20 via-purple-500/20 to-primary/20 animate-gradient" />
              <div className="relative flex items-center justify-between p-6 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/20 rounded-xl">
                    <Globe className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">Select Channel</h2>
                    {isFirstTime && (
                      <p className="text-white/40 text-xs flex items-center gap-1 mt-0.5">
                        <Sparkles className="h-2.5 w-2.5" />
                        Choose a channel to start watching
                      </p>
                    )}
                  </div>
                </div>
                {/* No X button on first-time — user must pick a channel */}
                {!isFirstTime && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={onClose}
                    className="text-white/60 hover:text-white hover:bg-white/10 rounded-xl"
                  >
                    <X className="h-5 w-5" />
                  </Button>
                )}
              </div>
            </div>

            {/* Search */}
            <div className="p-4 border-b border-white/10">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search channels..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-4 py-3 pl-11 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                />
                <Globe className="absolute left-3 top-3.5 h-4 w-4 text-white/40" />
              </div>
            </div>

            {/* Channel grid */}
            <div className="p-4 max-h-[calc(var(--app-vh)*60)] overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filtered.map((channel, index) => (
                  <motion.button
                    key={channel.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    whileHover={{ scale: 1.02, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleSelect(String(channel.id))}
                    className={`relative group p-4 rounded-xl border transition-all text-left ${
                      String(channel.id) === currentChannelId
                        ? 'bg-gradient-to-br from-primary/20 via-primary/10 to-transparent border-primary/50 shadow-lg shadow-primary/20'
                        : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
                    }`}
                  >
                    {String(channel.id) === currentChannelId && (
                      <motion.div
                        className="absolute inset-0 rounded-xl bg-primary/20"
                        animate={{ scale: [1, 1.05, 1], opacity: [0.3, 0.5, 0.3] }}
                        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                      />
                    )}
                    <div className="relative flex items-center gap-3">
                      {/* <div className="text-lg filter drop-shadow-lg">
                        {channel.isQuran ? '📖' : '📺'}
                      </div> */}
                      <div className="flex-1 min-w-0">
                        <p className={`font-semibold truncate ${
                          String(channel.id) === currentChannelId ? 'text-primary' : 'text-white'
                        }`}>
                          {channel.title}
                        </p>
                      </div>
                      {String(channel.id) === currentChannelId && (
                        <div className="px-2 py-1 bg-primary/20 rounded-full flex-shrink-0">
                          <span className="text-primary text-xs font-medium">Current</span>
                        </div>
                      )}
                    </div>
                  </motion.button>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-white/10 bg-white/5">
              <p className="text-center text-xs text-white/40">
                {filtered.length} channels available •{' '}
                {isFirstTime ? 'Select a channel to begin' : 'Select your preferred channel'}
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}