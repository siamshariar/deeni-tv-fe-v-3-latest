import { getChannelLocalizationId } from '@/lib/schedule-utils'

// Where Donate goes depends only on the selected channel's language, never on
// the visitor's location: Bangla → the Bangladesh page (bKash etc.), every
// other language → the DIT Web international USD/card form. Used by both the
// header Donate button and the 3-dot menu's Donate item.
export const BANGLADESH_DONATION_URL = 'https://www.deeniinfotech.com/donate/bd#payment-information'
export const INTERNATIONAL_DONATION_URL = 'https://www.deeniinfotech.com/donate#donation-form'

const BANGLA_LOCALIZATION_ID = '5'

export function getDonationUrl(channelId?: string | null): string {
  return getChannelLocalizationId(channelId) === BANGLA_LOCALIZATION_ID
    ? BANGLADESH_DONATION_URL
    : INTERNATIONAL_DONATION_URL
}

// Must run synchronously inside the click handler, or popup blockers
// (iOS Safari especially) stop the new tab.
export function openDonationPage(channelId?: string | null): void {
  window.open(getDonationUrl(channelId), '_blank', 'noopener,noreferrer')
}
