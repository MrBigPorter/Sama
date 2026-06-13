/**
 * Minimal logger for Sama app.
 *
 * Provides a simple structured logger interface with log levels.
 * Uses console under the hood — no external dependencies.
 *
 * Usage:
 *   import { logger } from '@/lib/logger';
 *   logger.info('Chat connected', { conversationId: 'abc' });
 *   logger.warn('Slow API', { endpoint, duration: 1200 });
 *   logger.error('Failed to load messages', error);
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const CURRENT_LEVEL: LogLevel = __DEV__ ? 'debug' : 'warn';

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[CURRENT_LEVEL];
}

function prefix(level: LogLevel): string {
  return `[Sama:${level.toUpperCase()}]`;
}

export const logger = {
  debug(message: string, ...args: unknown[]): void {
    if (shouldLog('debug')) {
      console.debug(prefix('debug'), message, ...args);
    }
  },

  info(message: string, ...args: unknown[]): void {
    if (shouldLog('info')) {
      console.info(prefix('info'), message, ...args);
    }
  },

  warn(message: string, ...args: unknown[]): void {
    if (shouldLog('warn')) {
      console.warn(prefix('warn'), message, ...args);
    }
  },

  error(message: string, ...args: unknown[]): void {
    if (shouldLog('error')) {
      console.error(prefix('error'), message, ...args);
    }
  },
};
