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
   * Deployed web app: tier-2 schedule route (/api/current-video) and the
   * privacy policy page. Empty string disables tier 2.
   */
  webBaseUrl: process.env.EXPO_PUBLIC_WEB_BASE_URL ?? 'https://www.deeni.tv',
  /** Origin of the inline YouTube player page (page baseUrl, `origin`, `widget_referrer`). */
  playerOrigin: process.env.EXPO_PUBLIC_PLAYER_ORIGIN || 'https://www.deeni.tv',
  /** YouTube embed host: 'https://www.youtube.com' or 'https://www.youtube-nocookie.com'. */
  youtubeHost: process.env.EXPO_PUBLIC_YOUTUBE_HOST || 'https://www.youtube.com',
} as const;

/**
 * YouTube-chrome behaviours, each behind a flag so the outcome of the
 * YouTube / store policy review (plan §17.1) is a setting change, not a redesign.
 */
export const youtubeFlags = {
  /** Branded cover from a few seconds before a programme ends (hides YouTube's end screen). */
  coverEndScreen: true,
  /** Branded cover until ≥3 s of real movement after every load / switch / seek. */
  coverAfterLoad: true,
  /** Previous player: programme thumbnail over YouTube's pause and end UI. */
  thumbnailCoverOnPauseAndEnd: true,
  /** Unmute automatically on the first frame (muted autoplay start). */
  autoUnmute: true,
} as const;
