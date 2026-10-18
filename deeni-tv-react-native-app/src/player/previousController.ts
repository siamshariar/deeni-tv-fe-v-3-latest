/**
 * The Previous-programme player (web: PreviousVideoPlayer in
 * components/previous-videos-modal.tsx). A second, persistent player page:
 * created the first time the Previous list opens (TV: the first time a
 * programme is played), warmed with the first row on phones, then kept for
 * the app's life. Closing only stops it.
 */
import { Platform } from 'react-native';

import { youtubeFlags } from '@/lib/config';
import { playerCommand, type PlayerPageMessage } from '@/lib/youtube/playerPage';
import { usePreviousPlayerStore } from '@/store/usePreviousPlayerStore';
import { useUiStore } from '@/store/useUiStore';
import type { VideoProgram } from '@/types';

import { broadcast } from './broadcastController';
import { EngineRef } from './engine';

// Web values (previous-videos-modal.tsx)
const PLAY_WATCHDOG_MS = 4000;
const PAGE_LOAD_GRACE_MS = 12000;
const MAX_BUFFERING_WAIT_MS = 12000;
// Web 3000. On the phone YouTube's start overlay (title bar, pause glyph, logo)
// was still up after 5 s of playback (Realme RMX2030), so the phone waits 6 s.
const REVEAL_AFTER_PLAYING_MS = Platform.isTV ? 3000 : 6000;
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
// movement on the TV box and ~4 s on the phone (screen-recorded frames), so both wait 5 s.
const STALL_REVEAL_MOVE_MS = 5000;
export const SKIP_SECONDS = 10;

class PreviousController {
  readonly engine = new EngineRef();
  private expectedId = '';
  private lastTime = -1;
  private lastMoveAt = 0;
  private movingSince = 0;
  private loadStartedAt = 0;
  private ytState = -1;
  private bufferingSince = 0;
  /** The watchdog showed Play; a late start still plays (and reveals like a fresh start). */
  private gaveUp = false;
  private watchdog: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    setInterval(() => this.tick(), 250);
  }

  /** The list opened: create the page (first time) and cue the first row. */
  warm(firstVideoId: string | undefined): void {
    // TV: no warm-up. A second YouTube page loading next to the live one made
    // the live video on the test box (4 GB, HiSilicon) stall for ~20 s, with
    // YouTube's own controls and then a black picture. The live player is
    // stopped anyway while a programme plays on TV, so the page is created
    // when one is chosen (play() below; commands wait in the engine queue).
    if (Platform.isTV) return;
    const store = usePreviousPlayerStore.getState();
    if (!store.isCreated) usePreviousPlayerStore.setState({ isCreated: true });
    if (firstVideoId && !store.isOpen && !store.video) {
      usePreviousPlayerStore.setState({ warmVideoId: firstVideoId });
      this.engine.run(playerCommand.load(firstVideoId, 0, false, true));
    }
  }

  play(video: VideoProgram): void {
    this.expectedId = video.videoId;
    this.lastTime = -1;
    this.movingSince = 0;
    this.lastMoveAt = 0;
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
    this.engine.run(playerCommand.load(video.videoId, 0, true, true));
    this.armWatchdog(PLAY_WATCHDOG_MS + pageWait);
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
      this.engine.run(playerCommand.play());
      usePreviousPlayerStore.setState({ isPlaying: true, isStalled: true });
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
    this.engine.run(playerCommand.stop());
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
    if (!('id' in msg) || msg.id !== this.expectedId) {
      if (msg.type === 'log') console.log('[previous page]', msg.msg);
      return;
    }
    switch (msg.type) {
      case 'firstFrame': {
        this.clearWatchdog();
        const { isMuted } = usePreviousPlayerStore.getState();
        if (youtubeFlags.autoUnmute && !isMuted) this.engine.run(playerCommand.mute(false));
        this.lateStart();
        usePreviousPlayerStore.setState({ isPlaying: true });
        break;
      }
      case 'state':
        this.noteState(msg.state);
        if (msg.state === 1) {
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
    if (s.isLoading) {
      if (moved >= REVEAL_AFTER_PLAYING_MS || now - this.loadStartedAt >= REVEAL_MAX_WAIT_MS) {
        // Lifted at the cap while still frozen: the stall cover takes over in the same update.
        usePreviousPlayerStore.setState({ isLoading: false, isStalled: frozen });
      }
      return;
    }
    if (!s.isStalled) {
      if (frozen) usePreviousPlayerStore.setState({ isStalled: true });
    } else if (!s.isPlaying || (!frozen && moved >= STALL_REVEAL_MOVE_MS)) {
      // Paused (the thumbnail covers it then) or playing again.
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
      if (Date.now() - capFrom < MAX_START_WAIT_MS) {
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

  private clearWatchdog(): void {
    if (this.watchdog) clearTimeout(this.watchdog);
    this.watchdog = null;
  }
}

export const previousPlayer = new PreviousController();
