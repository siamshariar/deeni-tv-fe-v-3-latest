/**
 * The live broadcast controller. Re-implements the web player's orchestration
 * (components/synced-video-player.tsx at fixes_to_launch a080ec2) with the
 * same rules and timings, driving the live player page through EngineRef:
 *
 * - loadChannel: external API (wait 10 s, keep the request up to 120 s and
 *   switch if a late answer names a different video) → web route → embedded
 * - start at the live offset (seekTo + time since the schedule was fetched)
 * - muted start, unmute on the first frame; volume locked until then
 * - branded cover until real movement (0.5 s with cropChrome, else 3–5 s); stall cover after 1.2 s frozen
 * - auto-advance at the end, post-transition queue alignment, 60 s sync; deviation:
 *   programme changes keep the broadcast's clock (switch at the scheduled end, the
 *   next programme at its live position, the API's seekTo corrects the timing)
 * - load timeout (20 s → one retry → "Failed to Load"), 12 s start watchdog,
 *   stall ladder (play → seek nudge → reload, 25 s cooldown)
 * - rejoin live after the Previous player closes and when the app returns
 */
import { Platform } from 'react-native';

import { fetchExternalSchedule, fetchWebRouteSchedule } from '@/lib/api/client';
import { isUsableSchedule } from '@/lib/api/normalize';
import { youtubeFlags } from '@/lib/config';
import { saveLaunchSchedule, savedProgramOnNow } from '@/lib/launchSchedule';
import { prefetchThumbnail } from '@/lib/youtube/thumbnail';
import { alignQueue, embeddedQueueAfter, periodicQueue, upcomingFromSchedule } from '@/lib/schedule/queue';
import { buildLocalCurrentVideoResponse, toVideoProgram } from '@/lib/schedule/schedule';
import { addToPreviousVideos, getPlayerLeads, getPreviousVideos, savePlayerLeads, savePreviousVideos } from '@/lib/storage';
import { playerCommand, type PlayerPageMessage } from '@/lib/youtube/playerPage';
import { useBroadcastStore } from '@/store/useBroadcastStore';
import { useChannelStore } from '@/store/useChannelStore';
import { usePreviousPlayerStore } from '@/store/usePreviousPlayerStore';
import type { ScheduleResult, VideoProgram } from '@/types';

import { EngineRef } from './engine';

// Web timings (Ref doc §5.6)
const STARTUP_API_WAIT_MS = 10000;
// How long a channel start waits for the web schedule route before the built-in schedule.
const WEB_ROUTE_START_WAIT_MS = 800;
const LOAD_TIMEOUT_MS = 20000;
const START_WATCHDOG_MS = 12000;
const STALL_TICK_MS = 1500;
const COVER_TICK_MS = 300;
const SYNC_INTERVAL_MS = 60000;
const NO_NEXT_RELOAD_MS = 20000;
const POST_TRANSITION_SYNC_MS = 500;
// With YouTube's top bar and bottom strip cropped out of view (youtubeFlags.cropChrome) the
// covers lift at the first real movement (one progress report), the sound held until then
// (setCoverHold); YouTube's centre icon may show (user request 2026-11-03: as fast as possible,
// YouTube's own icon is fine, no LIVE badge).
// Without the crop: YouTube's start overlay (title bar, pause glyph, "More videos") was still
// up after 3 s of playback on the TV box (recorded frames), so TV waited 5 s; after a stall it
// shows for ~3 s once playback resumes (the web uses 0.6 s).
const COVER_MIN_MOVE_MS = youtubeFlags.cropChrome ? 300 : Platform.isTV ? 5000 : 3000;
const COVER_MIN_MOVE_AFTER_STALL_MS = youtubeFlags.cropChrome ? 300 : 3000;
// A start or stall cover checks for a catch-up seek once the video has played this long.
const CATCH_UP_CHECK_MS = 500;
// Once the picture shows, short freezes don't bring the loading screen back (the TV box often
// pauses a moment right after a start or a seek): only a freeze this long does, and none in the
// first seconds after a cover lifts (user request 2026-11-03: no repeated loading while playing).
const STALL_COVER_AFTER_MS = Platform.isTV ? 5000 : 2500;
const NO_STALL_COVER_AFTER_REVEAL_MS = Platform.isTV ? 10000 : 4000;
// Back online: a broadcast that hasn't moved for this long is rejoined.
const OFFLINE_STUCK_MS = 3000;
// For this long after the connection returns, a stall is nudged at once with a seek: YouTube's
// own network retry lags behind (its backoff grew while offline), so the buffered video ran dry
// ~15 s after the reconnect and stalled until the ladder's step at 6 s (TV box, 2026-11-03).
const RECONNECT_NUDGE_WINDOW_MS = 60000;
const RECONNECT_NUDGE_AFTER_MS = 1500;
const STALL_COVER_MS = 1200;
// Closing the Watched player (phone): the live stream underneath counts as playing when it
// moved this recently (progress reports come every 300 ms).
const LIVE_MOVING_MS = 1000;
// TV: the Watched player's page is made this long after the live picture is up (prepareWatchedPlayer).
const WATCHED_PREP_DELAY_MS = 8000;
// TV, before a programme ends: the page's hidden player is made (once; ~10 s on the box), then the
// next programme loads in it. 15 s: it waits about 8 s on its first frame. At 30 s it waited ~20 s,
// Chromium dropped its decoder, and the running video stuttered (2026-11-04).
const NEXT_CREATE_S = 40;
const NEXT_PREPARE_S = 15;
const REJOIN_DRIFT_S = 20;
const REJOIN_API_WAIT_MS = 8000;
// TV: a few seconds more. Every catch-up on the box is a seek of ~4 s under the cover (after a
// 30 s pause it landed behind again and the way back took 10 s, 2026-11-04), for a difference
// nobody sees on a slow start.
const START_CORRECTION_S = Platform.isTV ? 8 : 5;
// Catch-up seeks per cover. When every seek buffers for longer than 5 s (a loaded TV
// box, a slow line; seeks took ~14 s on the test box while screen recording), the
// video is behind again by the time it has moved 3 s, and an uncapped catch-up could
// keep the cover up for good.
const MAX_COVER_CATCH_UPS = 2;
// TV box (HiSilicon, CPU capped at 1.2 GHz): a load takes 6–8 s and a seek several seconds
// before the video plays (YouTube's player JS is CPU-bound there), so a channel started that
// far behind the broadcast and every catch-up seek landed behind again: one more cover and
// one more YouTube overlay each (measured 2026-11-01). On TV a load and a catch-up seek aim
// ahead by what the last ones took (kept across launches; first guesses below: a load took
// 9–12 s to play at its position on the test box, a seek ~4 s), so they land on the broadcast.
const TV_LOAD_LEAD_S = 9;
const TV_SEEK_LEAD_S = 4;
const TV_LEAD_MAX_S = 15;
// TV: where the launch schedule's page aims ahead by, until measured (page start to PLAYING).
const TV_LAUNCH_LEAD_S = 12;
const TV_LAUNCH_LEAD_MAX_S = 30;
// A first-frame position further than this from the broadcast is not a slow start.
const START_POSITION_SANE_S = 60;
// A forward step bigger than this between two progress reports (300 ms apart), and bigger than
// the time between them plus 1 s, is a jump (a seek, a load's start position), not playback: it
// must not lift a cover by itself.
const PLAYBACK_STEP_MAX_S = 2.5;
// Live broadcast across programme changes (product request, 2026-10-18; deviation: the
// web starts the next programme at 0). The web way added each load time to the lag, and
// nothing caught up: the TV box was ~23 s behind the broadcast after one change. Now a
// change keeps the broadcast's clock: when the schedule says what plays has ended, the
// player switches (this grace after it, so a video on time ends by itself), and the next
// programme starts at its live position.
const SCHEDULE_SWITCH_GRACE_MS = 1500;
/** The next programme with less than this left in the broadcast is skipped: rejoin live instead. */
const NEXT_MIN_LEFT_S = 3;

export const LOAD_TIMEOUT_MESSAGE = 'Playback is taking longer than expected. Please tap Refresh.';

const PENDING = Symbol('pending');
const delay = (ms: number) => new Promise<typeof PENDING>((resolve) => setTimeout(() => resolve(PENDING), ms));

type LoadOptions = {
  prefetched?: ScheduleResult;
  isRecoveryRetry?: boolean;
  /** Started by the viewer (app open, channel switch, Refresh, back from the Watched player): TV holds the bar up. */
  userStart?: boolean;
};

class BroadcastController {
  readonly engine = new EngineRef();

  private attempt = 0;
  private recoveryAttempts = 0;
  private source: 'external-api' | 'fallback' = 'fallback';
  private expectedId = '';
  private transitioning = false;
  private lastNoNextReloadAt = 0;
  private pageReady = false;
  private loadSent = false;

  // first frame / movement / covers
  private firstFrameSeen = false;
  private channelPlayed = false;
  private lastTime = -1;
  /** Page time (ms) of the last progress report. */
  private lastProgressT = -1;
  private lastMoveAt = 0;
  private movingSince = 0;
  /** Phone: when the first frame was reported; the start cover lifts only after a movement past it. */
  private firstFrameAt = 0;
  private watchedPrepTimer: ReturnType<typeof setTimeout> | null = null;
  private stallCover = false;
  private endCover = false;
  private liveTarget: { position: number; at: number } | null = null;
  /**
   * Where the current video is in the broadcast at `at` (schedule start, a programme
   * switch, a rejoin, every sync naming it). Used to catch up after a stall (on TV boxes
   * the video often buffers again right after the first frame, and that time was never
   * made up) and to find the programme's scheduled end. Negative when the programme is
   * due later (the previous one ended early).
   */
  private liveAnchor: { videoId: string; position: number; at: number } | null = null;
  /** The cover up now is a start cover (channel load or programme change): catch up before it lifts. */
  private startCover = false;
  /** Catch-up seeks made while the current cover is up (MAX_COVER_CATCH_UPS). */
  private coverCatchUps = 0;
  /** The page's cover hold (setCoverHold). */
  private coverHeld = false;
  /** No new stall cover before then (a cover just lifted). */
  private noStallCoverUntil = 0;
  /** No internet (expo-network): recovery steps wait, setOnline(true) rejoins. */
  private offline = false;
  /** When the connection last came back (RECONNECT_NUDGE_WINDOW_MS). */
  private onlineAt = 0;
  /** TV: seconds a load / a seek took to play last time, the lead the next one aims ahead by. */
  private loadLeadS = (Platform.isTV && getPlayerLeads()?.load) || TV_LOAD_LEAD_S;
  private seekLeadS = (Platform.isTV && getPlayerLeads()?.seek) || TV_SEEK_LEAD_S;
  /** TV: page start to PLAYING when the page starts the programme by itself (launch schedule). */
  private launchLeadS = (Platform.isTV && getPlayerLeads()?.launch) || TV_LAUNCH_LEAD_S;
  private launchStartId = '';
  /** TV: the next programme was asked for in the page's hidden player / stands ready there. */
  private nextCreated = false;
  private nextPrepared = false;
  private nextReadyId = '';
  /** TV, until the first load: the programme on now by the saved schedule. */
  private launchProgram: { id: string; title: string } | null = null;
  /** TV: the load or seek being timed (where it aimed, when it was sent). */
  private leadProbe: { kind: 'load' | 'seek'; target: number; at: number } | null = null;

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
    const channel = Platform.isTV ? useChannelStore.getState().selectedId : null;
    this.launchProgram = channel ? savedProgramOnNow(channel) : null;
    if (this.launchProgram) useBroadcastStore.setState({ coverTitle: this.launchProgram.title, coverVideoId: this.launchProgram.id });
    this.engine.onReset(() => {
      this.nextCreated = false;
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
    void this.loadChannel(channelId, { userStart: true });
  }

  /** Refresh / Try Again: the current programme goes into history, then reload (web handleReload). */
  /** Connectivity (expo-network): offline holds the recovery steps; back online rejoins a stuck broadcast. */
  setOnline(online: boolean): void {
    if (this.offline === !online) return;
    this.offline = !online;
    if (!online) return;
    this.onlineAt = Date.now();
    const { channelId, phase } = useBroadcastStore.getState();
    if (!channelId || this.backgrounded || this.previousActive) return;
    const stuck = phase !== 'playing' || Date.now() - this.lastMoveAt > OFFLINE_STUCK_MS;
    if (stuck) void this.loadChannel(channelId);
  }

  refresh(): void {
    const { channelId, currentProgram } = useBroadcastStore.getState();
    if (!channelId) return;
    if (currentProgram) {
      useBroadcastStore.setState({ history: addToPreviousVideos(channelId, currentProgram) });
    }
    void this.loadChannel(channelId, { userStart: true });
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
    // TV: the loading screen shows the saved programme at the first load; a channel's first moments
    // have none until its schedule comes (not the last channel's).
    const first = this.launchProgram;
    this.launchProgram = null;
    useBroadcastStore.setState({
      ...(Platform.isTV && !options.isRecoveryRetry ? { coverTitle: first?.title ?? '', coverVideoId: first?.id ?? null } : null),
      channelId,
      phase: 'tuning',
      errorMessage: null,
      coverVisible: false,
      videoVisible: false,
      // Automatic reloads keep whatever the bar was doing.
      videoStarting: options.userStart ? true : useBroadcastStore.getState().videoStarting,
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
    if (!result) {
      // The web route serves the built-in schedule while its own API call fails (2026-11), so a
      // channel doesn't wait for it: it starts from the built-in schedule after a short grace,
      // and a later answer that comes from the API and names another programme switches to it.
      const routePromise = fetchWebRouteSchedule(channelId);
      const raced = await Promise.race([routePromise, delay(WEB_ROUTE_START_WAIT_MS)]);
      if (raced === PENDING) {
        routePromise
          .then((late) => {
            if (!late || stale() || late._source !== 'external-api') return;
            if (late.currentProgram.ytVideoId === this.expectedId) return;
            void this.loadChannel(channelId, { prefetched: late });
          })
          .catch(() => {});
      } else {
        result = raced;
      }
    }
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
    const live = result.currentProgram.seekTo + elapsed;
    const lastStart = Math.max(0, program.duration - 2);
    const start = Math.min(live + this.leadFor('load'), lastStart);
    this.liveTarget = { position: Math.min(live, lastStart), at: Date.now() };
    this.probeLead('load', start);
    this.expectedId = program.videoId;
    // Unclamped: near its end the programme's scheduled end must stay exact.
    this.liveAnchor = { videoId: program.videoId, position: live, at: Date.now() };
    this.startCover = true;
    this.coverCatchUps = 0;
    this.setCoverHold(true);

    useBroadcastStore.setState({
      phase: 'branded',
      currentProgram: program,
      nextProgram: upcoming[0] ?? null,
      upcoming,
      history,
      coverVisible: true,
      coverTitle: program.title,
      coverVideoId: program.videoId,
      currentTime: start,
      duration: program.duration,
    });

    this.armLoadTimeout(channelId, attempt);
    if (Platform.isTV) {
      prefetchThumbnail(program.videoId);
      if (upcoming[0]) prefetchThumbnail(upcoming[0].videoId);
    }
    this.engine.run(playerCommand.load(program.videoId, start, true, true));
    this.loadSent = true;
    if (this.previousActive) this.applyPreviousMode();
    if (this.pageReady) this.armStartWatchdog(attempt);
    this.saveLaunch();
  }

  /**
   * TV: the Watched player's page is created a while after the live picture is up, the way Safe
   * Kids creates its player before a video is chosen, so YouTube's player is ready when the list
   * opens (created at the list's opening it took ~5–6 s more on the TV box). It loads no video.
   */
  private prepareWatchedPlayer(): void {
    if (this.watchedPrepTimer || usePreviousPlayerStore.getState().isCreated) return;
    this.watchedPrepTimer = setTimeout(() => {
      if (usePreviousPlayerStore.getState().isCreated) return;
      if (this.backgrounded || useBroadcastStore.getState().coverVisible) {
        this.watchedPrepTimer = null;
        return;
      }
      usePreviousPlayerStore.setState({ isCreated: true });
    }, WATCHED_PREP_DELAY_MS);
  }

  /** The page started the programme by itself: its time to PLAYING is what the next launch aims ahead by. */
  private measureLaunchLead(id: string, pageT: number): void {
    const started = this.launchStartId;
    this.launchStartId = '';
    if (id !== started) return;
    const took = Math.min(TV_LAUNCH_LEAD_MAX_S, Math.max(3, pageT / 1000));
    this.launchLeadS = (this.launchLeadS + took) / 2;
    savePlayerLeads({ load: this.loadLeadS, seek: this.seekLeadS, launch: this.launchLeadS });
  }

  /** TV: what the next launch's live page starts by itself (modules/deeni-live-player). */
  private saveLaunch(): void {
    const anchor = this.liveAnchor;
    const { currentProgram, upcoming } = useBroadcastStore.getState();
    if (!anchor || !currentProgram || anchor.videoId !== currentProgram.videoId) return;
    const { channelId } = useBroadcastStore.getState();
    if (!channelId) return;
    saveLaunchSchedule(channelId, currentProgram, anchor.position + (Date.now() - anchor.at) / 1000, upcoming, this.launchLeadS);
    // In the disk cache for the next launch's first screen, should one of them be on by then.
    if (Platform.isTV) upcoming.slice(0, 2).forEach((p) => prefetchThumbnail(p.videoId));
  }

  // ── Player page events ──────────────────────────────────────────────────

  onPlayerMessage(msg: PlayerPageMessage): void {
    if (__DEV__ && msg.type !== 'progress') console.log('[live]', JSON.stringify(msg));
    switch (msg.type) {
      case 'nextReady':
        this.nextReadyId = msg.id;
        break;
      case 'initial':
        this.launchStartId = msg.id;
        break;
      case 'initialKept':
        // The page started this programme by itself at launch: its start time is no lead sample.
        if (msg.id === this.expectedId) this.leadProbe = null;
        break;
      case 'ready':
        this.pageReady = true;
        // A rebuilt page starts unheld.
        if (this.coverHeld) this.engine.run(playerCommand.coverHold(true));
        if (this.loadSent && !this.firstFrameSeen) this.armStartWatchdog(this.attempt);
        break;
      case 'state':
        if (msg.state === 1 && this.launchStartId) this.measureLaunchLead(msg.id, msg.t);
        if (msg.state === 1 && msg.match && msg.id === this.expectedId) this.playingUnderCover();
        this.playerState = msg.state;
        if (msg.state === 3 && !this.bufferingSince) this.bufferingSince = Date.now();
        this.trackCoverBuffering(msg.state);
        break;
      case 'firstFrame':
        if (msg.id === this.expectedId) this.onFirstFrame();
        break;
      case 'progress':
        if (msg.id === this.expectedId) this.onProgress(msg.current, msg.duration, msg.state, msg.t);
        break;
      case 'nearEnd':
        if (msg.id === this.expectedId) this.onNearEnd();
        break;
      case 'end':
        // Not before the programme has played: a late end of the previous video
        // must not skip the one that just started (deviation; the web has no guard).
        if (msg.id === this.expectedId && this.firstFrameSeen) this.playNextVideo();
        break;
      case 'error':
        // Code 0: the IFrame API script failed to load. The page tries again by itself; offline
        // that waits for the connection, online the load timeout decides.
        if (msg.code !== 0 && msg.id === this.expectedId) this.onPlayerError(msg.code);
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

    // A slow start can land behind the broadcast: catch up once (cover stays up).
    let catchingUp = false;
    if (this.liveTarget && this.lastTime >= 0) {
      const target = this.liveTarget.position + (Date.now() - this.liveTarget.at) / 1000;
      const { duration } = useBroadcastStore.getState();
      // More than a minute off, or still at 0, is YouTube reporting 0 before its start position
      // applies (TV box, 2026-11-01: a needless seek kept the cover up 5 s; in a programme's first
      // minute it came every time, 2026-11-04): coverTick catches up.
      const behind = target - this.lastTime;
      if (this.lastTime > 0 && behind > START_CORRECTION_S && behind < START_POSITION_SANE_S && (!duration || target < duration - 3)) {
        this.seekAhead(target);
        this.movingSince = 0;
        catchingUp = true;
      }
    }
    this.liveTarget = null;

    // Sound comes with the picture: while the start cover is up (it waits for real playback
    // and maybe a catch-up), the unmute waits for it to lift (coverTick). Users heard seconds
    // of sound under the cover (user report, 2026-11-01).
    const holdSound = catchingUp || (this.startCover && youtubeFlags.coverAfterLoad && useBroadcastStore.getState().coverVisible);
    let isMuted = useBroadcastStore.getState().isMuted;
    if (!this.previousActive && !this.backgrounded) {
      if (this.pendingUnmute && !holdSound) {
        this.engine.run(playerCommand.mute(false));
        isMuted = false;
      } else if (this.userMuted) {
        this.engine.run(playerCommand.mute(true));
        isMuted = true;
      }
    }
    if (!holdSound) this.pendingUnmute = false;
    // Phone: playback counts from its first frame, so the start cover lifts 0.3 s after it, once a
    // progress report shows it moving, rather than 0.3 s after that report (~0.5 s sooner,
    // 2026-11-04). The TV box's first frame can still be black (see coverTick), so the TV waits
    // for the reported movement.
    if (!Platform.isTV && !catchingUp) {
      const now = Date.now();
      this.firstFrameAt = now;
      this.lastMoveAt = now;
      if (!this.movingSince) this.movingSince = now;
    }
    useBroadcastStore.setState({ phase: 'playing', volumeLocked: false, isMuted, videoVisible: true });
  }

  /**
   * TV: YouTube reports PLAYING under a loading cover. That counts as movement, so the cover lifts
   * within a tick or two, and the sound comes now: progress reports are sparse on the box, and the
   * first movement seen and the unmute each cost ~1 s more (2026-11-04). Not when it is far enough
   * behind for a catch-up seek (coverTick).
   */
  private playingUnderCover(): void {
    if (!Platform.isTV || this.previousActive || this.backgrounded || this.transitioning) return;
    if (!(this.startCover || this.stallCover) || !useBroadcastStore.getState().coverVisible) return;
    const now = Date.now();
    this.lastMoveAt = now;
    if (!this.movingSince) this.movingSince = now;
    const anchor = this.liveAnchor;
    const position = anchor && anchor.videoId === this.expectedId ? anchor.position + (now - anchor.at) / 1000 : null;
    if (position !== null && this.lastTime >= 0 && position - this.lastTime > START_CORRECTION_S) return;
    this.setCoverHold(false);
    if (this.pendingUnmute) {
      this.pendingUnmute = false;
      this.engine.run(playerCommand.mute(false));
      useBroadcastStore.setState({ isMuted: false });
    }
  }

  /** The page stays silent while a start or stall cover is up (not the end cover: the programme still plays). */
  private setCoverHold(on: boolean): void {
    if (this.coverHeld === on) return;
    this.coverHeld = on;
    this.engine.run(playerCommand.coverHold(on));
  }

  /** TV: the lead a load or a seek aims ahead by (0 on phones: they start fast). */
  private leadFor(kind: 'load' | 'seek'): number {
    if (!Platform.isTV) return 0;
    return kind === 'load' ? this.loadLeadS : this.seekLeadS;
  }

  private probeLead(kind: 'load' | 'seek', target: number): void {
    this.leadProbe = Platform.isTV ? { kind, target, at: Date.now() } : null;
  }

  /** Seek to the broadcast position `target`, aiming ahead by the seek lead (TV). */
  private seekAhead(target: number): void {
    const to = target + this.leadFor('seek');
    this.engine.run(playerCommand.seek(to));
    this.probeLead('seek', to);
  }

  /** TV: once the timed load/seek plays at its position, its time becomes the next lead. */
  private measureLead(current: number, state: number): void {
    const probe = this.leadProbe;
    if (!probe || state !== 1 || current < probe.target - 0.5) return;
    this.leadProbe = null;
    if (current > probe.target + 15) return; // it played somewhere else
    const took = Math.min(TV_LEAD_MAX_S, Math.max(1, (Date.now() - probe.at) / 1000));
    if (probe.kind === 'load') this.loadLeadS = (this.loadLeadS + took) / 2;
    else this.seekLeadS = (this.seekLeadS + took) / 2;
    savePlayerLeads({ load: this.loadLeadS, seek: this.seekLeadS, launch: this.launchLeadS });
  }

  private onProgress(current: number, duration: number, state: number, pageT: number): void {
    const now = Date.now();
    this.playerState = state;
    this.trackCoverBuffering(state);
    this.measureLead(current, state);
    // The page's own clock between two reports: a busy TV box sent some 2.3 s apart, and the
    // ~3 s of playback between them counted as a jump (one more report before a cover lifted).
    const sinceLastS = pageT > this.lastProgressT && this.lastProgressT >= 0 ? (pageT - this.lastProgressT) / 1000 : 0;
    this.lastProgressT = pageT;
    if (this.lastTime >= 0 && current > this.lastTime + Math.max(PLAYBACK_STEP_MAX_S, sinceLastS + 1)) {
      // A jump: playback starts counting from here (the 0.5 s covers lifted mid-seek on TV).
      this.lastMoveAt = now;
      this.movingSince = 0;
    } else if (this.lastTime >= 0 && current > this.lastTime + 0.15) {
      this.lastMoveAt = now;
      if (!this.movingSince) this.movingSince = now;
    } else if (this.lastTime >= 0 && current < this.lastTime - 1) {
      this.movingSince = 0; // new video or seek back: its start counts afresh
    }
    this.lastTime = current;
    const patch: Partial<ReturnType<typeof useBroadcastStore.getState>> = { currentTime: current };
    if (duration > 0) patch.duration = duration;
    useBroadcastStore.setState(patch);
    if (Platform.isTV) this.prepareNextProgram(now, duration - current);
  }

  /** TV: near a programme's end, the next one loads in the page's hidden player (swapped in at the end). */
  private prepareNextProgram(now: number, videoLeft: number): void {
    if (this.nextPrepared || !this.firstFrameSeen || this.previousActive || this.backgrounded || this.offline || this.transitioning) return;
    const { nextProgram, coverVisible } = useBroadcastStore.getState();
    if (!nextProgram || coverVisible) return;
    const endAt = this.scheduledEndAt();
    const left = endAt === null ? videoLeft : Math.min(videoLeft, (endAt - now) / 1000);
    if (!(left > 0)) return;
    if (!this.nextCreated && left <= NEXT_CREATE_S) {
      this.nextCreated = true;
      this.engine.run(playerCommand.createNext());
    }
    if (left > NEXT_PREPARE_S) return;
    this.nextPrepared = true;
    this.engine.run(playerCommand.prepareNext(nextProgram.videoId));
  }

  private onNearEnd(): void {
    if (!youtubeFlags.coverEndScreen) return;
    const { nextProgram, currentProgram } = useBroadcastStore.getState();
    if (Platform.isTV) {
      // The video stays on screen with its sound; UpNextCard shows what comes when it ends.
      if (nextProgram) useBroadcastStore.setState({ upNextCard: nextProgram });
      return;
    }
    this.endCover = true;
    // An "Up next" card with the next programme while this one's last seconds play (sound on):
    // a programme's end isn't a loading screen (user request 2026-11-03, TV covers 20 s).
    const shown = nextProgram ?? currentProgram;
    useBroadcastStore.setState({ coverVisible: true, coverTitle: shown?.title ?? '', coverVideoId: shown?.videoId ?? null, endCover: !!nextProgram });
  }

  private onPlayerError(code: number): void {
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

    // How far the broadcast already is into the next programme: it began when this
    // one's scheduled time ended. Negative when this video ended early.
    const endAt = this.scheduledEndAt();
    const late = endAt === null ? 0 : (Date.now() - endAt) / 1000;
    const history = addToPreviousVideos(channelId, currentProgram);
    if (late > nextProgram.duration - NEXT_MIN_LEFT_S) {
      // The broadcast has moved past the next programme as well: rejoin it.
      void this.loadChannel(channelId);
      return;
    }

    this.transitioning = true;
    let upcoming = state.upcoming.slice(1);
    if (!upcoming[0]) upcoming = embeddedQueueAfter(channelId, nextProgram);

    // TV: standing ready in the hidden player, it comes straight in, with no loading screen.
    const ready = Platform.isTV && this.nextReadyId === nextProgram.videoId;
    this.resetPlaybackTracking();
    // A programme that is not due yet (late < 0) starts at 0; one already on aims ahead (TV).
    const start = ready ? Math.max(0, late) : late > 0 ? late + this.leadFor('load') : 0;
    const now = Date.now();
    this.expectedId = nextProgram.videoId;
    this.liveAnchor = { videoId: nextProgram.videoId, position: late, at: now };
    this.liveTarget = { position: late, at: now };
    if (ready) {
      this.leadProbe = null;
      this.lastMoveAt = now; // it starts in a moment: no stall yet
    } else {
      this.probeLead('load', start);
    }
    this.startCover = !ready; // its load time is caught up before the picture shows
    this.coverCatchUps = 0;
    this.pendingUnmute = youtubeFlags.autoUnmute && !this.userMuted;
    this.setCoverHold(!ready);
    useBroadcastStore.setState({
      phase: ready ? 'playing' : 'branded',
      history,
      currentProgram: nextProgram,
      nextProgram: upcoming[0] ?? null,
      upcoming,
      coverVisible: !ready,
      coverTitle: nextProgram.title,
      coverVideoId: nextProgram.videoId,
      volumeLocked: true,
      currentTime: start,
      duration: nextProgram.duration,
    });
    if (Platform.isTV && upcoming[0]) prefetchThumbnail(upcoming[0].videoId);
    // Every switch is muted until the new video plays (web transition mute).
    this.engine.run(playerCommand.load(nextProgram.videoId, start, true, true));
    if (this.previousActive) this.applyPreviousMode();
    this.transitioning = false;
    this.saveLaunch();

    const attempt = this.attempt;
    setTimeout(() => {
      if (attempt === this.attempt) void this.syncAfterTransition(channelId);
    }, POST_TRANSITION_SYNC_MS);
  }

  /** When what plays ends in the broadcast (client clock, ms), from its live anchor; null if unknown. */
  private scheduledEndAt(): number | null {
    const anchor = this.liveAnchor;
    const program = useBroadcastStore.getState().currentProgram;
    if (!anchor || !program || anchor.videoId !== program.videoId || !(program.duration > 0)) return null;
    return anchor.at + (program.duration - anchor.position) * 1000;
  }

  /** Where the broadcast is in what plays (seconds), from its live anchor; null if unknown or at its end. */
  private broadcastPosition(now: number): number | null {
    const anchor = this.liveAnchor;
    if (!anchor || anchor.videoId !== this.expectedId) return null;
    const position = anchor.position + (now - anchor.at) / 1000;
    const { duration } = useBroadcastStore.getState();
    return duration > 0 && position >= duration - 3 ? null : position;
  }

  /**
   * Take the live position of what plays from a schedule that names it: seekTo plus the
   * time since it was fetched. A channel started from the API takes timing only from the
   * API (the fallbacks follow another playlist); a fallback channel from any tier (they
   * compute the same embedded schedule). `seekNow`: when the picture is up and more than
   * 5 s off, jump there at once; under a cover the catch-up before it lifts does it.
   */
  private adoptLiveTiming(result: ScheduleResult, seekNow: boolean): void {
    if (result._source !== 'external-api' && this.source === 'external-api') return;
    const at = Date.now();
    const position = (result.currentProgram.seekTo || 0) + Math.max(0, at - (result._fetchedAt ?? at)) / 1000;
    this.liveAnchor = { videoId: this.expectedId, position, at };
    if (this.liveTarget) this.liveTarget = { position, at };
    if (!seekNow || !this.firstFrameSeen || this.lastTime < 0) return;
    const { coverVisible, duration } = useBroadcastStore.getState();
    if (coverVisible || Math.abs(position - this.lastTime) <= START_CORRECTION_S) return;
    if (duration > 0 && position >= duration - 3) return;
    this.engine.run(playerCommand.seek(position));
    this.movingSince = 0;
  }

  private async fetchScheduleChain(channelId: string): Promise<ScheduleResult> {
    let result = await fetchExternalSchedule(channelId);
    if (!result) result = await fetchWebRouteSchedule(channelId);
    return isUsableSchedule(result) ? result : buildLocalCurrentVideoResponse(channelId, 15);
  }

  /** Right after a switch: align the queue with what the API reports (web syncImmediateAfterTransition). */
  private async syncAfterTransition(channelId: string): Promise<void> {
    const attempt = this.attempt;
    const playing = this.expectedId;
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
      // The schedule names the programme that just started: its position is the live one
      // (the API's seekTo is authoritative; programmes may have gaps or other lengths).
      if (playing === this.expectedId && result.currentProgram?.ytVideoId === playing) this.adoptLiveTiming(result, true);
      this.saveLaunch();
    } else if (aligned.kind === 'rejoin') {
      void this.loadChannel(channelId, { prefetched: result });
    }
  }

  /**
   * Every 60 s: refresh the upcoming queue, and the live anchor when the schedule names
   * what plays (so the next change happens at the broadcast's time). No seek mid-programme:
   * drift correction stays off (web); programme changes and stall covers catch up.
   */
  private async periodicSync(): Promise<void> {
    const { channelId, phase } = useBroadcastStore.getState();
    if (!channelId || !this.channelPlayed || phase === 'error' || this.backgrounded) return;
    const attempt = this.attempt;
    const playing = this.expectedId;
    const result = await this.fetchScheduleChain(channelId);
    if (attempt !== this.attempt) return;
    if (playing === this.expectedId && result.currentProgram?.ytVideoId === playing) this.adoptLiveTiming(result, false);
    const latestHistory = getPreviousVideos(channelId);
    if (latestHistory.length > 0) useBroadcastStore.setState({ history: latestHistory });

    const state = useBroadcastStore.getState();
    const local = state.currentProgram?.videoId ?? '';
    // null: the schedule has moved past what plays (we lag after a change); keep the queue.
    const mapped = periodicQueue(result, channelId, local);
    if (mapped && (state.upcoming.length === 0 || mapped.length > 0)) {
      const patch: Partial<ReturnType<typeof useBroadcastStore.getState>> = { upcoming: mapped };
      if (mapped[0]) patch.nextProgram = mapped[0];
      useBroadcastStore.setState(patch);
    }
    this.saveLaunch();
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
    this.nextPrepared = false; // the hold stops the hidden player too
    this.nextReadyId = '';
    this.engine.run(playerCommand.hold(true));
    this.engine.run(playerCommand.mute(true));
    // TV: paused, not stopped (2026-11-04). Stopping tore YouTube's player down on the page
    // thread the Watched page shares (its start waited ~2.6 s behind it), and the way back was a
    // full reload (9–15 s on the TV box); paused, it comes back with a seek. The phone plays on.
    if (Platform.isTV) this.engine.run(playerCommand.pause());
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
      // Paused under the Watched player: back at the broadcast position with a seek, under the
      // stall cover (silent) until it plays (coverTick, which also catches up).
      const target = this.broadcastPosition(Date.now());
      if (this.firstFrameSeen && target !== null) {
        this.stallCover = true;
        this.movingSince = 0;
        this.setCoverHold(true);
        const { currentProgram, coverTitle } = useBroadcastStore.getState();
        useBroadcastStore.setState({ coverVisible: true, coverTitle: currentProgram?.title ?? coverTitle, coverVideoId: currentProgram?.videoId ?? null, isMuted: false });
        this.watchTime = Math.max(0, this.lastTime);
        this.watchAt = Date.now();
        this.bufferingSince = 0;
        this.ladderStep = 0;
        this.userMuted = false;
        this.engine.run(playerCommand.hold(false));
        this.engine.run(playerCommand.mute(false));
        this.seekAhead(target);
        this.engine.run(playerCommand.play());
        return;
      }
      // Its programme ended meanwhile (or it never started): rejoin with a load. On the built-in
      // schedule at once (the same programme comes out): the schedule route's 0.8 s wait, and the
      // closing layer's render meanwhile, held the load back ~1.7 s on the TV box (2026-11-04).
      if (channelId) {
        const local = this.source === 'fallback' ? buildLocalCurrentVideoResponse(channelId, 15) : null;
        void this.loadChannel(channelId, { userStart: true, ...(local ? { prefetched: local } : null) });
      }
      return;
    }
    // Web onResumeMainPlayer: release the hold, unmute, play, re-apply, rejoin.
    // The live stream played on underneath, muted. Still moving at the broadcast position, it
    // comes straight back with its sound (the stall cover added ~1 s to every close, 2026-11-04).
    // Stalled or behind (both streams share the connection), the stall cover stays up, silent,
    // until it plays (coverTick), at the broadcast position.
    const now = Date.now();
    const target = this.broadcastPosition(now);
    const behind = target === null ? 0 : target - Math.max(0, this.lastTime);
    const inStep = this.playerState === 1 && now - this.lastMoveAt < LIVE_MOVING_MS && behind <= START_CORRECTION_S;
    if (this.firstFrameSeen && !inStep) {
      this.stallCover = true;
      this.movingSince = 0;
      this.setCoverHold(true);
      const { currentProgram, coverTitle } = useBroadcastStore.getState();
      useBroadcastStore.setState({ coverVisible: true, coverTitle: currentProgram?.title ?? coverTitle, coverVideoId: null });
      if (target !== null && behind > START_CORRECTION_S) this.seekAhead(target);
    }
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
    if (Platform.isTV) {
      // Reopening the app is a viewer-started load: the bar stays up until the
      // video moves again (the cover also hides YouTube's paused screen meanwhile).
      if (this.firstFrameSeen) {
        this.stallCover = true;
        this.movingSince = 0;
      }
      if (this.firstFrameSeen) this.setCoverHold(true);
      const { currentProgram, coverTitle } = useBroadcastStore.getState();
      useBroadcastStore.setState({
        videoStarting: true,
        ...(this.firstFrameSeen ? { coverVisible: true, coverTitle: currentProgram?.title ?? coverTitle, coverVideoId: currentProgram?.videoId ?? null } : null),
      });
    }
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
    if (this.coverCatchUps >= MAX_COVER_CATCH_UPS) return false;
    const target = anchor.position + (now - anchor.at) / 1000;
    if (target - this.lastTime <= START_CORRECTION_S || (duration > 0 && target >= duration - 3)) return false;
    if (__DEV__) console.log('[live] catch up after stall', Math.round(target - this.lastTime), 's');
    this.coverCatchUps += 1;
    this.seekAhead(target);
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
    // The broadcast has moved on while this video is still behind (slow start, stall):
    // switch now, like a live channel, rather than finish late.
    const endAt = this.scheduledEndAt();
    if (endAt !== null && now >= endAt + SCHEDULE_SWITCH_GRACE_MS && !this.transitioning) {
      this.playNextVideo();
      return;
    }
    const buffering = this.playerState === 3 && this.coverBufferingSince > 0 && now - this.coverBufferingSince > STALL_COVER_MS;
    if (now - this.lastMoveAt > STALL_COVER_MS || buffering) this.movingSince = 0;
    if (state.coverVisible) {
      if (this.endCover || this.transitioning || buffering) return;
      const need = this.stallCover ? COVER_MIN_MOVE_AFTER_STALL_MS : COVER_MIN_MOVE_MS;
      const moving = this.movingSince ? now - this.movingSince : 0;
      // After a stall or a channel start: if buffering left the video more than 5 s behind
      // the broadcast, jump to the live position (the wait starts again there). Checked as
      // soon as it really plays, not at the end of the wait, which a jump would restart.
      if (moving >= CATCH_UP_CHECK_MS && (this.stallCover || this.startCover) && this.catchUpAfterStall(now, state.duration)) return;
      if (moving >= need && this.lastMoveAt > this.firstFrameAt) {
        this.stallCover = false;
        this.startCover = false;
        this.coverCatchUps = 0;
        // The unmute held back during a start catch-up (onFirstFrame).
        if (this.pendingUnmute && !this.previousActive && !this.backgrounded) {
          this.pendingUnmute = false;
          this.engine.run(playerCommand.mute(false));
          useBroadcastStore.setState({ isMuted: false });
        }
        this.setCoverHold(false);
        this.noStallCoverUntil = now + NO_STALL_COVER_AFTER_REVEAL_MS;
        useBroadcastStore.setState({ coverVisible: false, videoStarting: false });
        if (Platform.isTV) this.prepareWatchedPlayer();
      }
    } else if (
      youtubeFlags.coverAfterLoad &&
      now >= this.noStallCoverUntil &&
      (now - this.lastMoveAt > STALL_COVER_AFTER_MS ||
        (this.playerState === 3 && this.coverBufferingSince > 0 && now - this.coverBufferingSince > STALL_COVER_AFTER_MS))
    ) {
      this.stallCover = true;
      if (__DEV__) console.log("[live] stall cover on after", now - this.lastMoveAt, "ms without movement");
      // TV: no cover over a stall (LivePlayerView), so the page stays as it is.
      if (!Platform.isTV) this.setCoverHold(true);
      useBroadcastStore.setState({ coverVisible: true, coverVideoId: null, coverTitle: state.currentProgram?.title ?? state.coverTitle });
    }
  }

  /** Stall ladder (web, 1.5 s tick): play() at 6 s → seek +0.6 s → reload the channel (25 s cooldown). */
  private stallTick(): void {
    const { channelId, phase, duration } = useBroadcastStore.getState();
    if (!channelId || !this.channelPlayed || this.transitioning || this.backgrounded || this.offline) return;
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
    if (
      this.ladderStep === 0 &&
      now - this.onlineAt < RECONNECT_NUDGE_WINDOW_MS &&
      (stalledFor >= RECONNECT_NUDGE_AFTER_MS || bufferingFor >= RECONNECT_NUDGE_AFTER_MS)
    ) {
      this.engine.run(playerCommand.seek(current + 0.1));
      this.engine.run(playerCommand.play());
      this.ladderStep = 2; // still stuck: the reload step follows at the usual time
      this.watchAt = now;
      return;
    }
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
      // Offline: no "Failed to Load"; setOnline(true) loads the channel again.
      if (this.offline) {
        this.armLoadTimeout(channelId, attempt);
        return;
      }
      if (this.recoveryAttempts >= 1) {
        this.clearTimers();
        useBroadcastStore.setState({ phase: 'error', errorMessage: LOAD_TIMEOUT_MESSAGE, coverVisible: false });
        return;
      }
      this.recoveryAttempts += 1;
      this.engine.run(playerCommand.stop());
      setTimeout(() => {
        if (attempt !== this.attempt) return;
        // YouTube's player never came up on this page: a new page (it loads the channel).
        if (!this.pageReady) this.engine.rebuild();
        else void this.loadChannel(channelId, { isRecoveryRetry: true });
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
    this.nextPrepared = false;
    this.nextReadyId = '';
    this.firstFrameSeen = false;
    this.lastTime = -1;
    this.lastMoveAt = 0;
    this.movingSince = 0;
    this.firstFrameAt = 0;
    this.stallCover = false;
    this.endCover = false;
    if (useBroadcastStore.getState().upNextCard) useBroadcastStore.setState({ upNextCard: null });
    if (useBroadcastStore.getState().endCover) useBroadcastStore.setState({ endCover: false });
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
