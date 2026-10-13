import { Calendar } from 'lucide-react-native';
import { useMemo } from 'react';
import { FlatList, Platform, Text, View } from 'react-native';

import { Focusable } from '@/components/common/Focusable';
import { useFrameLayout } from '@/hooks/useFrameLayout';
import { colors, fonts } from '@/lib/theme';
import { formatDuration } from '@/lib/time';
import { useBroadcastStore } from '@/store/useBroadcastStore';
import { useUiStore } from '@/store/useUiStore';

import { ModalCard, ModalHeader, ModalList } from './ModalCard';

/**
 * Programs Schedule (web W-06): Now Playing (gold), Up Next (yellow chip),
 * then the upcoming programmes with their durations. Display only: rows
 * aren't tappable (on TV they take focus only so the list can scroll).
 */
export function ScheduleModal() {
  // Separate stable selectors: a selector returning a new array would re-render forever (zustand 5).
  const currentProgram = useBroadcastStore((s) => s.currentProgram);
  const upcoming = useBroadcastStore((s) => s.upcoming);
  const schedule = useMemo(
    () => (currentProgram ? [currentProgram, ...upcoming.filter((p) => p.videoId !== currentProgram.videoId)] : []),
    [currentProgram, upcoming],
  );
  const { unit } = useFrameLayout();
  const close = () => useUiStore.getState().close('schedule');

  return (
    <ModalCard onBackdropPress={close}>
      <ModalHeader icon={<Calendar size={20 * unit} color={colors.gold} />} title="Programs Schedule" onClose={close} preferCloseFocus={schedule.length === 0} />
      {schedule.length === 0 ? (
        <View style={{ alignItems: 'center', paddingVertical: 64 * unit, paddingHorizontal: 16 * unit }}>
          {/* Copy fixed (plan D-21; the web says "No previous program available."). */}
          <Text style={{ color: colors.text60, fontFamily: fonts.regular, fontSize: 14 * unit, marginBottom: 8 * unit }}>
            No programs scheduled right now.
          </Text>
          <Text style={{ color: colors.text40, fontFamily: fonts.regular, fontSize: 12 * unit }}>The schedule is currently unavailable.</Text>
        </View>
      ) : (
        <ModalList>
          <FlatList
            data={schedule}
            keyExtractor={(p, i) => `${p.id}-${i}`}
            style={{ flexGrow: 0, flexShrink: 1 }}
            contentContainerStyle={{ padding: 16 * unit, gap: 8 * unit }}
            renderItem={({ item, index }) => {
              const isCurrent = index === 0;
              const isUpNext = index === 1;
              const row = (
                <>
                  {isCurrent || isUpNext ? (
                    <View
                      style={{
                        alignSelf: 'flex-start',
                        paddingHorizontal: 8 * unit,
                        paddingVertical: 2 * unit,
                        borderRadius: 999,
                        marginBottom: 6 * unit,
                        backgroundColor: isCurrent ? 'rgba(217,165,20,0.2)' : 'rgba(234,179,8,0.2)',
                      }}
                    >
                      <Text style={{ color: isCurrent ? colors.gold : colors.yellow300, fontFamily: fonts.medium, fontSize: 12 * unit }}>
                        {isCurrent ? 'Now Playing' : 'Up Next'}
                      </Text>
                    </View>
                  ) : null}
                  <Text style={{ color: isCurrent ? colors.gold : colors.white, fontFamily: fonts.semibold, fontSize: 15 * unit, lineHeight: 20 * unit }}>
                    {item.title}
                  </Text>
                  <Text style={{ color: colors.text40, fontFamily: fonts.regular, fontSize: 12 * unit, marginTop: 6 * unit }}>
                    {formatDuration(item.duration)}
                  </Text>
                </>
              );
              const rowStyle = {
                padding: 16 * unit,
                borderRadius: 12 * unit,
                borderWidth: 1,
                backgroundColor: isCurrent ? 'rgba(217,165,20,0.1)' : colors.fill5,
                borderColor: isCurrent ? 'rgba(217,165,20,0.3)' : colors.border10,
              };
              return Platform.isTV ? (
                <Focusable hasTVPreferredFocus={isCurrent} style={rowStyle}>
                  {row}
                </Focusable>
              ) : (
                <View style={rowStyle}>{row}</View>
              );
            }}
          />
        </ModalList>
      )}
    </ModalCard>
  );
}
