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
      // The React Native app (own toolchain, lint and typecheck).
      'deeni-tv-react-native-app/**',
      // Generated PWA service worker output (next-pwa/workbox) — not
      // hand-written source, regenerates on every build.
      'public/sw.js',
      'public/workbox-*.js',
    ],
  },
]

export default eslintConfig
