'use client'

import { Heart } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { openDonationPage } from '@/lib/donation'

// `channelId` is the selected channel: its language decides the donation page.
export function DonateButton({ channelId }: { channelId?: string }) {
  const handleDonate = () => {
    openDonationPage(channelId)
  }

  return (
    <div className="fixed right-2 sm:right-4 z-50 flex items-center"
      suppressHydrationWarning
      style={{ top: 'max(0.5rem, env(safe-area-inset-top))' }}
    >
      {/* Donate Button - Shows on all screens including mobile */}
      <Button
        size="lg"
        onClick={handleDonate}
        className="
          bg-gradient-to-r from-primary to-primary/80 
          hover:from-primary/90 hover:to-primary/70 
          hover:scale-105 hover:shadow-xl hover:shadow-primary/30
          text-primary-foreground shadow-lg font-semibold 
          h-8 sm:h-9 md:h-10 lg:h-11 px-3 sm:px-4 md:px-5 lg:px-6 rounded-full gap-1.5 sm:gap-2
          transition-all duration-300 ease-out
          group cursor-pointer flex items-center justify-center
        "
      >
        {/* Heart Icon Placeholder */}
        <Heart className="h-3.5 w-3.5 sm:h-4 sm:w-4 md:h-5 md:w-5 lg:h-5 lg:w-5 fill-current" />
        <span className="text-xs sm:text-sm md:text-base font-bold">Donate</span>
      </Button>
    </div>
  )
}

