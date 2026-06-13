# Sama

> **A pure chat app for the Philippines market — fast, lightweight, AI-native.**

Sama (Tagalog for "Together") is a closed-network instant messaging application extracted from JoyMini's Flutter codebase, rebuilt from scratch in React Native (Expo). It targets the Philippines market with a focus on chat quality, AI-enhanced communication, and zero distractions.

---

## Tech Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Framework | **Expo SDK 56** (Dev Builds) | Fast dev cycle + full native module support |
| Language | **TypeScript 6** | Strict mode with path aliases |
| State | **Redux Toolkit** | Predictable state, RTK Query for API caching |
| Navigation | **React Navigation 7** | Stack + Bottom Tabs |
| Storage | **react-native-mmkv** | KV storage (theme, session, settings) |
| Animations | **react-native-reanimated + gesture-handler** | Smooth 60fps UI |
| Database | **WatermelonDB** *(Phase 1)* | Offline-first chat messages |
| Realtime | **Socket.IO / WebSocket** *(Phase 1)* | Live messaging |
| Voice/Video | **LiveKit** *(Phase 3)* | WebRTC-based calls |
| AI | **LLM Gateway** *(Phase 2)* | Multi-provider (OpenAI, Anthropic, etc.) |
| Monitoring | **Sentry** | Error tracking |
| CI/CD | **EAS Build + EAS Update** *(Phase 5)* | OTA updates |

---

## Project Structure

```
Sama/
├── App.tsx                      # Entry point (provider tree)
├── app.json                     # Expo config
├── tsconfig.json                # TypeScript config (@/ path alias)
├── babel.config.js              # Babel + module-resolver + reanimated
├── src/
│   ├── Navigation.tsx           # Root stack + tab navigator
│   ├── screens/
│   │   ├── ChatListScreen.tsx   # Chat list with unread badges
│   │   ├── ConversationScreen.tsx # Message bubbles + input bar
│   │   ├── ContactsScreen.tsx   # Contact list with status
│   │   └── SettingsScreen.tsx   # Profile + theme toggle + menu
│   ├── store/
│   │   ├── index.ts             # configureStore
│   │   └── slices/
│   │       └── uiSlice.ts       # UI state (loading, toast, bottom sheet)
│   ├── lib/
│   │   ├── storage/index.ts     # MMKV wrapper
│   │   ├── theme/
│   │   │   ├── design_tokens.g.ts  # Generated tokens (do not edit)
│   │   │   ├── ThemeContext.tsx     # ThemeProvider + hooks
│   │   │   └── ThemeToggle.tsx     # Dark mode toggle
│   │   └── hooks/               # Custom hooks (TBD)
│   ├── api/                     # RTK Query endpoints (TBD)
│   └── components/              # Shared UI components (TBD)
├── tool/
│   └── gen_tokens_rn.mjs        # Token generator script
├── assets/                      # Icons, splash, adaptive icons
└── plans/                       # Architecture docs, schedules
```

---

## Design Tokens

All colors and spacing are generated from `assets/variables.tokens.json` via `tool/gen_tokens_rn.mjs`.

### Usage

```typescript
import { useFront } from '@/lib/theme/ThemeContext';

function MyComponent() {
  const { front, colors } = useFront();

  return (
    <View style={{
      padding: front.spacingMd,   // 8
      borderRadius: front.radiusMd, // 8
      backgroundColor: colors.bgPrimary,
    }}>
      <Text style={{ color: colors.textPrimary }}>
        Hello Sama
      </Text>
    </View>
  );
}
```

### Available Properties

**Static tokens** (from `front`):
- `spacingXs(4)`, `spacingSm(6)`, `spacingMd(8)`, `spacingLg(12)`, `spacingXl(16)`
- `radiusNone(0)`, `radiusXs(4)`, `radiusSm(6)`, `radiusMd(8)`, `radiusLg(10)`, `radiusXl(12)`, `radius2xl(16)`, `radius4xl(24)`, `radiusFull(9999)`
- `textXs(12)`, `textSm(14)`, `textBase(16)`, `textLg(18)`, `textXl(20)`, `text2xl(24)`, `text3xl(30)`
- `lineHeight*` matching each text size
- `width*` for breakpoints

**Color tokens** (from `colors`, auto-resolved by theme mode):
- `textPrimary`, `textSecondary`, `textTertiary`, `textPlaceholder`, `textBrandPrimary`
- `bgPrimary`, `bgSecondary`, `bgTertiary`, `bgBrandSolid`
- `borderPrimary`, `borderSecondary`, `borderBrand`
- `utilityBrand500` (#FF7A00), `utilityBrand200`, `utilityBrand700`

> **Note**: Property names use `textPrimary` NOT `textPrimary900`, `radiusMd` NOT `borderRadiusMd`.

---

## Phase 0 Status (Infrastructure — ✅ Complete)

| Module | Files | Status |
|--------|-------|--------|
| Expo project scaffold | `package.json`, `app.json`, `tsconfig.json`, `babel.config.js` | ✅ |
| Design tokens | `design_tokens.g.ts`, `gen_tokens_rn.mjs` | ✅ |
| Theme system | `ThemeContext.tsx`, `ThemeToggle.tsx` | ✅ |
| Redux store | `store/index.ts`, `store/slices/uiSlice.ts` | ✅ |
| MMKV storage | `lib/storage/index.ts` | ✅ |
| Navigation | `Navigation.tsx` (Stack + Tab) | ✅ |
| Skeleton screens | `ChatListScreen`, `ConversationScreen`, `ContactsScreen`, `SettingsScreen` | ✅ |

### Remaining (Phase 0.4)
- Copy `baseApi.ts`, `env.ts`, `globals.ts`, `sentry.ts` from frontend-blog-mobile
- Verify TypeScript: `npx tsc --noEmit`
- Verify app launch: `npx expo start`

---

## Development

```bash
# Install dependencies
npm install

# Start dev server
npx expo start

# TypeScript check
npx tsc --noEmit

# Build for iOS (requires EAS)
npx eas build --platform ios --profile development

# Build for Android (requires EAS)
npx eas build --platform android --profile development
```

---

## Sama Brand

- **Primary Orange**: `#FF7A00`
- **Tagline**: "Together" (Tagalog)
- **Market**: Philippines (PH)
- **Platforms**: iOS + Android (Expo Dev Builds)

---

## License

Proprietary — JoyMini Technology
