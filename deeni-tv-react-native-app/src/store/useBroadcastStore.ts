import { create } from 'zustand';

import type { VideoProgram } from '@/types';

/**
 * The live broadcast as the UI sees it. Written only by the broadcast
 * controller (src/player/broadcastController.ts).
 *
 * phase:
 * - idle        nothing chosen yet
 * - tuning      the schedule is being fetched ("Tuning into your broadcast...")
 * - branded     programme known, video starting (branded WATCHING cover)
 * - playing     the real video is moving
 * - unavailable this programme can't be embedded; waits for the next one
 * - error       "Failed to Load"
 */
export type BroadcastPhase = 'idle' | 'tuning' | 'branded' | 'playing' | 'unavailable' | 'error';

interface BroadcastState {
  channelId: string | null;
  phase: BroadcastPhase;
  currentProgram: VideoProgram | null;
  nextProgram: VideoProgram | null;
  upcoming: VideoProgram[];
  history: VideoProgram[];
  errorMessage: string | null;
  /** Branded cover visible (start, transition, stall, near end). */
  coverVisible: boolean;
  /** Title on the branded cover. */
  coverTitle: string;
  /** The WebView may be shown (after the first real movement; web iframeVisible). */
  videoVisible: boolean;
  /**
   * A channel the viewer started is loading: from the load until its start cover
   * lifts (not set by automatic changes: next programme, recovery). TV keeps the bar up meanwhile.
   */
  videoStarting: boolean;
  /** Seconds into the programme / its duration, from the player. */
  currentTime: number;
  duration: number;
  /** The volume button is inert until the real video plays. */
  volumeLocked: boolean;
  isMuted: boolean;
  /** Remaining seconds until the next programme while `phase === 'unavailable'`. */
  unavailableUntil: number | null;
}

export const initialBroadcastState: BroadcastState = {
  channelId: null,
  phase: 'idle',
  currentProgram: null,
  nextProgram: null,
  upcoming: [],
  history: [],
  errorMessage: null,
  coverVisible: false,
  coverTitle: '',
  videoVisible: false,
  videoStarting: false,
  currentTime: 0,
  duration: 0,
  volumeLocked: true,
  isMuted: true,
  unavailableUntil: null,
};

export const useBroadcastStore = create<BroadcastState>()(() => ({ ...initialBroadcastState }));
