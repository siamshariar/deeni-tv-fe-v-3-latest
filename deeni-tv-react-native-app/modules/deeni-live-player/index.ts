import { requireNativeView, requireOptionalNativeModule } from 'expo';
import type { ComponentType } from 'react';
import type { ViewProps } from 'react-native';

/**
 * The TV's live player WebView, started with the app (android/…/LivePlayerHost.kt).
 * null where the native module isn't built in (iOS, tests).
 */
export interface DeeniLivePlayerModule {
  /** Show this page: the running one is kept when its version matches ('kept'), else it loads ('loaded'). */
  setPage(html: string, baseUrl: string, version: string): Promise<'kept' | 'loaded'>;
  /** The schedule the next launch's page starts from (JSON; see playerPage.ts `LaunchSchedule`). */
  setInitial(json: string): void;
  /** Run JS in the page (a player command). */
  inject(js: string): void;
  /** Messages the page posted before React Native listened, oldest first. Later ones come as events. */
  takeMessages(): string[];
  /** Throw the page away and load it again. */
  reload(): void;
  addListener(event: 'onMessage', listener: (event: { data: string }) => void): { remove(): void };
  addListener(event: 'onProcessGone', listener: () => void): { remove(): void };
}

export const DeeniLivePlayer = requireOptionalNativeModule<DeeniLivePlayerModule>('DeeniLivePlayer');

/** The TV's thin loading ring: runs on the render thread (res/drawable/deeni_spinner.xml). */
export const DeeniSpinnerView: ComponentType<ViewProps> | null = requireOptionalNativeModule('DeeniSpinner')
  ? requireNativeView<ViewProps>('DeeniSpinner')
  : null;

/** Shows the WebView; it has no props of its own. */
export const DeeniLivePlayerView: ComponentType<ViewProps> | null = DeeniLivePlayer
  ? requireNativeView<ViewProps>('DeeniLivePlayer')
  : null;
