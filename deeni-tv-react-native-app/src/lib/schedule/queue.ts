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
