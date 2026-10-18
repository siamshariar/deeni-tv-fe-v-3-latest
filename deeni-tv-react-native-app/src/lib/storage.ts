import Storage from 'expo-sqlite/kv-store';

import type { ApiChannel, VideoProgram } from '@/types';

/**
 * App storage. Same keys and JSON shapes as the web app's localStorage
 * (lib/schedule-utils.ts), so behaviour stays identical:
 * - `deeni-tv-channel`            selected API channel id ("1"…"9")
 * - `deeni-tv-channels`           channel list exactly as the API returned it
 * - `deeni-tv-previous-{channel}` watch history, newest first, max 30
 *
 * Backed by expo-sqlite's synchronous key-value store (supported on TV).
 */
export const STORAGE_KEY = 'deeni-tv-channel';
export const API_CHANNELS_STORAGE_KEY = 'deeni-tv-channels';
export const PREVIOUS_VIDEOS_KEY_PREFIX = 'deeni-tv-previous-';
const HISTORY_LIMIT = 30;

function read(key: string): string | null {
  try {
    return Storage.getItemSync(key);
  } catch (error) {
    console.warn('Storage read failed:', key, error);
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    Storage.setItemSync(key, value);
  } catch (error) {
    console.warn('Storage write failed:', key, error);
  }
}

function readJson<T>(key: string, fallback: T): T {
  const raw = read(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function getSavedChannel(): string | null {
  return read(STORAGE_KEY);
}

export function saveChannel(channelId: string): void {
  write(STORAGE_KEY, channelId);
}

export function getStoredApiChannels(): ApiChannel[] {
  const parsed = readJson<unknown>(API_CHANNELS_STORAGE_KEY, []);
  return Array.isArray(parsed) ? (parsed as ApiChannel[]) : [];
}

export function saveApiChannels(channels: ApiChannel[]): void {
  write(API_CHANNELS_STORAGE_KEY, JSON.stringify(channels));
}

export function getPreviousVideos(channelId: string): VideoProgram[] {
  const parsed = readJson<unknown>(`${PREVIOUS_VIDEOS_KEY_PREFIX}${channelId}`, []);
  return Array.isArray(parsed) ? (parsed as VideoProgram[]) : [];
}

export function savePreviousVideos(channelId: string, videos: VideoProgram[]): void {
  write(`${PREVIOUS_VIDEOS_KEY_PREFIX}${channelId}`, JSON.stringify(videos.slice(0, HISTORY_LIMIT)));
}

/** Prepend a watched programme: dedupe by id, newest first, max 30 (web addToPreviousVideos). */
export function addToPreviousVideos(channelId: string, video: VideoProgram): VideoProgram[] {
  const previous = getPreviousVideos(channelId);
  const watched = { ...video, watchedAt: Date.now() };
  const updated = [watched, ...previous.filter((v) => v.id !== video.id)].slice(0, HISTORY_LIMIT);
  savePreviousVideos(channelId, updated);
  return updated;
}
