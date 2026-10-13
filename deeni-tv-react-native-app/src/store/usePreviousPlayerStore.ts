import { create } from 'zustand';

import type { VideoProgram } from '@/types';

/** The on-demand Previous-programme player (web W-08). */
interface PreviousPlayerState {
  /** The player layer is open over the live player. */
  isOpen: boolean;
  /** The page was created (first time the Previous list opened); then kept for the app's life. */
  isCreated: boolean;
  video: VideoProgram | null;
  /** Warm-up video cued while the list is open (first row). */
  warmVideoId: string | null;
  isPlaying: boolean;
  isEnded: boolean;
  /** Branded loading screen until the video has really moved (≥3 s, cap 20 s). */
  isLoading: boolean;
  /** Frozen while playing → branded cover over YouTube's spinner. */
  isStalled: boolean;
  currentTime: number;
  /** TV: preview position while the remote's left/right is held on the seek bar (seeked to on release). */
  scrubTime: number | null;
  duration: number;
  isMuted: boolean;
  controlsVisible: boolean;
  isFullscreen: boolean;
}

export const usePreviousPlayerStore = create<PreviousPlayerState>()(() => ({
  isOpen: false,
  isCreated: false,
  video: null,
  warmVideoId: null,
  isPlaying: false,
  isEnded: false,
  isLoading: false,
  isStalled: false,
  currentTime: 0,
  scrubTime: null,
  duration: 0,
  isMuted: false,
  controlsVisible: true,
  isFullscreen: false,
}));
