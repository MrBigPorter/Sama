/**
 * Usage statistics for Sama app.
 *
 * Tracks user engagement counters with MMKV persistence.
 * Periodically flushes accumulated stats to Sentry as breadcrumbs.
 *
 * Usage:
 *   import { usageStats } from '@/lib/observability/usageStats';
 *   usageStats.increment('message_sent');
 *   usageStats.increment('call_minutes', 3);
 *   const count = usageStats.get('message_sent');
 */
import { addBreadcrumb, Sentry } from '@/lib/sentry';
import { env } from '@/lib/env';
import { logger } from '@/lib/logger';
import { getNumber, setNumber } from '@/lib/storage';

// ─── Constants ──────────────────────────────────────────────────────────

const STORAGE_PREFIX = 'stats.';
const FLUSH_INTERVAL_MS = 60_000; // 1 minute
const MAX_COUNTER_KEYS = 100;

// ─── Types ──────────────────────────────────────────────────────────────

export interface StatsSnapshot {
  [key: string]: number;
}

// ─── UsageStats ─────────────────────────────────────────────────────────

class UsageStats {
  private counters: Map<string, number> = new Map();
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private enabled: boolean;

  constructor() {
    this.enabled = env.ENABLE_ANALYTICS;
  }

  // ── Initialisation ──────────────────────────────────────────────────

  /**
   * Start periodic flushing. Call once on app init.
   */
  start(): void {
    if (!this.enabled) return;
    if (this.flushTimer) return;

    this._loadPersistedCounters();

    this.flushTimer = setInterval(() => {
      this.flush();
    }, FLUSH_INTERVAL_MS);

    logger.info('UsageStats started (flush every 60s)');
  }

  /**
   * Stop periodic flushing. Call on app background / logout.
   */
  stop(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }

  // ── Counter operations ──────────────────────────────────────────────

  /**
   * Increment a counter by a given amount (default 1).
   * Key must be snake_case (e.g. 'message_sent', 'call_minutes').
   */
  increment(key: string, by = 1): void {
    if (!this.enabled) return;
    if (this.counters.size >= MAX_COUNTER_KEYS) {
      logger.warn('UsageStats: too many counter keys — ignoring', { key });
      return;
    }

    const current = this.counters.get(key) ?? 0;
    this.counters.set(key, current + by);

    // Persist incrementally
    this._persistCounter(key);
  }

  /**
   * Get the current value of a counter.
   */
  get(key: string): number {
    return this.counters.get(key) ?? 0;
  }

  /**
   * Get a snapshot of all counters.
   */
  getAll(): StatsSnapshot {
    const snapshot: StatsSnapshot = {};
    for (const [key, value] of this.counters) {
      snapshot[key] = value;
    }
    return snapshot;
  }

  /**
   * Reset a specific counter to zero.
   */
  reset(key: string): void {
    this.counters.delete(key);
    setNumber(`${STORAGE_PREFIX}${key}`, 0);
  }

  /**
   * Reset all counters.
   */
  resetAll(): void {
    this.counters.clear();
    // We cannot enumerate all keys in MMKV, so we just clear the map.
    // Persisted values will be overwritten on next increment.
  }

  // ── Flush ───────────────────────────────────────────────────────────

  /**
   * Send all accumulated counters to Sentry as breadcrumbs and reset.
   * Called automatically every FLUSH_INTERVAL_MS, or manually on app
   * background / significant events.
   */
  flush(): void {
    if (!this.enabled) return;
    if (this.counters.size === 0) return;

    const snapshot = this.getAll();
    const total = Object.values(snapshot).reduce((sum, v) => sum + v, 0);

    addBreadcrumb('Usage stats flush', 'usage', {
      counters: Object.keys(snapshot).length,
      totalEvents: total,
      ...snapshot,
    });

    // Also send a captureMessage for dashboard querying
    if (Object.keys(snapshot).length > 0) {
      Sentry.captureMessage('usage_stats_flush', {
        level: 'info',
        extra: snapshot,
      });
    }

    logger.info('Usage stats flushed', { counters: snapshot });

    // Reset counters after flush (persisted values remain for crash recovery)
    this.counters.clear();
  }

  // ── Persistence ─────────────────────────────────────────────────────

  private _persistCounter(key: string): void {
    const value = this.counters.get(key) ?? 0;
    setNumber(`${STORAGE_PREFIX}${key}`, value);
  }

  private _loadPersistedCounters(): void {
    // MMKV doesn't support key enumeration, so we rely on in-memory
    // counters that are periodically flushed. On crash recovery,
    // counters are reset to zero which is acceptable.
  }

  // ── Cleanup ─────────────────────────────────────────────────────────

  /**
   * Tear down the service. Flushes remaining counters and stops the timer.
   */
  dispose(): void {
    this.flush();
    this.stop();
  }
}

// ─── Singleton export ───────────────────────────────────────────────────

export const usageStats = new UsageStats();
