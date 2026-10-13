/**
 * The YouTube player page that runs inside a WebView (plan §9.3, option A).
 *
 * Modelled on Safe Kids TV's `lib/shortsIframe.ts`: an inline page with the
 * command handler installed BEFORE the player exists (no lost commands at
 * cold start), the YouTube IFrame API with YouTube's own controls off, the
 * iframe made untouchable (`pointer-events: none`; every control is a native
 * overlay), mute = mute()+setVolume(0) / unmute = unMute()+setVolume(100)
 * (iOS gates autoplay on the muted attribute, Android listens to the volume),
 * an autoplay watchdog, captions unloaded, and a first-frame event that only
 * fires for the expected video (a late 'playing' from the previous video
 * never uncovers anything).
 *
 * One page = one player. The live broadcast and the Previous-programme
 * player are two WebViews running this page with different roles.
 *
 * Written in ES5: old Android TV boxes ship old System WebViews (the test
 * box has Chrome 66).
 */

export type PlayerRole = 'live' | 'previous';

export interface PlayerPageConfig {
  /** Page origin, also passed to YouTube as `origin` / `widget_referrer`. */
  origin: string;
  /** 'https://www.youtube.com' or 'https://www.youtube-nocookie.com'. */
  host: string;
  role: PlayerRole;
  /** Seconds before the end at which `nearEnd` is posted (0 = never). */
  nearEndSec: number;
  /** Seconds before the end at which `end` is posted (also on ENDED). */
  endSec: number;
}

/** Messages the page posts to React Native. `t` is ms since the page started. */
export type PlayerPageMessage =
  | { type: 'ready'; t: number }
  | { type: 'state'; state: number; id: string; match: boolean; t: number }
  | { type: 'firstFrame'; id: string; t: number }
  | { type: 'progress'; id: string; current: number; duration: number; state: number; muted: boolean; t: number }
  | { type: 'nearEnd'; id: string; remaining: number; t: number }
  | { type: 'end'; id: string; t: number }
  | { type: 'error'; code: number; id: string; t: number }
  | { type: 'log'; msg: string; t: number };

const YT_ID_RE = /^[A-Za-z0-9_-]{11}$/;

export function isYouTubeId(id: string): boolean {
  return YT_ID_RE.test(id);
}

const secs = (n: number | undefined) => Math.max(0, Math.floor(Number(n) || 0));
const vid = (id: string) => JSON.stringify(isYouTubeId(id) ? id : '');
const bool = (b: boolean) => (b ? 'true' : 'false');

/** JS to run in the page for one command. Ids are validated, numbers coerced. */
export const playerCommand = {
  /** Load `id` at `start` seconds; play or only cue it; start muted or not. */
  load: (id: string, start: number, play: boolean, muted: boolean) =>
    `window.__deeni&&window.__deeni.load(${vid(id)},${secs(start)},${bool(play)},${bool(muted)});true;`,
  play: () => 'window.__deeni&&window.__deeni.play();true;',
  pause: () => 'window.__deeni&&window.__deeni.pause();true;',
  mute: (muted: boolean) => `window.__deeni&&window.__deeni.mute(${bool(muted)});true;`,
  /** While held, nothing in the page may unmute (another player owns the audio). */
  hold: (held: boolean) => `window.__deeni&&window.__deeni.hold(${bool(held)});true;`,
  seek: (seconds: number) => `window.__deeni&&window.__deeni.seek(${Math.max(0, Number(seconds) || 0)});true;`,
  /** Stop and unload (frees the decoder on TV boxes). */
  stop: () => 'window.__deeni&&window.__deeni.stop();true;',
};

export function buildPlayerHtml(config: PlayerPageConfig): string {
  const cfg = JSON.stringify({
    origin: config.origin,
    host: config.host,
    role: config.role,
    nearEndSec: Math.max(0, config.nearEndSec),
    endSec: Math.max(0.2, config.endSec),
  });

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<style>
  html, body { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; background: #000; }
  #slot { position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: #000; }
  #slot iframe, #slot > div { position: absolute; top: 0; left: 0; width: 100% !important; height: 100% !important; border: 0; }
  /* YouTube's own UI is never interactive: every touch goes to the native overlay. */
  iframe { pointer-events: none !important; }
</style>
</head>
<body>
<div id="slot"><div id="player"></div></div>
<script>
(function () {
  var CFG = ${cfg};
  var t0 = Date.now();
  function post(m) {
    try {
      m.t = Date.now() - t0;
      window.ReactNativeWebView.postMessage(JSON.stringify(m));
    } catch (_) {}
  }
  window.onerror = function (msg) { post({ type: 'log', msg: String(msg) }); };

  var S = {
    player: null,
    ready: false,
    expected: '',     // the id React Native wants on screen
    loaded: '',       // the id last handed to the player
    start: 0,
    wantPlay: false,
    muted: true,      // every load starts muted so autoplay is allowed
    held: false,
    firstSent: false,
    nearSent: false,
    endSent: false,
    state: -1,
    lastTime: -1
  };

  function applyMute() {
    if (!S.player || !S.ready) return;
    try {
      if (S.muted || S.held) { S.player.mute(); S.player.setVolume(0); }
      else { S.player.unMute(); S.player.setVolume(100); }
    } catch (_) {}
  }

  // Undocumented calls; each is harmless if ignored.
  function captionsOff() {
    if (!S.player) return;
    try { S.player.unloadModule('captions'); } catch (_) {}
    try { S.player.unloadModule('cc'); } catch (_) {}
    try { S.player.setOption('captions', 'track', {}); } catch (_) {}
  }

  function urlHas(id) {
    try { return !!id && (S.player.getVideoUrl() || '').indexOf(id) !== -1; }
    catch (_) { return false; }
  }

  function resetFlags() {
    S.firstSent = false; S.nearSent = false; S.endSent = false; S.lastTime = -1;
  }

  function loadNow() {
    if (!S.expected) return;
    S.loaded = S.expected;
    var req = { videoId: S.expected, startSeconds: S.start };
    if (S.wantPlay) S.player.loadVideoById(req); else S.player.cueVideoById(req);
    applyMute();
  }

  function sendFirstFrame() {
    if (S.firstSent) return;
    S.firstSent = true;
    captionsOff();
    post({ type: 'firstFrame', id: S.expected });
  }

  window.__deeni = {
    load: function (id, start, play, muted) {
      if (!id) return;
      S.expected = id; S.start = start || 0; S.wantPlay = !!play; S.muted = !!muted;
      resetFlags();
      if (S.player && S.ready) loadNow();
    },
    play: function () {
      S.wantPlay = true;
      if (S.player && S.ready) { S.player.playVideo(); applyMute(); }
    },
    pause: function () {
      S.wantPlay = false;
      if (S.player && S.ready) { try { S.player.pauseVideo(); } catch (_) {} }
    },
    mute: function (m) { S.muted = !!m; applyMute(); },
    hold: function (h) { S.held = !!h; applyMute(); },
    seek: function (sec) {
      if (!S.player || !S.ready) return;
      try {
        var d = S.player.getDuration();
        if (d > 0 && sec < d - CFG.endSec - 1) { S.endSent = false; }
        if (d > 0 && sec < d - CFG.nearEndSec - 1) { S.nearSent = false; }
        S.player.seekTo(sec, true);
      } catch (_) {}
    },
    stop: function () {
      S.wantPlay = false; S.expected = ''; S.loaded = ''; resetFlags();
      if (S.player && S.ready) { try { S.player.stopVideo(); } catch (_) {} }
    }
  };

  function onReady() {
    S.ready = true;
    applyMute();
    post({ type: 'ready' });
    if (S.expected && S.expected !== S.loaded) { loadNow(); return; }
    if (S.wantPlay) S.player.playVideo();
  }

  function onStateChange(e) {
    S.state = e.data;
    var match = urlHas(S.expected);
    post({ type: 'state', state: e.data, id: S.expected, match: match });
    if (e.data === 1 && match) {
      sendFirstFrame();
      applyMute();
    }
    if (e.data === 0 && S.expected && !S.endSent) {
      S.endSent = true;
      post({ type: 'end', id: S.expected });
    }
  }

  function onError(e) {
    post({ type: 'error', code: e.data, id: S.expected });
  }

  window.onYouTubeIframeAPIReady = function () {
    S.player = new YT.Player('player', {
      host: CFG.host,
      width: '100%',
      height: '100%',
      playerVars: {
        autoplay: 0,
        controls: 0,
        disablekb: 1,
        enablejsapi: 1,
        cc_load_policy: 0,
        fs: 0,
        iv_load_policy: 3,
        modestbranding: 1,
        mute: 1,
        playsinline: 1,
        rel: 0,
        origin: CFG.origin,
        widget_referrer: CFG.origin
      },
      events: {
        onReady: onReady,
        onStateChange: onStateChange,
        onError: onError,
        onApiChange: function () { captionsOff(); }
      }
    });
  };

  // Autoplay watchdog (Safe Kids): YouTube can ignore a playVideo on a freshly
  // cued video, and the live broadcast must never stay paused. While play is
  // wanted and the player sits idle (unstarted, paused or cued), re-send play
  // at most once a second. A user pause clears wantPlay first, so it is never
  // fought.
  var lastKickAt = 0;
  setInterval(function () {
    try {
      if (!S.player || !S.ready || !S.expected || !S.wantPlay || document.hidden) return;
      var st = S.player.getPlayerState();
      if (st !== -1 && st !== 5 && st !== 2) return;
      var now = Date.now();
      if (now - lastKickAt < 1000) return;
      lastKickAt = now;
      S.player.playVideo();
      applyMute();
    } catch (_) {}
  }, 500);

  // Time checks every 100 ms, in the page so there are no bridge round trips:
  // first frame when time really advances (some WebViews miss the PLAYING
  // event), near-end and end triggers, and a progress message every 250 ms.
  var tick = 0;
  setInterval(function () {
    try {
      if (!S.player || !S.ready || !S.expected || S.loaded !== S.expected) return;
      var c = S.player.getCurrentTime() || 0;
      var d = S.player.getDuration() || 0;
      var st = S.player.getPlayerState();
      if (!S.firstSent && S.lastTime >= 0 && c > S.lastTime + 0.25 && urlHas(S.expected)) {
        sendFirstFrame();
        applyMute();
      }
      S.lastTime = c;
      if (S.firstSent && d > 0 && st === 1) {
        var left = d - c;
        if (CFG.nearEndSec > 0 && !S.nearSent && left <= CFG.nearEndSec) {
          S.nearSent = true;
          post({ type: 'nearEnd', id: S.expected, remaining: left });
        }
        if (!S.endSent && left <= CFG.endSec) {
          S.endSent = true;
          post({ type: 'end', id: S.expected });
        }
      }
      tick = (tick + 1) % 3;
      if (tick === 0) {
        var m = false;
        try { m = S.player.isMuted(); } catch (_) {}
        post({ type: 'progress', id: S.expected, current: c, duration: d, state: st, muted: m });
      }
    } catch (_) {}
  }, 100);

  var tag = document.createElement('script');
  tag.src = 'https://www.youtube.com/iframe_api';
  tag.onerror = function () { post({ type: 'error', code: 0, id: S.expected }); };
  document.head.appendChild(tag);
})();
</script>
</body>
</html>`;
}
