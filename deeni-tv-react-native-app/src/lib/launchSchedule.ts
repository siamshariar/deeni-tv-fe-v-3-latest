import { Platform } from 'react-native';

import { DeeniLivePlayer } from '../../modules/deeni-live-player';
import { getLaunchPrograms, saveLaunchPrograms } from '@/lib/storage';
import type { LaunchSchedule } from '@/lib/youtube/playerPage';
import type { VideoProgram } from '@/types';

const MAX_ITEMS = 24;

/**
 * TV with the native live player: the programmes from now on, back to back as the live player
 * plays them, for the next launch's page to start by itself before React Native runs
 * (modules/deeni-live-player). `position` is how far the current programme is, in seconds.
 */
export function saveLaunchSchedule(channelId: string, current: VideoProgram, position: number, upcoming: VideoProgram[], lead: number): void {
  if (!DeeniLivePlayer || Platform.OS !== 'android' || !Platform.isTV) return;
  const now = Date.now();
  let start = Math.round(now - position * 1000);
  const items: LaunchSchedule['items'] = [];
  const named: { id: string; title: string; start: number; end: number }[] = [];
  for (const program of [current, ...upcoming.slice(0, MAX_ITEMS - 1)]) {
    if (!program?.videoId || !(program.duration > 0)) break;
    const end = start + Math.round(program.duration * 1000);
    items.push({ id: program.videoId, start, end });
    named.push({ id: program.videoId, title: program.title, start, end });
    start = end;
  }
  if (items.length === 0) return;
  saveLaunchPrograms({ channelId, items: named });
  const schedule: LaunchSchedule = { items, lead, savedAt: now };
  try {
    DeeniLivePlayer.setInitial(JSON.stringify(schedule));
  } catch {
    // The next launch starts the usual way.
  }
}

/** The programme on now by the saved schedule: the first screen shows it before anything has loaded. */
export function savedProgramOnNow(channelId: string): { id: string; title: string } | null {
  const saved = getLaunchPrograms();
  if (saved?.channelId !== channelId) return null;
  const now = Date.now();
  const item = saved.items?.find((i) => now >= i.start && now < i.end - 5000);
  return item ? { id: item.id, title: item.title } : null;
}
