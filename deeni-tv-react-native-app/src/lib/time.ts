// Ported from the Deeni web app: lib/schedule-utils.ts formatTime / formatDuration.

/** Seconds → M:SS or H:MM:SS (the remaining-time pill, the Previous player). */
export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) seconds = 0;
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  if (hours > 0) {
    return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  if (mins > 0) {
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
  return `0:${secs.toString().padStart(2, '0')}`;
}

/** Seconds → "45 secs", "1 min", "36 mins", "1h", "1h 7m" (schedule and previous lists). */
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds} secs`;
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }
  return mins === 1 ? `${mins} min` : `${mins} mins`;
}
