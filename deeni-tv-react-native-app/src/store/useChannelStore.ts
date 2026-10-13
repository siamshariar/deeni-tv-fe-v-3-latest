import { create } from 'zustand';

import { getFallbackApiChannels } from '@/lib/schedule/channels';
import { getSavedChannel, getStoredApiChannels, saveApiChannels, saveChannel } from '@/lib/storage';
import type { ApiChannel } from '@/types';

interface ChannelState {
  /** Shown at once: stored list, else the defaults (the Capacitor app's behaviour). */
  channels: ApiChannel[];
  /** Selected API channel id; null = first visit. */
  selectedId: string | null;
  setChannels: (channels: ApiChannel[]) => void;
  /** Replace the list only if ids or titles changed (in-player Channel modal, web W-10). */
  mergeFreshChannels: (fresh: ApiChannel[]) => void;
  select: (channelId: string) => void;
}

const stored = getStoredApiChannels();

export const useChannelStore = create<ChannelState>()((set, get) => ({
  channels: stored.length > 0 ? stored : getFallbackApiChannels(),
  selectedId: getSavedChannel(),
  setChannels: (channels) => {
    saveApiChannels(channels);
    set({ channels });
  },
  mergeFreshChannels: (fresh) => {
    const current = getStoredApiChannels();
    const changed =
      fresh.length !== current.length ||
      fresh.some((f, i) => !current[i] || f.id !== current[i].id || f.title !== current[i].title);
    if (changed) get().setChannels(fresh);
  },
  select: (channelId) => {
    saveChannel(channelId);
    set({ selectedId: channelId });
  },
}));
