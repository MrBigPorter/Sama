import { TextStyle } from 'react-native';

/**
 * Typography system backed by generated Design Tokens from design_tokens.g.ts.
 *
 * Uses generated font sizes, line heights, and font families while
 * keeping the backward-compatible TextStyle objects.
 */

import { front } from './design_tokens.g';

/**
 * Typography scale — TextStyle objects built from generated tokens.
 */
export const typography: Record<string, TextStyle> = {
  display: {
    fontFamily: front.fontFamilyDisplay,
    fontSize: front.displayMd,
    fontWeight: '700',
    lineHeight: front.leadingDisplayMd,
    letterSpacing: -0.5,
  },
  h1: {
    fontFamily: front.fontFamilyDisplay,
    fontSize: front.displayXs,
    fontWeight: '700',
    lineHeight: front.leadingDisplayXs,
    letterSpacing: -0.3,
  },
  h2: {
    fontFamily: front.fontFamilyBody,
    fontSize: front.displayXs,
    fontWeight: '600',
    lineHeight: front.leadingDisplayXs,
    letterSpacing: -0.2,
  },
  h3: {
    fontFamily: front.fontFamilyBody,
    fontSize: front.textXl,
    fontWeight: '600',
    lineHeight: front.leadingXl,
  },
  h4: {
    fontFamily: front.fontFamilyBody,
    fontSize: front.textLg,
    fontWeight: '600',
    lineHeight: front.leadingLg,
  },
  h5: {
    fontFamily: front.fontFamilyBody,
    fontSize: front.textMd,
    fontWeight: '600',
    lineHeight: front.leadingMd,
  },
  base: {
    fontFamily: front.fontFamilyBody,
    fontSize: front.textSm,
    fontWeight: '400',
    lineHeight: front.leadingSm,
  },
  small: {
    fontFamily: front.fontFamilyBody,
    fontSize: front.textXs,
    fontWeight: '400',
    lineHeight: front.leadingXs,
  },
  xs: {
    fontFamily: front.fontFamilyBody,
    fontSize: front.text2xs,
    fontWeight: '400',
    lineHeight: front.leading2xs,
  },
  label: {
    fontFamily: front.fontFamilyBody,
    fontSize: front.text2xs,
    fontWeight: '500',
    lineHeight: front.leading2xs,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  caption: {
    fontFamily: front.fontFamilyBody,
    fontSize: front.text2xs,
    fontWeight: '400',
    lineHeight: front.leading2xs,
    color: '#64748b',
  },

  // ── Backward-compatible aliases ──────────────────────────
  body: {
    fontFamily: front.fontFamilyBody,
    fontSize: front.textSm,
    fontWeight: '400',
    lineHeight: front.leadingSm,
  },
  body2: {
    fontFamily: front.fontFamilyBody,
    fontSize: front.textXs,
    fontWeight: '400',
    lineHeight: front.leadingXs,
  },
  subtitle2: {
    fontFamily: front.fontFamilyBody,
    fontSize: front.textMd,
    fontWeight: '600',
    lineHeight: front.leadingMd,
  },
};

export type TypographyVariant = keyof typeof typography;
