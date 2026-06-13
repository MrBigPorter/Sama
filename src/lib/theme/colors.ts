/**
 * Color system backed by generated Design Tokens from design_tokens.g.ts
 *
 * Provides backward-compatible exports for existing code while
 * exposing the full generated token set for new development.
 *
 * Generated tokens are sourced from assets/variables.tokens.json
 * (shared with Flutter project).
 */

import {
  primitiveColors_base,
  primitiveColors_grayLightMode,
  primitiveColors_brand,
  primitiveColors_error,
  primitiveColors_warning,
  primitiveColors_success,
} from './design_tokens.g';

// ── Backward-compatible `colors` export ──────────────────
// Matches the previous shape: colors.primary, colors.neutral, colors.semantic

/** Primary color scale (mapped from Brand primitives) */
export const colors = {
  primary: {
    50: primitiveColors_brand['50'],
    100: primitiveColors_brand['100'],
    200: primitiveColors_brand['200'],
    300: primitiveColors_brand['300'],
    400: primitiveColors_brand['400'],
    500: primitiveColors_brand['500'],
    600: primitiveColors_brand['600'],
    700: primitiveColors_brand['700'],
    800: primitiveColors_brand['800'],
    900: primitiveColors_brand['900'],
  },
  neutral: {
    50: primitiveColors_grayLightMode['50'],
    100: primitiveColors_grayLightMode['100'],
    200: primitiveColors_grayLightMode['200'],
    300: primitiveColors_grayLightMode['300'],
    400: primitiveColors_grayLightMode['400'],
    500: primitiveColors_grayLightMode['500'],
    600: primitiveColors_grayLightMode['600'],
    700: primitiveColors_grayLightMode['700'],
    800: primitiveColors_grayLightMode['800'],
    900: primitiveColors_grayLightMode['900'],
  },
  semantic: {
    success: primitiveColors_success['500'],
    warning: primitiveColors_warning['500'],
    error: primitiveColors_error['500'],
    info: primitiveColors_brand['500'],
  },
  white: primitiveColors_base.white,
  black: primitiveColors_base.black,
  transparent: primitiveColors_base.transparent,
} as const;

export type ColorKey = keyof typeof colors;
