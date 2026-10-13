/**
 * The live broadcast controller. Re-implements the web player's orchestration
 * (components/synced-video-player.tsx at fixes_to_launch a080ec2) with the
 * same rules and timings, driving the live player page through EngineRef:
 *
 * - loadChannel: external API (wait 10 s, keep the request up to 120 s and
 *   switch if a late answer names a different video) → web route → embedded
 * - start at the live offset (seekTo + time since the schedule was fetched)
 * - muted start, unmute on the first frame; volume locked until then
 * - branded cover until ≥3 s of real movement; stall cover after 1.2 s frozen
 * - auto-advance at the end, post-transition queue alignment, 60 s sync
 * - load timeout (20 s → one retry → "Failed to Load"), 12 s start watchdog,
 *   stall ladder (play → seek nudge → reload, 25 s cooldown)
 * - rejoin live after the Previous player closes and when the app returns
 */
import { Platform } from 'react-native';

import { fetchExternalSchedule, fetchWebRouteSchedule } from '@/lib/api/client';
import { isUsableSchedule } from '@/lib/api/normalize';
import { youtubeFlags } from '@/lib/config';
import { alignQueue, embeddedQueueAfter, upcomingFromSchedule } from '@/lib/schedule/queue';
import { buildLocalCurrentVideoResponse, toVideoProgram } from '@/lib/schedule/schedule';
import { addToPreviousVideos, getPreviousVideos, savePreviousVideos } from '@/lib/storage';
import { playerCommand, type PlayerPageMessage } from '@/lib/youtube/playerPage';
import { useBroadcastStore } from '@/store/useBroadcastStore';
import { useChannelStore } from '@/store/useChannelStore';
import type { ScheduleResult, VideoProgram } from '@/types';

import { EngineRef } from './engine';

// Web timings (Ref doc §5.6)
const STARTUP_API_WAIT_MS = 10000;
const LOAD_TIMEOUT_MS = 20000;
const START_WATCHDOG_MS = 12000;
const STALL_TICK_MS = 1500;
const COVER_TICK_MS = 300;
const SYNC_INTERVAL_MS = 60000;
const NO_NEXT_RELOAD_MS = 20000;
const POST_TRANSITION_SYNC_MS = 500;
const COVER_MIN_MOVE_MS = 3000;
// After a stall, YouTube shows its own controls (title bar, play glyph, "More videos")
// for ~3 s once playback resumes. TV waits that out like the start cover; the phone
// keeps the web's 0.6 s.
const COVER_MIN_MOVE_AFTER_STALL_MS = Platform.isTV ? 3000 : 600;
const STALL_COVER_MS = 1200;
const REJOIN_DRIFT_S = 20;
const REJOIN_API_WAIT_MS = 8000;
const START_CORRECTION_S = 5;

export const LOAD_TIMEOUT_MESSAGE = 'Playback is taking longer than expected. Please tap Refresh.';

const PENDING = Symbol('pending');
const delay = (ms: number) => new Promise<typeof PENDING>((resolve) => setTimeout(() => resolve(PENDING), ms));

type LoadOptions = { prefetched?: ScheduleResult; isRecoveryRetry?: boolean };

class BroadcastController {
  readonly engine = new EngineRef();

  private attempt = 0;
  private recoveryAttempts = 0;
  private source: 'external-api' | 'fallback' = 'fallback';
  private expectedId = '';
  private transitioning = false;
  private lastNoNextReloadAt = 0;
  private pageReady = false;
  private pageRebuilt = false;
  private loadSent = false;

  // first frame / movement / covers
  private firstFrameSeen = false;
  private channelPlayed = false;
  private lastTime = -1;
  private lastMoveAt = 0;
  private movingSince = 0;
  private stallCover = false;
  private endCover = false;
  private liveTarget: { position: number; at: number } | null = null;
  /**
   * Where the current video is in the broadcast at `at` (schedule start, a programme
   * switch, a rejoin). Used to catch up after a stall: on TV boxes the video often
   * buffers again right after the first frame, and that time was never made up.
   */
  private liveAnchor: { videoId: string; position: number; at: number } | null = null;
  /** The cover up now is the start cover of a channel load (not a programme switch). */
  private startCover = false;

  // stall ladder
  private playerState = -1;
  private watchTime = 0;
  private watchAt = 0;
  private bufferingSince = 0;
  /** Since when YouTube has reported BUFFERING (for the stall cover; the ladder keeps its own). */
  private coverBufferingSince = 0;
  private ladderStep = 0;
  private lastHardRecoveryAt = 0;

  // sound
  private pendingUnmute = true;
  private userMuted = false;

  // other players / app
  private previousActive = false;
  private backgrounded = false;

  private loadTimer: ReturnType<typeof setTimeout> | null = null;
  private startTimer: ReturnType<typeof setTimeout> | null = null;
  private unavailableTimer: ReturnType<typeof setTimeout> | null = null;
  private intervals: ReturnType<typeof setInterval>[] = [];

  constructor() {
    this.engine.onReset(() => {
      this.pageReady = false;
      const channelId = useBroadcastStore.getState().channelId;
      if (channelId) void this.loadChannel(channelId, { isRecoveryRetry: true });
    });
    this.intervals.push(setInterval(() => this.coverTick(), COVER_TICK_MS));
    this.intervals.push(setInterval(() => this.stallTick(), STALL_TICK_MS));
    this.intervals.push(setInterval(() => void this.periodicSync(), SYNC_INTERVAL_MS));
  }

  // ── Public actions ──────────────────────────────────────────────────────

  /** First start or channel switch (always tries to start with sound, like the web). */
  selectChannel(channelId: string): void {
    useChannelStore.getState().select(channelId);
    void this.loadChannel(channelId);
  }

  /** Refresh / Try Again: the current programme goes into history, then reload (web handleReload). */
  refresh(): void {
    const { channelId, currentProgram } = useBroadcastStore.getState();
    if (!channelId) return;
    if (currentProgram) {
      useBroadcastStore.setState({ history: addToPreviousVideos(channelId, currentProgram) });
    }
    void this.loadChannel(channelId);
  }

  toggleMute(): void {
    const { volumeLocked, isMuted } = useBroadcastStore.getState();
    if (volumeLocked || this.previousActive) return;
    const next = !isMuted;
    this.userMuted = next;
    this.pendingUnmute = false;
    this.engine.run(playerCommand.mute(next));
    useBroadcastStore.setState({ isMuted: next });
  }

  // ── loadChannel ─────────────────────────────────────────────────────────

  async loadChannel(channelId: string, options: LoadOptions = {}): Promise<void> {
    const attempt = ++this.attempt;
    const stale = () => attempt !== this.attempt;

    this.clearTimers();
    if (!options.isRecoveryRetry) this.recoveryAttempts = 0;
    this.resetPlaybackTracking();
    this.channelPlayed = false;
    this.transitioning = false;
    this.userMuted = false;
    this.pendingUnmute = youtubeFlags.autoUnmute;
    this.loadSent = false;

    useChannelStore.getState().select(channelId);
    useBroadcastStore.setState({
      channelId,
      phase: 'tuning',
      errorMessage: null,
      coverVisible: false,
      videoVisible: false,
      volumeLocked: true,
      isMuted: true,
      unavailableUntil: null,
      history: getPreviousVideos(channelId),
    });
    this.engine.run(playerCommand.mute(true));

    let result: ScheduleResult | null = options.prefetched ?? null;
    if (!result) {
      const apiPromise = fetchExternalSchedule(channelId);
      const raced = await Promise.race([apiPromise, delay(STARTUP_API_WAIT_MS)]);
      if (raced === PENDING) {
        // Don't hold the loading screen for a slow API; switch if it later
        // names a different programme (web: late API answer).
        apiPromise
          .then((late) => {
            if (!late || stale()) return;
            if (late.currentProgram.ytVideoId === this.expectedId) return;
            void this.loadChannel(channelId, { prefetched: late });
          })
          .catch(() => {});
      } else {
        result = raced;
      }
    }
    if (stale()) return;
    if (!result) result = await fetchWebRouteSchedule(channelId);
    if (stale()) return;
    if (!isUsableSchedule(result)) result = buildLocalCurrentVideoResponse(channelId, 15);

    this.applySchedule(channelId, result, attempt);
  }

  private applySchedule(channelId: string, result: ScheduleResult, attempt: number): void {
    const scheduleAt = result._fetchedAt ?? Date.now();
    this.source = result._source === 'external-api' ? 'external-api' : 'fallback';

    const program = toVideoProgram(result.currentProgram, channelId);
    const upcoming = upcomingFromSchedule(result, channelId, program.videoId);

    // History: real watch history wins; seed from the schedule only when empty (web).
    let history = getPreviousVideos(channelId);
    if (history.length === 0 && result.previousPrograms?.length) {
      history = result.previousPrograms.map((p) => toVideoProgram(p, channelId)).slice(0, 30);
      savePreviousVideos(channelId, history);
    }

    const elapsed = Math.max(0, (Date.now() - scheduleAt) / 1000);
    const start = Math.min(result.currentProgram.seekTo + elapsed, Math.max(0, program.duration - 2));
    this.liveTarget = { position: start, at: Date.now() };
    this.expectedId = program.videoId;
    this.liveAnchor = { videoId: program.videoId, position: start, at: Date.now() };
    this.startCover = true;

    useBroadcastStore.setState({
      phase: 'branded',
      currentProgram: program,
      nextProgram: upcoming[0] ?? null,
      upcoming,
      history,
      coverVisible: true,
      coverTitle: program.title,
      currentTime: start,
      duration: program.duration,
    });

    this.armLoadTimeout(channelId, attempt);
    this.engine.run(playerCommand.load(program.videoId, start, true, true));
    this.loadSent = true;
    if (this.previousActive) this.applyPreviousMode();
    if (this.pageReady) this.armStartWatchdog(attempt);
  }

  // ── Player page events ──────────────────────────────────────────────────

  onPlayerMessage(msg: PlayerPageMessage): void {
    if (__DEV__ && msg.type !== 'progress') console.log('[live]', JSON.stringify(msg));
    switch (msg.type) {
      case 'ready':
        this.pageReady = true;
        if (this.loadSent && !this.firstFrameSeen) this.armStartWatchdog(this.attempt);
        break;
      case 'state':
        this.playerState = msg.state;
        if (msg.state === 3 && !this.bufferingSince) this.bufferingSince = Date.now();
        this.trackCoverBuffering(msg.state);
        break;
      case 'firstFrame':
        if (msg.id === this.expectedId) this.onFirstFrame();
        break;
      case 'progress':
        if (msg.id === this.expectedId) this.onProgress(msg.current, msg.duration, msg.state);
        break;
      case 'nearEnd':
        if (msg.id === this.expectedId) this.onNearEnd();
        break;
      case 'end':
        if (msg.id === this.expectedId) this.playNextVideo();
        break;
      case 'error':
        if (msg.code === 0 || msg.id === this.expectedId) this.onPlayerError(msg.code);
        break;
      case 'log':
        console.log('[live page]', msg.msg);
        break;
    }
  }

  private onFirstFrame(): void {
    if (this.firstFrameSeen) return;
    this.firstFrameSeen = true;
    this.channelPlayed = true;
    this.recoveryAttempts = 0;
    this.clearTimer('start');
    this.clearTimer('load');
    this.watchTime = this.lastTime;
    this.watchAt = Date.now();
    this.bufferingSince = 0;
    this.ladderStep = 0;

    let isMuted = useBroadcastStore.getState().isMuted;
    if (!this.previousActive && !this.backgrounded) {
      if (this.pendingUnmute) {
        this.engine.run(playerCommand.mute(false));
        isMuted = false;
      } else if (this.userMuted) {
        this.engine.run(playerCommand.mute(true));
        isMuted = true;
      }
    }
    this.pendingUnmute = false;
    useBroadcastStore.setState({ phase: 'playing', volumeLocked: false, isMuted, videoVisible: true });

    // A slow start can land behind the broadcast: catch up once (cover stays up).
    if (this.liveTarget && this.lastTime >= 0) {
      const target = this.liveTarget.position + (Date.now() - this.liveTarget.at) / 1000;
      const { duration } = useBroadcastStore.getState();
      if (target - this.lastTime > START_CORRECTION_S && (!duration || target < duration - 3)) {
        this.engine.run(playerCommand.seek(target));
        this.movingSince = 0;
      }
    }
    this.liveTarget = null;
  }

  private onProgress(current: number, duration: number, state: number): void {
    const now = Date.now();
    this.playerState = state;
    this.trackCoverBuffering(state);
    if (this.lastTime >= 0 && current > this.lastTime + 0.15) {
      this.lastMoveAt = now;
      if (!this.movingSince) this.movingSince = now;
    } else if (this.lastTime >= 0 && current < this.lastTime - 1) {
      this.movingSince = 0; // new video or seek back: its start counts afresh
    }
    this.lastTime = current;
    const patch: Partial<ReturnType<typeof useBroadcastStore.getState>> = { currentTime: current };
    if (duration > 0) patch.duration = duration;
    useBroadcastStore.setState(patch);
  }

  private onNearEnd(): void {
    if (!youtubeFlags.coverEndScreen) return;
    const { nextProgram, currentProgram } = useBroadcastStore.getState();
    this.endCover = true;
    useBroadcastStore.setState({ coverVisible: true, coverTitle: (nextProgram ?? currentProgram)?.title ?? '' });
  }

  private onPlayerError(code: number): void {
    const { channelId, phase } = useBroadcastStore.getState();
    console.warn('Live player error', code);
    if (code === 2 || code === 5 || code === 100) {
      this.clearTimers();
      useBroadcastStore.setState({ phase: 'error', errorMessage: `Playback error: Error ${code}`, coverVisible: false });
      return;
    }
    if (code === 101 || code === 150) {
      // The programme can't be embedded (plan D-16): say so over the branded
      // cover and move on when its scheduled slot ends.
      this.clearTimers();
      const { duration, currentTime } = useBroadcastStore.getState();
      const remaining = Math.max(5, (duration || 0) - (currentTime || 0));
      useBroadcastStore.setState({ phase: 'unavailable', coverVisible: true, unavailableUntil: Date.now() + remaining * 1000 });
      this.unavailableTimer = setTimeout(() => this.playNextVideo(), remaining * 1000);
      return;
    }
    if (code === 0 && channelId && phase !== 'error') {
      // The IFrame API script failed to load. Rebuild the page once (web: blank
      // frame forever, I-01), then show the error.
      if (!this.pageRebuilt) {
        this.pageRebuilt = true;
        this.engine.rebuild();
        return;
      }
      this.clearTimers();
      useBroadcastStore.setState({ phase: 'error', errorMessage: LOAD_TIMEOUT_MESSAGE, coverVisible: false });
    }
  }

  // ── Transitions ─────────────────────────────────────────────────────────

  playNextVideo(): void {
    if (this.transitioning) return;
    const state = useBroadcastStore.getState();
    const { channelId, currentProgram, nextProgram } = state;
    if (!channelId || !currentProgram) return;
    this.clearTimer('unavailable');

    if (!nextProgram) {
      // Nothing queued: reload the live schedule, at most every 20 s.
      const now = Date.now();
      if (now - this.lastNoNextReloadAt > NO_NEXT_RELOAD_MS) {
        this.lastNoNextReloadAt = now;
        void this.loadChannel(channelId);
      }
      return;
    }

    this.transitioning = true;
    const history = addToPreviousVideos(channelId, currentProgram);
    let upcoming = state.upcoming.slice(1);
    if (!upcoming[0]) upcoming = embeddedQueueAfter(channelId, nextProgram);

    this.resetPlaybackTracking();
    this.expectedId = nextProgram.videoId;
    this.liveAnchor = { videoId: nextProgram.videoId, position: 0, at: Date.now() };
    this.startCover = false; // a new programme starts at 0 (web), no catch-up
    this.pendingUnmute = youtubeFlags.autoUnmute && !this.userMuted;
    useBroadcastStore.setState({
      phase: 'branded',
      history,
      currentProgram: nextProgram,
      nextProgram: upcoming[0] ?? null,
      upcoming,
      coverVisible: true,
      coverTitle: nextProgram.title,
      volumeLocked: true,
      currentTime: 0,
      duration: nextProgram.duration,
    });
    // Every switch is muted until the new video plays (web transition mute).
    this.engine.run(playerCommand.load(nextProgram.videoId, 0, true, true));
    if (this.previousActive) this.applyPreviousMode();
    this.transitioning = false;

    const attempt = this.attempt;
    setTimeout(() => {
      if (attempt === this.attempt) void this.syncAfterTransition(channelId);
    }, POST_TRANSITION_SYNC_MS);
  }

  private async fetchScheduleChain(channelId: string): Promise<ScheduleResult> {
    let result = await fetchExternalSchedule(channelId);
    if (!result) result = await fetchWebRouteSchedule(channelId);
    return isUsableSchedule(result) ? result : buildLocalCurrentVideoResponse(channelId, 15);
  }

  /** Right after a switch: align the queue with what the API reports (web syncImmediateAfterTransition). */
  private async syncAfterTransition(channelId: string): Promise<void> {
    const attempt = this.attempt;
    const result = await this.fetchScheduleChain(channelId);
    if (attempt !== this.attempt) return;
    const latestHistory = getPreviousVideos(channelId);
    if (latestHistory.length > 0) useBroadcastStore.setState({ history: latestHistory });

    const local = useBroadcastStore.getState().currentProgram?.videoId;
    const aligned = alignQueue(result, channelId, local);
    if (aligned.kind === 'use' || aligned.kind === 'after-ours') {
      const patch: Partial<ReturnType<typeof useBroadcastStore.getState>> = { upcoming: aligned.upcoming };
      if (aligned.upcoming[0]) patch.nextProgram = aligned.upcoming[0];
      useBroadcastStore.setState(patch);
    } else if (aligned.kind === 'rejoin') {
      void this.loadChannel(channelId, { prefetched: result });
    }
  }

  /** Every 60 s: refresh the upcoming queue only; drift correction stays off (web). */
  private async periodicSync(): Promise<void> {
    const { channelId, phase } = useBroadcastStore.getState();
    if (!channelId || !this.channelPlayed || phase === 'error' || this.backgrounded) return;
    const attempt = this.attempt;
    const result = await this.fetchScheduleChain(channelId);
    if (attempt !== this.attempt) return;
    const latestHistory = getPreviousVideos(channelId);
    if (latestHistory.length > 0) useBroadcastStore.setState({ history: latestHistory });

    const state = useBroadcastStore.getState();
    const local = state.currentProgram?.videoId ?? '';
    const mapped = upcomingFromSchedule(result, channelId, local);
    if (state.upcoming.length === 0 || mapped.length > 0) {
      const patch: Partial<ReturnType<typeof useBroadcastStore.getState>> = { upcoming: mapped };
      if (mapped[0]) patch.nextProgram = mapped[0];
      useBroadcastStore.setState(patch);
    }
  }

  /**
   * Back to the live position. After the Previous player closes this runs
   * only with the authoritative API (web resyncToLive). When the app returns
   * from the background it also uses the deterministic fallback schedule, and
   * corrects any drift above the 5 s start tolerance: the video was paused while
   * away, so even a short trip left it that far behind with the 20 s rule.
   */
  async resyncToLive(anySource = false, maxDriftS = REJOIN_DRIFT_S): Promise<void> {
    const { channelId } = useBroadcastStore.getState();
    if (!channelId || !this.channelPlayed) return;
    if (!anySource && this.source !== 'external-api') return;
    const requestedAt = Date.now();
    let result: ScheduleResult | null = null;
    if (this.source === 'external-api') {
      const raced = await Promise.race([fetchExternalSchedule(channelId), delay(REJOIN_API_WAIT_MS)]);
      result = raced === PENDING ? null : raced;
    } else {
      result = buildLocalCurrentVideoResponse(channelId, 15);
    }
    if (!result?.currentProgram?.ytVideoId || this.previousActive || this.transitioning) return;
    const liveSeek = (result.currentProgram.seekTo || 0) + (Date.now() - requestedAt) / 1000;
    if (result.currentProgram.ytVideoId === this.expectedId) {
      const drift = liveSeek - Math.max(0, this.lastTime);
      this.liveAnchor = { videoId: this.expectedId, position: liveSeek, at: Date.now() };
      if (Math.abs(drift) > maxDriftS) {
        this.engine.run(playerCommand.seek(liveSeek));
        this.engine.run(playerCommand.play());
        this.movingSince = 0;
      }
    } else {
      void this.loadChannel(channelId, { prefetched: result });
    }
  }

  // ── Previous player interplay (plan D-02) ───────────────────────────────

  private applyPreviousMode(): void {
    if (Platform.isTV) this.engine.run(playerCommand.stop());
    else {
      this.engine.run(playerCommand.hold(true));
      this.engine.run(playerCommand.mute(true));
    }
  }

  previousOpened(): void {
    this.previousActive = true;
    this.applyPreviousMode();
    useBroadcastStore.setState({ isMuted: true });
  }

  previousClosed(): void {
    if (!this.previousActive) return;
    this.previousActive = false;
    const { channelId } = useBroadcastStore.getState();
    if (Platform.isTV) {
      // The live player was stopped to free the decoder: rejoin live.
      if (channelId) void this.loadChannel(channelId);
      return;
    }
    // Web onResumeMainPlayer: release the hold, unmute, play, re-apply, rejoin.
    this.watchTime = Math.max(0, this.lastTime);
    this.watchAt = Date.now();
    this.bufferingSince = 0;
    this.ladderStep = 0;
    this.userMuted = false;
    this.engine.run(playerCommand.hold(false));
    this.engine.run(playerCommand.mute(false));
    this.engine.run(playerCommand.play());
    useBroadcastStore.setState({ isMuted: false });
    let lastT = this.lastTime;
    for (const ms of [600, 1800, 3500]) {
      setTimeout(() => {
        if (this.previousActive) return;
        const t = this.lastTime;
        if (ms > 600 && t <= lastT + 0.2) this.engine.run(playerCommand.seek(t + 0.25));
        lastT = t;
        this.engine.run(playerCommand.play());
        if (!this.userMuted) this.engine.run(playerCommand.mute(false));
      }, ms);
    }
    setTimeout(() => {
      if (!this.previousActive) void this.resyncToLive();
    }, 1200);
  }

  // ── App lifecycle (plan D-29) ───────────────────────────────────────────

  onAppBackground(): void {
    if (this.backgrounded) return;
    this.backgrounded = true;
    this.engine.run(playerCommand.mute(true));
    this.engine.run(playerCommand.pause());
  }

  onAppForeground(): void {
    if (!this.backgrounded) return;
    this.backgrounded = false;
    if (this.previousActive && Platform.isTV) return;
    const { isMuted } = useBroadcastStore.getState();
    this.engine.run(playerCommand.play());
    if (!this.previousActive) this.engine.run(playerCommand.mute(isMuted));
    this.watchAt = Date.now();
    void this.resyncToLive(true, START_CORRECTION_S);
  }

  // ── Watchers ────────────────────────────────────────────────────────────

  private catchUpAfterStall(now: number, duration: number): boolean {
    const anchor = this.liveAnchor;
    if (!anchor || anchor.videoId !== this.expectedId || this.lastTime < 0) return false;
    const target = anchor.position + (now - anchor.at) / 1000;
    if (target - this.lastTime <= START_CORRECTION_S || (duration > 0 && target >= duration - 3)) return false;
    if (__DEV__) console.log('[live] catch up after stall', Math.round(target - this.lastTime), 's');
    this.engine.run(playerCommand.seek(target));
    this.movingSince = 0;
    return true;
  }

  private trackCoverBuffering(state: number): void {
    if (state === 3) {
      if (!this.coverBufferingSince) this.coverBufferingSince = Date.now();
    } else {
      this.coverBufferingSince = 0;
    }
  }

  /**
   * Branded cover: up while frozen >1.2 s, down after ≥3 s (0.6 s after a stall) of real movement.
   * "Frozen" also covers YouTube reporting BUFFERING for >1.2 s: on the TV box's WebView the clock
   * kept running while YouTube showed its spinner, title bar and a black picture, so a
   * time-only check never raised the cover (desktop Chrome, which the web relies on, stops the clock).
   */
  private coverTick(): void {
    if (!this.firstFrameSeen || this.previousActive || this.backgrounded) return;
    const state = useBroadcastStore.getState();
    if (state.phase !== 'playing') return;
    const now = Date.now();
    const buffering = this.playerState === 3 && this.coverBufferingSince > 0 && now - this.coverBufferingSince > STALL_COVER_MS;
    if (now - this.lastMoveAt > STALL_COVER_MS || buffering) this.movingSince = 0;
    if (state.coverVisible) {
      if (this.endCover || this.transitioning || buffering) return;
      const need = this.stallCover ? COVER_MIN_MOVE_AFTER_STALL_MS : COVER_MIN_MOVE_MS;
      if (this.movingSince && now - this.movingSince >= need) {
        // Before showing the picture after a stall or a channel start: if buffering left
        // the video more than 5 s behind the broadcast, jump to the live position first
        // (the cover stays up until it moves again there).
        if ((this.stallCover || this.startCover) && this.catchUpAfterStall(now, state.duration)) return;
        this.stallCover = false;
        this.startCover = false;
        useBroadcastStore.setState({ coverVisible: false });
      }
    } else if (youtubeFlags.coverAfterLoad && (now - this.lastMoveAt > STALL_COVER_MS || buffering)) {
      this.stallCover = true;
      if (__DEV__) console.log("[live] stall cover on after", now - this.lastMoveAt, "ms without movement");
      useBroadcastStore.setState({ coverVisible: true, coverTitle: state.currentProgram?.title ?? state.coverTitle });
    }
  }

  /** Stall ladder (web, 1.5 s tick): play() at 6 s → seek +0.6 s → reload the channel (25 s cooldown). */
  private stallTick(): void {
    const { channelId, phase, duration } = useBroadcastStore.getState();
    if (!channelId || !this.channelPlayed || this.transitioning || this.backgrounded) return;
    if (phase !== 'playing' && phase !== 'branded') return;
    if (this.previousActive && Platform.isTV) return;
    const now = Date.now();
    const current = Math.max(0, this.lastTime);

    if (this.previousActive) {
      // Keep the muted live stream moving underneath; never unmute or reload.
      if (current > this.watchTime + 0.35) {
        this.watchTime = current;
        this.watchAt = now;
      } else if (now - this.watchAt >= 8000) {
        this.engine.run(playerCommand.seek(current + 0.6));
        this.engine.run(playerCommand.play());
        this.watchAt = now;
      }
      this.bufferingSince = 0;
      this.ladderStep = 0;
      return;
    }

    if (duration > 0 && duration - current < 1.5) return;
    if (current > this.watchTime + 0.35) {
      this.watchTime = current;
      this.watchAt = now;
      if (this.playerState === 1) {
        this.bufferingSince = 0;
        this.ladderStep = 0;
      }
      return;
    }
    if (!this.watchAt) {
      this.watchAt = now;
      return;
    }
    const stalledFor = now - this.watchAt;
    if (this.playerState === 3 && !this.bufferingSince) this.bufferingSince = now;
    const bufferingFor = this.bufferingSince ? now - this.bufferingSince : 0;
    if (stalledFor < 6000 && bufferingFor < 6000) return;

    if (this.ladderStep === 0) {
      this.engine.run(playerCommand.play());
      this.ladderStep = 1;
      this.watchAt = now;
      return;
    }
    if (this.ladderStep === 1 && (stalledFor >= 10000 || bufferingFor >= 9500)) {
      this.engine.run(playerCommand.seek(current + 0.6));
      this.engine.run(playerCommand.play());
      this.ladderStep = 2;
      this.watchAt = now;
      return;
    }
    if (this.ladderStep >= 2 && (stalledFor >= 17000 || bufferingFor >= 16000)) {
      if (now - this.lastHardRecoveryAt < 25000) {
        this.watchAt = now;
        return;
      }
      this.lastHardRecoveryAt = now;
      this.ladderStep = 0;
      this.bufferingSince = 0;
      this.watchAt = now;
      void this.loadChannel(channelId, { isRecoveryRetry: true });
    }
  }

  private armLoadTimeout(channelId: string, attempt: number): void {
    this.clearTimer('load');
    this.loadTimer = setTimeout(() => {
      if (attempt !== this.attempt || this.firstFrameSeen) return;
      if (this.recoveryAttempts >= 1) {
        this.clearTimers();
        useBroadcastStore.setState({ phase: 'error', errorMessage: LOAD_TIMEOUT_MESSAGE, coverVisible: false });
        return;
      }
      this.recoveryAttempts += 1;
      this.engine.run(playerCommand.stop());
      setTimeout(() => {
        if (attempt === this.attempt) void this.loadChannel(channelId, { isRecoveryRetry: true });
      }, 700);
    }, LOAD_TIMEOUT_MS);
  }

  /** 12 s after the player is ready: moving without a PLAYING event → treat as playing; else kick play. */
  private armStartWatchdog(attempt: number): void {
    this.clearTimer('start');
    this.startTimer = setTimeout(() => {
      if (attempt !== this.attempt || this.firstFrameSeen) return;
      if (this.movingSince) {
        this.onFirstFrame();
        return;
      }
      this.engine.run(playerCommand.play());
    }, START_WATCHDOG_MS);
  }

  private resetPlaybackTracking(): void {
    this.firstFrameSeen = false;
    this.lastTime = -1;
    this.lastMoveAt = 0;
    this.movingSince = 0;
    this.stallCover = false;
    this.endCover = false;
    this.playerState = -1;
    this.coverBufferingSince = 0;
    this.watchTime = 0;
    this.watchAt = 0;
    this.bufferingSince = 0;
    this.ladderStep = 0;
    this.liveTarget = null;
  }

  private clearTimer(which: 'load' | 'start' | 'unavailable'): void {
    if (which === 'load' && this.loadTimer) clearTimeout(this.loadTimer);
    if (which === 'start' && this.startTimer) clearTimeout(this.startTimer);
    if (which === 'unavailable' && this.unavailableTimer) clearTimeout(this.unavailableTimer);
    if (which === 'load') this.loadTimer = null;
    if (which === 'start') this.startTimer = null;
    if (which === 'unavailable') this.unavailableTimer = null;
  }

  private clearTimers(): void {
    this.clearTimer('load');
    this.clearTimer('start');
    this.clearTimer('unavailable');
  }

  /** For screens that must not show stale programme data. */
  currentProgramOrNull(): VideoProgram | null {
    return useBroadcastStore.getState().currentProgram;
  }
}

export const broadcast = new BroadcastController();
