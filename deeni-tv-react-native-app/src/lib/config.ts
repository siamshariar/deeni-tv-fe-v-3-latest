import { Platform } from 'react-native';

/**
 * Build-time configuration (EXPO_PUBLIC_* variables are inlined by Metro).
 * Defaults match the Deeni web app.
 */
export const config = {
  /** Live schedule API base (web: NEXT_PUBLIC_API_BASE). */
  apiBase: process.env.EXPO_PUBLIC_API_BASE || 'https://api.deeniinfotech.com/api/tv-schedules',
  /** Channel list API (web: NEXT_PUBLIC_TV_CHANNELS_API). */
  tvChannelsApi: process.env.EXPO_PUBLIC_TV_CHANNELS_API || 'https://api.deeniinfotech.com/api/tv-channels',
  /** JWT signing secret for the `p` header (web: NEXT_PUBLIC_NP_AS_L). Empty = no auth header. */
  jwtSecret: process.env.EXPO_PUBLIC_NP_AS_L || '',
  /**
   * Sent as `Referer` (and its origin as `Origin`) with API requests, like a browser on
   * the web app. Cloudflare in front of api.deeniinfotech.com blocks requests without a
   * deeni.tv referer ("Sorry, you have been blocked", 2026-10-21) before they reach the
   * API, so the app needs it until the API allows the app another way. Empty = not sent.
   */
  apiReferer: process.env.EXPO_PUBLIC_API_REFERER ?? 'https://www.deeni.tv/',
  /**
   * Deployed web app: tier-2 schedule route (/api/current-video) and the
   * privacy policy page. Empty string disables tier 2.
   */
  webBaseUrl: process.env.EXPO_PUBLIC_WEB_BASE_URL ?? 'https://www.deeni.tv',
  /** Origin of the inline YouTube player page (page baseUrl, `origin`, `widget_referrer`). */
  playerOrigin: process.env.EXPO_PUBLIC_PLAYER_ORIGIN || 'https://www.deeni.tv',
  /**
   * YouTube embed host: 'https://www.youtube.com' or 'https://www.youtube-nocookie.com'. The
   * privacy-enhanced host by default (user request 2026-11-16): it doesn't draw the uploader's
   * end screen (suggested-video, channel and playlist tiles over a video's last 5–20 s), which
   * www.youtube.com draws over every embed with no way to turn it off (tested in Chrome).
   */
  youtubeHost: process.env.EXPO_PUBLIC_YOUTUBE_HOST || 'https://www.youtube-nocookie.com',
} as const;

/**
 * YouTube-chrome behaviours, each behind a flag so the outcome of the
 * YouTube / store policy review (plan §17.1) is a setting change, not a redesign.
 */
export const youtubeFlags = {
  /** Branded cover from a few seconds before a programme ends (hides YouTube's end screen). */
  coverEndScreen: true,
  /**
   * Branded cover after every load / switch / seek until the video really plays (0.5 s with
   * `cropChrome`, else 3–6 s); its sound stays off meanwhile (the player page's cover hold).
   */
  coverAfterLoad: true,
  /**
   * Keep YouTube's top bar (title, channel) and bottom strip ("More videos", logo) out of
   * view: the player page clips the iframe to the 16:9 picture and makes it taller by a
   * margin at the top and the bottom, so YouTube centres the same picture inside it (the
   * video is not cropped or zoomed). YouTube's centre icon is covered by PlaybackIndicator.
   */
  cropChrome: true,
  /** Previous player: programme thumbnail over YouTube's pause and end UI. */
  thumbnailCoverOnPauseAndEnd: true,
  /** Unmute automatically on the first frame (muted autoplay start). */
  autoUnmute: true,
} as const;

/**
 * How long YouTube shows its centre play/pause icon once a video plays after a start, seek or
 * resume (with any playerVars, muted or not; measured 2026-11-01/03: ~3 s phone, 5–6 s on the
 * CPU-capped TV box). PlaybackIndicator covers it that long after a cover lifts. History: a
 * Deeni logo badge looked like a stray stamp, and waiting the icon out under the cover made the
 * loading 3–6 s longer (both rejected by the user, 2026-11-03).
 */
export const YOUTUBE_ICON_MS = Platform.isTV ? 6000 : 3500;
