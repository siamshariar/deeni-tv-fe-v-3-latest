// Normalises an external tv-schedules/live response into the unified shape.
// Ported from the web app's fetchFromBrowserAPI (components/synced-video-player.tsx):
// the API's field names vary, so every alias the web accepts is accepted here.
import type { ScheduleItem, ScheduleResult } from '@/types';

type Raw = Record<string, any>;

function mapProgram(p: Raw): ScheduleItem {
  return {
    ytVideoId: p.ytVideoId || p.videoId || p.yt_video_id,
    title: p.title || p.name,
    startTime: p.startTime || p.start_time,
    endTime: p.endTime || p.end_time,
    duration: p.duration,
  };
}

export function normalizeScheduleResponse(data: Raw | null | undefined, fetchedAt: number): ScheduleResult | null {
  const curr = data?.currentProgram || data?.current || data?.data?.currentProgram;
  if (!curr) return null;

  const serverTime: number = data?.serverTime || Date.now();
  const prevList = data?.previousPrograms || data?.previous || data?.data?.previousPrograms || [];
  const upList = data?.upcomingPrograms || data?.upcoming || data?.data?.upcomingPrograms || [];

  return {
    serverTime,
    currentProgram: {
      ytVideoId: curr.ytVideoId || curr.videoId || curr.yt_video_id,
      title: curr.title || curr.name,
      startTime: curr.startTime || curr.start_time || serverTime,
      endTime: curr.endTime || curr.end_time || serverTime + (curr.duration || 3600) * 1000,
      duration: curr.duration || 3600,
      seekTo: curr.seekTo || curr.seek_to || 0,
    },
    previousPrograms: (Array.isArray(prevList) ? prevList : []).map(mapProgram),
    upcomingPrograms: (Array.isArray(upList) ? upList : []).map(mapProgram),
    _source: 'external-api',
    _fetchedAt: fetchedAt,
  };
}

/** A response from any tier is usable only with these fields (web check). */
export function isUsableSchedule(result: ScheduleResult | null | undefined): result is ScheduleResult {
  return !!result && !!result.serverTime && !!result.currentProgram && !!result.currentProgram.ytVideoId;
}
