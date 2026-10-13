import { Clock, History, Play } from 'lucide-react-native';
import { FlatList, Text, View } from 'react-native';

import { Focusable } from '@/components/common/Focusable';
import { useFrameLayout } from '@/hooks/useFrameLayout';
import { colors, fonts } from '@/lib/theme';
import { formatDuration } from '@/lib/time';
import { previousPlayer } from '@/player/previousController';
import { useBroadcastStore } from '@/store/useBroadcastStore';
import { usePreviousPlayerStore } from '@/store/usePreviousPlayerStore';
import { useUiStore } from '@/store/useUiStore';

import { ModalCard, ModalHeader, ModalList } from './ModalCard';

/**
 * "Previous Programs" (web W-07; opened by "Watched Program"). The backdrop
 * does not close it (web). A row opens the Previous player over everything;
 * the list stays behind it and closes together with the player.
 */
export function PreviousProgramsModal() {
  const videos = useBroadcastStore((s) => s.history);
  const playerOpen = usePreviousPlayerStore((s) => s.isOpen);
  const { unit } = useFrameLayout();
  const close = () => useUiStore.getState().close('previous-list');

  if (playerOpen) return null;

  return (
    <ModalCard>
      <ModalHeader
        icon={<History size={20 * unit} color={colors.gold} />}
        title="Previous Programs"
        subtitle={`${videos.length} ${videos.length === 1 ? 'video' : 'videos'}`}
        onClose={close}
        preferCloseFocus={videos.length === 0}
      />
      {videos.length === 0 ? (
        <View style={{ alignItems: 'center', paddingVertical: 48 * unit, paddingHorizontal: 16 * unit }}>
          <History size={32 * unit} color="rgba(255,255,255,0.2)" style={{ marginBottom: 16 * unit }} />
          <Text style={{ color: colors.text60, fontFamily: fonts.regular, fontSize: 14 * unit, marginBottom: 8 * unit }}>No Previous Programs videos</Text>
          <Text style={{ color: colors.text40, fontFamily: fonts.regular, fontSize: 12 * unit, textAlign: 'center' }}>Videos you watch will appear here</Text>
        </View>
      ) : (
        <ModalList>
          <FlatList
            data={videos}
            keyExtractor={(v, i) => `${v.id}-${i}`}
            style={{ flexGrow: 0, flexShrink: 1 }}
            contentContainerStyle={{ padding: 16 * unit, gap: 8 * unit }}
            renderItem={({ item, index }) => (
              <Focusable
                onPress={() => previousPlayer.play(item)}
                hasTVPreferredFocus={index === 0}
                accessibilityRole="button"
                accessibilityLabel={`Play ${item.title}`}
                style={({ focused }) => ({
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  gap: 12 * unit,
                  padding: 16 * unit,
                  borderRadius: 12 * unit,
                  borderWidth: 1,
                  backgroundColor: focused ? colors.fill10 : colors.fill5,
                  borderColor: focused ? colors.gold : colors.border10,
                })}
              >
                <View
                  style={{
                    width: 24 * unit,
                    height: 24 * unit,
                    borderRadius: 12 * unit,
                    backgroundColor: 'rgba(217,165,20,0.2)',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginTop: 2 * unit,
                  }}
                >
                  <Play size={10 * unit} color={colors.gold} fill={colors.gold} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.white, fontFamily: fonts.semibold, fontSize: 14 * unit, lineHeight: 19 * unit }}>{item.title}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 * unit, marginTop: 6 * unit }}>
                    <Clock size={12 * unit} color={colors.text40} />
                    <Text style={{ color: colors.text40, fontFamily: fonts.regular, fontSize: 12 * unit }}>{formatDuration(item.duration)}</Text>
                  </View>
                </View>
              </Focusable>
            )}
          />
        </ModalList>
      )}
    </ModalCard>
  );
}
