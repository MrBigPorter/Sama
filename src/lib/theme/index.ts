// ── Backward-compatible exports ───────────────────────
export { colors } from './colors';
export type { ColorKey } from './colors';
export { typography } from './typography';
export type { TypographyVariant } from './typography';
export { spacing, borderRadius, shadows } from './spacing';
export type { SpacingKey } from './spacing';
export { ThemeProvider, useTheme, useModeColors } from './ThemeContext';

// ── New API exports ───────────────────────────────────
export { useFront } from './ThemeContext';

// ── Generated Design Token exports ───────────────────
export {
  TokensLight,
  TokensDark,
  front,
  primitiveColors,
} from './design_tokens.g';

export type {
  FrontTokens,
  TokensLightType,
  TokensDarkType,
} from './design_tokens.g';
