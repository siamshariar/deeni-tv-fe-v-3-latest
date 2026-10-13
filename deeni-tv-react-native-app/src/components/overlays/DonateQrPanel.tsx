import { Heart } from 'lucide-react-native';
import { Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { useFrameLayout } from '@/hooks/useFrameLayout';
import { getDonationUrl } from '@/lib/donation';
import { colors, fonts } from '@/lib/theme';
import { useChannelStore } from '@/store/useChannelStore';
import { useUiStore } from '@/store/useUiStore';

import { ModalCard, ModalHeader } from './ModalCard';

/**
 * TV Donate (plan D-24): a TV can't open a browser, so the same
 * language-based donation page is shown as a QR code to scan with a phone.
 */
export function DonateQrPanel() {
  const channelId = useChannelStore((s) => s.selectedId);
  const { unit } = useFrameLayout();
  const url = getDonationUrl(channelId);
  const close = () => useUiStore.getState().close('donate-qr');
  return (
    <ModalCard onBackdropPress={close}>
      <ModalHeader icon={<Heart size={20 * unit} color={colors.gold} fill={colors.gold} />} title="Donate" onClose={close} preferCloseFocus />
      <View style={{ alignItems: 'center', padding: 24 * unit, gap: 16 * unit }}>
        <View style={{ padding: 12 * unit, backgroundColor: colors.white, borderRadius: 12 * unit }}>
          <QRCode value={url} size={180 * unit} />
        </View>
        <Text style={{ color: colors.white, fontFamily: fonts.medium, fontSize: 16 * unit, textAlign: 'center' }}>
          Scan with your phone to donate
        </Text>
        <Text style={{ color: colors.text40, fontFamily: fonts.regular, fontSize: 12 * unit, textAlign: 'center' }}>{url}</Text>
      </View>
    </ModalCard>
  );
}
