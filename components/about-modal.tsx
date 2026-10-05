'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useMediaQuery } from '@/hooks/use-media-query'

interface AboutModalProps {
  isOpen: boolean
  onClose: () => void
}

export function AboutModal({ isOpen, onClose }: AboutModalProps) {
  const isMobile = useMediaQuery('(max-width: 640px)')
  
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
          
          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed inset-0 z-[51] flex items-center justify-center p-4"
            onClick={onClose}
          >
            <div className="w-full max-w-2xl max-h-[calc(var(--app-vh)*88)] overflow-y-auto backdrop-blur-xl bg-gradient-to-br from-zinc-900/95 via-zinc-900/90 to-zinc-950/95 border border-white/10 rounded-2xl p-6 md:p-8 shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-start mb-2 md:mb-4">
                <div className="flex items-center gap-4">
                  <img 
                    src="/DeeniTV-V-2.png" 
                    alt="Deeni.tv" 
                    className="h-10 md:h-12 w-auto object-contain mb-2"
                  />

                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onClose}
                  className={`text-white hover:bg-white/20 rounded-full ${
                    isMobile ? 'h-12 w-12' : 'h-10 w-10'
                  }`}
                >
                  <X className={isMobile ? 'h-7 w-7' : 'h-6 w-6'} />
                </Button>
              </div>
                  <div>
                    <p className="text-primary text-base md:text-lg font-medium mb-2">Your Spiritual Journey</p>
                  </div>
              <div className="space-y-4 md:space-y-6 text-white/90 leading-relaxed text-sm md:text-base">
                <p className="text-base md:text-lg">
                  Experience premium Islamic content in a revolutionary lean-back TV interface designed for modern audiences.
                </p>
                
                <p>
                  Deeni.tv brings you high-quality spiritual programming including Quran recitations, 
                  Islamic lectures, historical documentaries, and daily reflections—all in a viewing experience.
                </p>
                
                <div className="pt-4 border-t border-white/10">
                  <h3 className="text-lg md:text-xl font-semibold text-white mb-3">Our Mission</h3>
                  <p>
                    To make authentic Islamic knowledge accessible to everyone, 
                    anywhere, in a format that fits seamlessly into modern life.
                  </p>
                </div>
                
                <div className="pt-4">
                  <h3 className="text-lg md:text-xl font-semibold text-white mb-3">Features</h3>
                  <ul className="space-y-2 text-white/80">
                    <li>• 24/7 live streaming spiritual content</li>
                    <li>• Multi-language support</li>
                    <li>• Scheduled programming</li>
                    <li>• Premium production quality</li>
                  </ul>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
