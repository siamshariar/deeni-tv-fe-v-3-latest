# Quick Reference - Deeni TV Latest Changes

> **Corrected during PR #21 review** — the original version of this file claimed
> the splash-screen and status-bar work below was shipped and marked the build
> "READY FOR RELEASE". Neither claim matched the code. See
> `PR-REVIEW-fixes_to_launch-vs-stg.md` for the full review.

## 🎯 What Was Actually Shipped vs. What's Still Open

### 1. **Splash Screen** — ❌ not shipped
**Before**: Two splash screens showing on startup (confusing)
**Now**: Still not fixed. `components/boot-splash.tsx` was added but never
wired into the app, and has since been deleted as dead code. The in-app
`StartScreen` still has the feature badges, subtitle, and helper text that
earlier notes claimed were removed. This remains open work if a single
clean splash screen is still wanted.

### 2. **Status Bar Color** — ⚠️ partially shipped
**Before**: Status bar stayed static (not matching video)
**Now**: `lib/status-bar-utils.ts` exists and is called once, on app mount,
to reset the status bar to the default background color. There is no
dynamic per-video-change update — that part was never implemented.

---

## 📁 Files Changed (this cycle)

| File | Change | Status |
|------|--------|--------|
| `components/boot-splash.tsx` | Added, then removed (dead code) | Removed |
| `components/synced-video-player.tsx` | Various player fixes (see PR review) | Shipped, unrelated to splash/status-bar claims |
| `lib/status-bar-utils.ts` | NEW | Shipped, only the mount-time reset is wired in |
| `capacitor.config.ts` | StatusBar plugin config updated | Shipped |
| `package.json` | Added `@capacitor/status-bar` | Shipped |

---

## 📱 Platform Support

Not independently re-verified in this correction pass. See
`PR-REVIEW-fixes_to_launch-vs-stg.md`'s "Full manual feature test" section
for what was actually tested (web only — no iOS device or Android
emulator was available during that review).

---

## 🚀 APK Release Status

**Status**: ⚠️ **Not confirmed ready** — the "READY FOR RELEASE" claim
previously here was not backed by device testing as far as this review
could confirm. Re-verify on a real Android device (and ideally iOS) before
treating any APK build as release-ready.

---

## 🧪 Testing Recommendations

Still a good checklist to run manually — none of these should be assumed
passing based on this document:
- [ ] APK installs without errors
- [ ] App launches without duplicate splash screens
- [ ] Video loads and plays automatically
- [ ] No crashes on different screen sizes
- [ ] Works on a real Android phone (not just emulator)
- [ ] Selecting each of the 9 channels shows that channel's own content
      when the live API is reachable (see PR review Critical Finding #6
      for why this specifically needs checking)

### Device Testing
- Test on: Small phone, medium phone, tablet
- Orientations: Portrait, landscape
- Devices: Android 8+, 10, 12, 14

---

## 🔐 Version Info

```
App: Deeni TV
ID: com.deeni.tv
Capacitor: 8.3.3
Next.js: 16.0.10
```
