import { X } from 'lucide-react-native';
import { ScrollView, Text, View } from 'react-native';

import { Focusable } from '@/components/common/Focusable';
import { Logo } from '@/components/common/Logo';
import { useFrameLayout } from '@/hooks/useFrameLayout';
import { colors, fonts } from '@/lib/theme';
import { useUiStore } from '@/store/useUiStore';

import { ModalCard } from './ModalCard';

/** About (web W-12): copy verbatim from components/about-modal.tsx. */
export function AboutModal() {
  const { unit, size } = useFrameLayout();
  const compact = size === 'mobile';
  const close = () => useUiStore.getState().close('about');
  const body = { color: 'rgba(255,255,255,0.9)', fontFamily: fonts.regular, fontSize: (compact ? 14 : 16) * unit, lineHeight: (compact ? 21 : 25) * unit };
  const heading = { color: colors.white, fontFamily: fonts.semibold, fontSize: (compact ? 18 : 20) * unit, marginBottom: 12 * unit };

  return (
    <ModalCard onBackdropPress={close} maxHeightRatio={0.88} wide>
      <ScrollView contentContainerStyle={{ padding: (compact ? 24 : 32) * unit }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 * unit }}>
          <Logo height={(compact ? 40 : 48) * unit} />
          <Focusable
            onPress={close}
            hasTVPreferredFocus
            accessibilityRole="button"
            accessibilityLabel="Close"
            style={{ width: (compact ? 48 : 40) * unit, height: (compact ? 48 : 40) * unit, borderRadius: 999, alignItems: 'center', justifyContent: 'center' }}
          >
            <X size={(compact ? 28 : 24) * unit} color={colors.white} />
          </Focusable>
        </View>
        <Text style={{ color: colors.gold, fontFamily: fonts.medium, fontSize: (compact ? 16 : 18) * unit, marginBottom: 8 * unit }}>
          Your Spiritual Journey
        </Text>
        <Text style={[body, { fontSize: (compact ? 16 : 18) * unit, lineHeight: (compact ? 24 : 27) * unit, marginBottom: 16 * unit }]}>
          Experience premium Islamic content in a revolutionary lean-back TV interface designed for modern audiences.
        </Text>
        <Text style={[body, { marginBottom: 16 * unit }]}>
          Deeni.tv brings you high-quality spiritual programming including Quran recitations, Islamic lectures, historical documentaries, and daily reflections—all in a viewing experience.
        </Text>
        <View style={{ paddingTop: 16 * unit, borderTopWidth: 1, borderTopColor: colors.border10, marginBottom: 16 * unit }}>
          <Text style={heading}>Our Mission</Text>
          <Text style={body}>To make authentic Islamic knowledge accessible to everyone, anywhere, in a format that fits seamlessly into modern life.</Text>
        </View>
        <View style={{ paddingTop: 16 * unit }}>
          <Text style={heading}>Features</Text>
          {['24/7 live streaming spiritual content', 'Multi-language support', 'Scheduled programming', 'Premium production quality'].map((f) => (
            <Text key={f} style={[body, { color: 'rgba(255,255,255,0.8)', marginBottom: 8 * unit }]}>
              • {f}
            </Text>
          ))}
        </View>
      </ScrollView>
    </ModalCard>
  );
}
