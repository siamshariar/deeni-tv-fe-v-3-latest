import React from 'react'
import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import Script from 'next/script'
import GoogleAnalytics from '../components/google-analytics'
import { GA_TRACKING_ID } from '../lib/gtag'
import './globals.css'

const geist = Geist({ 
  subsets: ["latin"],
  display: 'swap',
  variable: '--font-geist',
})

const geistMono = Geist_Mono({ 
  subsets: ["latin"],
  display: 'swap',
  variable: '--font-geist-mono',
})

export const viewport: Viewport = {
  // viewport-fit=cover + all lock-zoom flags are injected as a raw <meta> in <head>
  // below, giving full control over the content string iOS actually reads.
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#09090b' },
    { media: '(prefers-color-scheme: dark)', color: '#09090b' },
  ],
}

export const metadata: Metadata = {
  metadataBase: new URL('https://deeni.tv'),
  title: {
    default: 'Deeni.tv',
    template: '%s | Deeni.tv'
  },
  description: 'Experience premium spiritual content in a lean-back TV interface. Watch Islamic lectures, Ramadan guides, and more in a synchronized TV-like experience.',
  generator: 'Next.js',
  applicationName: 'Deeni.tv',
  referrer: 'origin-when-cross-origin',
  keywords: ['Islamic TV', 'Spiritual content', 'Ramadan guide', 'Islamic lectures', 'Deeni TV'],
  authors: [{ name: 'Deeni.tv Team' }],
  creator: 'Deeni.tv',
  publisher: 'Deeni.tv',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  
  icons: {
    icon: [
      { url: '/App_logo_192.png', sizes: '192x192', type: 'image/png' },
      { url: '/App_logo_256.png', sizes: '256x256', type: 'image/png' },
      { url: '/App_logo_384.png', sizes: '384x384', type: 'image/png' },
      { url: '/App_logo_512.png', sizes: '512x512', type: 'image/png' },
      { url: '/1024-1024-size.png', sizes: '1024x1024', type: 'image/png' },
      { url: '/2732-2732-size.png', sizes: '2732x2732', type: 'image/png' },
    ],
    apple: [
      { url: '/App_logo_192.png', sizes: '192x192', type: 'image/png' },
      { url: '/1024-1024-size.png', sizes: '1024x1024', type: 'image/png' },
      { url: '/2732-2732-size.png', sizes: '2732x2732', type: 'image/png' },
    ],
    shortcut: '/App_logo_192.png',
  },

  manifest: '/manifest.json',
  
  openGraph: {
    title: 'Deeni.tv',
    description: 'Experience premium spiritual content in a lean-back TV interface',
    url: 'https://deeni.tv',
    siteName: 'Deeni.tv',
    images: [
      {
        url: '/Deeni-TV-Play-store-Cover-1200-630.png',
        width: 1200,
        height: 630,
        alt: 'Deeni.tv',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  
  twitter: {
    card: 'summary_large_image',
    title: 'Deeni.tv',
    images: ['/Deeni-TV-Play-store-Cover-1200-630.png'],
    description: 'Experience premium spiritual content in a lean-back TV interface',    
    creator: '@deenitv',
  },
  
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  
  verification: {
    google: 'your-google-verification-code', // Add your verification code
    yandex: 'your-yandex-verification-code', // Add if needed
    yahoo: 'your-yahoo-verification-code', // Add if needed
  },
  
  category: 'religion',
  
  // PWA meta tags — explicitly rendered in <head> below for full iOS control.
  // Keeping only entries that don't have a dedicated <meta> in RootLayout.
  other: {
    'msapplication-TileColor': '#09090b',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html 
      lang="en" 
      className={`${geist.variable} ${geistMono.variable}`}
      style={{ backgroundColor: '#09090b' }}
      suppressHydrationWarning
    >
      <head suppressHydrationWarning>
        {GA_TRACKING_ID && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${GA_TRACKING_ID}`}
              strategy="afterInteractive"
            />
            <Script id="gtag-init" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${GA_TRACKING_ID}');
              `}
            </Script>
          </>
        )}
      </head>
      <body
        className="font-sans antialiased bg-[#09090b] text-white"
        style={{ backgroundColor: '#09090b' }}
        suppressHydrationWarning={true}
      >
        <div id="root" suppressHydrationWarning>
          {children}
        </div>
        <Analytics />
        <GoogleAnalytics />
      </body>
    </html>
  )
}
