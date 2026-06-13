#!/usr/bin/env node

/**
 * gen_tokens_rn.mjs
 *
 * Reads assets/variables.tokens.json (Design Tokens from Flutter project)
 * and generates src/lib/theme/design_tokens.g.ts
 *
 * Outputs:
 *   - TokensLight  – all light-mode color values (camelCase keys)
 *   - TokensDark   – all dark-mode color values (camelCase keys)
 *   - front        – static design tokens (spacing, radius, fontSizes, lineHeights,
 *                    widths, containers, fontFamilies, fontWeights)
 *   - primitiveColors – backward-compat primitive color families
 *
 * Usage: node tool/gen_tokens_rn.mjs
 *        or from package.json script: yarn gen-tokens
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ─── Paths ──────────────────────────────────────────────
const TOKENS_PATH = resolve(__dirname, '..', 'assets', 'variables.tokens.json');
const OUTPUT_PATH = resolve(__dirname, '..', 'src', 'lib', 'theme', 'design_tokens.g.ts');

// ─── Naming Helpers ────────────────────────────────────

/**
 * Convert a design-token key to camelCase matching Flutter convention.
 *
 * Examples:
 *   "text-primary (900)"     → "textPrimary900"
 *   "text-secondary (700)"   → "textSecondary700"
 *   "bg-primary"             → "bgPrimary"
 *   "fg-brand-primary"       → "fgBrandPrimary"
 *   "utility-brand-600"      → "utilityBrand600"
 *   "utility-brand-50_alt"   → "utilityBrand50Alt"
 *   "border-error_subtle"    → "borderErrorSubtle"
 *   "button-primary-bg"      → "buttonPrimaryBg"
 *   "button-primary-bg_hover"→ "buttonPrimaryBgHover"
 *   "spacing-none"           → "spacingNone"
 *   "spacing-xxs"            → "spacingXxs"
 *   "radius-none"            → "radiusNone"
 *   "text-xs"                → "textXs"
 *   "display-md"             → "displayMd"
 *   "width-xxs"              → "widthXxs"
 *   "container-max-width-desktop" → "containerMaxWidthDesktop"
 *   "font-family-display"    → "fontFamilyDisplay"
 *   "regular-italic"         → "regularItalic"
 *   "alpha-white-90"         → "alphaWhite90"
 */
function toCamelCase(str) {
  // Strip parenthetical content like "(900)", "(700)"
  let s = str.replace(/\([^)]*\)/g, '').trim();
  // Replace special chars (hyphens, underscores, dots, spaces) with a single delimiter
  s = s.replace(/[-_\s.]+/g, '-');
  // Split on delimiter, lowercase first word, uppercase subsequent words
  const parts = s.split('-').filter(Boolean);
  if (parts.length === 0) return '_empty';

  let result = parts[0].toLowerCase();
  for (let i = 1; i < parts.length; i++) {
    const p = parts[i];
    if (p.length === 0) continue;
    result += p[0].toUpperCase() + p.slice(1).toLowerCase();
  }

  // If starts with a digit, prefix with underscore
  if (/^\d/.test(result)) {
    result = '_' + result;
  }

  return result;
}

/**
 * Map a font-size leaf key to the Flutter-consistent front property name.
 * Text sizes get "text" prefix, display sizes keep "display" prefix.
 * Examples: "xs" → "textXs", "display-md" → "displayMd", "3xs" → "text3xs"
 */
function fontSizeToFrontKey(str) {
  const s = str.trim();
  if (s.startsWith('display-') || s === 'display') {
    // "display-xs" → "displayXs", "display-md" → "displayMd"
    return toCamelCase(s);
  }
  if (s.startsWith('text-')) {
    // "text-xs" → "textXs", "text-3xs" → "text3xs"
    return toCamelCase(s);
  }
  // "xs" → "textXs", "3xs" → "text3xs", "sm" → "textSm"
  return 'text' + s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Map a line-height leaf key to the Flutter "leading" prefix.
 * Examples: "xs" → "leadingXs", "display-md" → "leadingDisplayMd", "3xs" → "leading3xs"
 */
function lineHeightToFrontKey(str) {
  const s = str.trim();
  if (s.startsWith('display-')) {
    // "display-xs" → "leadingDisplayXs"
    const rest = s.slice(8); // remove "display-"
    return 'leadingDisplay' + rest.charAt(0).toUpperCase() + rest.slice(1);
  }
  if (s === 'display') return 'leadingDisplay';
  if (s.startsWith('text-')) {
    // "text-xs" → "leadingXs", "text-3xs" → "leading3xs"
    const rest = s.slice(5); // remove "text-"
    return 'leading' + rest.charAt(0).toUpperCase() + rest.slice(1);
  }
  // "xs" → "leadingXs", "3xs" → "leading3xs"
  return 'leading' + s.charAt(0).toUpperCase() + s.slice(1);
}

// ─── JSON Parsing Helpers ──────────────────────────────

/** Recursively walk object; collect leaf nodes with { value, type } */
function collectLeaves(obj, path = []) {
  const leaves = [];
  for (const [key, val] of Object.entries(obj)) {
    const cur = [...path, key];
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      if ('value' in val && 'type' in val) {
        leaves.push({ path: cur, value: val.value, type: val.type });
      } else {
        leaves.push(...collectLeaves(val, cur));
      }
    }
  }
  return leaves;
}

/** Flatten nested object into dot-path keys */
function flattenObj(obj, prefix = '', sep = '.') {
  return Object.entries(obj).reduce((acc, [key, val]) => {
    const newKey = prefix ? `${prefix}${sep}${key}` : key;
    if (val && typeof val === 'object' && !Array.isArray(val) && !('value' in val)) {
      Object.assign(acc, flattenObj(val, newKey, sep));
    } else {
      acc[newKey] = val;
    }
    return acc;
  }, {});
}

/**
 * Resolve token references by looking up the provided resolution map.
 * Handles nested paths like "Colors.Gray (light mode).900" and "Colors.Background.bg-secondary"
 */
function resolveRef(value, resolutionMap) {
  if (typeof value !== 'string') return value;
  const match = value.match(/^\{(.+)\}$/);
  if (!match) return value;

  const refPath = match[1];
  
  // Try flattened lookup first (fast path)
  if (resolutionMap[refPath] !== undefined) {
    return resolutionMap[refPath];
  }

  // Handle nested paths like "Colors.Gray (light mode).900"
  const parts = refPath.split('.');
  let current = resolutionMap;
  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = current[part];
    } else {
      // Try flattened lookup again (for partial paths)
      const flatKey = parts.join('.');
      if (resolutionMap[flatKey] !== undefined) {
        return resolutionMap[flatKey];
      }
      return value; // Can't resolve, return original
    }
  }
  return current !== undefined ? current : value;
}

/**
 * Resolve a reference value that may be a simple value or {ref}.
 * For semantic tokens (with "Light mode"/"Dark mode"), returns { light, dark }.
 * Uses the provided resolutionMap which may contain primitives AND already-resolved
 * semantic tokens for cross-reference support.
 */
function resolveValue(value, resolutionMap) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    if ('Light mode' in value && 'Dark mode' in value) {
      return {
        light: resolveRef(value['Light mode'], resolutionMap),
        dark: resolveRef(value['Dark mode'], resolutionMap),
      };
    }
    // Fallback: simple value
    for (const v of Object.values(value)) {
      if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
        return resolveRef(v, resolutionMap);
      }
    }
    return value;
  }
  return resolveRef(value, resolutionMap);
}

/**
 * Multi-pass resolve: iteratively resolves cross-references between semantic tokens.
 * Some semantic tokens reference other semantic tokens (e.g. "bgBrandPrimaryAlt" references "bgSecondary").
 * This function keeps resolving until no more {}-references remain or maxPasses is reached.
 */
function multiPassResolve(leaves, initialResolutionMap, maxPasses = 5) {
  // Build a flat map of raw-path → { light, dark } from initial resolution
  const rawPathToValue = {};
  for (const leaf of leaves) {
    const key = leaf.path.join('.');
    rawPathToValue[key] = resolveValue(leaf.value, initialResolutionMap);
  }

  // Build the resolution map starting with primitives
  let resolutionMap = { ...initialResolutionMap };

  // Add all currently resolved values to the map for cross-reference resolution
  for (const [rawPath, val] of Object.entries(rawPathToValue)) {
    if (val && typeof val === 'object' && 'light' in val && 'dark' in val) {
      resolutionMap[rawPath] = val.light; // store light value for reference lookups
    } else if (typeof val === 'string') {
      resolutionMap[rawPath] = val;
    }
  }

  // Iteratively resolve until stable
  for (let pass = 0; pass < maxPasses; pass++) {
    let changed = false;
    for (const leaf of leaves) {
      const key = leaf.path.join('.');
      const resolved = resolveValue(leaf.value, resolutionMap);
      const existing = rawPathToValue[key];

      // Check if resolution changed
      const existingStr = JSON.stringify(existing);
      const resolvedStr = JSON.stringify(resolved);
      if (existingStr !== resolvedStr) {
        changed = true;
        rawPathToValue[key] = resolved;
        // Update resolution map
        if (resolved && typeof resolved === 'object' && 'light' in resolved && 'dark' in resolved) {
          resolutionMap[key] = resolved.light;
        } else if (typeof resolved === 'string') {
          resolutionMap[key] = resolved;
        }
      }
    }
    if (!changed) break; // Stable
  }

  return rawPathToValue;
}

// ─── Main ───────────────────────────────────────────────

function generate() {
  console.log(`📖 Reading tokens from: ${TOKENS_PATH}`);

  if (!existsSync(TOKENS_PATH)) {
    console.error(`❌ Tokens file not found at ${TOKENS_PATH}`);
    console.error('   Make sure assets/variables.tokens.json exists.');
    process.exit(1);
  }

  const raw = JSON.parse(readFileSync(TOKENS_PATH, 'utf-8'));

  // ── 1. Build resolved primitives map ──
  const primitives = raw._Primitives;
  const primitiveLeaves = collectLeaves(primitives);

  // First pass: collect all primitive leaves keyed by their path
  const primitiveMap = {};
  for (const leaf of primitiveLeaves) {
    const key = leaf.path.join('.');
    primitiveMap[key] = leaf.value;
  }

  // Also create a flattened map for reference resolution
  const primitivesFlat = flattenObj(primitives);
  // Merge leaf values into flat map for resolution
  for (const leaf of primitiveLeaves) {
    primitivesFlat[leaf.path.join('.')] = leaf.value;
  }

  // Build a resolved primitives lookup: path string → resolved value
  const resolvedPrimitives = {};
  for (const leaf of primitiveLeaves) {
    const key = leaf.path.join('.');
    resolvedPrimitives[key] = leaf.value;
  }

  // ── 2. Parse semantic color tokens (theme-dependent) ──
  const colorModes = raw['1. Color modes'];
  const semanticColorLeaves = collectLeaves(colorModes);

  // Multi-pass resolve to handle cross-references between semantic tokens
  const resolvedSemanticMap = multiPassResolve(semanticColorLeaves, resolvedPrimitives);

  // Build light/dark maps with camelCase keys
  const lightMap = {};
  const darkMap = {};

  for (const [rawPath, resolved] of Object.entries(resolvedSemanticMap)) {
    const parts = rawPath.split('.');
    const rawKey = parts[parts.length - 1];
    const camelKey = toCamelCase(rawKey);

    if (resolved && typeof resolved === 'object' && 'light' in resolved && 'dark' in resolved) {
      lightMap[camelKey] = resolved.light;
      darkMap[camelKey] = resolved.dark;
    } else {
      // Fixed color (no light/dark split) — same in both modes
      const val = typeof resolved === 'string' ? resolved : String(resolved);
      lightMap[camelKey] = val;
      darkMap[camelKey] = val;
    }
  }

  // ── 3. Parse spacing tokens ──
  const spacingLeaves = collectLeaves({ '': raw['3. Spacing'] });
  const spacingMap = {};
  for (const leaf of spacingLeaves) {
    const rawKey = leaf.path[leaf.path.length - 1];
    const camelKey = toCamelCase(rawKey);
    spacingMap[camelKey] = Number(resolveRef(leaf.value, resolvedPrimitives));
  }

  // ── 4. Parse radius tokens ──
  const radiusLeaves = collectLeaves({ '': raw['2. Radius'] });
  const radiusMap = {};
  for (const leaf of radiusLeaves) {
    const rawKey = leaf.path[leaf.path.length - 1];
    const camelKey = toCamelCase(rawKey);
    radiusMap[camelKey] = Number(leaf.value);
  }

  // ── 5. Parse width tokens ──
  const widthLeaves = collectLeaves({ '': raw['4. Widths'] });
  const widthMap = {};
  for (const leaf of widthLeaves) {
    const rawKey = leaf.path[leaf.path.length - 1];
    const camelKey = toCamelCase(rawKey);
    widthMap[camelKey] = Number(resolveRef(leaf.value, resolvedPrimitives));
  }

  // ── 6. Parse container tokens ──
  const containerLeaves = collectLeaves({ '': raw['5. Containers'] });
  const containerMap = {};
  for (const leaf of containerLeaves) {
    const rawKey = leaf.path[leaf.path.length - 1];
    const camelKey = toCamelCase(rawKey);
    containerMap[camelKey] = Number(resolveRef(leaf.value, resolvedPrimitives));
  }

  // ── 7. Parse typography tokens ──
  const typography = raw['6. Typography'];
  const fontFamilyLeaves = collectLeaves({ '': typography['Font family'] || {} });
  const fontWeightLeaves = collectLeaves({ '': typography['Font weight'] || {} });
  const fontSizeLeaves = collectLeaves({ '': typography['Font size'] || {} });
  const lineHeightLeaves = collectLeaves({ '': typography['Line height'] || {} });

  // Font families — use "fontFamily" prefix
  const fontFamilyMap = {};
  for (const leaf of fontFamilyLeaves) {
    const rawKey = leaf.path[leaf.path.length - 1];
    // Map "font-family-display" → "fontFamilyDisplay", "font-family-body" → "fontFamilyBody"
    const camelKey = toCamelCase(rawKey);
    fontFamilyMap[camelKey] = leaf.value;
  }

  // Font weights — raw values like "regular", "medium", "semibold"
  const fontWeightMap = {};
  for (const leaf of fontWeightLeaves) {
    const rawKey = leaf.path[leaf.path.length - 1];
    const camelKey = toCamelCase(rawKey);
    fontWeightMap[camelKey] = leaf.value;
  }

  // Font sizes — map to proper front keys
  const fontSizeMap = {};
  for (const leaf of fontSizeLeaves) {
    const rawKey = leaf.path[leaf.path.length - 1];
    const frontKey = fontSizeToFrontKey(rawKey);
    fontSizeMap[frontKey] = Number(leaf.value);
  }

  // Line heights — map to "leading" prefix
  const lineHeightMap = {};
  for (const leaf of lineHeightLeaves) {
    const rawKey = leaf.path[leaf.path.length - 1];
    const frontKey = lineHeightToFrontKey(rawKey);
    lineHeightMap[frontKey] = Number(leaf.value);
  }

  // ── 8. Parse primitive color families (for backward compat) ──
  const primitiveColors = primitives.Colors || {};
  const colorFamilies = {};
  for (const [familyName, shades] of Object.entries(primitiveColors)) {
    // Preserve parenthetical content (e.g. "Gray (light mode)" → "grayLightMode")
    // by replacing parens with spaces before camelCase conversion
    const cleanName = familyName.replace(/[()]/g, ' ').replace(/\s+/g, ' ').trim();
    const familyKey = toCamelCase(cleanName);
    colorFamilies[familyKey] = {};
    for (const [shade, data] of Object.entries(shades)) {
      if (data && typeof data === 'object' && 'value' in data) {
        colorFamilies[familyKey][shade] = data.value;
      }
    }
  }

  // ── 9. Generate TypeScript output ──
  const lines = [];
  const pad = (n) => '  '.repeat(n);

  // ── Header ──
  lines.push('// ═══════════════════════════════════════════════════════');
  lines.push('// design_tokens.g.ts — AUTO-GENERATED by tool/gen_tokens_rn.mjs');
  lines.push(`// Generated: ${new Date().toISOString()}`);
  lines.push('// Source: assets/variables.tokens.json');
  lines.push('// ═══════════════════════════════════════════════════════');
  lines.push('');
  lines.push('// ═══════════════════════════════════════════════════════');
  lines.push('// 1. TokensLight — All light-mode color values');
  lines.push('// ═══════════════════════════════════════════════════════');
  lines.push('');

  lines.push('/**');
  lines.push(' * All theme-dependent color tokens resolved to light mode.');
  lines.push(' * Usage: TokensLight.textPrimary900');
  lines.push(' */');
  lines.push('export const TokensLight = {');
  for (const [key, val] of Object.entries(lightMap)) {
    lines.push(`${pad(1)}${key}: '${val}',`);
  }
  lines.push('} as const;');
  lines.push('');

  // ── TokensDark ──
  lines.push('// ═══════════════════════════════════════════════════════');
  lines.push('// 2. TokensDark — All dark-mode color values');
  lines.push('// ═══════════════════════════════════════════════════════');
  lines.push('');

  lines.push('/**');
  lines.push(' * All theme-dependent color tokens resolved to dark mode.');
  lines.push(' * Usage: TokensDark.textPrimary900');
  lines.push(' */');
  lines.push('export const TokensDark = {');
  for (const [key, val] of Object.entries(darkMap)) {
    lines.push(`${pad(1)}${key}: '${val}',`);
  }
  lines.push('} as const;');
  lines.push('');

  // ── front: Static design tokens ──
  lines.push('// ═══════════════════════════════════════════════════════');
  lines.push('// 3. front — Static design tokens (theme-independent)');
  lines.push('// ═══════════════════════════════════════════════════════');
  lines.push('');

  lines.push('/**');
  lines.push(' * Static design tokens — never change with theme.');
  lines.push(' * Includes spacing, radius, font sizes, line heights,');
  lines.push(' * widths, containers, font families, and font weights.');
  lines.push(' *');
  lines.push(' * Usage:');
  lines.push(' *   import { front } from "@/lib/theme";');
  lines.push(' *   front.spacingMd   // → 8');
  lines.push(' *   front.radiusSm    // → 6');
  lines.push(' *   front.textSm      // → 14');
  lines.push(' *   front.displayMd   // → 36');
  lines.push(' */');
  lines.push('export const front = {');

  // Spacing
  if (Object.keys(spacingMap).length > 0) {
    lines.push('');
    lines.push(`${pad(1)}// ── Spacing ──`);
    for (const [key, val] of Object.entries(spacingMap)) {
      lines.push(`${pad(1)}${key}: ${val},`);
    }
  }

  // Radius
  if (Object.keys(radiusMap).length > 0) {
    lines.push('');
    lines.push(`${pad(1)}// ── Radius ──`);
    for (const [key, val] of Object.entries(radiusMap)) {
      lines.push(`${pad(1)}${key}: ${val},`);
    }
  }

  // Font sizes
  if (Object.keys(fontSizeMap).length > 0) {
    lines.push('');
    lines.push(`${pad(1)}// ── Font sizes ──`);
    for (const [key, val] of Object.entries(fontSizeMap)) {
      lines.push(`${pad(1)}${key}: ${val},`);
    }
  }

  // Line heights
  if (Object.keys(lineHeightMap).length > 0) {
    lines.push('');
    lines.push(`${pad(1)}// ── Line heights ──`);
    for (const [key, val] of Object.entries(lineHeightMap)) {
      lines.push(`${pad(1)}${key}: ${val},`);
    }
  }

  // Widths
  if (Object.keys(widthMap).length > 0) {
    lines.push('');
    lines.push(`${pad(1)}// ── Widths ──`);
    for (const [key, val] of Object.entries(widthMap)) {
      lines.push(`${pad(1)}${key}: ${val},`);
    }
  }

  // Containers
  if (Object.keys(containerMap).length > 0) {
    lines.push('');
    lines.push(`${pad(1)}// ── Containers ──`);
    for (const [key, val] of Object.entries(containerMap)) {
      lines.push(`${pad(1)}${key}: ${val},`);
    }
  }

  // Font families
  if (Object.keys(fontFamilyMap).length > 0) {
    lines.push('');
    lines.push(`${pad(1)}// ── Font families ──`);
    for (const [key, val] of Object.entries(fontFamilyMap)) {
      lines.push(`${pad(1)}${key}: '${val}',`);
    }
  }

  // Font weights
  if (Object.keys(fontWeightMap).length > 0) {
    lines.push('');
    lines.push(`${pad(1)}// ── Font weights ──`);
    for (const [key, val] of Object.entries(fontWeightMap)) {
      lines.push(`${pad(1)}${key}: '${val}',`);
    }
  }

  lines.push('} as const;');
  lines.push('');

  // ── Type helpers ──
  lines.push('// ═══════════════════════════════════════════════════════');
  lines.push('// 4. Type helpers');
  lines.push('// ═══════════════════════════════════════════════════════');
  lines.push('');

  lines.push('export type FrontTokens = keyof typeof front;');
  lines.push('export type TokensLightType = typeof TokensLight;');
  lines.push('export type TokensDarkType = typeof TokensDark;');
  lines.push('');

  // ── Primitive colors (backward compat) ──
  lines.push('// ═══════════════════════════════════════════════════════');
  lines.push('// 5. Primitive color families (backward compat)');
  lines.push('// ═══════════════════════════════════════════════════════');
  lines.push('');

  for (const [familyKey, shades] of Object.entries(colorFamilies)) {
    lines.push(`/** Primitive color family` + (familyKey ? `: ${familyKey}` : '') + ` */`);
    lines.push(`export const primitiveColors_${familyKey} = {`);
    for (const [shade, val] of Object.entries(shades)) {
      lines.push(`${pad(1)}'${shade}': '${val}',`);
    }
    lines.push('} as const;');
    lines.push('');
  }

  // Combined primitive colors
  lines.push('/** All primitive colors combined */');
  lines.push('export const primitiveColors = {');
  for (const [familyKey] of Object.entries(colorFamilies)) {
    lines.push(`${pad(1)}...primitiveColors_${familyKey},`);
  }
  lines.push('} as const;');
  lines.push('');

  // ── Write output ──
  const output = lines.join('\n');

  const outDir = dirname(OUTPUT_PATH);
  if (!existsSync(outDir)) {
    mkdirSync(outDir, { recursive: true });
  }

  writeFileSync(OUTPUT_PATH, output, 'utf-8');
  console.log(`✅ Generated: ${OUTPUT_PATH}`);
  console.log(`   ${lines.length} lines written.`);
  console.log(`   - TokensLight: ${Object.keys(lightMap).length} color tokens`);
  console.log(`   - TokensDark: ${Object.keys(darkMap).length} color tokens`);
  console.log(`   - front: ${Object.keys(spacingMap).length} spacing + ${Object.keys(radiusMap).length} radius + ${Object.keys(fontSizeMap).length} fontSizes + ${Object.keys(lineHeightMap).length} lineHeights + ${Object.keys(widthMap).length} widths + ${Object.keys(containerMap).length} containers + ${Object.keys(fontFamilyMap).length} fontFamilies + ${Object.keys(fontWeightMap).length} fontWeights = ${Object.keys(spacingMap).length + Object.keys(radiusMap).length + Object.keys(fontSizeMap).length + Object.keys(lineHeightMap).length + Object.keys(widthMap).length + Object.keys(containerMap).length + Object.keys(fontFamilyMap).length + Object.keys(fontWeightMap).length} static tokens`);
  console.log(`   - primitiveColors: ${Object.keys(colorFamilies).length} families`);
}

generate();
