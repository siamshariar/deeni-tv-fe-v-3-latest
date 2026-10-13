import { useEffect } from 'react';
import { BackHandler, StyleSheet, View } from 'react-native';

import { previousPlayer } from '@/player/previousController';
import { setMainFullscreen, setPreviousFullscreen } from '@/player/fullscreen';
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
 */
export function useBackHandler(): void {
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      const prev = usePreviousPlayerStore.getState();
      if (prev.isOpen) {
        if (prev.isFullscreen) setPreviousFullscreen(false);
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
      if (ui.isFullscreen) {
        setMainFullscreen(false);
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, []);
}
