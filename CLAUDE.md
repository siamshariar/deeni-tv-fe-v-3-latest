# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Package manager is **pnpm** (`packageManager: pnpm@9.0.0` in package.json).

```bash
pnpm dev              # next dev --turbo -p 4356 (note: non-default port 4356, not 3000)
pnpm build            # next build --webpack
pnpm start            # next start
pnpm lint             # eslint . (flat config in eslint.config.mjs) — currently fails: 74 errors, 138 warnings
npx tsc --noEmit      # typecheck (no dedicated package.json script) — currently passes
```

`next.config.mjs` sets `typescript.ignoreBuildErrors: true`, so `pnpm build` does **not** catch type errors. Run `npx tsc --noEmit` yourself.

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

Environment variables (all `.env*` files are gitignored): `NP_AS_L` (server JWT secret), `NEXT_PUBLIC_NP_AS_L` (client JWT secret), `NEXT_PUBLIC_API_BASE` (overrides the `…/api/tv-schedules` base), `NEXT_PUBLIC_TV_CHANNELS_API`, `NEXT_PUBLIC_GOOGLE_ANALYTICS_ID`.

The root-level guides (`README.md`, `QUICKSTART.md`, `PROJECT-SUMMARY.md`, `ANDROID-OFFLINE-*.md`, `RELEASE-NOTES-MAY-2026.md`, …) were last touched between February and July 2026 and predate much of the current player. Where they disagree with the code or this file, trust the code.

## React Native app (`deeni-tv-react-native-app/`)

A separate Expo / React Native app (phone + Android TV) that ports this web app lives in `deeni-tv-react-native-app/`. It has its own `package.json` (npm, not pnpm), toolchain and `CLAUDE.md`; read that file before working there. The web build ignores it: it is excluded in `tsconfig.json`, in `eslint.config.mjs`, and from Tailwind's class scanning (`@source not` in `app/globals.css`). Behaviour changes in the web player (`synced-video-player.tsx`, `lib/schedule-utils.ts`, `previous-videos-modal.tsx`) usually need the same change in the app.

## Architecture

The app is a single page (`app/page.tsx`) that renders `SyncedVideoPlayer` plus page-level overlays: `DonateButton`, `MenuDrawer`, the first-visit `ChannelSelector`, `ScheduleModal` and `AboutModal`. `app/privacy-policy/` is the only other page.

### Synchronized "broadcast" playback model

The core idea (see `lib/schedule-utils.ts`): there is no database and no real backend scheduler. "What's playing right now" is *computed* from wall-clock time using modular arithmetic against a fixed `MASTER_EPOCH_START`, per channel:

```
elapsedSinceEpoch = now - MASTER_EPOCH_START
cyclePosition = elapsedSinceEpoch % totalChannelDuration
→ walk the channel's program list to find which program cyclePosition falls into,
  and how far into it (currentTime)
```

Because this is a pure function of time, every client independently computes the identical "current program + seek position," which is what makes playback appear synchronized across users without any coordination. `getCurrentProgram()`/`computeCurrentProgramFromList()` are the canonical implementation; several other functions (`getUpcomingPrograms`, `buildLocalCurrentVideoResponse`) are built on top of the same math. This local math is only the fallback; when the external API answers, its `currentProgram.seekTo` is authoritative.

### Schedule data: where it comes from

Every schedule source returns one shape: `{ serverTime, currentProgram: { ytVideoId, title, duration, seekTo, startTime, endTime }, previousPrograms, upcomingPrograms, _source }`. The player (`loadChannel`, `syncWithServer` and `syncImmediateAfterTransition` in `components/synced-video-player.tsx`) tries, in order:

1. **External API straight from the browser** (`fetchFromBrowserAPI`: `GET https://api.deeniinfotech.com/api/tv-schedules/live?lid=<localizationId>[&iq=true]`, with the JWT from `lib/client-fetch.ts`). Browser requests get past Cloudflare; server requests may not. The API can be very slow. A channel start waits `STARTUP_API_WAIT_MS` (10s) and then plays from the fallback, but the request keeps running for up to 2 minutes. If a late answer names a different video, the channel reloads onto it.
2. **Our own `/api/current-video` route** (10s client timeout). The server first tries the same external API (5s timeout, its own JWT). If that fails, it computes the schedule locally from the embedded `CHANNELS` data.
3. **Embedded `CHANNELS` data in the browser** (`buildLocalCurrentVideoResponse()`). This is the only path that works with no network and no server, which makes it the Android APK's offline path, because the static `out/` bundle has no `/api` routes.

`public/api/fallback-schedule.json` together with `loadLocalScheduleData()`/`fetchLocalScheduleData()` was meant to be an editable offline schedule for the APK. **Nothing calls those functions**, so the JSON is never read at runtime. Editing it changes nothing unless someone wires it in.

**Channel ids and fallback coverage:** the player uses the numeric channel ids of the live `tv-channels` API (`1` = Bangla, `2` = Quran - Bangla, `3` = English, …; mirrored in `DEFAULT_API_CHANNELS`), while `CHANNELS` (`lib/schedule-utils.ts`) uses local ids (`english-1`). `resolveLocalChannelId()` maps one to the other by language (`localizationId`: 5 Bangla, 6 English, 7 Arabic, 8 Urdu, 9 Chinese) and Quran flag. The player passes `lid`/`iq` to `/api/current-video` so the server asks the external API for the same schedule as the browser (`iq=true` is the API's Quran parameter). Of the 9 channels, only `bangla-1`, `english-1` and `arabic-1` have embedded program data, and their durations must be the real YouTube durations because the broadcast math depends on them. For a channel without data, `getChannelPrograms()` substitutes a same-language channel (Quran - English → English), else Bangla. The response flags this with a `channelUnavailable` boolean, but nothing in the UI shows it yet. Expanding offline coverage means adding to `CHANNELS`.

The channel list itself comes from `https://api.deeniinfotech.com/api/tv-channels` (fetched in the browser; `/api/tv-channels` is the server fallback), is cached in localStorage, and falls back to `DEFAULT_API_CHANNELS`.

### Keeping in step with the live schedule

- **Program transitions:** `playNextVideo()` runs on YouTube `ENDED`, or when the 100ms time poll sees less than 0.5s left. It moves the finished program into the watch history, shifts the upcoming queue and loads the next video at 0s. 500ms later, `syncImmediateAfterTransition()` refreshes the queue from the API. If the API is ahead of us, it rejoins live. If it lags (still reporting the video that just ended), the queue continues from the program after ours. When the queue runs dry, the next items come from the embedded data. With no next program at all, the channel reloads, at most once every 20s.
- **Periodic sync:** `syncWithServer()` runs every **1 minute**; comments that say "5-minute" are stale. It only refreshes the upcoming queue and the schedule shown to the parent. Mid-session drift correction is **disabled** (`hasDrifted = false`), so a running video is never replaced by this sync. Each run also fire-and-forgets `POST /api/sync-ping`, which only logs to `/tmp/deeni-sync-calls.log`.
- **Rejoining live:** each start/rejoin seeks to `seekTo` + the time elapsed since the schedule was fetched. `resyncToLive()` runs after the previous-program player closes and seeks if the stream is more than 20s off the API position.

### Player core

`components/synced-video-player.tsx` (~3,450 lines) is the heart of the app. It is a large, mostly-monolithic client component that owns:
- schedule sync/re-sync, channel loading/switching and Refresh
- iOS vs Android vs web playback differences (below)
- mute/volume state and the "Tap to unmute" prompt
- startup watchdogs: a 12s start watchdog and a 20s channel-load timeout, each allowing one automatic retry before showing "Please tap Refresh"
- a buffering-stall watchdog with a 3-step recovery ladder: `play()` after ~6s, a small seek nudge after ~10s, a channel reload after ~17s (25s cooldown)
- the branded loading overlay, which also hides YouTube's own spinner and title bar: it stays up until playback has actually advanced for about 3s

Most of its UI sub-pieces (`ChannelSelectorModal`, `StartScreen`, `AutoUnmuteNotification`, `LiveBadge`, `BrandedLoadingOverlay`, `ProgramOverlay`, `DeeniLogo`, `DesktopTicker`/`MobileTicker`, `ModernTimeDisplay`) are defined **inline at the top of this same file**, not imported from `components/ui/`. A previous attempt to extract them into standalone files was abandoned midway, and the dead files from it were deleted. If you extract player UI pieces again, switch `synced-video-player.tsx` over to importing them instead of leaving two versions to drift.

The bar under the video holds, in order: volume (a slider on hover, not on mobile), Programs Schedule, Watched Program, Channel, Refresh, Full screen, and the 3-dot menu. `components/menu-drawer.tsx` repeats Schedule/Watched Program/Channel/Refresh and adds About and Donate. Layout breakpoints come from `useMediaQuery`: mobile ≤768px, tablet 769–1024px, desktop ≥1025px. `lib/player-layout.ts` `playerFrameStyle()` sizes the 16:9 frame plus bar and is shared with the previous-program player, so both are the same box.

**Platform differences** (detected in the component; `app/page.tsx` repeats the iOS check):
- **iOS** (including iPadOS reporting as MacIntel): playback starts only from the Start screen tap. A hidden, muted primer player (`IOS_PRIMER_VIDEO_ID`) is created early, so the tap can unlock audio and the *same* iframe can then swap to the real video. On iOS that instance is never destroyed on reload or retry, because a new iframe would lose the audio unlock.
- **Android** (Capacitor or UA): autoplays and unmutes itself on the first `PLAYING` event.
- **Web**: autoplays muted after a channel is chosen. If the browser keeps the sound off, `AutoUnmuteNotification` shows "Tap to unmute".
- **All platforms**: the volume controls stay locked until the real video plays. Each video transition is muted until `PLAYING`.

**Channel pickers:** there are two. On a first visit (no saved channel), `app/page.tsx` opens `components/channel-selector.tsx`, which can't be dismissed until a channel is picked. Picking a channel *is* picking the language; there is no separate language screen. Later switches use the player's inline `ChannelSelectorModal`.

**Previous programs ("Watched Program"):** this list is the user's local watch history, not a server feature: localStorage `deeni-tv-previous-<channelId>`, newest first, capped at 30. It is seeded from the API's `previousPrograms` only when empty. `components/previous-videos-modal.tsx` (~1,300 lines) plays these in its **own** persistent `YT.Player`. That player is created on first open and only paused/hidden on close, so iOS needs its Tap to Play at most once. It has its own controls: play/pause, ±10s skip, seek, volume and fullscreen. While it is open, the main player keeps playing muted underneath (opacity 0, with `setMuteHold(true)` so no recovery path can unmute it). On close, the main player is unmuted and re-synced to live.

**Fullscreen** (`hooks/use-fullscreen.ts`, used by both players): native fullscreen is requested on `<html>`, not on the player, and the player wrapper is pinned over the viewport so modals still show on top. iPhone Safari has no page fullscreen, so the fallback is a CSS "pseudo" fullscreen. In portrait, the whole app root is rotated 90° (`html[data-rotated-fs]`, `--app-vh` in `app/globals.css`).

`hooks/use-youtube-player.ts` wraps the YouTube IFrame API for the main player. It:
- chains `window.onYouTubeIframeAPIReady` instead of overwriting it, because `previous-videos-modal.tsx` loads the API independently
- uses an operation-token/staleness guard so overlapping init calls can't race
- fully purges and tears down the DOM before every player creation (avoids zombie iOS WKWebView iframes)
- holds a mute hold, transition-mute logic and the iOS primer
- unloads YouTube's captions module (captions showed up over the broadcast)

Player vars: `controls: 0, disablekb: 1, fs: 0, rel: 0, iv_load_policy: 3, cc_load_policy: 0, playsinline: 1, origin: window.location.origin`.

### Local storage

| Key | Contents |
|---|---|
| `deeni-tv-channel` | Selected channel id (API id, e.g. `"3"`). Its absence means a first visit |
| `deeni-tv-channels` | `tv-channels` API list, stored exactly as received |
| `deeni-tv-previous-<channelId>` | Watch history (≤30 `VideoProgram`s with `watchedAt`) |

### Donation link

`lib/donation.ts` picks the donation page from the selected channel's language only, never the visitor's location. Bangla (`localizationId` 5) → the Bangladesh/bKash page; any other language, or no channel yet → the DIT Web USD/card form. Both the header `DonateButton` and the 3-dot menu's Donate use it. `window.open` must stay synchronous inside the click handler, or popup blockers stop it.

### Auth pattern (external API)

`api.deeniinfotech.com` takes an HS256 JWT (payload `{ userAgent, timestamp, random }`) in a `p` request header. There are **three** independent implementations:
- `lib/client-fetch.ts`: browser, Web Crypto, secret `NEXT_PUBLIC_NP_AS_L`. If the secret is unset, it sends no auth header and logs a warning instead of failing; that is intentional for local dev without credentials.
- `lib/fetch.ts`: server, `jwt-simple` + `moment-timezone`, secret `NP_AS_L`. Used by `/api/tv-channels` and the unused `/api/live-schedule`.
- `app/api/current-video/route.ts`: an inline Node `crypto` version, secret `NP_AS_L`, else `NEXT_PUBLIC_NP_AS_L`.

### Dead code (not imported anywhere)

These files are not used by the running app. Don't treat them as current behavior, and don't port them:
- `components/channel-switcher.tsx`, `components/osd-overlay.tsx` (and `components/language-modal.tsx`, which only it uses), `components/tv-hero.tsx`, `components/tv-ticker.tsx`, `components/video-player.tsx`
- `components/theme-provider.tsx` and `components/theme-provider copy.tsx`
- `lib/scheduling-service.ts`
- the routes `app/api/live-schedule`, `app/api/mock-schedule` and `app/api/upcoming-videos` (only the dead `tv-ticker` calls the last one)

`components/ui/` is a stock shadcn set, and only a handful of it is used (`button`, `slider`, `separator`, `input`, `label`, …).

### Capacitor / Android

`android/` is a standard Capacitor-generated native project (gradle scaffold, mostly not hand-edited; app id `com.deeni.tv`). `/android` is listed in `.gitignore`, but 76 of its files are tracked anyway. Changes to those show up in git as usual, while *new* files there need `git add -f`. `capacitor.config.ts` points `webDir: 'out'`, so the APK bundles the built pages and runs from local files instead of being a thin WebView on a remote URL (the earlier mode, now disabled; see the commented-out `server.url`). Online, it still calls the external API from the WebView; offline, it falls back to the embedded schedule (see above). `lib/status-bar-utils.ts` sets the `@capacitor/status-bar` color (`#09090b`). Release signing config lives in `android/keystore.properties` / `android/*.jks`, which are gitignored and must be provisioned locally per environment — they are intentionally not part of the repo.

### PWA / service worker

`next.config.mjs` is the **only** Next config file that is actually loaded (verified by running a build — Next.js resolves `.mjs` and ignores a same-directory `.js`/`.ts` if both existed, which was a real bug here; don't reintroduce a second config file). It wraps the app with `@ducanh2912/next-pwa`, which generates `public/sw.js` and `public/workbox-*.js` on every build — these are generated output, not hand-written, and are excluded from ESLint (`eslint.config.mjs`). The service worker caches `/api/*` NetworkFirst for 5 minutes.
