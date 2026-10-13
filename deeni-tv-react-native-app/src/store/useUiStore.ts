import { create } from 'zustand';

/** Overlays, in the order they can stack. Back closes the newest first. */
export type OverlayId =
  | 'channels-first' // mandatory first-visit picker
  | 'channels' // in-player Channel modal
  | 'schedule'
  | 'previous-list'
  | 'menu'
  | 'about'
  | 'donate-qr';

/** Where the live player frame is on screen (window coordinates). */
export interface FrameRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface UiState {
  overlays: OverlayId[];
  /** Main player fullscreen. */
  isFullscreen: boolean;
  /** Fullscreen controls visible (auto-hide after 3.5 s). */
  fsControlsVisible: boolean;
  /** The 16:9 video area of the live frame (not including the bar). */
  videoRect: FrameRect | null;
  /** TV: where focus returns when an overlay closes (the opener: bar button or Donate pill). */
  tvFocusArea: 'bar' | 'donate';
  open: (id: OverlayId) => void;
  close: (id: OverlayId) => void;
  closeTop: () => boolean;
  closeAll: () => void;
  setFullscreen: (on: boolean) => void;
  setFsControlsVisible: (on: boolean) => void;
  setVideoRect: (rect: FrameRect) => void;
  setTvFocusArea: (area: 'bar' | 'donate') => void;
}

export const useUiStore = create<UiState>()((set, get) => ({
  overlays: [],
  isFullscreen: false,
  fsControlsVisible: true,
  videoRect: null,
  tvFocusArea: 'bar',
  open: (id) => set((s) => ({ overlays: [...s.overlays.filter((o) => o !== id), id] })),
  close: (id) => set((s) => ({ overlays: s.overlays.filter((o) => o !== id) })),
  closeTop: () => {
    const { overlays } = get();
    if (overlays.length === 0) return false;
    set({ overlays: overlays.slice(0, -1) });
    return true;
  },
  closeAll: () => set({ overlays: [] }),
  setFullscreen: (on) => set({ isFullscreen: on, fsControlsVisible: true }),
  setFsControlsVisible: (on) => set({ fsControlsVisible: on }),
  setTvFocusArea: (area) => {
    if (get().tvFocusArea !== area) set({ tvFocusArea: area });
  },
  setVideoRect: (rect) => {
    const prev = get().videoRect;
    if (prev && prev.x === rect.x && prev.y === rect.y && prev.width === rect.width && prev.height === rect.height) return;
    set({ videoRect: rect });
  },
}));

export const isOverlayOpen = (id: OverlayId) => useUiStore.getState().overlays.includes(id);
