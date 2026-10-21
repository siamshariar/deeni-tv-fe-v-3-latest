import { Image } from 'react-native';

export type ThumbQuality = 'maxresdefault' | 'hqdefault';

export const thumbUrl = (videoId: string, quality: ThumbQuality) => `https://img.youtube.com/vi/${videoId}/${quality}.jpg`;

/** Older videos have no maxresdefault (404): remembered, so a later cover goes straight to the one that exists. */
const known = new Map<string, ThumbQuality>();

export const thumbQuality = (videoId: string): ThumbQuality => known.get(videoId) ?? 'maxresdefault';

export function noteThumbMissing(videoId: string): void {
  known.set(videoId, 'hqdefault');
}

/** Loaded ahead of its cover: fetched only when the cover is up, the picture stays black for ~0.7 s (phone, 2026-11-04). */
export function prefetchThumbnail(videoId: string): void {
  if (known.has(videoId)) return;
  known.set(videoId, 'maxresdefault');
  Image.prefetch(thumbUrl(videoId, 'maxresdefault'))
    .catch(() => {
      known.set(videoId, 'hqdefault');
      return Image.prefetch(thumbUrl(videoId, 'hqdefault'));
    })
    .catch(() => {});
}
