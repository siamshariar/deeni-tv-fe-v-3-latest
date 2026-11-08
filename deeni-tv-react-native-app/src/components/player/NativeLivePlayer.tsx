import { useEffect, useRef } from 'react';
import { Platform, StyleSheet, TVFocusGuideView, View, type StyleProp, type ViewStyle } from 'react-native';

import { DeeniLivePlayer, DeeniLivePlayerView } from '../../../modules/deeni-live-player';
import type { PlayerPageMessage } from '@/lib/youtube/playerPage';
import type { EngineRef } from '@/player/engine';

import { playerPageSource } from './YouTubeWebView';

/**
 * TV: the live player page in a WebView the app starts at launch (modules/deeni-live-player),
 * like Safe Kids' player that is up before a video is chosen. React Native's own WebView only
 * exists ~7 s into the start on the TV box; this one has YouTube loading by then. Same page and
 * engine as YouTubeWebView, which the phone keeps.
 */
export const nativeLivePlayerAvailable = Platform.OS === 'android' && Platform.isTV && !!DeeniLivePlayer && !!DeeniLivePlayerView;

interface Props {
  engine: EngineRef;
  onMessage: (msg: PlayerPageMessage) => void;
  style?: StyleProp<ViewStyle>;
}

export function NativeLivePlayer({ engine, onMessage, style }: Props) {
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  useEffect(() => {
    const native = DeeniLivePlayer;
    if (!native) return undefined;
    let alive = true;
    const deliver = (data: string) => {
      let msg: PlayerPageMessage;
      try {
        msg = JSON.parse(data);
      } catch {
        return;
      }
      if (msg.type === 'boot') engine.onPageLoaded();
      onMessageRef.current(msg);
    };
    const host = {
      run: (js: string) => native.inject(js),
      rebuild: () => {
        engine.onPageReset();
        native.reload();
      },
    };
    const messages = native.addListener('onMessage', (e) => {
      if (alive) deliver(e.data);
    });
    const gone = native.addListener('onProcessGone', () => {
      console.warn('[live player] web process gone — rebuilding the page');
      engine.onPageReset();
    });
    engine.attach(host);
    const { html, baseUrl } = playerPageSource('live');
    native
      .setPage(html, baseUrl, pageVersion(html))
      .catch(() => undefined)
      // What the page said before React Native listened (its boot, the player's ready, a start).
      .finally(() => {
        if (alive) native.takeMessages().forEach(deliver);
      });
    return () => {
      alive = false;
      messages.remove();
      gone.remove();
      engine.detach(host);
    };
  }, [engine]);

  const NativeView = DeeniLivePlayerView;
  if (!NativeView) return null;
  return (
    <View style={[styles.container, style]} pointerEvents="none" collapsable={false}>
      {/* Never focusable (as YouTubeWebView): a non-focusable TVFocusGuideView blocks the subtree. */}
      <TVFocusGuideView focusable={false} style={styles.fill}>
        <NativeView style={styles.fill} />
      </TVFocusGuideView>
    </View>
  );
}

/** FNV-1a of the page: a new app version's page replaces the cached one. */
function pageVersion(html: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < html.length; i++) {
    h ^= html.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `${h.toString(16)}-${html.length}`;
}

const styles = StyleSheet.create({
  container: { backgroundColor: '#000', overflow: 'hidden' },
  fill: { flex: 1 },
});
