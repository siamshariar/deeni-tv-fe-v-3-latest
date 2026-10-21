// Ported from the Deeni web app: lib/schedule-utils.ts (fixes_to_launch a080ec2).
// "What's on now" is computed from wall-clock time against a fixed epoch, so
// every client independently lands on the same programme and offset.
// `now` is a parameter (default: the server-corrected clock, lib/serverClock) so the maths can be unit-tested.
import { clockOffsetMs, serverNow } from '@/lib/serverClock';
import { getPreviousVideos } from '@/lib/storage';
import type { ScheduleItem, ScheduleResult, VideoProgram } from '@/types';

import { CHANNELS, CHANNEL_LID_MAP } from './channelsData';
import { resolveLocalChannelId } from './channels';

export const MASTER_EPOCH_START = Date.UTC(2024, 0, 1, 0, 0, 0);
export const SCHEDULE_VERSION = '1.1.0';

/** True only when this channel has its own embedded programmes (Bangla, English, Arabic). */
export function channelHasEmbeddedPrograms(channelId: string): boolean {
  const channel = CHANNELS.find((c) => c.id === resolveLocalChannelId(channelId));
  return !!(channel?.programs && channel.programs.length > 0);
}

/**
 * Programmes for a channel (local id 'english-1' or API id '3'). A channel
 * without embedded programmes gets a same-language channel's, else Bangla's —
 * so callers never divide by a zero-length schedule.
 */
export function getChannelPrograms(channelId: string): VideoProgram[] {
  const localId = resolveLocalChannelId(channelId);
  const programs = CHANNELS.find((c) => c.id === localId)?.programs;
  if (programs && programs.length > 0) return programs;

  const lid = CHANNEL_LID_MAP[localId];
  const sameLanguage = CHANNELS.find((c) => c.programs.length > 0 && CHANNEL_LID_MAP[c.id] === lid);
  return sameLanguage ? sameLanguage.programs : CHANNELS[0].programs;
}

export function getTotalScheduleDuration(channelId: string): number {
  return getChannelPrograms(channelId).reduce((sum, prog) => sum + prog.duration, 0);
}

export interface CurrentProgramInfo {
  program: VideoProgram;
  currentTime: number;
  timeRemaining: number;
  nextProgram: VideoProgram;
  serverTime: number;
  programIndex: number;
  epochStart: number;
  nextProgramStartTime: number;
  scheduleVersion: string;
  totalPrograms: number;
  channelId: string;
}

/** Core "what's on right now" maths over an explicit programme list. */
export function computeCurrentProgramFromList(
  channelId: string,
  programs: VideoProgram[],
  now: number = serverNow(),
): CurrentProgramInfo {
  const totalDuration = programs.reduce((sum, prog) => sum + prog.duration, 0);

  const elapsedSinceEpoch = Math.floor((now - MASTER_EPOCH_START) / 1000);
  const cyclePosition = elapsedSinceEpoch % totalDuration;

  let accumulatedTime = 0;
  let currentProgram = programs[0];
  let currentTime = 0;
  let programIndex = 0;

  for (let i = 0; i < programs.length; i++) {
    const program = programs[i];
    if (cyclePosition >= accumulatedTime && cyclePosition < accumulatedTime + program.duration) {
      currentProgram = program;
      currentTime = cyclePosition - accumulatedTime;
      programIndex = i;
      break;
    }
    accumulatedTime += program.duration;
  }

  const nextProgram = programs[(programIndex + 1) % programs.length];

  const currentCycleStart =
    MASTER_EPOCH_START + Math.floor((now - MASTER_EPOCH_START) / totalDuration / 1000) * totalDuration * 1000;

  const nextProgramStartTime = currentCycleStart + (accumulatedTime + currentProgram.duration) * 1000;

  return {
    program: currentProgram,
    currentTime,
    timeRemaining: currentProgram.duration - currentTime,
    nextProgram,
    serverTime: now,
    programIndex,
    epochStart: MASTER_EPOCH_START,
    nextProgramStartTime,
    scheduleVersion: SCHEDULE_VERSION,
    totalPrograms: programs.length,
    channelId,
  };
}

export function getCurrentProgram(
  channelId: string,
  now: number = serverNow(),
): CurrentProgramInfo & { channelUnavailable: boolean } {
  return {
    ...computeCurrentProgramFromList(channelId, getChannelPrograms(channelId), now),
    channelUnavailable: !channelHasEmbeddedPrograms(channelId),
  };
}

export function getUpcomingPrograms(channelId: string, count = 15, now: number = serverNow()): VideoProgram[] {
  const current = getCurrentProgram(channelId, now);
  const programs = getChannelPrograms(channelId);
  const upcoming: VideoProgram[] = [];
  for (let i = 1; i <= count; i++) {
    upcoming.push(programs[(current.programIndex + i) % programs.length]);
  }
  return upcoming;
}

function buildLocalProgramRange(programs: VideoProgram[], startTime: number, count: number): ScheduleItem[] {
  const items: ScheduleItem[] = [];
  let currentStart = startTime;
  for (let i = 0; i < count; i++) {
    const program = programs[i % programs.length];
    const endTime = currentStart + program.duration * 1000;
    items.push({
      ytVideoId: program.videoId,
      title: program.title,
      duration: program.duration,
      startTime: currentStart,
      endTime,
    });
    currentStart = endTime;
  }
  return items;
}

/**
 * Same response shape as the external API, computed from the embedded
 * CHANNELS data. The web client's last-resort fallback (and the only one that
 * works with no network and no server).
 */
export function buildLocalCurrentVideoResponse(
  channelId: string,
  count = 15,
  now: number = serverNow(),
): ScheduleResult {
  const current = getCurrentProgram(channelId, now);
  const currentStartTime = current.serverTime - current.currentTime * 1000;
  const currentEndTime = currentStartTime + current.program.duration * 1000;

  const upcomingPrograms = getUpcomingPrograms(channelId, count, now);
  const previousPrograms = getPreviousVideos(channelId).slice(0, count);

  return {
    serverTime: current.serverTime,
    currentProgram: {
      ytVideoId: current.program.videoId,
      title: current.program.title,
      duration: current.program.duration,
      seekTo: current.currentTime,
      startTime: currentStartTime,
      endTime: currentEndTime,
    },
    previousPrograms: buildLocalProgramRange(
      [...previousPrograms].reverse(),
      currentStartTime - previousPrograms.reduce((sum, p) => sum + p.duration * 1000, 0),
      Math.min(previousPrograms.length, count),
    ),
    upcomingPrograms: buildLocalProgramRange(
      upcomingPrograms,
      currentEndTime,
      Math.min(upcomingPrograms.length, count),
    ),
    _source: 'local-schedule',
    // `now` is the servers' clock; _fetchedAt is the device's (callers add Date.now() −
    // _fetchedAt). Storing `now` made a device whose clock is off start that far off: a TV
    // box 23 s fast started 23 s ahead of the broadcast (2026-10-21).
    _fetchedAt: now - clockOffsetMs(),
    channelUnavailable: current.channelUnavailable,
  };
}

/** Schedule item → the app's programme shape (web mapping, incl. thumbnail). */
export function toVideoProgram(item: ScheduleItem, channelId: string): VideoProgram {
  return {
    id: item.ytVideoId,
    videoId: item.ytVideoId,
    title: item.title,
    description: item.title,
    duration: item.duration,
    category: 'Lecture',
    language: 'Bengali',
    channelId,
    thumbnail: `https://img.youtube.com/vi/${item.ytVideoId}/maxresdefault.jpg`,
  };
}
