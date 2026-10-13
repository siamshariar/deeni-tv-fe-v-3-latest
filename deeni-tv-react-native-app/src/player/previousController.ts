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
const REVEAL_AFTER_PLAYING_MS = 3000;
const REVEAL_MAX_WAIT_MS = 20000;
const STALL_COVER_MS = 1200;
export const SKIP_SECONDS = 10;

class PreviousController {
  readonly engine = new EngineRef();
  private expectedId = '';
  private lastTime = -1;
  private lastMoveAt = 0;
  private movingSince = 0;
  private loadStartedAt = 0;
  private bufferingSince = 0;
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
    this.bufferingSince = 0;
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
    if (isEnded) {
      this.engine.run(playerCommand.seek(0));
      this.engine.run(playerCommand.play());
      usePreviousPlayerStore.setState({ isEnded: false, isPlaying: true, currentTime: 0 });
      return;
    }
    if (isPlaying) {
      this.engine.run(playerCommand.pause());
      usePreviousPlayerStore.setState({ isPlaying: false });
    } else {
      this.engine.run(playerCommand.play());
      usePreviousPlayerStore.setState({ isPlaying: true });
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
    usePreviousPlayerStore.setState({ currentTime: clamped, isEnded: false });
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
        usePreviousPlayerStore.setState({ isPlaying: true });
        break;
      }
      case 'state':
        if (msg.state === 1) usePreviousPlayerStore.setState({ isPlaying: true, isEnded: false });
        if (msg.state === 3 && !this.bufferingSince) this.bufferingSince = Date.now();
        if (msg.state !== 3) this.bufferingSince = 0;
        break;
      case 'progress': {
        const now = Date.now();
        if (this.lastTime >= 0 && msg.current > this.lastTime + 0.15) {
          this.lastMoveAt = now;
          if (!this.movingSince) this.movingSince = now;
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

  /** Reveal after ≥3 s of real movement (cap 20 s); cover a frozen picture after 1.2 s. */
  private tick(): void {
    const s = usePreviousPlayerStore.getState();
    if (!s.isOpen) return;
    const now = Date.now();
    if (now - this.lastMoveAt > STALL_COVER_MS) this.movingSince = 0;
    if (s.isLoading) {
      const moved = this.movingSince ? now - this.movingSince : 0;
      if (moved >= REVEAL_AFTER_PLAYING_MS || now - this.loadStartedAt >= REVEAL_MAX_WAIT_MS) {
        usePreviousPlayerStore.setState({ isLoading: false });
      }
      return;
    }
    const frozen = s.isPlaying && !s.isEnded && now - this.lastMoveAt > STALL_COVER_MS;
    if (frozen !== s.isStalled) usePreviousPlayerStore.setState({ isStalled: frozen });
  }

  /**
   * Native WebViews may play without a gesture, so the web's "Tap to Play"
   * screen isn't needed (plan D-13). If playback still hasn't started after
   * 4 s (or keeps buffering for 12 s), the transport shows Play instead of an
   * endless loading screen.
   */
  private armWatchdog(delayMs = PLAY_WATCHDOG_MS): void {
    this.clearWatchdog();
    this.watchdog = setTimeout(() => {
      const s = usePreviousPlayerStore.getState();
      if (!s.isOpen || this.movingSince) return;
      const bufferingTooLong = this.bufferingSince && Date.now() - this.bufferingSince >= MAX_BUFFERING_WAIT_MS - PLAY_WATCHDOG_MS;
      if (!this.lastMoveAt || bufferingTooLong) {
        usePreviousPlayerStore.setState({ isPlaying: false, isLoading: false });
      }
    }, delayMs);
  }

  private clearWatchdog(): void {
    if (this.watchdog) clearTimeout(this.watchdog);
    this.watchdog = null;
  }
}

export const previousPlayer = new PreviousController();
