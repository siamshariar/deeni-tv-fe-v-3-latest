/**
 * User actions shared by the control bar, the menu drawer and the error
 * overlay (web app/page.tsx + synced-video-player handlers).
 */
import { Linking, Platform } from 'react-native';

import { fetchChannelList } from '@/lib/api/client';
import { config } from '@/lib/config';
import { openDonationPage } from '@/lib/donation';
import { useBroadcastStore } from '@/store/useBroadcastStore';
import { useChannelStore } from '@/store/useChannelStore';
import { useUiStore } from '@/store/useUiStore';

import { broadcast } from './broadcastController';
import { previousPlayer } from './previousController';

/** Web: menu items close the drawer first, then open the target after 300 ms (TV: no slide, at once). */
export const MENU_TARGET_DELAY_MS = Platform.isTV ? 0 : 300;

export function openSchedule(): void {
  useUiStore.getState().open('schedule');
}

/**
 * Phone: the Watched player's page is created (first time) and cued after the list is on
 * screen. Doing it in the same frame as the list made the list take ~1 s to open (user
 * report, 2026-11-01). A row tapped sooner still works: play() creates the page itself.
 */
const WARM_AFTER_OPEN_MS = 300;

export function openPreviousList(): void {
  const first = useBroadcastStore.getState().history[0]?.videoId;
  // TV: its commands go first. The page is usually there already (prepareWatchedPlayer), and the
  // box needs every second to load the programme before one is picked.
  if (Platform.isTV) previousPlayer.listOpening();
  useUiStore.getState().open('previous-list');
  setTimeout(() => previousPlayer.warm(first), Platform.isTV ? 0 : WARM_AFTER_OPEN_MS);
}

/** In-player Channel modal; refreshes the list in the background (web handleOpenChannelSelector). */
export function openChannelModal(): void {
  useUiStore.getState().open('channels');
  void fetchChannelList().then((fresh) => {
    if (fresh) useChannelStore.getState().mergeFreshChannels(fresh);
  });
}

/** Refresh / Try Again: close every overlay, then reload the channel (web handleReload). */
export function refreshBroadcast(): void {
  useUiStore.getState().closeAll();
  previousPlayer.close();
  broadcast.refresh();
}

export function selectChannel(channelId: string, variant: 'first-visit' | 'switch'): void {
  const ui = useUiStore.getState();
  ui.close(variant === 'first-visit' ? 'channels-first' : 'channels');
  broadcast.selectChannel(channelId);
}

/** Donate: the language-based page in the browser; a QR code on TV (plan D-24). */
export function donate(): void {
  if (Platform.isTV) {
    useUiStore.getState().open('donate-qr');
    return;
  }
  openDonationPage(useChannelStore.getState().selectedId);
}

export function openAbout(): void {
  useUiStore.getState().open('about');
}

/** Privacy Policy (plan D-23): the web page in the browser. */
export function openPrivacyPolicy(): void {
  if (!config.webBaseUrl) return;
  Linking.openURL(`${config.webBaseUrl}/privacy-policy`).catch(() => {});
}

/** First load: fetch the channel list once in the background (stored list shows at once). */
export function refreshChannelListInBackground(): void {
  void fetchChannelList().then((fresh) => {
    if (fresh) useChannelStore.getState().setChannels(fresh);
  });
}
