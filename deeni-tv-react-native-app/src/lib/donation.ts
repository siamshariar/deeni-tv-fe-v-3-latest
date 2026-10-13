// Ported from the Deeni web app: lib/donation.ts (fixes_to_launch a080ec2).
// Where Donate goes depends only on the selected channel's language, never on
// the viewer's location: Bangla → the Bangladesh page (bKash etc.), every
// other language (or no channel yet) → the international USD/card form.
import { Linking } from 'react-native';

import { getChannelLocalizationId } from '@/lib/schedule/channels';

export const BANGLADESH_DONATION_URL = 'https://www.deeniinfotech.com/donate/bd#payment-information';
export const INTERNATIONAL_DONATION_URL = 'https://www.deeniinfotech.com/donate#donation-form';

const BANGLA_LOCALIZATION_ID = '5';

export function getDonationUrl(channelId?: string | null): string {
  return getChannelLocalizationId(channelId) === BANGLA_LOCALIZATION_ID
    ? BANGLADESH_DONATION_URL
    : INTERNATIONAL_DONATION_URL;
}

/** Phones and tablets: opens the donation page in the system browser. */
export function openDonationPage(channelId?: string | null): void {
  Linking.openURL(getDonationUrl(channelId)).catch((error) => console.warn('Could not open donation page', error));
}
