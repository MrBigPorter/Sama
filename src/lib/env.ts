/**
 * Sama environment configuration.
 *
 * Environment detection priority:
 *   1. process.env.APP_VARIANT (injected by EAS Build — 'development' | 'preview' | 'production')
 *   2. __DEV__ global (Metro dev server — maps to 'development')
 *   3. Fallback to 'production'
 *
 * Usage:
 *   import { env } from '@/lib/env';
 *   const baseUrl = env.API_URL;
 */

interface EnvConfig {
  /** Build variant: development / preview (staging) / production */
  APP_VARIANT: 'development' | 'preview' | 'production';
  /** GraphQL endpoint (no trailing /graphql) */
  API_URL: string;
  /** WebSocket URL for Socket.IO */
  WS_URL: string;
  SENTRY_DSN: string;
  DEFAULT_LOCALE: string;
  ENABLE_ANALYTICS: boolean;
  LOG_LEVEL: 'debug' | 'info' | 'warn' | 'error';
}

// ─── Environment detection ────────────────────────────────────────────

function detectAppVariant(): EnvConfig['APP_VARIANT'] {
  // 1. EAS Build injects APP_VARIANT via eas.json env
  if (typeof process !== 'undefined' && process.env?.APP_VARIANT) {
    const variant = process.env.APP_VARIANT as EnvConfig['APP_VARIANT'];
    if (['development', 'preview', 'production'].includes(variant)) {
      return variant;
    }
  }

  // 2. __DEV__ global (Metro dev server)
  try {
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      return 'development';
    }
  } catch {
    // __DEV__ may not be defined in some environments
  }

  // 3. Fallback
  return 'production';
}

const APP_VARIANT = detectAppVariant();

// ─── Per-variant defaults ─────────────────────────────────────────────
// These are overridden by process.env.* injected via eas.json.
// EAS Build profiles define the actual values for each variant.

const defaults: Record<EnvConfig['APP_VARIANT'], EnvConfig> = {
  development: {
    APP_VARIANT: 'development',
    API_URL: 'http://localhost:4000',
    WS_URL: 'http://localhost:4000',
    SENTRY_DSN: '',
    DEFAULT_LOCALE: 'en',
    ENABLE_ANALYTICS: false,
    LOG_LEVEL: 'debug',
  },
  preview: {
    APP_VARIANT: 'preview',
    API_URL: 'https://api-staging.sama.app',
    WS_URL: 'wss://api-staging.sama.app',
    SENTRY_DSN: '',
    DEFAULT_LOCALE: 'en',
    ENABLE_ANALYTICS: true,
    LOG_LEVEL: 'info',
  },
  production: {
    APP_VARIANT: 'production',
    API_URL: 'https://api.sama.app',
    WS_URL: 'wss://api.sama.app',
    SENTRY_DSN:
      'https://6042c78ea2c7e97d792b37ae9c50d1ed@o4511086990524416.ingest.us.sentry.io/4511557286952960',
    DEFAULT_LOCALE: 'en',
    ENABLE_ANALYTICS: true,
    LOG_LEVEL: 'warn',
  },
};

function readStr(key: string, fallback: string): string {
  try {
    return (process.env?.[key] as string) ?? fallback;
  } catch {
    return fallback;
  }
}

function readBool(key: string, fallback: boolean): boolean {
  try {
    const val = process.env?.[key];
    if (val === undefined || val === null) return fallback;
    return val === 'true' || val === '1';
  } catch {
    return fallback;
  }
}

const def = defaults[APP_VARIANT];

// ─── Exported config ──────────────────────────────────────────────────

export const env = {
  /** Build variant */
  APP_VARIANT,

  /** API base URL (no trailing slash) */
  API_URL: readStr('API_URL', def.API_URL),

  /** WebSocket URL */
  WS_URL: readStr('WS_URL', def.WS_URL),

  /** Sentry DSN (optional) */
  SENTRY_DSN: readStr('SENTRY_DSN', def.SENTRY_DSN),

  /** Default locale */
  DEFAULT_LOCALE: readStr('DEFAULT_LOCALE', def.DEFAULT_LOCALE),

  /** Whether to enable analytics */
  ENABLE_ANALYTICS: readBool('ENABLE_ANALYTICS', def.ENABLE_ANALYTICS),

  /** Log level */
  LOG_LEVEL: (readStr('LOG_LEVEL', def.LOG_LEVEL) as EnvConfig['LOG_LEVEL']),

  /** Whether to enable Sentry crash reporting */
  get SENTRY_ENABLED(): boolean {
    return APP_VARIANT !== 'development' && !!env.SENTRY_DSN;
  },
} as const;

/** Check if running in development mode */
export const isDev = APP_VARIANT === 'development';

/** Check if running in preview (staging) mode */
export const isPreview = APP_VARIANT === 'preview';

/** Check if running in production build */
export const isProd = APP_VARIANT === 'production';

/** Get the API base URL (no trailing slash) */
export function getApiBaseUrl(): string {
  return env.API_URL;
}

/** Get the WebSocket URL */
export function getWsUrl(): string {
  return env.WS_URL;
}
