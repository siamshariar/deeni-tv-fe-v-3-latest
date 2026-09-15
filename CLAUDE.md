# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Package manager is **pnpm** (`packageManager: pnpm@9.0.0` in package.json).

```bash
pnpm dev              # next dev --turbo -p 4356 (note: non-default port 4356, not 3000)
pnpm build            # next build --webpack
pnpm start            # next start
pnpm lint             # eslint . (flat config in eslint.config.mjs)
npx tsc --noEmit      # typecheck (no dedicated package.json script)
```

Android (Capacitor) build chain:
```bash
pnpm run build:android-web   # Next.js server build + manual copy into out/ for Capacitor
                              # NOT `next export` — that command was removed in Next 13.3+/14
                              # and fails outright on this project's Next.js 16.
npx cap sync android          # sync out/ into android/app/src/main/assets/public/
pnpm run apk:debug            # cap sync + gradlew assembleDebug
pnpm run apk:release          # build:android-web + cap sync + gradlew assembleRelease
```

There is no automated test suite (no Jest/Vitest/Playwright configured, no test files) — verification is manual/browser-based.

## Architecture

### Synchronized "broadcast" playback model

The core idea (see `lib/schedule-utils.ts`): there is no database and no real backend scheduler. "What's playing right now" is *computed* from wall-clock time using modular arithmetic against a fixed `MASTER_EPOCH_START`, per channel:

```
elapsedSinceEpoch = now - MASTER_EPOCH_START
cyclePosition = elapsedSinceEpoch % totalChannelDuration
→ walk the channel's program list to find which program cyclePosition falls into,
  and how far into it (currentTime)
```

Because this is a pure function of time, every client independently computes the identical "current program + seek position," which is what makes playback appear synchronized across users without any coordination. `getCurrentProgram()`/`computeCurrentProgramFromList()` are the canonical implementation; several other functions (`getUpcomingPrograms`, `getPreviousPrograms`, `buildLocalCurrentVideoResponse`) are built on top of the same math.

### Three-tier data fallback

`app/api/current-video/route.ts` (and the client fetch paths in `components/synced-video-player.tsx`) try, in order:
1. **External live API** (`api.deeniinfotech.com`) — authenticated with a JWT sent in a `p` header (see Auth below). If this succeeds, it's the source of truth.
2. **Local schedule computation** (`getCurrentProgram()` etc. in `lib/schedule-utils.ts`, using the embedded `CHANNELS` data) — used server-side whenever the external API is unreachable (the code anticipates Cloudflare blocking server IPs) and client-side as a final fallback.
3. **`public/api/fallback-schedule.json`** — a separately-editable JSON asset, used only by the Android APK's fully-offline path (`fetchLocalScheduleData()`/`loadLocalScheduleData()`), so offline channel content can be updated without a rebuild.

**Important gap:** of the 9 channels in `CHANNELS` (`lib/schedule-utils.ts`), only `bangla-1` has real embedded program data. When any other channel's data is needed from tier 2 or 3, `getChannelPrograms()` silently substitutes Bangla content (flagged via a `channelUnavailable` boolean on the response, but nothing currently surfaces that in the UI — this was a deliberate product decision, not an oversight). If you're asked to expand offline coverage, this is where to look.

### Player core

`components/synced-video-player.tsx` is the heart of the app — a large, mostly-monolithic client component that owns: schedule sync/re-sync, channel loading/switching, iOS-vs-Android-vs-web playback differences (iOS requires a user-gesture Start button; autoplay works directly on Android/web), mute/volume state, a buffering-stall watchdog with a 3-step recovery ladder, and the branded loading overlay. Most of its UI sub-pieces (`StartScreen`, `ChannelSelectorModal`, `ProgramOverlay`, `DesktopTicker`/`MobileTicker`, `BrandedLoadingOverlay`, `AutoUnmuteNotification`, `LiveBadge`) are defined **inline at the top of this same file**, not imported from `components/ui/`. There was a prior attempt to extract these into standalone files under `components/ui/` and `components/player/`; that refactor was abandoned mid-way and the resulting dead files have since been deleted — if you're extracting player UI pieces again, make sure you actually switch `synced-video-player.tsx` over to importing them rather than leaving both versions to drift.

`hooks/use-youtube-player.ts` wraps the YouTube IFrame API: handles script-load deduplication (chains `window.onYouTubeIframeAPIReady` rather than overwriting it, since multiple components load the API independently — see also `components/previous-videos-modal.tsx`, which runs its own separate `YT.Player` instance for the "watch a previous program" modal), an operation-token/staleness guard so overlapping init calls can't race, and a full DOM-purge/teardown before every player creation (avoids zombie iOS WKWebView iframes).

### Auth pattern (external API)

Both `lib/fetch.ts` (server-side, Node `crypto`) and `lib/client-fetch.ts` (client-side, Web Crypto) independently implement the same JWT HMAC-SHA256 token generation to authenticate against `api.deeniinfotech.com`, sent as a `p` request header. The signing secret is `NP_AS_L` (server) / `NEXT_PUBLIC_NP_AS_L` (client) — if unset, `client-fetch.ts` degrades to sending no auth header (logs a warning) rather than failing, which is intentional for local dev without credentials.

### Capacitor / Android

`android/` is a standard Capacitor-generated native project (gradle scaffold, mostly not hand-edited). `capacitor.config.ts` currently points `webDir: 'out'` — the APK bundles a static export and runs fully offline, rather than being a thin WebView pointed at a remote URL (an earlier mode, now disabled — see the commented-out `server.url` in that file). Release signing config lives in `android/keystore.properties` / `android/*.jks`, which are gitignored and must be provisioned locally per environment — they are intentionally not part of the repo.

### PWA / service worker

`next.config.mjs` is the **only** Next config file that is actually loaded (verified by running a build — Next.js resolves `.mjs` and ignores a same-directory `.js`/`.ts` if both existed, which was a real bug here; don't reintroduce a second config file). It wraps the app with `@ducanh2912/next-pwa`, which generates `public/sw.js` and `public/workbox-*.js` on every build — these are generated output, not hand-written, and are excluded from ESLint (`eslint.config.mjs`).
