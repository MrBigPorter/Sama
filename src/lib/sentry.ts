/**
 * Sentry crash reporting for Sama.
 *
 * Initializes @sentry/react-native with Performance Tracing.
 * Only activates when a valid DSN is configured (production).
 *
 * Usage:
 *   import { initSentry, captureException } from '@/lib/sentry';
 *   initSentry();
 *   captureException(error, { context: 'chat_send' });
 */
import * as Sentry from '@sentry/react-native';
import { env } from '@/lib/env';
import { logger } from '@/lib/logger';

let initialized = false;

/**
 * Initialize Sentry SDK. Safe to call multiple times — only runs once.
 */
export function initSentry(): void {
  if (initialized) {
    return;
  }

  if (__DEV__) {
    logger.info('Sentry disabled in dev mode');
    return;
  }

  if (!env.SENTRY_DSN) {
    logger.info('Sentry DSN not configured — skipping');
    return;
  }

  // React Navigation instrumentation for automatic route tracing
  const routingInstrumentation = Sentry.reactNavigationIntegration({
    routeChangeTimeoutMs: 500,
  });

  Sentry.init({
    dsn: env.SENTRY_DSN,
    enabled: env.SENTRY_ENABLED,
    environment: env.APP_VARIANT,
    release: `sama-app@${env.APP_VARIANT}`,

    // ── Performance Tracing ──────────────────────────────────────────
    tracesSampleRate: env.SENTRY_ENABLED ? (__DEV__ ? 1.0 : 0.2) : 0,
    profilesSampleRate: env.SENTRY_ENABLED ? (__DEV__ ? 1.0 : 0.2) : 0,

    // ── Session Replay ───────────────────────────────────────────────
    replaysSessionSampleRate: env.SENTRY_ENABLED && !__DEV__ ? 0.1 : 0,
    replaysOnErrorSampleRate: env.SENTRY_ENABLED ? 1.0 : 0,

    // ── Integrations ─────────────────────────────────────────────────
    integrations: [routingInstrumentation],

    // ── Breadcrumb filter ────────────────────────────────────────
    beforeBreadcrumb(breadcrumb) {
      if (breadcrumb.category === 'touch' && breadcrumb.message == null) {
        return null;
      }
      return breadcrumb;
    },

    debug: __DEV__ && !!env.SENTRY_DSN,
  });

  initialized = true;
  logger.info('Sentry initialized', {
    environment: env.APP_VARIANT,
  });
}

/**
 * Report an exception to Sentry with optional context.
 */
export function captureException(
  error: Error,
  context?: Record<string, unknown>,
): void {
  Sentry.captureException(error, {
    extra: context,
  });
}

/**
 * Record a breadcrumb for Sentry event trail.
 */
export function addBreadcrumb(
  message: string,
  category?: string,
  data?: Record<string, unknown>,
): void {
  Sentry.addBreadcrumb({
    message,
    category: category ?? 'app',
    data,
    level: 'info',
  });
}

export { Sentry };
