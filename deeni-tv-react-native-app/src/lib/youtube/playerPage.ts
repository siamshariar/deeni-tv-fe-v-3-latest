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
  /** Clip YouTube's top bar and bottom strip out of view (youtubeFlags.cropChrome). */
  cropChrome: boolean;
  /**
   * Lay the player out this many times smaller and scale it up to the picture (with the crop):
   * YouTube picks its quality from the layout size, so 1.5 on a 1080p TV gives 720p instead of
   * 1080p, less work for a slow box. 1 = native.
   */
  renderScale: number;
  /**
   * Hide YouTube's frame inside the page until it plays, and under a loading or stall cover. The
   * app's own opacity doesn't reach Chromium, so YouTube's spinner went on animating behind the
   * covers: 25–35 redraws a second through the main thread, which YouTube's start also needs,
   * on the TV box (0 with nothing to draw, 2026-11-04).
   */
  hideUntilPlaying?: boolean;
}

// YouTube's top bar is 48 px plus margins, taller in big players; the crop is that
// margin above and below the picture.
const CROP_MIN_PX = 64;
const CROP_RATIO = 0.14;

/**
 * TV: where a page that starts before React Native (modules/deeni-live-player) finds the
 * schedule the previous run saved; the native side puts a `LaunchSchedule` in its place.
 */
export const INITIAL_MARK = '/*DEENI_INITIAL*/null';

/** Programmes back to back from now (epoch ms), and the lead a load aims ahead by (s). */
export interface LaunchSchedule {
  items: { id: string; start: number; end: number }[];
  lead: number;
  savedAt: number;
}

/** Messages the page posts to React Native. `t` is ms since the page started (`t0`, epoch ms). */
export type PlayerPageMessage =
  | { type: 'boot'; t0: number; t: number }
  | { type: 'ready'; t: number }
  /** It started `id` by itself from the launch schedule. */
  | { type: 'initial'; id: string; start: number; t: number }
  /** A load asked for the video it started by itself: kept as it is. */
  | { type: 'initialKept'; id: string; t: number }
  /** The next programme stands ready in the hidden player (prepareNext). */
  | { type: 'nextReady'; id: string; t: number }
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
  /**
   * Play `id` muted up to its first frame and hold it paused there; a later `load` of the same
   * id with play just resumes it (no reload): it starts in ~1 s on the slow TV box.
   */
  preload: (id: string) => `window.__deeni&&window.__deeni.preload(${vid(id)});true;`,
  /** TV: make the page's second, hidden player (empty; its first start takes ~10 s on the box). */
  createNext: () => 'window.__deeni&&window.__deeni.createNext();true;',
  /**
   * TV: load `id` muted in the hidden player and hold it on its first frame; a later `load` of it
   * swaps the two players: the next programme starts at once.
   */
  prepareNext: (id: string) => `window.__deeni&&window.__deeni.prepareNext(${vid(id)});true;`,
  /** Silent while a loading / stall cover is up (separate from mute and hold). */
  coverHold: (on: boolean) => `window.__deeni&&window.__deeni.coverHold(${bool(on)});true;`,
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
    crop: config.cropChrome,
    cropMinPx: CROP_MIN_PX,
    cropRatio: CROP_RATIO,
    scale: Math.max(1, config.renderScale || 1),
    hide: !!config.hideUntilPlaying,
  });

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<link rel="preconnect" href="https://www.youtube.com">
${config.host !== 'https://www.youtube.com' ? `<link rel="preconnect" href="${config.host}">\n` : ''}<link rel="preconnect" href="https://www.google.com">
<link rel="preconnect" href="https://i.ytimg.com">
<style>
  html, body { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; background: #000; }
  #slot { position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: #000; }
  /* #clip is the 16:9 picture when the crop is on (layout() below), else the whole page. */
  #clip { position: absolute; top: 0; left: 0; width: 100%; height: 100%; overflow: hidden; }
  /* Sizes in the iframe's own px (--iw, --ih, --crop), scaled up by --s to the picture. */
  #clip iframe, #clip > div { position: absolute; left: 0; top: calc(-1 * var(--crop, 0px) * var(--s, 1)); width: var(--iw, 100%) !important; height: var(--ih, 100%) !important; transform: scale(var(--s, 1)); transform-origin: 0 0; border: 0; }
  /* YouTube's own UI is never interactive: every touch goes to the native overlay. */
  iframe { pointer-events: none !important; }
  /* prepareNext: the second player stays under the first, invisible, until they swap. */
  #player { z-index: 2; }
  #player2 { z-index: 1; opacity: 0; }
</style>
</head>
<body>
<div id="slot"><div id="clip"><div id="player"></div><div id="player2"></div></div></div>
<script>
(function () {
  var CFG = ${cfg};
  var t0 = Date.now();
  var API_RETRY_MS = 3000;
  function post(m) {
    try {
      m.t = Date.now() - t0;
      window.ReactNativeWebView.postMessage(JSON.stringify(m));
    } catch (_) {}
  }
  window.onerror = function (msg) { post({ type: 'log', msg: String(msg) }); };

  // Crop (CFG.crop): #clip = the 16:9 picture fitted into the page; the iframe is
  // taller by --crop at the top and the bottom, so YouTube centres the same picture
  // in it and draws its top bar and bottom strip in the margins #clip cuts off.
  function layout() {
    if (!CFG.crop) return;
    var w = window.innerWidth, h = window.innerHeight;
    if (!w || !h) return;
    var vw = w, vh = w * 9 / 16;
    if (vh > h) { vh = h; vw = h * 16 / 9; }
    var clip = document.getElementById('clip');
    clip.style.left = Math.round((w - vw) / 2) + 'px';
    clip.style.top = Math.round((h - vh) / 2) + 'px';
    clip.style.width = Math.round(vw) + 'px';
    clip.style.height = Math.round(vh) + 'px';
    var s = CFG.scale, iw = vw / s, ih = vh / s;
    var crop = Math.max(CFG.cropMinPx, Math.round(ih * CFG.cropRatio));
    var root = document.documentElement.style;
    root.setProperty('--s', String(s));
    root.setProperty('--crop', crop + 'px');
    root.setProperty('--iw', iw + 'px');
    root.setProperty('--ih', (ih + 2 * crop) + 'px');
  }
  window.addEventListener('resize', layout);
  layout();

  function setShown(on) {
    if (CFG.hide) document.getElementById('clip').style.opacity = on ? '1' : '0';
  }
  setShown(false);

  var S = {
    player: null,
    ready: false,
    expected: '',     // the id React Native wants on screen
    loaded: '',       // the id last handed to the player
    start: 0,
    wantPlay: false,
    muted: true,      // every load starts muted so autoplay is allowed
    held: false,
    coverHeld: false, // silent while the app's loading / stall cover is up
    preloading: false, // preload(): playing muted until its first frame
    preloaded: '',     // preload(): held paused on its first frame
    initial: '',       // started by the page itself from INITIAL (until a load takes it over)
    firstSent: false,
    nearSent: false,
    endSent: false,
    state: -1,
    lastTime: -1
  };

  function applyMute() {
    if (!S.player || !S.ready) return;
    try {
      if (S.muted || S.held || S.coverHeld) { S.player.mute(); S.player.setVolume(0); }
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

  // preload(): the video has started; hold it paused (and muted) until load() plays it.
  function holdPreload() {
    S.preloading = false; S.preloaded = S.expected; S.wantPlay = false;
    try { S.player.pauseVideo(); } catch (_) {}
    captionsOff();
  }

  function sendFirstFrame() {
    if (S.firstSent) return;
    S.firstSent = true;
    captionsOff();
    post({ type: 'firstFrame', id: S.expected });
  }

  // TV, page started with the app (modules/deeni-live-player): the programme the previous run's
  // schedule names for now starts with the player, before React Native runs. React Native's
  // load of that same video keeps it (load below).
  var INITIAL = ${INITIAL_MARK};
  function startInitial() {
    if (CFG.role !== 'live' || !INITIAL || !INITIAL.items) return;
    var now = Date.now();
    var lead = Math.max(0, Math.min(30, Number(INITIAL.lead) || 0));
    for (var i = 0; i < INITIAL.items.length; i++) {
      var it = INITIAL.items[i];
      if (!it || !/^[A-Za-z0-9_-]{11}$/.test(it.id) || now < it.start || now >= it.end - 5000) continue;
      S.expected = it.id;
      S.start = Math.max(0, Math.min((now - it.start) / 1000 + lead, (it.end - it.start) / 1000 - 2));
      S.wantPlay = true;
      S.muted = true;
      S.initial = it.id;
      post({ type: 'initial', id: it.id, start: S.start });
      return;
    }
  }

  // The hidden second player (prepareNext): same page, so the two share one media session and the
  // running video isn't paused when this one starts (a second page's first frame paused it ~2 s).
  var NEXT = { player: null, ready: false, id: '', held: false };
  function setFront(p, front) {
    try { var f = p.getIframe(); f.style.zIndex = front ? '2' : '1'; f.style.opacity = front ? '1' : '0'; } catch (_) {}
  }
  function nextCreate() {
    if (NEXT.player || !S.player || !window.YT || !YT.Player) return;
    NEXT.player = new YT.Player('player2', { host: CFG.host, width: '100%', height: '100%', playerVars: playerVars(), events: EVENTS });
  }
  function nextLoad() {
    if (!NEXT.player || !NEXT.ready || !NEXT.id) return;
    try {
      NEXT.player.mute(); NEXT.player.setVolume(0);
      NEXT.player.loadVideoById({ videoId: NEXT.id, startSeconds: 0 });
    } catch (_) {}
  }
  function nextStop() {
    NEXT.id = ''; NEXT.held = false;
    if (NEXT.player && NEXT.ready) { try { NEXT.player.stopVideo(); } catch (_) {} }
  }
  function nextState(e) {
    if (e.data !== 1 || !NEXT.id || NEXT.held) return;
    NEXT.held = true;
    try { NEXT.player.pauseVideo(); } catch (_) {}
    post({ type: 'nextReady', id: NEXT.id });
  }
  // Swaps the players: the id is in the hidden one. The old one stops later: stopping tears YouTube's
  // player down on the page thread, which the new one needs now.
  function nextSwap(id, start, muted) {
    var old = S.player;
    S.player = NEXT.player; NEXT.player = old; NEXT.id = ''; NEXT.held = false;
    setFront(S.player, true); setFront(old, false);
    try { old.mute(); old.setVolume(0); old.pauseVideo(); } catch (_) {}
    setTimeout(function () { if (NEXT.player === old && !NEXT.id) { try { old.stopVideo(); } catch (_) {} } }, 8000);
    S.initial = ''; S.preloading = false; S.preloaded = '';
    S.expected = id; S.loaded = id; S.start = start || 0; S.wantPlay = true; S.muted = !!muted; S.state = -1;
    resetFlags();
    setShown(!S.coverHeld);
    try { if (start > 2) S.player.seekTo(start, true); S.player.playVideo(); } catch (_) {}
    applyMute();
  }

  window.__deeni = {
    createNext: nextCreate,
    prepareNext: function (id) {
      if (!id || NEXT.id === id || !S.player) return;
      NEXT.id = id; NEXT.held = false;
      nextCreate();
      nextLoad();
    },
    load: function (id, start, play, muted) {
      if (!id) return;
      if (play && id === NEXT.id && NEXT.player && NEXT.ready && S.player && S.ready) { nextSwap(id, start, muted); return; }
      if (NEXT.id) nextStop();
      // The video the page started by itself: kept loading or playing where it is (the
      // controller catches up a late start, as for any start). Its first frame is reported again.
      if (play && S.initial && id === S.initial && id === S.loaded && S.player) {
        S.initial = '';
        S.expected = id; S.wantPlay = true; S.muted = !!muted;
        resetFlags();
        if (S.state === 1) setShown(true);
        applyMute();
        post({ type: 'initialKept', id: id });
        if (S.ready) {
          try { var st0 = S.player.getPlayerState(); if (st0 === -1 || st0 === 2 || st0 === 5) S.player.playVideo(); } catch (_) {}
        }
        return;
      }
      S.initial = '';
      setShown(false);
      // A preloaded (or still preloading) video starts where it stands: no reload.
      if (play && id === S.loaded && (S.preloading || S.preloaded === id) && S.player && S.ready) {
        S.expected = id; S.wantPlay = true; S.muted = !!muted; S.preloading = false; S.preloaded = '';
        resetFlags();
        try { S.player.playVideo(); } catch (_) {}
        applyMute();
        return;
      }
      S.preloading = false; S.preloaded = '';
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
    hold: function (h) { S.held = !!h; applyMute(); if (h && NEXT.id) nextStop(); },
    coverHold: function (h) { S.coverHeld = !!h; applyMute(); setShown(!h); },
    seek: function (sec) {
      if (!S.player || !S.ready) return;
      try {
        var d = S.player.getDuration();
        if (d > 0 && sec < d - CFG.endSec - 1) { S.endSent = false; }
        if (d > 0 && sec < d - CFG.nearEndSec - 1) { S.nearSent = false; }
        S.player.seekTo(sec, true);
      } catch (_) {}
    },
    preload: function (id) {
      // Already there or on its way: not from the start again.
      if (!id || (id === S.loaded && (S.preloading || S.preloaded === id))) return;
      setShown(false);
      S.expected = id; S.start = 0; S.wantPlay = true; S.muted = true;
      S.preloading = true; S.preloaded = '';
      resetFlags();
      if (S.player && S.ready) loadNow();
    },
    stop: function () {
      if (NEXT.id) nextStop();
      S.preloading = false; S.preloaded = '';
      S.wantPlay = false; S.expected = ''; S.loaded = ''; resetFlags();
      if (S.player && S.ready) { try { S.player.stopVideo(); } catch (_) {} }
    }
  };

  function onReady() {
    S.ready = true;
    applyMute();
    post({ type: 'ready' });
    if (S.expected && S.expected !== S.loaded) { loadNow(); return; }
    // The video the player was created with: a stop or a pause that came meanwhile still applies.
    if (!S.expected) { try { S.player.stopVideo(); } catch (_) {} return; }
    if (S.wantPlay) S.player.playVideo();
    else { try { S.player.pauseVideo(); } catch (_) {} }
  }

  function onStateChange(e) {
    S.state = e.data;
    var match = urlHas(S.expected);
    post({ type: 'state', state: e.data, id: S.expected, match: match });
    if (e.data === 1 && match) {
      if (S.preloading) { holdPreload(); return; }
      setShown(true);
      sendFirstFrame();
      applyMute();
    }
    // ENDED only for the video on screen that has played: on a slow TV box the
    // previous video's ENDED arrived after the next one was loaded and skipped
    // that whole programme.
    if (e.data === 0 && S.expected && !S.endSent && S.firstSent && match) {
      S.endSent = true;
      post({ type: 'end', id: S.expected });
    }
  }

  function onError(e) {
    post({ type: 'error', code: e.data, id: S.expected });
  }

  function playerVars() {
    return {
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
    };
  }

  // Each event goes by the player it came from: the two players swap roles.
  var EVENTS = {
    onReady: function (e) {
      if (e.target !== NEXT.player) { onReady(); return; }
      NEXT.ready = true;
      try { NEXT.player.mute(); NEXT.player.setVolume(0); } catch (_) {}
      setFront(NEXT.player, false);
      nextLoad();
    },
    onStateChange: function (e) { if (e.target === NEXT.player) nextState(e); else onStateChange(e); },
    onError: function (e) { if (e.target === NEXT.player) NEXT.id = ''; else onError(e); },
    onApiChange: function () { captionsOff(); }
  };

  window.onYouTubeIframeAPIReady = function () {
    var vars = playerVars();
    var opts = {
      host: CFG.host,
      width: '100%',
      height: '100%',
      playerVars: vars,
      events: EVENTS
    };
    // A video asked for before the API was ready (the first start) comes with the player, so
    // YouTube fetches it while the player sets up instead of after onReady: on the TV box a
    // load sent after onReady waited ~1.4 s for the busy page, then took 8 s (2026-11-04).
    if (S.expected) {
      opts.videoId = S.expected;
      vars.start = Math.floor(S.start || 0);
      vars.autoplay = S.wantPlay ? 1 : 0;
      S.loaded = S.expected;
    }
    S.player = new YT.Player('player', opts);
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
        if (S.preloading) holdPreload();
        else { sendFirstFrame(); applyMute(); }
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

  // Commands can run from now on: the WebView's load end only comes once YouTube's iframe has
  // loaded too (with the player), so commands queued until then reached the page late.
  post({ type: 'boot', t0: t0 });
  startInitial();

  // Tried until it loads: with no internet when the page starts (a TV box whose Wi-Fi isn't up
  // yet), a page that gave up stayed without a player after the connection came back.
  function loadApi() {
    var tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    tag.onerror = function () {
      if (tag.parentNode) tag.parentNode.removeChild(tag);
      post({ type: 'error', code: 0, id: S.expected });
      setTimeout(loadApi, API_RETRY_MS);
    };
    document.head.appendChild(tag);
  }
  loadApi();
})();
</script>
</body>
</html>`;
}
