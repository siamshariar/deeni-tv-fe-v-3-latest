/**
 * The Previous-programme player (web: PreviousVideoPlayer in
 * components/previous-videos-modal.tsx). A second, persistent player page:
 * created the first time the Previous list opens (TV: the first time a
 * programme is played), warmed with the first row on phones, then kept for
 * the app's life. Closing only stops it.
 */
import { Platform } from 'react-native';

import { YOUTUBE_ICON_MS, youtubeFlags } from '@/lib/config';
import { playerCommand, type PlayerPageMessage } from '@/lib/youtube/playerPage';
import { prefetchThumbnail } from '@/lib/youtube/thumbnail';
import { usePreviousPlayerStore } from '@/store/usePreviousPlayerStore';
import { useUiStore } from '@/store/useUiStore';
import type { VideoProgram } from '@/types';

import { broadcast } from './broadcastController';
import { EngineRef } from './engine';

// Web values (previous-videos-modal.tsx)
const PLAY_WATCHDOG_MS = 4000;
const PAGE_LOAD_GRACE_MS = 12000;
const MAX_BUFFERING_WAIT_MS = 12000;
// Web 3000. With youtubeFlags.cropChrome YouTube's top bar and bottom strip are out of
// view: the cover lifts once the video really plays (sound held until then) and
// PlaybackIndicator covers YouTube's centre icon. Without it: on the phone YouTube's start
// overlay (title bar, pause glyph, logo) was still up after 5 s of playback (Realme RMX2030).
const REVEAL_AFTER_PLAYING_MS = youtubeFlags.cropChrome ? 300 : Platform.isTV ? 3000 : 6000;
const REVEAL_MAX_WAIT_MS = 20000;
const STALL_COVER_MS = 1200;
// The web shows Play when nothing plays after 4 s (iOS blocks its autoplay) and
// waits up to 12 s only while YouTube reports BUFFERING. A native WebView never
// blocks autoplay (the page keeps re-sending play), and the TV box can take
// 20 s+ to start a video, so here every not-yet-playing state counts as
// "still starting" until this cap.
const MAX_START_WAIT_MS = Platform.isTV ? 30000 : MAX_BUFFERING_WAIT_MS;
// After a stall, a resume or a jump, YouTube's title bar, play glyph and "More
// videos" fade out only after it has played a moment: still up ~1 s after 3 s of
// movement on the TV box and ~4 s on the phone (screen-recorded frames), so both
// waited 5 s. With the crop only the centre icon is left, under PlaybackIndicator.
const STALL_REVEAL_MOVE_MS = youtubeFlags.cropChrome ? 300 : 5000;
export const SKIP_SECONDS = 10;
const ROW_REST_MS = 500;
const LATE_STOP_MS = 12000;
// After a resume, how long a not-yet-moving video stays on screen before the stall cover.
const RESUME_GRACE_MS = YOUTUBE_ICON_MS + 2000;
// Once the picture shows, only a freeze this long brings the cover back, and none in the first
// seconds after a cover lifts (user request 2026-11-03: no repeated loading while playing).
const STALL_COVER_AFTER_MS = Platform.isTV ? 5000 : 2500;
const NO_STALL_COVER_AFTER_REVEAL_MS = Platform.isTV ? 10000 : 4000;

class PreviousController {
  readonly engine = new EngineRef();
  private expectedId = '';
  private lastTime = -1;
  private lastMoveAt = 0;
  private movingSince = 0;
  /** Phone: when the first frame was reported; the start cover lifts only after a movement past it. */
  private firstFrameAt = 0;
  private loadStartedAt = 0;
  private ytState = -1;
  private bufferingSince = 0;
  /** The watchdog showed Play; a late start still plays (and reveals like a fresh start). */
  private gaveUp = false;
  private watchdog: ReturnType<typeof setTimeout> | null = null;

  /** The page's cover hold: silent while the loading or stall cover is up. */
  private coverHeld = false;
  /** TV: the Watched list is open. */
  private listOpen = false;
  private rowTimer: ReturnType<typeof setTimeout> | null = null;
  private lateStop: ReturnType<typeof setTimeout> | null = null;
  /** No stall cover until then after a resume (togglePlay) or a cover lifting. */
  private resumeGraceUntil = 0;
  /** No internet: the start watchdog waits instead of giving up. */
  private offline = false;
  /** Back online: one immediate seek nudge for a stall in the next minute (see broadcastController). */
  private onlineAt = 0;
  private reconnectNudged = false;

  constructor() {
    setInterval(() => this.tick(), 250);
    // TV shows no cover over a stall (PreviousPlayerLayer): the page stays as it is.
    usePreviousPlayerStore.subscribe((s) => this.setCoverHold(s.isOpen && (s.isLoading || (!Platform.isTV && s.isStalled))));
    if (Platform.isTV) {
      // The list closed with no programme chosen: the live player paused for it comes back.
      useUiStore.subscribe((s) => {
        const open = s.overlays.includes('previous-list');
        if (this.listOpen && !open && !usePreviousPlayerStore.getState().isOpen) broadcast.previousClosed();
        this.listOpen = open;
      });
    }
  }

  /**
   * TV, the list is opening: only a popup over the live player, which plays on with its sound
   * (user request 2026-11-16; it used to pause here, from 2026-11-04, because next to the live one
   * a programme took 7–10 s to load). The live player pauses once a programme is picked (play).
   */
  listOpening(): void {
    this.listOpen = true;
  }

  /** TV: the row the viewer rests on is the one to have ready (a moment later, not on every step past it). */
  rowFocused(videoId: string): void {
    prefetchThumbnail(videoId);
    if (this.rowTimer) clearTimeout(this.rowTimer);
    this.rowTimer = setTimeout(() => {
      this.rowTimer = null;
      if (this.listOpen) this.warm(videoId);
    }, ROW_REST_MS);
  }

  private setCoverHold(on: boolean): void {
    if (this.coverHeld === on) return;
    this.coverHeld = on;
    this.engine.run(playerCommand.coverHold(on));
  }

  /** The list opened: create the page (first time) and cue the first row. */
  warm(firstVideoId: string | undefined): void {
    this.cancelLateStop();
    // TV too (2026-11-03): creating the page only when a programme was chosen made its first
    // start take ~16 s on the test box; the user wants it to start right away. Earlier a second
    // page loading next to the live one stalled the live video behind the list (~20 s, YouTube's
    // controls showing); the live player now has a stall cover, and it is stopped anyway once a
    // programme is chosen.
    const store = usePreviousPlayerStore.getState();
    if (!store.isCreated) usePreviousPlayerStore.setState({ isCreated: true });
    if (firstVideoId && !store.isOpen && !store.video) {
      usePreviousPlayerStore.setState({ warmVideoId: firstVideoId });
      // Started muted and held on its first frame, so a tap only resumes it: a cued video still
      // took ~10 s to start on the TV box and ~2.8 s on the phone (2026-11-03).
      this.engine.run(playerCommand.preload(firstVideoId));
    }
  }

  play(video: VideoProgram): void {
    if (this.rowTimer) clearTimeout(this.rowTimer);
    this.rowTimer = null;
    this.cancelLateStop();
    // TV: YouTube first. Sent after the update below it waited behind the player layer's draw,
    // and reached the page ~1.2 s after the key on the box (2026-11-04).
    if (Platform.isTV) this.engine.run(playerCommand.load(video.videoId, 0, true, true));
    this.expectedId = video.videoId;
    this.lastTime = -1;
    this.movingSince = 0;
    this.lastMoveAt = 0;
    this.firstFrameAt = 0;
    this.ytState = -1;
    this.bufferingSince = 0;
    this.gaveUp = false;
    this.loadStartedAt = Date.now();
    usePreviousPlayerStore.setState({
      isCreated: true,
      isOpen: true,
      video,
      isPlaying: true,
      isEnded: false,
      isLoading: true,
      isStalled: false,
      currentTime: 0,
      scrubTime: null,
      duration: video.duration,
      isMuted: false,
      controlsVisible: true,
      isFullscreen: useUiStore.getState().isFullscreen,
    });
    broadcast.previousOpened();
    // TV creates the page only now (no warm-up): give it time to load first.
    const pageWait = this.engine.isReady ? 0 : PAGE_LOAD_GRACE_MS;
    if (!Platform.isTV) this.engine.run(playerCommand.load(video.videoId, 0, true, true));
    this.armWatchdog(PLAY_WATCHDOG_MS + pageWait);
  }

  /** Connectivity: offline the start watchdog waits; back online a stuck video is nudged. */
  setOnline(online: boolean): void {
    this.offline = !online;
    if (!online) return;
    this.onlineAt = Date.now();
    this.reconnectNudged = false;
    const s = usePreviousPlayerStore.getState();
    if (s.isOpen && s.isPlaying && !s.isEnded && Date.now() - this.lastMoveAt > 3000) this.engine.run(playerCommand.play());
  }

  togglePlay(): void {
    const { isEnded, isPlaying } = usePreviousPlayerStore.getState();
    this.gaveUp = false;
    // Resuming: the picture is still YouTube's paused one (title bar, "More videos"),
    // so the stall cover goes up with the same update and lifts once it plays (tick).
    if (isEnded) {
      this.engine.run(playerCommand.seek(0));
      this.engine.run(playerCommand.play());
      usePreviousPlayerStore.setState({ isEnded: false, isPlaying: true, isStalled: true, currentTime: 0 });
      return;
    }
    if (isPlaying) {
      this.engine.run(playerCommand.pause());
      usePreviousPlayerStore.setState({ isPlaying: false, isStalled: false });
    } else {
      // Play / pause is only play / pause: no loading screen on resume (user request
      // 2026-11-03). The ▶ flash covers YouTube's centre icon (and its spinner) meanwhile.
      this.engine.run(playerCommand.play());
      this.resumeGraceUntil = Date.now() + RESUME_GRACE_MS;
      usePreviousPlayerStore.setState((st) => ({ isPlaying: true, isStalled: false, resumeFlash: st.resumeFlash + 1 }));
      this.armWatchdog();
    }
  }

  seek(seconds: number): void {
    const { duration } = usePreviousPlayerStore.getState();
    const clamped = Math.max(0, Math.min(seconds, duration > 0 ? duration - 0.5 : seconds));
    this.engine.run(playerCommand.seek(clamped));
    // The jump itself is not playback (deviation from the web, which counts
    // it): otherwise the first report at the new position lifts the stall
    // cover while YouTube still buffers, and on TV its spinner, title bar and
    // "More videos" show through.
    this.lastTime = clamped;
    // After every jump (±10 s, scrub) YouTube shows its title bar, play glyph
    // and "More videos" for a few seconds, even when it resumes at once (TV and
    // phone). While playing, the stall cover goes up now and lifts after 5 s of
    // movement at the new position (tick).
    const cover = usePreviousPlayerStore.getState().isPlaying;
    if (cover) this.movingSince = 0;
    usePreviousPlayerStore.setState(cover ? { currentTime: clamped, isEnded: false, isStalled: true } : { currentTime: clamped, isEnded: false });
  }

  skip(delta: number): void {
    this.seek(usePreviousPlayerStore.getState().currentTime + delta);
  }

  toggleMute(): void {
    const next = !usePreviousPlayerStore.getState().isMuted;
    this.engine.run(playerCommand.mute(next));
    usePreviousPlayerStore.setState({ isMuted: next });
  }

  /** Close: stop + mute this player, close the player AND the list, back to live (web). */
  close(): void {
    if (!usePreviousPlayerStore.getState().isOpen) return;
    this.clearWatchdog();
    this.engine.run(playerCommand.mute(true));
    if (Platform.isTV) {
      // The live player first, and only paused here: stopping tears YouTube's player down on the
      // page thread both pages share, and held the live seek back ~2.8 s on the box (2026-11-04).
      this.engine.run(playerCommand.pause());
      broadcast.previousClosed();
      this.lateStop = setTimeout(() => {
        this.lateStop = null;
        this.engine.run(playerCommand.stop());
      }, LATE_STOP_MS);
    } else {
      this.engine.run(playerCommand.stop());
    }
    this.expectedId = '';
    this.gaveUp = false;
    usePreviousPlayerStore.setState({
      isOpen: false,
      video: null,
      isPlaying: false,
      isEnded: false,
      isLoading: false,
      isStalled: false,
      isFullscreen: false,
      scrubTime: null,
    });
    useUiStore.getState().close('previous-list');
    broadcast.previousClosed();
  }

  onAppBackground(): void {
    if (!usePreviousPlayerStore.getState().isOpen) return;
    this.engine.run(playerCommand.pause());
    usePreviousPlayerStore.setState({ isPlaying: false });
  }

  onPlayerMessage(msg: PlayerPageMessage): void {
    // A rebuilt page starts unheld.
    if (msg.type === 'ready' && this.coverHeld) this.engine.run(playerCommand.coverHold(true));
    if (!('id' in msg) || msg.id !== this.expectedId) {
      if (msg.type === 'log') console.log('[previous page]', msg.msg);
      return;
    }
    switch (msg.type) {
      case 'firstFrame': {
        this.clearWatchdog();
        const { isMuted } = usePreviousPlayerStore.getState();
        if (youtubeFlags.autoUnmute && !isMuted) this.engine.run(playerCommand.mute(false));
        // Phone: playback counts from its first frame, so the cover lifts 0.3 s after it once a
        // progress report shows it moving (the TV waits for the reported movement; see
        // broadcastController.onFirstFrame). A resumed preload reports PLAYING ~1 s before its
        // held frame moves: lifting at 0.3 s showed that frame frozen, without sound.
        if (!Platform.isTV) {
          const now = Date.now();
          this.firstFrameAt = now;
          this.lastMoveAt = now;
          if (!this.movingSince) this.movingSince = now;
        }
        this.lateStart();
        usePreviousPlayerStore.setState({ isPlaying: true });
        break;
      }
      case 'state':
        this.noteState(msg.state);
        if (msg.state === 1) {
          // TV: PLAYING counts as movement, so the cover lifts in a tick or two (sound with it).
          if (Platform.isTV) {
            this.lastMoveAt = Date.now();
            if (!this.movingSince) this.movingSince = this.lastMoveAt;
          }
          this.lateStart();
          usePreviousPlayerStore.setState({ isPlaying: true, isEnded: false });
        }
        break;
      case 'progress': {
        const now = Date.now();
        this.noteState(msg.state);
        if (this.lastTime >= 0 && msg.current > this.lastTime + 0.15) {
          this.lastMoveAt = now;
          if (!this.movingSince) this.movingSince = now;
          this.lateStart();
        } else if (this.lastTime >= 0 && msg.current < this.lastTime - 1) {
          this.movingSince = 0;
        }
        this.lastTime = msg.current;
        const patch: Record<string, number> = { currentTime: msg.current };
        if (msg.duration > 0) patch.duration = msg.duration;
        usePreviousPlayerStore.setState(patch);
        break;
      }
      case 'end':
        usePreviousPlayerStore.setState({ isEnded: true, isPlaying: false, isLoading: false, isStalled: false, controlsVisible: true });
        this.engine.run(playerCommand.pause());
        break;
      case 'error':
        // The IFrame API script failed to load: the page tries again by itself.
        if (msg.code === 0) break;
        console.warn('Previous player error', msg.code);
        this.clearWatchdog();
        usePreviousPlayerStore.setState({ isLoading: false });
        break;
      default:
        break;
    }
  }

  private noteState(state: number): void {
    this.ytState = state;
    if (state !== 3) this.bufferingSince = 0;
    else if (!this.bufferingSince) this.bufferingSince = Date.now();
  }

  /**
   * Reveal after ≥3 s of real movement (cap 20 s); cover a frozen picture after 1.2 s.
   * "Frozen" also covers YouTube reporting BUFFERING for >1.2 s (as the live player
   * does): on the TV box's WebView the clock kept running while YouTube showed its
   * spinner, title bar and "More videos" on a black picture, so a time-only check
   * left all of that on screen.
   */
  private tick(): void {
    const s = usePreviousPlayerStore.getState();
    if (!s.isOpen) return;
    const now = Date.now();
    const buffering = this.ytState === 3 && this.bufferingSince > 0 && now - this.bufferingSince > STALL_COVER_MS;
    if (now - this.lastMoveAt > STALL_COVER_MS || buffering) this.movingSince = 0;
    const frozen = s.isPlaying && !s.isEnded && (now - this.lastMoveAt > STALL_COVER_MS || buffering);
    const moved = this.movingSince ? now - this.movingSince : 0;
    if (!this.reconnectNudged && now - this.onlineAt < 60000 && s.isPlaying && !s.isEnded && !s.isLoading && now - this.lastMoveAt > 1500) {
      this.reconnectNudged = true;
      this.engine.run(playerCommand.seek(s.currentTime + 0.1));
      this.engine.run(playerCommand.play());
    }
    if (s.isLoading) {
      if ((moved >= REVEAL_AFTER_PLAYING_MS && this.lastMoveAt > this.firstFrameAt) || now - this.loadStartedAt >= REVEAL_MAX_WAIT_MS) {
        // Lifted at the cap while still frozen: the stall cover takes over in the same update.
        if (!frozen) this.resumeGraceUntil = Math.max(this.resumeGraceUntil, now + NO_STALL_COVER_AFTER_REVEAL_MS);
        usePreviousPlayerStore.setState({ isLoading: false, isStalled: frozen });
      }
      return;
    }
    if (!s.isStalled) {
      // Only a real stall brings the cover back, never right after a resume or a reveal.
      const frozenLong =
        s.isPlaying && !s.isEnded &&
        (now - this.lastMoveAt > STALL_COVER_AFTER_MS || (this.ytState === 3 && this.bufferingSince > 0 && now - this.bufferingSince > STALL_COVER_AFTER_MS));
      if (frozenLong && now >= this.resumeGraceUntil) usePreviousPlayerStore.setState({ isStalled: true });
    } else if (!s.isPlaying || (!frozen && moved >= STALL_REVEAL_MOVE_MS)) {
      // Paused (the thumbnail covers it then) or playing again.
      if (s.isPlaying) this.resumeGraceUntil = Math.max(this.resumeGraceUntil, now + NO_STALL_COVER_AFTER_REVEAL_MS);
      usePreviousPlayerStore.setState({ isStalled: false });
    }
  }

  /**
   * Native WebViews may play without a gesture, so the web's "Tap to Play"
   * screen isn't needed (plan D-13). Checked every 4 s (web): while YouTube is
   * still starting (unstarted, buffering, cued or paused, which the page keeps
   * re-sending play for), the loading cover stays; only after
   * MAX_START_WAIT_MS does the transport show Play instead of an endless
   * loading screen. Showing Play after 4 s made a slow start on the TV box
   * look like autoplay was broken.
   */
  private armWatchdog(delayMs = PLAY_WATCHDOG_MS): void {
    this.clearWatchdog();
    const armedAt = Date.now();
    // TV's first open waits for the page to load; that grace doesn't count.
    const capFrom = armedAt + delayMs - PLAY_WATCHDOG_MS;
    const check = () => {
      this.watchdog = null;
      const s = usePreviousPlayerStore.getState();
      if (!s.isOpen || !s.isPlaying || this.lastMoveAt > armedAt) return;
      // PLAYING without movement is a stall (cover), ENDED has its own handler.
      if (this.ytState === 1 || this.ytState === 0) return;
      if (this.offline || Date.now() - capFrom < MAX_START_WAIT_MS) {
        this.watchdog = setTimeout(check, PLAY_WATCHDOG_MS);
        return;
      }
      this.gaveUp = true;
      usePreviousPlayerStore.setState({ isPlaying: false, isLoading: false, isStalled: false });
    };
    this.watchdog = setTimeout(check, delayMs);
  }

  /** It started after the watchdog showed Play: play on, behind the loading cover until it has moved for 3 s. */
  private lateStart(): void {
    if (!this.gaveUp) return;
    this.gaveUp = false;
    this.loadStartedAt = Date.now();
    usePreviousPlayerStore.setState({ isPlaying: true, isLoading: true, isEnded: false });
  }

  private cancelLateStop(): void {
    if (this.lateStop) clearTimeout(this.lateStop);
    this.lateStop = null;
  }

  private clearWatchdog(): void {
    if (this.watchdog) clearTimeout(this.watchdog);
    this.watchdog = null;
  }
}

export const previousPlayer = new PreviousController();
