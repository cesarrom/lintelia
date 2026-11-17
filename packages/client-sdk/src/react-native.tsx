import { useCallback, useRef } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { embedUrl, isAppMessage, type AppEvent, type HostMessage } from './protocol';

/**
 * React Native: the client app in a WebView. Same protocol as the web embed; the WebView bridge carries the messages
 * (`window.ReactNativeWebView.postMessage` out, injected `postMessage` in).
 */
export interface FintivioAppViewProps {
  appUrl: string;
  fetchClientSecret?: () => Promise<string>;
  fetchSubjectToken?: () => Promise<string>;
  page?: string;
  params?: Record<string, string>;
  chrome?: 'full' | 'none';
  style?: StyleProp<ViewStyle>;
  onReady?: (page: string) => void;
  onEvent?: (event: AppEvent) => void;
  onNavigate?: (page: string, params: Record<string, string>) => void;
  onError?: (error: Error) => void;
}

export function FintivioAppView({ appUrl, fetchClientSecret, fetchSubjectToken, page, params, chrome = 'full', style, onReady, onEvent, onNavigate, onError }: FintivioAppViewProps) {
  const view = useRef<WebView>(null);
  const send = useCallback((message: HostMessage) => {
    // Delivered as a window message inside the page, which only trusts messages from its own window in a WebView.
    view.current?.injectJavaScript(`window.postMessage(${JSON.stringify(message)}, window.location.origin); true;`);
  }, []);

  const onMessage = useCallback(async (event: WebViewMessageEvent) => {
    let data: unknown;
    try {
      data = JSON.parse(event.nativeEvent.data);
    } catch {
      return;
    }
    if (!isAppMessage(data)) return;
    switch (data.type) {
      case 'needs-session':
        try {
          if (fetchClientSecret) send({ source: 'fintivio-sdk', type: 'session', clientSecret: await fetchClientSecret() });
          else if (fetchSubjectToken) send({ source: 'fintivio-sdk', type: 'session', subjectToken: await fetchSubjectToken() });
        } catch (error) {
          onError?.(error as Error);
        }
        return;
      case 'ready': return onReady?.(data.page);
      case 'navigate': return onNavigate?.(data.page, data.params);
      case 'event': return onEvent?.(data.event);
      case 'error': return onError?.(new Error(data.message));
    }
  }, [fetchClientSecret, fetchSubjectToken, send, onReady, onNavigate, onEvent, onError]);

  return (
    <WebView
      ref={view}
      source={{ uri: embedUrl({ appUrl, page, params, chrome, hostOrigin: 'react-native' }) }}
      onMessage={onMessage}
      style={style}
      originWhitelist={[new URL(appUrl).origin]}
      sharedCookiesEnabled={false}
      javaScriptEnabled
      domStorageEnabled
    />
  );
}
