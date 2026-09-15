import withPWA from '@ducanh2912/next-pwa'

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // NOTE: this project previously had an unused STATIC_EXPORT env toggle for
  // `output: 'export'` here. Removed rather than merged forward — verified
  // by actually running `STATIC_EXPORT=true next build` that it fails
  // outright (`export const dynamic = "force-dynamic"` on /api/sync-ping,
  // /api/live-schedule, /api/donation-url is incompatible with
  // `output: 'export'`). The Android build genuinely uses the
  // `build:android-web` script (regular server build + manual asset copy
  // into out/), not Next's static export mode — see ANDROID-OFFLINE-GUIDE.md.
  // Silences Turbopack's "webpack config with no turbopack config" warning
  // (next-pwa below adds a webpack config).
  turbopack: {},
  // Allow cross-origin requests from the Android emulator during `next dev`.
  allowedDevOrigins: ['10.0.2.2', 'localhost', '192.168.0.5'],
  // Enable CORS only in development (e.g. for the Android emulator hitting
  // the dev server directly).
  async headers() {
    if (process.env.NODE_ENV === 'production') {
      return []
    }

    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,OPTIONS,PATCH,DELETE,POST,PUT' },
          { key: 'Access-Control-Allow-Headers', value: 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version' },
        ],
      },
    ]
  },
}

export default withPWA({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
  // Increase cache size limit for video content
  maximumFileSizeToCacheInBytes: 30 * 1024 * 1024, // 30MB
  workboxOptions: {
    runtimeCaching: [
      {
        urlPattern: /^https:\/\/fonts\.(?:googleapis|gstatic)\.com\/.*/i,
        handler: 'CacheFirst',
        options: {
          cacheName: 'google-fonts',
          expiration: {
            maxEntries: 4,
            maxAgeSeconds: 365 * 24 * 60 * 60 // 1 year
          }
        }
      },
      {
        urlPattern: /\.(?:jpg|jpeg|gif|png|svg|ico|webp)$/i,
        handler: 'StaleWhileRevalidate',
        options: {
          cacheName: 'static-images',
          expiration: {
            maxEntries: 64,
            maxAgeSeconds: 24 * 60 * 60 // 1 day
          }
        }
      },
      {
        urlPattern: /^https:\/\/i\.ytimg\.com\/.*/i,
        handler: 'StaleWhileRevalidate',
        options: {
          cacheName: 'youtube-thumbnails',
          expiration: {
            maxEntries: 32,
            maxAgeSeconds: 24 * 60 * 60 // 1 day
          }
        }
      },
      {
        urlPattern: /\/api\/donation-url/i,
        handler: 'NetworkOnly'
      },
      {
        urlPattern: /\/api\/(?!donation-url).*/i,
        handler: 'NetworkFirst',
        options: {
          cacheName: 'api-cache',
          networkTimeoutSeconds: 10,
          expiration: {
            maxEntries: 16,
            maxAgeSeconds: 5 * 60 // 5 minutes
          }
        }
      }
    ]
  }
})(nextConfig)
