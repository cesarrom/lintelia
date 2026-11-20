/**
 * Minimal types of the React Native peers, so the package type-checks without them installed (apps that use
 * `@lintelia/client-sdk/react-native` have the real ones).
 */
declare module 'react-native' {
  export type StyleProp<T> = T | T[] | null | undefined | false;
  export interface ViewStyle { [key: string]: unknown }
}

declare module 'react-native-webview' {
  import type { Component } from 'react';
  import type { StyleProp, ViewStyle } from 'react-native';
  export interface WebViewMessageEvent { nativeEvent: { data: string } }
  export interface WebViewProps {
    source: { uri: string };
    onMessage?: (event: WebViewMessageEvent) => void;
    style?: StyleProp<ViewStyle>;
    originWhitelist?: string[];
    sharedCookiesEnabled?: boolean;
    javaScriptEnabled?: boolean;
    domStorageEnabled?: boolean;
  }
  export class WebView extends Component<WebViewProps> {
    injectJavaScript(script: string): void;
  }
}
