import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import { TokensLight, TokensDark, front } from './design_tokens.g';
import { storage } from '@/lib/storage';

type ThemeMode = 'light' | 'dark';

interface ThemeContextValue {
  mode: ThemeMode;
  isDark: boolean;
  /** Flat map of all color tokens resolved to the current theme mode (backward compat) */
  colors: Record<string, string>;
  toggleTheme: () => void;
  setTheme: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

/**
 * Resolve TokensLight/TokensDark into a flat Record<string, string>.
 */
function resolveThemeColors(mode: ThemeMode): Record<string, string> {
  const source = mode === 'dark' ? TokensDark : TokensLight;
  const map: Record<string, string> = {};
  for (const [key, val] of Object.entries(source)) {
    map[key] = val as string;
  }
  // ── Common aliases (backward compat for screens that use legacy keys) ──
  map.background = map.bgPrimary;
  map.text = map.textPrimary;
  map.primary = map.utilityBrand500 ?? map.fgBrandPrimary;
  map.border = map.borderSecondary;
  map.surface = map.bgSecondary;
  return map;
}

/**
 * Lightweight ThemeProvider.
 *
 * Manages the current theme mode (light/dark).
 * Theme-dependent color resolution is handled via TokensLight / TokensDark,
 * exposed through `useFront()` (new API) or `useTheme()` (backward compat).
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Read persisted theme preference from MMKV; default to 'dark' if none saved
  const savedTheme = storage.getString('theme_mode') as ThemeMode | undefined;
  const [mode, setMode] = useState<ThemeMode>(savedTheme ?? 'light');

  // Persist theme preference to MMKV whenever mode changes
  useEffect(() => {
    storage.set('theme_mode', mode);
  }, [mode]);

  const toggleTheme = useCallback(() => {
    setMode(prev => (prev === 'light' ? 'dark' : 'light'));
  }, []);

  const setTheme = useCallback((newMode: ThemeMode) => {
    setMode(newMode);
  }, []);

  // Resolve colors whenever mode changes
  const colors = useMemo(() => resolveThemeColors(mode), [mode]);


  const value = useMemo<ThemeContextValue>(
    () => ({
      mode,
      isDark: mode === 'dark',
      colors,
      toggleTheme,
      setTheme,
    }),
    [mode, colors, toggleTheme, setTheme],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

/**
 * Hook to access the current theme mode and resolved color map.
 * @deprecated Prefer useFront() which separates static tokens from themed colors.
 */
export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return ctx;
}

/**
 * The main design-token hook.
 *
 * Returns:
 * - `front` – all static design tokens (spacing, radius, fontSizes, lineHeights, etc.)
 * - `colors` – all theme-dependent color tokens resolved to the current mode
 *
 * Usage:
 *   const { front, colors } = useFront();
 *   style={{ gap: front.spacingMd, backgroundColor: colors.bgPrimary }}
 *
 * Or with individual destructuring:
 *   const { front: { spacingMd, textSm }, colors: { textPrimary } } = useFront();
 */
export function useFront() {
  const { mode } = useTheme();

  return useMemo(() => {
    const colors = mode === 'dark' ? TokensDark : TokensLight;
    return { front, colors };
  }, [mode]);
}

/**
 * Convenience hook returning a flat Record<string, string> of all
 * theme-dependent color tokens resolved to the current mode.
 *
 * Usage:
 *   const mc = useModeColors();
 *   // mc.textPrimary → '#181d27' (light) or '#f7f7f7' (dark)
 */
export function useModeColors(): Record<string, string> {
  const { mode } = useTheme();
  return useMemo(() => resolveThemeColors(mode), [mode]);
}
