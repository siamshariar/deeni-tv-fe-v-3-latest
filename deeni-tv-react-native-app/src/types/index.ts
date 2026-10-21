// Shapes ported from the Deeni web app (types/schedule.ts, lib/schedule-utils.ts).

export interface VideoProgram {
  id: string;
  videoId: string;
  title: string;
  description: string;
  duration: number; // seconds
  category: string;
  language: string;
  channelId: string;
  thumbnail?: string;
  watchedAt?: number; // when added to the watch history
}

export interface Channel {
  id: string;
  name: string;
  language: string;
  icon: string;
  programs: VideoProgram[];
}

/** Exact shape returned by https://api.deeniinfotech.com/api/tv-channels */
export interface ApiChannel {
  id: number;
  title: string;
  localizationId: string;
  isQuran: boolean | null;
}

/** One programme in a schedule response (external API, web route or embedded). */
export interface ScheduleItem {
  ytVideoId: string;
  title: string;
  duration: number;
  startTime?: number;
  endTime?: number;
}

export type ScheduleSourceTag = 'external-api' | 'local-schedule' | 'local-schedule-json';

/** The unified schedule response every data tier returns. */
export interface ScheduleResult {
  serverTime: number;
  currentProgram: ScheduleItem & { seekTo: number; startTime: number; endTime: number };
  previousPrograms: ScheduleItem[];
  upcomingPrograms: ScheduleItem[];
  _source: ScheduleSourceTag | string;
  /** When seekTo was valid (client clock, ms). */
  _fetchedAt?: number;
  channelUnavailable?: boolean;
}
