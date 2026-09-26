'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { Globe, Sparkles } from 'lucide-react'

interface LanguageModalProps {
  isOpen: boolean
  onClose: () => void
  onSelectLanguage?: (languageCode: string) => void
  isFirstTime?: boolean // If first time, no close option
}

const languages = [
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'ar', name: 'العربية', flag: '🇸🇦' },
  { code: 'ur', name: 'اردو', flag: '🇵🇰' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'tr', name: 'Türkçe', flag: '🇹🇷' },
  { code: 'id', name: 'Bahasa', flag: '🇮🇩' },
]

export function LanguageModal({ isOpen, onClose, onSelectLanguage, isFirstTime = false }: LanguageModalProps) {
  const handleSelect = (langCode: string) => {
    console.log('[v0] Channel selected:', langCode)
    // Save to localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('deeni-tv-language', langCode)
    }
    onSelectLanguage?.(langCode)
    onClose()
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop - No onClick if first time (must select) */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={isFirstTime ? undefined : onClose}
            className="fixed inset-0 bg-black/80 backdrop-blur-md z-50"
          />
          
          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[calc(100%-2rem)] max-w-2xl"
          >
            <div className="backdrop-blur-xl bg-gradient-to-br from-zinc-900/95 via-zinc-900/90 to-zinc-950/95 border border-white/10 rounded-3xl p-6 md:p-8 shadow-2xl">
              {/* Header - No close button */}
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-primary/20 rounded-xl">
                  <Globe className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h2 className="text-2xl md:text-3xl font-bold text-white">Select Channel</h2>
                  {isFirstTime && (
                    <p className="text-white/50 text-sm mt-1 flex items-center gap-1">
                      <Sparkles className="h-3 w-3" />
                      Please select your preferred language to continue
                    </p>
                  )}
                </div>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
                {languages.map((lang, index) => (
                  <motion.button
                    key={lang.code}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    whileHover={{ scale: 1.05, y: -2 }}
                    whileTap={{ scale: 0.95 }}
                    className="backdrop-blur-lg bg-white/5 hover:bg-white/15 border border-white/10 hover:border-primary/50 rounded-2xl p-4 md:p-6 transition-all group"
                    onClick={() => handleSelect(lang.code)}
                  >
                    <div className="text-4xl md:text-5xl mb-2 md:mb-3 group-hover:scale-110 transition-transform">{lang.flag}</div>
                    <div className="text-white font-medium text-base md:text-lg">{lang.name}</div>
                  </motion.button>
                ))}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
