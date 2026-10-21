# Deeni TV — React Native (phone, tablet, Android TV)

Native port of the Deeni.tv web app (`deeni-tv-fe`, branch `fixes_to_launch` @ `a080ec2`).
One codebase builds the phone/tablet app (follows the web's mobile view) and the
Android TV app (follows the web's desktop view). The plan this follows is
`deeni-tv-fe/local-ref/plan.md` (local only).

## Toolchain (locked by the phase-1 build spike, 2026-10-12)

| Item | Version |
|---|---|
| Expo SDK | 57 (`expo ~57.0.28`) |
| React Native | `react-native-tvos@0.86.3-0` (aliased as `react-native`; matches SDK 57's RN 0.86.3) |
| TV config plugin | `@react-native-tvos/config-tv` 0.1.7 |
| React | 19.2.3 |
| Router | `expo-router` ~57.0.26 (routes in `src/app/`) |
| WebView | `react-native-webview` 13.16.1 (Expo-bundled) |
| Storage | `expo-sqlite/kv-store` (synchronous key-value; TV-supported Expo module) |
| State | `zustand` 5 |
| Animation | `react-native-reanimated` 4.5.1 + `react-native-worklets` **0.10.4** (SDK 57 pins 0.10.1; 0.10.4 pauses its frame queue in the background, which cut ~10 % background CPU on the TV box, 2026-10-18; excluded from `expo install --check` in `package.json`) |

**Spike result:** the TV debug build (armeabi-v7a) builds and runs on a TX20Pro
Android TV box (Android 9 / API 28, HiSilicon, Chrome 66 WebView): `Platform.isTV`
is true, the D-pad moves between native buttons and never enters the WebView,
and the YouTube page plays with origin `https://www.deeni.tv`. The phone build
(arm64) runs on an Android 10 phone; both were tested end to end on 2026-10-13.

`.npmrc` sets `legacy-peer-deps=true`: the TV fork's version (`0.86.3-0`) is a
prerelease tag, which npm's peer ranges (e.g. `0.83 - 0.86`) reject.

## Commands

```bash
npm install
npm run typecheck          # tsc --noEmit
npm test                   # jest (web-parity unit tests; src/__tests__/ is kept locally, git-ignored)

# Phone / tablet
npm run prebuild           # expo prebuild --clean (EXPO_TV unset)
npm run android            # or: cd android && ./gradlew assembleDebug
npm run ios                # macOS only

# Android TV
npm run prebuild:tv        # EXPO_TV=1 expo prebuild --clean
npm run android:tv
```

Switching between phone and TV changes native config: always run a clean prebuild.

On this development machine `GRADLE_USER_HOME` (and `~/.gradle`) point at an
unmounted drive, so builds pass `GRADLE_USER_HOME=$PWD/.gradle-home`
(git-ignored). Metro runs on port 8082 (8081 is taken locally) with
`adb reverse tcp:8081 tcp:8082`; the system's inotify watch limit is
exhausted, so Metro is started with `CI=1` (no file watching).

## Configuration

Build-time variables (`.env.local`, git-ignored), defaults in `src/lib/config.ts`:

| Variable | Purpose |
|---|---|
| `EXPO_PUBLIC_NP_AS_L` | JWT secret for the `p` header (web: `NEXT_PUBLIC_NP_AS_L`). Unset = no auth header |
| `EXPO_PUBLIC_API_REFERER` | `Referer` (and `Origin`) sent with API requests, `https://www.deeni.tv/`. Cloudflare blocks API requests without it. Empty = not sent |
| `EXPO_PUBLIC_API_BASE` | `https://api.deeniinfotech.com/api/tv-schedules` |
| `EXPO_PUBLIC_TV_CHANNELS_API` | `https://api.deeniinfotech.com/api/tv-channels` |
| `EXPO_PUBLIC_WEB_BASE_URL` | Deployed web app (tier-2 `/api/current-video`, privacy page). Empty disables tier 2 |
| `EXPO_PUBLIC_PLAYER_ORIGIN` | Player page origin / YouTube `origin` (`https://www.deeni.tv`) |
| `EXPO_PUBLIC_YOUTUBE_HOST` | `https://www.youtube.com` or `https://www.youtube-nocookie.com` |

### Release checklist (Android)

1. **API secret:** put `EXPO_PUBLIC_NP_AS_L=…` in `.env.local` before building (Metro inlines it into the bundle, as the web inlines `NEXT_PUBLIC_NP_AS_L`; anyone can extract it from the APK, the same exposure as the web's).
2. **Cloudflare:** `api.deeniinfotech.com` blocks requests that don't carry a deeni.tv `Referer` ("Sorry, you have been blocked", HTML 403 from Cloudflare). The app sends `EXPO_PUBLIC_API_REFERER`. With it, a request reaches the API (`x-powered-by: Express`), which then checks the `p` token. Better for the long run: a Cloudflare rule that allows the app itself.
3. **Version:** raise `BUILD_NUMBER` in `app.config.ts` for every upload. It must stay above the Capacitor app's versionCode 2 (same id `com.deeni.tv`); the TV build is `1000000 + BUILD_NUMBER`.
4. **All CPU types:** build without `-PreactNativeArchitectures=…` (the test APKs carry one each); Google Play requires 64-bit code. Store uploads are AABs (`./gradlew bundleRelease`).
5. **Signing:** release builds are debug-signed here. Updating an installed or published `com.deeni.tv` needs that app's signing key; Expo's prebuild regenerates `android/`, so add the signing config with a config plugin or EAS.
6. **Permissions:** only `INTERNET` (the rest are blocked in `app.config.ts`); check with `aapt dump badging <apk>`.
7. **Phone and TV builds:** two builds of one app id (`npm run prebuild` / `npm run prebuild:tv`); on Google Play the TV one goes on the Android TV track.

YouTube-chrome behaviours are flags in `youtubeFlags` (`src/lib/config.ts`) so the
outcome of the YouTube / store policy review is a setting change.

## Structure

```
src/app/            _layout.tsx (fonts, splash, app lifecycle), index.tsx (the one screen)
src/player/         broadcastController (live broadcast), previousController, engine, actions, fullscreen
src/lib/            schedule/ (ported web maths + embedded data), api/ (client, JWT, normalise),
                    youtube/playerPage.ts (the WebView player page), storage, donation, theme, layout
src/components/     player/ (WebView host, live + previous layers, covers), shell/ (bar, Donate),
                    overlays/ (channel picker, schedule, previous list, menu, about, TV donate QR)
src/store/          zustand stores (channel, broadcast, previous player, UI/overlays)
src/__tests__/      web-parity tests (local only, git-ignored); fixtures generated by running the web's own code
```

## Player

The player follows the Safe Kids TV approach: a display-only WebView running the
YouTube IFrame API (controls off, iframe `pointer-events: none`, all controls
native), an inline page with a command API (`window.__deeni`), muted start →
unmute on the first frame, an autoplay watchdog, branded covers over YouTube's own
UI, and on TV a non-focusable WebView inside `TVFocusGuideView focusable={false}`.
Rounded corners are drawn with masks, never by clipping the WebView (clipping
turns video black on HiSilicon boxes).

TV focus rule: a View whose opacity or shape toggles while it holds a focusable
control (or a WebView) gets `collapsable={false}`. Otherwise Fabric flattens it
away at opacity 1 and re-creates it at opacity 0, re-parenting the children and
dropping D-pad focus (seen as "focus vanishes" when hidden controls reappear).
Likewise, keep focusable controls mounted under covers instead of unmounting them.
