/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_WS_URL: string;
  readonly VITE_APP_NAME: string;
  readonly VITE_APP_VERSION: string;
  readonly VITE_APP_DESCRIPTION: string;
  readonly VITE_ENABLE_ANALYTICS: string;
  readonly VITE_ENABLE_DEBUG: string;
  readonly VITE_ENABLE_OFFLINE: string;
  readonly VITE_DEFAULT_THEME: string;
  readonly VITE_ENABLE_DARK_MODE: string;
  readonly VITE_SENTRY_DSN: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}