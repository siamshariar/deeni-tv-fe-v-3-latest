import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'
import nextTypescript from 'eslint-config-next/typescript'

const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    ignores: [
      'android/**',
      '.next/**',
      'out/**',
      'node_modules/**',
      // Generated PWA service worker output (next-pwa/workbox) — not
      // hand-written source, regenerates on every build.
      'public/sw.js',
      'public/workbox-*.js',
    ],
  },
]

export default eslintConfig
