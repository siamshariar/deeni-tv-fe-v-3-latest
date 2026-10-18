import { useEffect } from 'react';
import { BackHandler, StyleSheet, ToastAndroid, View } from 'react-native';

import { previousPlayer } from '@/player/previousController';
import { ALWAYS_FULLSCREEN, setMainFullscreen, setPreviousFullscreen } from '@/player/fullscreen';
import { usePreviousPlayerStore } from '@/store/usePreviousPlayerStore';
import { useUiStore, type OverlayId } from '@/store/useUiStore';

import { AboutModal } from './AboutModal';
import { ChannelSelector } from './ChannelSelector';
import { DonateQrPanel } from './DonateQrPanel';
import { MenuDrawer } from './MenuDrawer';
import { PreviousProgramsModal } from './PreviousProgramsModal';
import { ScheduleModal } from './ScheduleModal';

function renderOverlay(id: OverlayId) {
  switch (id) {
    case 'channels-first':
      return <ChannelSelector variant="first-visit" />;
    case 'channels':
      return <ChannelSelector variant="switch" />;
    case 'schedule':
      return <ScheduleModal />;
    case 'previous-list':
      return <PreviousProgramsModal />;
    case 'menu':
      return null; // always mounted below (slides in and out)
    case 'about':
      return <AboutModal />;
    case 'donate-qr':
      return <DonateQrPanel />;
  }
}

/** Every overlay, in opening order (newest on top). */
export function OverlayHost() {
  const overlays = useUiStore((s) => s.overlays);
  return (
    <>
      {overlays.map((id) => (
        <View key={id} style={StyleSheet.absoluteFill} pointerEvents="box-none">
          {renderOverlay(id)}
        </View>
      ))}
      <MenuDrawer />
    </>
  );
}

/**
 * Hardware Back (Android phones and TV, plan D-25):
 * Previous player fullscreen → Previous player → top overlay → main
 * fullscreen → leave the app. The mandatory first-visit picker can't be
 * closed: Back there leaves the app. The web had no Back handling at all.
 * TV (always fullscreen) on the live screen: Back is a key like any other and
 * shows the bar; leaving takes a second Back within 2.5 s ("Press Back again
 * to exit"), so one stray press never drops the viewer out of the broadcast.
 */
const EXIT_CONFIRM_MS = 2500;
export function useBackHandler(): void {
  useEffect(() => {
    let lastBackAt = 0;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      const prev = usePreviousPlayerStore.getState();
      if (prev.isOpen) {
        // TV is always fullscreen: Back closes the player.
        if (prev.isFullscreen && !ALWAYS_FULLSCREEN) setPreviousFullscreen(false);
        else previousPlayer.close();
        return true;
      }
      const ui = useUiStore.getState();
      const top = ui.overlays[ui.overlays.length - 1];
      if (top === 'channels-first') return false;
      if (top) {
        ui.close(top);
        return true;
      }
      if (ui.isFullscreen && !ALWAYS_FULLSCREEN) {
        setMainFullscreen(false);
        return true;
      }
      if (ALWAYS_FULLSCREEN) {
        const now = Date.now();
        if (now - lastBackAt < EXIT_CONFIRM_MS) {
          lastBackAt = 0;
          return false;
        }
        lastBackAt = now;
        ui.showFsControls();
        ToastAndroid.show('Press Back again to exit', ToastAndroid.SHORT);
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, []);
}
