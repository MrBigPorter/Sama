/**
 * Spacing system backed by generated Design Tokens from design_tokens.g.ts
 *
 * Provides backward-compatible exports while exposing the full
 * `front` token set for new development.
 */

import { front } from './design_tokens.g';

// ── Backward-compatible `spacing` export ─────────────────
// Maps previous semantic keys to generated token values

export const spacing = {
  xxs: front.spacingXxs,
  xs: front.spacingXs,
  sm: front.spacingSm,
  md: front.spacingMd,
  lg: front.spacingLg,
  xl: front.spacingXl,
  xxl: front.spacing2xl,
  '3xl': front.spacing3xl,
  '4xl': front.spacing4xl,
  '5xl': front.spacing5xl,
} as const;

// ── Backward-compatible `borderRadius` export ────────────

export const borderRadius = {
  none: front.radiusNone,
  sm: front.radiusXs,
  md: front.radiusMd,
  lg: front.radiusXl,
  xl: front.radius2xl,
  full: front.radiusFull,
} as const;

// ── Backward-compatible `shadows` export ─────────────────
// (still manually defined as shadow objects with RN ShadowProp types)

import { ViewStyle } from 'react-native';

type ShadowStyle = Pick<ViewStyle, 'shadowColor' | 'shadowOffset' | 'shadowOpacity' | 'shadowRadius' | 'elevation'>;

export const shadows: Record<string, ShadowStyle> = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
} as const;

export type SpacingKey = keyof typeof spacing;
