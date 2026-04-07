/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GRAPHQL_HTTP?: string;
  readonly VITE_GRAPHQL_WS?: string;
  readonly VITE_GRAPHQL_AUTH_TOKEN?: string;
  readonly VITE_KLINE_EXCHANGE?: string;
  readonly VITE_KLINE_SYMBOL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
