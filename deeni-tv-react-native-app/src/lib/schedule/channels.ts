// Ported from the Deeni web app: lib/schedule-utils.ts (fixes_to_launch a080ec2).
// The player uses the live tv-channels API's numeric ids ('3'); the embedded
// data uses local ids ('english-1'). They are matched by language
// (localizationId) and the Quran flag.
import { getStoredApiChannels } from '@/lib/storage';
import type { ApiChannel } from '@/types';

import { CHANNELS, CHANNEL_LID_MAP } from './channelsData';

// Same ids and order as the live tv-channels API, used whenever it is unreachable.
// Keep it in step with the API: channel ids are saved in storage and sent to
// the API, so a different numbering selects the wrong channel.
export const DEFAULT_API_CHANNELS: ApiChannel[] = [
  { id: 1, title: 'Bangla', localizationId: '5', isQuran: null },
  { id: 2, title: 'Quran - Bangla', localizationId: '5', isQuran: true },
  { id: 3, title: 'English', localizationId: '6', isQuran: null },
  { id: 4, title: 'Quran - English', localizationId: '6', isQuran: true },
  { id: 5, title: 'Arabic', localizationId: '7', isQuran: null },
  { id: 6, title: 'Quran - Arabic', localizationId: '7', isQuran: true },
  { id: 7, title: 'Urdu', localizationId: '8', isQuran: null },
  { id: 8, title: 'Chinese', localizationId: '9', isQuran: null },
  { id: 9, title: 'Quran - Chinese', localizationId: '9', isQuran: true },
];

export function getFallbackApiChannels(): ApiChannel[] {
  return DEFAULT_API_CHANNELS.map((channel) => ({ ...channel }));
}

export function isQuranChannel(channelId: string): boolean {
  return channelId.startsWith('quran-');
}

export function getChannelLid(channelId: string): number {
  return CHANNEL_LID_MAP[channelId] || 5;
}

/** The API channel for an id — from the stored API list, else the defaults. */
export function findApiChannel(channelId: string): ApiChannel | undefined {
  const byId = (c: ApiChannel) => String(c.id) === channelId;
  return getStoredApiChannels().find(byId) ?? DEFAULT_API_CHANNELS.find(byId);
}

/**
 * Map a channel id to its entry in CHANNELS by language and Quran flag.
 * Pass `hint` when the caller already knows them.
 */
export function resolveLocalChannelId(
  channelId: string,
  hint?: { lid?: string | number | null; isQuran?: boolean | null },
): string {
  if (CHANNELS.some((c) => c.id === channelId)) return channelId;
  const apiChannel =
    hint?.lid != null && hint.lid !== ''
      ? { localizationId: String(hint.lid), isQuran: hint.isQuran ?? null }
      : findApiChannel(channelId);
  if (!apiChannel) return channelId;
  const match = CHANNELS.find(
    (c) =>
      String(getChannelLid(c.id)) === String(apiChannel.localizationId) &&
      isQuranChannel(c.id) === (apiChannel.isQuran === true),
  );
  return match?.id ?? channelId;
}

/** The language (API localizationId, '5' = Bangla) of a channel, or null if unknown. */
export function getChannelLocalizationId(channelId?: string | null): string | null {
  if (!channelId) return null;
  const apiChannel = findApiChannel(channelId);
  if (apiChannel) return String(apiChannel.localizationId);
  return CHANNEL_LID_MAP[channelId] ? String(CHANNEL_LID_MAP[channelId]) : null;
}
