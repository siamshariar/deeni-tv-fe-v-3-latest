# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

`README.md` has the toolchain table, commands and configuration. Expo changes between SDKs: check the versioned docs for the installed `expo` major (https://docs.expo.dev/versions/v57.0.0/) instead of relying on memory, and add packages with `npx expo install`.

## What this is

A React Native port of the Deeni.tv web app (`deeni-tv-fe`, branch `fixes_to_launch` @ `a080ec2`). One codebase builds:

- **Phone / tablet:** follows the web's **mobile** view (≤768 px layout).
- **Android TV:** follows the web's **desktop** view, scaled (`unit = window width / 1280`), with D-pad focus.

Behaviour, timings and copy are ported from the web. When the app and the web disagree, the web (`components/synced-video-player.tsx`, `lib/schedule-utils.ts`, `components/previous-videos-modal.tsx`) is the reference, unless a comment here or in the code says the difference is deliberate.

## Commands

```bash
npm install                # .npmrc has legacy-peer-deps=true (react-native-tvos prerelease tag)
npm run typecheck          # tsc --noEmit
npm test                   # jest (tests live in src/__tests__/, kept locally: git-ignored)

npm run prebuild           # phone: expo prebuild --clean (EXPO_TV unset)
npm run prebuild:tv        # TV:    EXPO_TV=1 expo prebuild --clean
```

Phone and TV need different native projects: **always run a clean prebuild when switching**. `android/` and `ios/` are generated (git-ignored). Release APKs for device testing: `cd android && ./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a` (phone) or `EXPO_TV=1 … -PreactNativeArchitectures=armeabi-v7a` (TV box). Release builds are debug-signed until a release keystore exists.

There is no lint script; run `npm run typecheck` and `npm test` before calling a change done.

## Architecture

### The broadcast model (same as the web)

There is no backend scheduler. "What's on now" is computed from the clock: `elapsed = now − MASTER_EPOCH_START`, `cycle = elapsed % channelDuration`, then walk the channel's programmes (`src/lib/schedule/schedule.ts`). Every client lands on the same programme and second.

- `now` is the **server-corrected** clock (`src/lib/serverClock.ts`): every HTTP reply's `Date` header measures the device's offset. A TV box with a slow clock otherwise played 10–20 s behind the web.
- Schedule sources, in order (`src/lib/api/client.ts`, `broadcastController.loadChannel`): external API `tv-schedules/live?lid=&iq=` (JWT in header `p`, secret `EXPO_PUBLIC_NP_AS_L`; unset = no auth and the API answers 403) → the deployed web app's `/api/current-video` → embedded `CHANNELS` (`src/lib/schedule/channelsData.ts`, a verbatim copy of the web data; only Bangla, English and Arabic have programmes, other channels fall back by language).
- Channel ids are the API's numeric ids (`"1"`…`"9"`); `resolveLocalChannelId()` maps them to local data by `localizationId` + Quran flag.

### Player

- `src/lib/youtube/playerPage.ts` builds an inline HTML page with the YouTube IFrame API (controls off, iframe `pointer-events: none`) and a command API `window.__deeni` (load / play / pause / mute / hold / seek / stop). It posts `ready`, `state`, `firstFrame`, `progress` (every 250 ms), `nearEnd`, `end`, `error`.
- `src/player/engine.ts` (`EngineRef`) queues commands until the page has loaded; `YouTubeWebView` hosts it.
- `src/player/broadcastController.ts`: the live player (port of the web's `loadChannel` / `syncWithServer` / `playNextVideo` / stall ladder). Covers: tuning → branded "Watching" cover until ≥3 s of real movement; stall cover when frozen >1.2 s **or YouTube reports BUFFERING** >1.2 s; before a start or stall cover lifts, it seeks to the live position if >5 s behind (`liveAnchor`), at most twice per cover (a slow box behind again after every seek kept the cover up). A stall cover lifts after 3 s of movement on TV and phone (web: 0.6 s; YouTube's controls showed through). On the phone the live player also gets the stall cover when the Watched player closes. A programme change is triggered by an `end` for the video on screen that has already played (page and controller both check: on the TV box the old video's late ENDED skipped the next programme), or by the broadcast's clock: programme changes keep it (product request 2026-10-18; deviation, the web starts the next programme at 0 and fell further behind with every change, ~23 s after one on the TV box). From the live anchor the controller knows when what plays ends in the broadcast; 1.5 s after that it switches even if the video is behind (slow start, stall), the next programme starts at its live position (rejoining the schedule if that one is over too), and its start cover catches up like a channel start. The schedule's seekTo resets the anchor whenever it names what plays (right after a change and at every 60 s sync; never mid-programme seeks there): a channel started from the external API takes timing only from the API, a fallback channel from any tier. Tested in `src/__tests__/liveSync.test.ts` (simulated player page). Periodic sync every 60 s; it refreshes the queue only while the schedule names what plays (`periodicQueue`): after a programme change the app runs seconds behind the schedule, and the web-ported refresh (`upcomingFromSchedule`, the web's `syncWithServer` "In sync" branch) then skipped a programme (phone re-test, 2026-10-18; the web has the same bug). Background → pause, foreground → rejoin with the 5 s tolerance.
- `src/player/previousController.ts`: the "Watched Program" player, a second persistent page. Phone: warmed when the list opens; live keeps playing muted underneath (`hold`). **TV: no warm-up** (two YouTube pages loading at once starved the TV box), live is stopped while it plays and rejoined on close. It autoplays: unlike the web (Play after 4 s, for iOS), the start watchdog keeps the loading cover while YouTube is still starting and shows Play only after 30 s (TV) / 12 s; a late start still plays. Its stall cover also goes up on BUFFERING >1.2 s, on resume and on every seek, and lifts after 5 s of movement (YouTube's title bar / play glyph / "More videos" showed otherwise; 3 s was not enough on the TV box or the phone). The start cover waits 3 s of movement on TV and 6 s on the phone. TV seek-bar focus: no box; the bar thickens and the handle grows (YouTube on TV).
- Never clip a WebView with rounded corners (black video on HiSilicon boxes): `CornerMasks` draws the corners on top.

### UI

- One screen: `src/app/index.tsx` (live frame + `ControlBar` + `DonateButton` + `PreviousPlayerLayer` + `OverlayHost`). Overlays are a stack in `useUiStore`; hardware Back closes the top one (`useBackHandler`).
- `useFrameLayout()` is the single source of sizes (frame, bar, buttons, logo, corner radius, fullscreen box), shared by the live and the Watched player.
- The Logo uses pre-scaled PNGs (`assets/images/logo/logo-h*.png`, Lanczos from the web's 3033×595 original) picked by pixel height; one big image squeezed by the GPU looked jagged on TV.
- Rounded borders, focus rings and the loader ring are SVG (`src/components/common/Rings.tsx`): Android's own rounded borders render jagged on TV boxes.
- Phone menu: Schedule, Watched, Channel, Refresh, About, Donate. A Privacy Policy item exists but is commented out (product owner's request) in `MenuDrawer.tsx`. On TV, Donate shows a QR panel instead of opening the browser.

### TV rules (each one cost a bug)

- **Remote keys reach JS on key-up only** (react-native-tvos sends key-down only with `ReactFeatureFlags.enableKeyDownEvents`). `useTVEventHandler` code must act on `eventKeyAction === 1`; held keys arrive as `longLeft` / `longRight` (down at hold start, up on release).
- A View whose opacity or shape toggles around a focusable control or a WebView needs `collapsable={false}`; Fabric otherwise re-creates it and D-pad focus is lost. Keep focusable controls mounted under covers instead of unmounting them.
- Every `FlatList` inside a modal goes in `ModalList` (react-native-tvos wraps lists in a focus guide that doesn't shrink).
- **TV is always fullscreen** (product decision 2026-10-17; `ALWAYS_FULLSCREEN` in `src/player/fullscreen.ts`): the live and Watched players start full-bleed and can't leave it, neither bar has a Full screen button, Back closes the Watched player directly and with nothing open leaves the app, and the Donate pill (hidden in fullscreen) is reached through the menu's QR panel. Phones are windowed with a Full screen button (locks landscape), and also follow rotation like the YouTube app (product request 2026-10-18, `onPhoneOrientation`): turning the phone sideways opens fullscreen (the Watched player's when open) without a lock, turning it upright leaves it, and leaving it by button or Back while sideways rotates back to the upright screen at once (YouTube app) and holds it with a portrait lock until the accelerometer (`expo-sensors`) sees the phone held upright for 0.4 s; then rotation is free again. "Upright" (`isHeldUpright`) is judged like Android's auto-rotate: gravity in the screen's plane within ~35° of the long axis, at any tilt up to ~70° back; a phone lying flat doesn't count (Android can't tell its orientation either). The first version required 0.7 g along the long axis, and on the phone the lock never released for a phone tilted back or on a desk, so turning it did nothing (2026-10-18). Without an accelerometer it keeps the windowed landscape view until the phone is upright. Phones only (short side < 600 dp), never tablets. The bar stays up while a channel the viewer started is loading (app open or reopen, channel switch, Refresh, back from the Watched player: `userStart` → `videoStarting` in the broadcast store, cleared when the start cover lifts) and hides 5 s after the video appears, later 3.5 s after the last key. Automatic changes (the next programme, recovery reloads, schedule rejoins) leave the bar as it is, so a hidden bar stays hidden. With the bar hidden any remote key only shows it (focus/blur TV events don't count); Back on the live screen also shows it with a "Press Back again to exit" toast, and a second Back within 2.5 s leaves the app. The Watched player keeps its controls up while loading and hides them 5 s after it starts.
- Fullscreen with hidden controls: the first key only shows them (an invisible full-screen `Focusable` holds focus).
- Endless animations (`Spin`, `Pulse`, `SweepBar` in `Motion.tsx`) run only while the app is in the foreground: Reanimated keeps driving them in the background, and the "Failed to Load" screen's held the box's main thread at ~75 % after Home. Build new looping animations from these. Reanimated 4.5.1 also re-arms its mapper run every frame for the app's lifetime; worklets 0.10.1 never paused that frame queue (it didn't register for host pause, ~10 % of a core in the background), so the app uses worklets 0.10.4, which does. After changing worklets, delete the native build folders (`android/.cxx` and `android/build`) of worklets, Reanimated and `expo/node_modules/expo-modules-core`, or the build links against the removed `libworklets.so`.
- Focus returns to the opener when an overlay closes (`ControlBar` remembers the last button; `tvFocusArea` handled the Donate pill, which TV no longer shows).

### Storage (same keys as the web, `src/lib/storage.ts`, `expo-sqlite/kv-store`)

| Key | Contents |
|---|---|
| `deeni-tv-channel` | Selected API channel id; absent = first visit (mandatory channel picker) |
| `deeni-tv-channels` | `tv-channels` API list as received |
| `deeni-tv-previous-<channelId>` | Watch history, newest first, max 30 |

## Testing

- `src/__tests__/` (local only, git-ignored): `webParity.test.ts` checks the ported maths against fixtures generated by running the web's own code; `serverClock.test.ts` covers the clock correction.
- Device testing is manual (an Android 9 TV box and an Android 10 phone so far). Not covered yet: iOS (needs a Mac or EAS), the API with the JWT secret, error/offline screens, long multi-hour playback.

## Open decisions

- App id is `com.deeni.tv`; the existing store app may be `com.deeniinfotech.deenitv` (to confirm before release; a store update needs the same id and signing key).
- Release signing keystore (not in the repo).
- YouTube / store policy review before release; YouTube-chrome workarounds are switchable in `youtubeFlags` (`src/lib/config.ts`).
