import { Calendar, Globe, History, Maximize, Minimize, MoreHorizontal, RefreshCw, Volume2, VolumeX } from 'lucide-react-native';
import { useState } from 'react';
import { Platform, StyleSheet, TVFocusGuideView, View, type StyleProp, type ViewStyle } from 'react-native';

import { Logo } from '@/components/common/Logo';
import type { FrameLayout } from '@/hooks/useFrameLayout';
import { colors } from '@/lib/theme';
import { openChannelModal, openPreviousList, openSchedule, refreshBroadcast } from '@/player/actions';
import { broadcast } from '@/player/broadcastController';
import { useBroadcastStore } from '@/store/useBroadcastStore';
import { useUiStore } from '@/store/useUiStore';

import { RoundButton } from './RoundButton';

/**
 * The bar under the live video (web W-04): Deeni.tv logo left; right, in
 * order: Volume, Programs Schedule, Watched Program, Channel, Refresh,
 * Full screen, Menu. Labels are the web's `title` texts.
 */
export function ControlBar({
  layout,
  fullscreen,
  onToggleFullscreen,
  onActivity,
  style,
  preferFocus,
  blocked = false,
}: {
  layout: FrameLayout;
  fullscreen: boolean;
  onToggleFullscreen: () => void;
  onActivity?: () => void;
  style?: StyleProp<ViewStyle>;
  /** TV: default focus on the Channel button (plan D-33) when nothing else is open. */
  preferFocus: boolean;
  /** The Previous player covers the bar: no D-pad focus. */
  blocked?: boolean;
}) {
  const isMuted = useBroadcastStore((s) => s.isMuted);
  const volumeLocked = useBroadcastStore((s) => s.volumeLocked);
  const { buttonSize, iconSize, unit, size } = layout;
  const compact = size === 'mobile';
  const gap = (compact ? 2 : 6) * unit;

  // TV: focus returns to the button that opened an overlay (Channel by default, plan D-33).
  const [lastFocused, setLastFocused] = useState('channel');
  const focusProps = (key: string) => ({
    focusable: !blocked,
    hasTVPreferredFocus: preferFocus && lastFocused === key,
    onFocus: () => {
      setLastFocused(key);
      useUiStore.getState().setTvFocusArea('bar');
      onActivity?.();
    },
  });

  const act = (fn: () => void) => () => {
    onActivity?.();
    fn();
  };

  const buttons = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap }}>
      <RoundButton
        icon={isMuted ? VolumeX : Volume2}
        label={volumeLocked ? 'Volume becomes available after the real video starts' : isMuted ? 'Unmute' : 'Mute'}
        size={buttonSize}
        iconSize={iconSize}
        disabled={volumeLocked}
        onPress={act(() => broadcast.toggleMute())}
        {...focusProps('volume')}
      />
      <RoundButton icon={Calendar} label="Programs Schedule" size={buttonSize} iconSize={iconSize} onPress={act(openSchedule)} {...focusProps('schedule')} />
      <RoundButton icon={History} label="Watched Program" size={buttonSize} iconSize={iconSize} onPress={act(openPreviousList)} {...focusProps('watched')} />
      <RoundButton
        icon={Globe}
        label="Channel"
        size={buttonSize}
        iconSize={iconSize}
        onPress={act(openChannelModal)}
        {...focusProps('channel')}
      />
      <RoundButton icon={RefreshCw} label="Refresh" size={buttonSize} iconSize={iconSize} onPress={act(refreshBroadcast)} {...focusProps('refresh')} />
      <RoundButton
        icon={fullscreen ? Minimize : Maximize}
        label={fullscreen ? 'Exit full screen' : 'Full screen'}
        size={buttonSize}
        iconSize={iconSize}
        onPress={act(onToggleFullscreen)}
        {...focusProps('fullscreen')}
      />
      <RoundButton
        icon={MoreHorizontal}
        label="Menu"
        size={buttonSize}
        iconSize={iconSize}
        onPress={act(() => useUiStore.getState().open('menu'))}
        {...focusProps('menu')}
      />
    </View>
  );

  return (
    <View
      style={[
        styles.bar,
        {
          height: layout.barHeight,
          paddingHorizontal: (layout.windowWidth >= 640 || layout.isTV ? 24 : 12) * unit,
        },
        // Framed: the web's frame border on the sides and bottom, rounded bottom
        // corners. Fullscreen: no border props at all — even 0-width overrides
        // left the background 1 px short of the left, right and bottom screen edges.
        fullscreen ? null : styles.framed,
        fullscreen ? null : { borderBottomLeftRadius: layout.cornerRadius, borderBottomRightRadius: layout.cornerRadius },
        style,
      ]}
    >
      <Logo height={layout.logoHeight} style={{ flexShrink: 1, maxWidth: '40%' }} />
      {Platform.isTV ? (
        <TVFocusGuideView autoFocus trapFocusLeft trapFocusRight>
          {buttons}
        </TVFocusGuideView>
      ) : (
        buttons
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.black60,
  },
  framed: {
    borderColor: colors.border10,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
  },
});
