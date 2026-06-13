/**
 * A/B test service for Sama app.
 *
 * Assigns users to experiment variants using deterministic bucket assignment
 * (hash of user_id). Stores assignments in MMKV for persistence across sessions.
 * Experiment exposures and conversions are tracked via Sentry.
 *
 * Usage:
 *   import { abTestService } from '@/lib/abtest/abTestService';
 *   abTestService.init('user_abc123');
 *   const variant = abTestService.getVariant('new_chat_ui');
 *   if (variant === 'treatment') { ... }
 */
import { addBreadcrumb } from '@/lib/sentry';
import { env } from '@/lib/env';
import { logger } from '@/lib/logger';
import { getString, setString, getNumber, setNumber } from '@/lib/storage';

// ─── Constants ──────────────────────────────────────────────────────────

const STORAGE_PREFIX = 'ab.';
const ASSIGNMENT_KEY = `${STORAGE_PREFIX}assignments`;
const USER_ID_KEY = `${STORAGE_PREFIX}userId`;

// ─── Types ──────────────────────────────────────────────────────────────

export interface ExperimentConfig {
  /** Unique experiment name (snake_case). */
  name: string;
  /** Variant names. Must have at least 1. */
  variants: string[];
  /** Weights for each variant (must sum to 100). */
  weights: number[];
  /** Whether the experiment is currently active. */
  enabled: boolean;
}

export type Variant = string;

// ─── Default experiments ────────────────────────────────────────────────
// Add new experiments here. Weights must sum to 100.

const DEFAULT_EXPERIMENTS: ExperimentConfig[] = [
  {
    name: 'new_chat_ui',
    variants: ['control', 'treatment'],
    weights: [50, 50],
    enabled: false,
  },
  {
    name: 'smart_reply_position',
    variants: ['top', 'bottom'],
    weights: [50, 50],
    enabled: false,
  },
  {
    name: 'onboarding_flow',
    variants: ['control', 'simplified', 'guided'],
    weights: [34, 33, 33],
    enabled: false,
  },
];

// ─── Bucket hash ────────────────────────────────────────────────────────

/**
 * Deterministic hash from a string (djb2 algorithm).
 * Returns a number in [0, 1).
 */
function hashToUnit(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) & 0xffffffff;
  }
  // Convert to unsigned then normalise to [0, 1)
  return Math.abs(hash % 1000000) / 1000000;
}

/**
 * Assign a variant for a given (userId, experimentName) pair.
 */
function assignVariant(userId: string, config: ExperimentConfig): string {
  const bucket = hashToUnit(`${userId}:${config.name}`);
  const cumulative = config.weights.reduce(
    (acc, w) => [...acc, (acc[acc.length - 1] ?? 0) + w],
    [] as number[],
  );
  for (let i = 0; i < cumulative.length; i++) {
    if (bucket < (cumulative[i] ?? 0) / 100) {
      return config.variants[i] ?? config.variants[0]!;
    }
  }
  return config.variants[config.variants.length - 1]!;
}

// ─── Persistence ────────────────────────────────────────────────────────

interface AssignmentMap {
  [experimentName: string]: Variant;
}

function loadAssignments(): AssignmentMap {
  try {
    const raw = getString(ASSIGNMENT_KEY);
    if (raw) {
      return JSON.parse(raw) as AssignmentMap;
    }
  } catch {
    // corrupted storage — reset
  }
  return {};
}

function saveAssignments(map: AssignmentMap): void {
  setString(ASSIGNMENT_KEY, JSON.stringify(map));
}

// ─── ABTestService ──────────────────────────────────────────────────────

class ABTestService {
  private userId: string | null = null;
  private experiments: ExperimentConfig[] = DEFAULT_EXPERIMENTS;
  private assignments: AssignmentMap = {};
  private initialized = false;

  // ── Initialisation ──────────────────────────────────────────────────

  /**
   * Initialise the A/B test service with the current user.
   * Call once after login / on app start when userId is available.
   */
  init(userId: string): void {
    if (this.initialized && this.userId === userId) return;

    this.userId = userId;
    this.assignments = loadAssignments();
    this.initialized = true;

    // Pre-compute assignments for enabled experiments
    for (const exp of this.experiments) {
      if (!exp.enabled) continue;
      if (!this.assignments[exp.name]) {
        this.assignments[exp.name] = assignVariant(userId, exp);
      }
    }

    saveAssignments(this.assignments);
    setString(USER_ID_KEY, userId);

    logger.info('ABTestService initialised', {
      userId,
      activeExperiments: this.experiments.filter((e) => e.enabled).length,
    });
  }

  /**
   * Get the assigned variant for an experiment.
   * Returns 'control' if experiment is disabled or user not initialised.
   */
  getVariant(experimentName: string): Variant {
    const config = this.experiments.find((e) => e.name === experimentName);

    if (!config || !config.enabled || !this.userId) {
      return 'control';
    }

    // Return cached assignment if exists
    if (this.assignments[experimentName]) {
      return this.assignments[experimentName]!;
    }

    // Compute and cache
    const variant = assignVariant(this.userId, experimentName);
    this.assignments[experimentName] = variant;
    saveAssignments(this.assignments);

    return variant;
  }

  /**
   * Check if user is in a specific variant for an experiment.
   */
  isVariant(experimentName: string, variantName: string): boolean {
    return this.getVariant(experimentName) === variantName;
  }

  // ── Tracking ─────────────────────────────────────────────────────────

  /**
   * Track that the user was exposed to an experiment variant.
   * Call when the user actually sees the treatment.
   */
  trackExposure(experimentName: string): void {
    const variant = this.getVariant(experimentName);
    if (!this.userId) return;

    addBreadcrumb('AB: exposure', 'abtest', {
      experiment: experimentName,
      variant,
    });

    logger.info('AB exposure', { experiment: experimentName, variant });
  }

  /**
   * Track a conversion event for an experiment (e.g. user completed
   * the desired action).
   */
  trackConversion(experimentName: string, eventName: string): void {
    const variant = this.getVariant(experimentName);
    if (!this.userId) return;

    addBreadcrumb('AB: conversion', 'abtest', {
      experiment: experimentName,
      variant,
      event: eventName,
    });

    logger.info('AB conversion', {
      experiment: experimentName,
      variant,
      event: eventName,
    });
  }

  // ── Experiment management ────────────────────────────────────────────

  /**
   * Override experiments at runtime (e.g. from remote config).
   */
  setExperiments(experiments: ExperimentConfig[]): void {
    this.experiments = experiments;
  }

  /**
   * Get current experiment configurations.
   */
  getExperiments(): ExperimentConfig[] {
    return this.experiments;
  }

  /**
   * Get all current assignments.
   */
  getAssignments(): Record<string, Variant> {
    return { ...this.assignments };
  }

  /**
   * Force-reset a user's assignment for a specific experiment (for testing).
   */
  resetAssignment(experimentName: string): void {
    delete this.assignments[experimentName];
    saveAssignments(this.assignments);

    if (this.userId) {
      const config = this.experiments.find((e) => e.name === experimentName);
      if (config?.enabled) {
        this.assignments[experimentName] = assignVariant(this.userId, config);
        saveAssignments(this.assignments);
      }
    }
  }

  /**
   * Clear all stored assignments (e.g. on logout).
   */
  clear(): void {
    this.userId = null;
    this.assignments = {};
    this.initialized = false;
    // Note: we don't clear storage here — assignments persist across
    // sessions for the same user. Call .init(newUserId) on next login.
  }
}

// ─── Singleton export ───────────────────────────────────────────────────

export const abTestService = new ABTestService();
