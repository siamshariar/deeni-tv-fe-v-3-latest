import { Globe, Sparkles } from 'lucide-react-native';
import { useMemo, useRef, useState, type Ref } from 'react';
import { FlatList, Keyboard, Platform, Text, TextInput, View, useTVEventHandler, type HWEvent } from 'react-native';

import { Focusable } from '@/components/common/Focusable';
import { Gradient } from '@/components/common/Gradient';
import { Pulse } from '@/components/common/Motion';
import { useFrameLayout } from '@/hooks/useFrameLayout';
import { colors, fonts } from '@/lib/theme';
import { requestTVFocus } from '@/lib/tvFocus';
import { selectChannel } from '@/player/actions';
import { useChannelStore } from '@/store/useChannelStore';
import { useUiStore } from '@/store/useUiStore';
import type { ApiChannel } from '@/types';

import { ModalCard, ModalHeader, ModalList } from './ModalCard';

/**
 * Channel picker (web W-01 / W-10), one component with the web's two
 * variants (plan D-20):
 * - first-visit: mandatory — no X, backdrop does nothing, search box (also
 *   on TV: ▲ from the first row, OK opens the TV keyboard), sub-line
 *   "Choose a channel to start watching"
 * - switch: X, backdrop closes, no search, the current channel highlighted
 *   with a "Current" chip
 * Picking a channel is picking the language: there is no language screen.
 */
export function ChannelSelector({ variant }: { variant: 'first-visit' | 'switch' }) {
  const channels = useChannelStore((s) => s.channels);
  const currentId = useChannelStore((s) => s.selectedId);
  const { unit, windowWidth } = useFrameLayout();
  const [query, setQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  // Once the search box has been used, the list stops claiming focus: a re-filtered
  // list would otherwise pull focus out of the box (and the TV keyboard) per letter.
  const [searchUsed, setSearchUsed] = useState(false);
  // TV: while the search box has focus the keyboard service swallows ▼'s key-down,
  // so the field never moves focus itself; ▼ (seen as its key-up) moves it to the
  // first card from here.
  const searchFocusedRef = useRef(false);
  searchFocusedRef.current = searchFocused;
  const firstCardRef = useRef<View>(null);
  useTVEventHandler((evt: HWEvent) => {
    if (searchFocusedRef.current && evt.eventType === 'down') requestTVFocus(firstCardRef.current);
  });
  const isFirst = variant === 'first-visit';
  const showSearch = isFirst;
  const columns = windowWidth >= 768 || Platform.isTV ? 2 : 1;
  const close = isFirst ? undefined : () => useUiStore.getState().close('channels');

  const filtered = useMemo(
    () => channels.filter((c) => c.title.toLowerCase().includes(query.trim().toLowerCase())),
    [channels, query],
  );
  const defaultFocusId = !isFirst && currentId ? currentId : filtered[0] ? String(filtered[0].id) : null;
  // Web grid: an odd last card stays half width (a spacer fills the row).
  const rows: (ApiChannel | null)[] = columns > 1 && filtered.length % 2 === 1 ? [...filtered, null] : filtered;

  return (
    <ModalCard backdropOpacity={0.9} onBackdropPress={close} maxHeightRatio={0.9}>
      <View>
        {/* Web: bg-gradient-to-r from-primary/20 via-purple-500/20 to-primary/20 */}
        <Gradient
          direction="r"
          stops={[
            { offset: 0, color: colors.gold, opacity: 0.2 },
            { offset: 0.5, color: colors.purple500, opacity: 0.2 },
            { offset: 1, color: colors.gold, opacity: 0.2 },
          ]}
        />
        <ModalHeader
          big
          icon={<Globe size={20 * unit} color={colors.gold} />}
          title="Select Channel"
          onClose={close}
          subtitle={
            isFirst ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 * unit, marginTop: 2 * unit }}>
                <Sparkles size={10 * unit} color={colors.text40} />
                <Text style={{ color: colors.text40, fontFamily: fonts.regular, fontSize: 12 * unit }}>
                  Choose a channel to start watching
                </Text>
              </View>
            ) : undefined
          }
        />
      </View>

      {showSearch ? (
        <View style={{ padding: 16 * unit, borderBottomWidth: 1, borderBottomColor: colors.border10 }}>
          <View>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search channels..."
              placeholderTextColor={colors.text40}
              autoCorrect={false}
              onFocus={() => {
                setSearchFocused(true);
                setSearchUsed(true);
              }}
              onBlur={() => setSearchFocused(false)}
              style={{
                color: colors.white,
                fontFamily: fonts.regular,
                fontSize: 15 * unit,
                paddingVertical: 12 * unit,
                paddingLeft: 44 * unit,
                paddingRight: 16 * unit,
                borderRadius: 12 * unit,
                backgroundColor: colors.fill5,
                borderWidth: searchFocused && Platform.isTV ? 2 : 1,
                borderColor: searchFocused && Platform.isTV ? colors.gold : searchFocused || query ? 'rgba(217,165,20,0.5)' : colors.border10,
              }}
            />
            <View style={{ position: 'absolute', left: 12 * unit, top: 14 * unit }} pointerEvents="none">
              <Globe size={16 * unit} color={colors.text40} />
            </View>
          </View>
        </View>
      ) : null}

      <ModalList>
        <FlatList
          data={rows}
          key={columns}
          numColumns={columns}
          keyExtractor={(c, i) => (c ? String(c.id) : `spacer-${i}`)}
          style={{ flexGrow: 0, flexShrink: 1 }}
          // A tap on a card selects it even while the search box has focus (web);
          // the default ('never') spent the first tap on closing the keyboard.
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: 16 * unit, gap: 12 * unit }}
          columnWrapperStyle={columns > 1 ? { gap: 12 * unit } : undefined}
          renderItem={({ item, index }) =>
            item === null ? (
              // Same padding + border as a card, so both halves get the same width.
              <View style={{ flex: 1, padding: 16 * unit, borderWidth: 1, borderColor: 'transparent' }} />
            ) : (
              <ChannelCard
                cardRef={index === 0 ? firstCardRef : undefined}
                channel={item}
                isCurrent={!isFirst && String(item.id) === currentId}
                preferFocus={!searchUsed && String(item.id) === defaultFocusId}
                unit={unit}
                onPress={() => {
                  // The search keyboard would otherwise stay up over the player (the web's closes with the input).
                  Keyboard.dismiss();
                  selectChannel(String(item.id), variant);
                }}
              />
            )
          }
        />
      </ModalList>

      <View style={{ padding: 16 * unit, borderTopWidth: 1, borderTopColor: colors.border10, backgroundColor: colors.fill5 }}>
        <Text style={{ color: colors.text40, fontFamily: fonts.regular, fontSize: 12 * unit, textAlign: 'center' }}>
          {filtered.length} channels available • {isFirst ? 'Select a channel to begin' : 'Select your preferred channel'}
        </Text>
      </View>
    </ModalCard>
  );
}

function ChannelCard({
  cardRef,
  channel,
  isCurrent,
  preferFocus,
  unit,
  onPress,
}: {
  cardRef?: Ref<View>;
  channel: ApiChannel;
  isCurrent: boolean;
  preferFocus: boolean;
  unit: number;
  onPress: () => void;
}) {
  return (
    <Focusable
      ref={cardRef}
      onPress={onPress}
      hasTVPreferredFocus={preferFocus}
      accessibilityRole="button"
      accessibilityLabel={channel.title}
      style={({ focused }) => ({
        flex: 1,
        padding: 16 * unit,
        borderRadius: 12 * unit,
        borderWidth: 1,
        borderColor: isCurrent ? 'rgba(217,165,20,0.5)' : focused ? colors.gold : colors.border10,
        backgroundColor: isCurrent ? 'rgba(217,165,20,0.15)' : focused ? colors.fill10 : colors.fill5,
        overflow: 'hidden',
      })}
    >
      {isCurrent ? (
        <Pulse durationMs={2000} to={1.05} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
          <View style={{ flex: 1, borderRadius: 12 * unit, backgroundColor: 'rgba(217,165,20,0.12)' }} />
        </Pulse>
      ) : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 * unit }}>
        <Text
          numberOfLines={1}
          style={{ flex: 1, color: isCurrent ? colors.gold : colors.white, fontFamily: fonts.semibold, fontSize: 15 * unit }}
        >
          {channel.title}
        </Text>
        {isCurrent ? (
          <View style={{ paddingHorizontal: 8 * unit, paddingVertical: 4 * unit, borderRadius: 999, backgroundColor: 'rgba(217,165,20,0.2)' }}>
            <Text style={{ color: colors.gold, fontFamily: fonts.medium, fontSize: 12 * unit }}>Current</Text>
          </View>
        ) : null}
      </View>
    </Focusable>
  );
}
