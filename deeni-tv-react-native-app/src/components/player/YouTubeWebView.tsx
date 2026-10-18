import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, TVFocusGuideView, View, type StyleProp, type ViewStyle } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import type { ShouldStartLoadRequest } from 'react-native-webview/lib/WebViewTypes';

import { config } from '@/lib/config';
import { buildPlayerHtml, type PlayerPageMessage, type PlayerRole } from '@/lib/youtube/playerPage';
import type { EngineRef } from '@/player/engine';

interface Props {
  engine: EngineRef;
  role: PlayerRole;
  onMessage: (msg: PlayerPageMessage) => void;
  style?: StyleProp<ViewStyle>;
}

const IS_TV = Platform.isTV;

/**
 * Display-only WebView running the player page (Safe Kids ShortsPlayer
 * pattern): no touches reach YouTube, no navigation out of the page, and on
 * TV the WebView can never take D-pad focus. The page is built once and
 * reused for every video; it is only rebuilt when its process dies or the
 * controller asks for it.
 */
export function YouTubeWebView({ engine, role, onMessage, style }: Props) {
  const webViewRef = useRef<WebView>(null);
  const [pageKey, setPageKey] = useState(0);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  const source = useMemo(
    () => ({
      html: buildPlayerHtml({
        origin: config.playerOrigin,
        host: config.youtubeHost,
        role,
        // TV: YouTube end screens (suggested-video cards) start up to 20 s before the
        // end; the live player covers that stretch. Phones keep 3 s.
        nearEndSec: role === 'live' ? (Platform.isTV ? 20 : 3) : 0,
        endSec: role === 'live' ? 0.5 : 0.3,
      }),
      baseUrl: `${config.playerOrigin}/`,
    }),
    [role],
  );

  const rebuild = useCallback(() => {
    engine.onPageReset();
    setPageKey((k) => k + 1);
  }, [engine]);

  useEffect(() => {
    const host = {
      run: (js: string) => webViewRef.current?.injectJavaScript(js),
      rebuild,
    };
    engine.attach(host);
    return () => engine.detach(host);
  }, [engine, rebuild]);

  const handleMessage = useCallback((e: WebViewMessageEvent) => {
    let msg: PlayerPageMessage;
    try {
      msg = JSON.parse(e.nativeEvent.data);
    } catch {
      return;
    }
    onMessageRef.current(msg);
  }, []);

  // Only the inline page itself may load in the top frame. YouTube's iframe is
  // a sub-frame (iOS reports it here; Android never does). Anything else, e.g.
  // a YouTube link, is dropped: no way out of the app through YouTube's UI.
  const handleShouldStart = useCallback((req: ShouldStartLoadRequest) => {
    if (Platform.OS === 'ios' && req.isTopFrame === false) return true;
    return req.url === 'about:blank' || req.url.startsWith(config.playerOrigin);
  }, []);

  const handleProcessGone = useCallback(() => {
    console.warn(`[${role} player] web process gone — rebuilding the page`);
    rebuild();
  }, [rebuild, role]);

  const webView = (
    <WebView
      key={pageKey}
      ref={webViewRef}
      source={source}
      originWhitelist={['*']}
      onMessage={handleMessage}
      onLoadEnd={() => engine.onPageLoaded()}
      onShouldStartLoadWithRequest={handleShouldStart}
      onContentProcessDidTerminate={handleProcessGone}
      onRenderProcessGone={handleProcessGone}
      javaScriptEnabled
      domStorageEnabled
      allowsInlineMediaPlayback
      mediaPlaybackRequiresUserAction={false}
      allowsFullscreenVideo={false}
      allowsLinkPreview={false}
      setSupportMultipleWindows={false}
      scrollEnabled={false}
      bounces={false}
      overScrollMode="never"
      webviewDebuggingEnabled={__DEV__}
      style={styles.webView}
      containerStyle={styles.webView}
      {...(IS_TV ? { focusable: false, importantForAccessibility: 'no-hide-descendants' as const } : null)}
    />
  );

  return (
    <View style={[styles.container, style]} pointerEvents="none" collapsable={false}>
      {/* TV: the WebView's own `focusable` prop is ignored by its native view;
          a non-focusable TVFocusGuideView blocks focus for the whole subtree. */}
      {IS_TV ? (
        <TVFocusGuideView focusable={false} style={styles.fill}>
          {webView}
        </TVFocusGuideView>
      ) : (
        webView
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: '#000', overflow: 'hidden' },
  fill: { flex: 1 },
  webView: { flex: 1, backgroundColor: '#000' },
});
