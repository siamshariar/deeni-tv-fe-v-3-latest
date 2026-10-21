// Queue decisions from the web player (components/synced-video-player.tsx),
// extracted as pure functions so they can be unit-tested.
import type { ScheduleResult, VideoProgram } from '@/types';

import { getChannelPrograms, toVideoProgram } from './schedule';

/** Upcoming programmes from a schedule, without the one now playing (web filter). */
export function upcomingFromSchedule(result: ScheduleResult, channelId: string, currentVideoId: string): VideoProgram[] {
  return (result.upcomingPrograms || [])
    .map((p) => toVideoProgram(p, channelId))
    .filter((p) => p.videoId !== currentVideoId);
}

/**
 * The 60 s sync's queue refresh. The web (syncWithServer, "In sync" branch)
 * always replaces the queue with the schedule's upcoming list minus what plays.
 * But after a programme change the player runs a few seconds behind the schedule
 * (the next programme starts at 0), and with fallback data that lag grows over a
 * session. A sync landing in the gap sees the schedule already on the programme
 * after ours, so its upcoming list starts one too late and that programme is
 * skipped (2026-10-18, English: the 131 s "Can we Abstain…" was skipped and the
 * phone ran 2 min ahead of the broadcast). Deviation: refresh only while the
 * schedule names what plays; otherwise return null = keep the queue, which was
 * set at the last programme change and aligned then (alignQueue).
 */
export function periodicQueue(result: ScheduleResult, channelId: string, localCurrentId: string): VideoProgram[] | null {
  const apiCurrentId = result.currentProgram?.ytVideoId;
  if (apiCurrentId && apiCurrentId !== localCurrentId) return null;
  return upcomingFromSchedule(result, channelId, localCurrentId);
}

export type QueueAlignment =
  | { kind: 'use'; upcoming: VideoProgram[] }
  | { kind: 'after-ours'; upcoming: VideoProgram[] }
  | { kind: 'rejoin' }
  | { kind: 'keep' };

/**
 * syncImmediateAfterTransition's alignment (web):
 *  - API agrees with what plays (or names no current) → its upcoming list
 *  - API lags: ours is in its upcoming list          → what comes after ours
 *  - API is ahead with authoritative data           → rejoin live
 *  - API is ahead with fallback data                → keep our queue
 */
export function alignQueue(result: ScheduleResult, channelId: string, localCurrentId: string | undefined): QueueAlignment {
  const apiCurrentId = result.currentProgram?.ytVideoId;
  const mapped = (result.upcomingPrograms || []).map((p) => toVideoProgram(p, channelId));
  if (!apiCurrentId || apiCurrentId === localCurrentId) {
    return { kind: 'use', upcoming: mapped.filter((p) => p.videoId !== localCurrentId) };
  }
  const ourIndex = mapped.findIndex((p) => p.videoId === localCurrentId);
  if (ourIndex >= 0) return { kind: 'after-ours', upcoming: mapped.slice(ourIndex + 1) };
  return result._source === 'external-api' ? { kind: 'rejoin' } : { kind: 'keep' };
}

/** When the API queue runs out: the next 15 embedded programmes after `current` (web refill). */
export function embeddedQueueAfter(channelId: string, current: VideoProgram): VideoProgram[] {
  const programs = getChannelPrograms(channelId);
  const index = programs.findIndex((p) => p.id === current.id);
  if (programs.length === 0 || index < 0) return [];
  const upcoming: VideoProgram[] = [];
  for (let i = 1; i <= 15; i++) upcoming.push(programs[(index + i) % programs.length]);
  return upcoming;
}
