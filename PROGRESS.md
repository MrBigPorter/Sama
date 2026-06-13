# Sama — 开发进度与状态追踪

> **Theme**: Sama Orange `#FF7A00` · **Target**: Philippines IM App · **Stack**: Expo SDK 56 + TypeScript + Redux Toolkit + Apollo GraphQL + LiveKit

---

## 当前阶段：Phase 5 — Release（EAS Build + App Store 提交）⬅️ 进行中

### 文件清单

#### Phase 0 — 基础设施 ✅

| # | 文件 | 类型 | 状态 | 说明 |
|---|------|------|------|------|
| 1 | `App.tsx` | Entry | ✅ | Provider 树：GestureHandler → SafeArea → Redux → Theme + StatusBar + Navigation + Sentry |
| 2 | `app.json` | Config | ✅ | Expo 配置（splash, icon, plugins） |
| 3 | `tsconfig.json` | Config | ✅ | `@/` → `./src`，strict 模式 |
| 4 | `babel.config.js` | Config | ✅ | babel-preset-expo + module-resolver + reanimated/plugin |
| 5 | `package.json` | Config | ✅ | 所有依赖已安装 |
| 6 | `src/Navigation.tsx` | Navigation | ✅ | Stack(MainTabs + Conversation + Call) + BottomTab(Chats/Contacts/Settings) + IncomingCallOverlay |
| 7 | `src/screens/ChatListScreen.tsx` | Screen | ✅ | FlatList + 通话按钮 + 未读圆点 |
| 8 | `src/screens/ConversationScreen.tsx` | Screen | ✅ | 消息气泡 + 输入栏 + 通话按钮（header） + KeyboardAvoidingView |
| 9 | `src/screens/ContactsScreen.tsx` | Screen | ✅ | 联系人列表 + 在线状态指示器 |
| 10 | `src/screens/SettingsScreen.tsx` | Screen | ✅ | 头像 + 暗黑模式切换 + 菜单列表 + 版本号 |
| 11 | `src/store/index.ts` | Store | ✅ | configureStore(ui + callSlice) |
| 12 | `src/store/slices/uiSlice.ts` | Slice | ✅ | toast/loading/bottomSheet 状态 |
| 13 | `src/store/slices/callSlice.ts` | Slice | ✅ | 通话记录状态 + Reducer |
| 14 | `src/lib/storage/index.ts` | Storage | ✅ | MMKV 包装器 |
| 15 | `src/lib/theme/design_tokens.g.ts` | Tokens | ✅ | 生成的设计令牌（1455 行）⚠️ 勿手动编辑 |
| 16 | `src/lib/theme/ThemeContext.tsx` | Theme | ✅ | ThemeProvider + useFront() + useTheme() + useModeColors() |
| 17 | `src/lib/theme/ThemeToggle.tsx` | Component | ✅ | 动画暗黑模式切换按钮 |
| 18 | `src/lib/logger/index.ts` | Logger | ✅ | debug/info/warn/error + 级别过滤 |
| 19 | `src/lib/env.ts` | Env | ✅ | dev/prod 配置（API_URL, WS_URL, SENTRY_DSN, BUILD_VARIANT, LIVEKIT_URL） |
| 20 | `src/lib/globals.ts` | Polyfill | ✅ | Hermes polyfills |
| 21 | `src/lib/sentry.ts` | Monitoring | ✅ | Sentry init + React Navigation 路由追踪 |
| 22 | `src/lib/apollo.ts` | API Client | ✅ | Apollo Client + authLink + errorLink + pagination merge |
| 23 | `src/lib/hooks/useSocket.ts` | Hook | ✅ | Socket.IO event listener hook（自动 subscribe/cleanup） |
| 24 | `src/lib/hooks/useLiveKit.ts` | Hook | ✅ | 通话状态管理 hook（startCall/acceptCall/endCall/rejectCall） |
| 25 | `src/api/baseApi.ts` | API | ✅ | samaApi(createApi) — RTK Query（保留备用） |
| 26 | `src/api/operations.ts` | API | ✅ | GraphQL mutations/queries（LOGIN, REGISTER, REQUEST_LIVEKIT_TOKEN 等） |
| 27 | `src/api/fragments.ts` | API | ✅ | GraphQL fragments |
| 28 | `src/types/graphql.ts` | Types | ✅ | GraphQL 类型定义（UserProfile, Conversation, Message, LiveKitTokenResponse, CallPayloads 等） |
| 29 | `src/services/authService.ts` | Service | ✅ | Auth 逻辑（login/register/refresh/logout + MMKV token 存储） |
| 30 | `src/services/socketService.ts` | Service | ✅ | Socket.IO 单例（connect/disconnect + 事件发送：message/typing/call） |
| 31 | `src/services/liveKitService.ts` | Service | ✅ | LiveKit 单例 Room 管理（connect/disconnect/toggleMic/toggleCamera/switchCamera） |
| 32 | `src/components/call/IncomingCallOverlay.tsx` | Component | ✅ | 来电弹窗（accept/reject 按钮，全屏覆盖） |
| 33 | `src/screens/CallScreen.tsx` | Screen | ✅ | 通话界面（VideoView, toggle mic/camera, speaker, end call, 计时器） |
| 34 | `src/screens/LoginScreen.tsx` | Screen | ✅ | 登录页 |
| 35 | `src/screens/RegisterScreen.tsx` | Screen | ✅ | 注册页 |
| 36 | `tool/gen_tokens_rn.mjs` | Tool | ✅ | design tokens generator |
| 37 | `assets/variables.tokens.json` | Assets | ✅ | JoyMini 设计令牌 |
| 38 | `README.md` | Doc | ✅ | 项目总览 |
| 39 | `plans/sama_project_schedule.md` | Doc | ✅ | 完整排期 |
| 40 | `plans/sama_dependency_matching.md` | Doc | ✅ | 依赖匹配分析 |
| 41 | `plans/sama_flutter_dep_matching.md` | Doc | ✅ | Flutter 67 包 → RN 等价分析 |
| 42 | `plans/sama_ai_chat_polish.md` | Doc | ✅ | AI 功能全集 |
| 43 | `plans/sama_ai_architecture.md` | Doc | ✅ | AI 原生架构设计 |
| 44 | `plans/sama_frontend_integration_plan.md` | Doc | ✅ | SamaApp ↔ SamaHub 对接实施计划 |
| 45 | `plans/sama_remaining_phases_plan.md` | Doc | ✅ | Phase 3/4/5 剩余阶段实施计划 |
| 46 | `docs/AI_QUICK_START.md` | Doc | ✅ | AI 快速入门开发指南 |
| 47 | `plans/sama_build_release_plan.md` | Doc | ✅ | EAS Build + Makefile + CI/CD 实施计划 |
| 48 | `Makefile` | Tool | ✅ | dev/preview/production 构建命令 + OTA |
| 49 | `eas.json` | Config | ✅ | EAS Build profiles (development/preview/production) |
| 50 | `.github/workflows/check.yml` | CI | ✅ | PR 验证 (tsc + eslint) |

| | 51 | `src/lib/observability/perfMonitor.ts` | Observability | ✅ | 性能监控 — Sentry transactions + MMKV buffer |
| | 52 | `src/lib/observability/usageStats.ts` | Observability | ✅ | 使用统计 — MMKV 计数器 + 批量 Sentry 上报 |
| | 53 | `src/lib/abtest/abTestService.ts` | A/B Test | ✅ | A/B 测试 — 确定性用户分组 + MMKV 持久化 |

---

## 关键技术决策（每次开发前必读）

### 1. Token 属性命名规则
```typescript
// ❌ 不对
borderRadius: front.borderRadiusMd  // 不存在！
color: colors.textPrimary900         // 不存在！

// ✅ 正确
borderRadius: front.radiusMd        // 8
color: colors.textPrimary           // 自动按主题模式解析
```

| 错误写法 | 正确写法 |
|---------|---------|
| `front.borderRadiusMd` | `front.radiusMd` |
| `front.borderRadiusLg` | `front.radiusLg` |
| `colors.textPrimary900` | `colors.textPrimary` |
| `colors.textSecondary700` | `colors.textSecondary` |

### 2. useFront() 用法
```typescript
const { front, colors } = useFront();
// front = 静态间距/圆角/字号（不随主题变化）
// colors = 主题色（light/dark 自动切换）
```

### 3. LiveKit 导入规则
```typescript
// ✅ Core SDK 来自 livekit-client
import { Room, RoomEvent, Track, VideoPresets } from 'livekit-client';
import type { Participant, LocalParticipant, RemoteParticipant } from 'livekit-client';

// ✅ React Native 渲染组件来自 @livekit/react-native
import { VideoView } from '@livekit/react-native';   // 使用 videoTrack prop（deprecated API）
// ❌ 不要从 @livekit/react-native 导入 Room/Track 等核心类型
```

### 4. VideoView API（deprecated）
`VideoView` 使用 `videoTrack` prop（单个 `VideoTrack` 对象），不是 `room`+`trackSource`：
```typescript
// ✅ 正确
<VideoView style={styles.remoteVideo} videoTrack={remoteVideoTrack} />

// ❌ 不对
<VideoView style={styles.remoteVideo} room={room} trackSource={Track.Source.Camera} />
```

### 5. MMKV v3 API 变更
```typescript
// ❌ 不对
import { MMKV } from 'react-native-mmkv';
const storage = new MMKV({ id: 'x' });
storage.delete('key');

// ✅ 正确
import { createMMKV } from 'react-native-mmkv';
const storage = createMMKV({ id: 'sama-app-storage' });
storage.remove('key');     // 注意是 remove 不是 delete
storage.set('key', value); // set 不变
```

### 6. 基础设施适配说明（来自 frontend-blog-mobile）

| 文件 | 改动 |
|------|------|
| `env.ts` | **精简**：去掉 staging flavor、OAuth config、i18n。**新增**：WS_URL, LIVEKIT_URL |
| `baseApi.ts` | **改名**：`blogApi`→`samaApi`，保留 RTK Query 备用。主 API 使用 Apollo Client |
| `sentry.ts` | **新增**：`Sentry.reactNavigationIntegration()` 路由追踪 |
| `globals.ts` | **直接复制**（Hermes polyfill 通用） |
| `logger/index.ts` | **精简**：去掉 transports/format 配置，单纯 console-based |

### 7. Sentry 性能监控配置
```typescript
tracesSampleRate: __DEV__ ? 1.0 : 0.2,
profilesSampleRate: __DEV__ ? 1.0 : 0.2,
replaysSessionSampleRate: 0.1,
```

### 8. i18n 状态
- **暂时不做多语言**（用户确认）
- 所有文案硬编码为英文

---

## 排期总览

```
Phase 0: 基础设施 ✅ 完成
Phase 1: Auth + WebSocket + Chat UI + Backend Integration ✅ 完成
Phase A: IM 消息类型扩展（7 种气泡 + 状态指示器 + 附件 ActionSheet + 撤回）✅ 完成
Phase 2: AI 功能（Smart Reply, Auto-Translate, Chat Polish）❌ 推迟（用户要求最后做）
Phase 3: 音视频通话（LiveKit）✅ 完成
Phase 4: A/B Test + Observability ✅ 完成
Phase 5: Release（i18n, Sentry 验证, EAS Build, App Store 提交）⬅️ 进行中
Phase B: 本地存储 + 离线 ✅ 完成（B.1 MMKV 缓存 + B.2 离线发送队列 + B.3 seqId 增量同步）
Phase C: 群组 + 联系人页面 ✅ 完成
Phase D: 性能 + 基础 UX ✅ 完成（D.1 FlatList 优化 + D.2 图片缓存 + D.3 音频播放管理）
Phase E: 交互体验 ✅ 完成（E.1 手势 + E.2 Reactions + E.3 引用回复）
```

详见 [`plans/sama_im_architecture.md`](plans/sama_im_architecture.md)

---

## Phase A — IM 消息类型扩展 ✅

> 目标：对标 JoyMini Flutter 的 7 种消息类型，实现统一气泡渲染 + 消息状态指示 + 撤回逻辑 + 附件 ActionSheet
> 详见 [`plans/sama_chat_gap_analysis.md`](plans/sama_chat_gap_analysis.md) | [`plans/sama_im_architecture.md`](plans/sama_im_architecture.md)

### 排期总览

| 步骤 | 内容 | 文件数 | 状态 |
|------|------|--------|------|
| A.1 | 类型系统扩展（MessageType 枚举、MessageMeta 接口、MessageStatus） | 2 | ✅ |
| A.2 | 工具函数（parseMeta、canRecall、getPreviewText） | 1 | ✅ |
| A.3 | 消息状态指示器组件（MessageStatus） | 1 | ✅ |
| A.4 | 统一气泡调度（MessageBubble dispatcher） | 1 | ✅ |
| A.5 | 7 种气泡组件（Text/Image/Audio/Video/File/Location/System） | 7 | ✅ |
| A.6 | 撤回机制（RecalledMessageBubble + 2 分钟窗口） | 1 | ✅ |
| A.7 | 附件 ActionSheet 集成 | 1 | ⚠️ 框架完成，具体操作待 Phase E |
| A.8 | 媒体预览处理框架 | 1 | ⚠️ 框架完成，具体预览待 Phase D/E |

### 架构变更

- **类型扩展**: 从纯文本 TEXT=0 扩展到 7 种类型：TEXT, IMAGE, AUDIO, VIDEO, FILE, LOCATION, SYSTEM
- **统一调度**: [`MessageBubble.tsx`](src/components/chat/MessageBubble.tsx) 按 `message.type` 自动分发到对应气泡组件
- **消息状态**: 客户端 [`MessageStatus`](src/components/chat/MessageStatus.tsx) 枚举（SENDING/SENT/FAILED/READ），显示在气泡右下角
- **撤回机制**: 2 分钟撤回窗口 + [`RecalledMessageBubble`](src/components/chat/bubbles/RecalledMessageBubble.tsx) 覆盖原始气泡
- **附件入口**: 输入栏 "+" 按钮 → iOS ActionSheet / Android 覆盖层（Photo/Camera/File/Location/Voice）

### 新增文件

| # | 文件 | 类型 | 说明 |
|---|------|------|------|
| 1 | `src/types/graphql.ts` | Types | 新增 `MessageType` 枚举（7 种）、`MessageStatus` 枚举、`MessageMeta` 接口、`Message.status` 字段 |
| 2 | `src/components/chat/chatTypes.ts` | Utils | `parseMeta()`、`canRecall()`（2 分钟窗口）、`getPreviewText()` |
| 3 | `src/components/chat/MessageStatus.tsx` | Component | 状态指示器：SENDING→⏳、SENT→✓、READ→✓✓（绿）、FAILED→!（红） |
| 4 | `src/components/chat/MessageBubble.tsx` | Component | 统一调度：按 type 分发 + 撤回覆盖 + 状态脚标 + 长按提示 |
| 5 | `src/components/chat/bubbles/TextMessageBubble.tsx` | Component | 纯文本渲染，fontSize 15 |
| 6 | `src/components/chat/bubbles/ImageMessageBubble.tsx` | Component | 加载中/错误状态，55% 最大宽度，onPress 预览 |
| 7 | `src/components/chat/bubbles/AudioMessageBubble.tsx` | Component | 播放/暂停 + 18 柱波形可视化 + 时长徽标 |
| 8 | `src/components/chat/bubbles/VideoMessageBubble.tsx` | Component | 缩略图 + ▶ 播放覆盖层 + 时长徽标，4:3 比例 |
| 9 | `src/components/chat/bubbles/FileMessageBubble.tsx` | Component | 扩展名徽标 + 文件名（max 2 行）+ 文件大小 |
| 10 | `src/components/chat/bubbles/LocationMessageBubble.tsx` | Component | 地址/坐标 + 地图深度链接（Apple Maps） |
| 11 | `src/components/chat/bubbles/SystemMessageBubble.tsx` | Component | 居中灰底徽标，color #888，fontSize 12 |
| 12 | `src/components/chat/bubbles/RecalledMessageBubble.tsx` | Component | 🚫 已撤回覆盖层，区分自撤回/他撤回 |
| 13 | `src/screens/ConversationScreen.tsx` | Screen | 重构：替换内联气泡 → `<MessageBubble>`，新增 `handleRecall`/`handleMediaPress`/`handleAttachmentPress`，新增 "+" 附件按钮 + ActionSheet |

### 使用示例

```typescript
// 气泡渲染（自动调度）
<MessageBubble
  message={item}
  isMe={item.sender.id === currentUserId}
  onRecall={handleRecall}
  onMediaPress={handleMediaPress}
/>

// 检查是否可撤回
if (canRecall(message, currentUserId)) {
  // 显示"长按撤回"提示
}

// 解析消息元数据
const meta = parseMeta(message);
if (meta?.width && meta?.height) {
  // 按比例渲染图片/视频
}
```

### 遗留项（将在后续阶段完成）

| 遗留项 | 目标阶段 | 说明 |
|--------|---------|------|
| 附件具体操作（拍照/相册/文件/位置/录音） | Phase E | `handleAttachmentPress` 中需要集成 `expo-image-picker`、`expo-file-system`、`expo-location`、`expo-av` |
| 媒体预览（图片查看器/视频播放器） | Phase D/E | `handleMediaPress` 中需要集成图片/视频全屏查看 |
| Android ActionSheet 完整实现 | Phase E | 当前只有 Cancel 按钮的 stub |

---

## Phase D — 性能 + 基础 UX ✅

> 目标：FlatList 性能优化、图片缓存（expo-image）、音频播放管理（expo-av）
> 详见 [`plans/sama_remaining_work_plan.md`](plans/sama_remaining_work_plan.md#phase-d--性能--基础-ux)

### D.2 — 图片缓存（expo-image）

| 任务 | 文件 | 说明 |
|------|------|------|
| 安装 expo-image | `package.json` | `npx expo install expo-image` ✅ |
| ImageMessageBubble 替换 | [`src/components/chat/bubbles/ImageMessageBubble.tsx`](src/components/chat/bubbles/ImageMessageBubble.tsx) | 使用 `expo-image` 替代 RN `<Image>`，内置磁盘+内存缓存 |
| Video 缩略图替换 | [`src/components/chat/bubbles/VideoMessageBubble.tsx`](src/components/chat/bubbles/VideoMessageBubble.tsx) | 使用 `expo-image` 渲染缩略图，`cachePolicy="memory-disk"` |

### D.3 — 音频播放管理（expo-av）

| 任务 | 文件 | 说明 |
|------|------|------|
| 安装 expo-av | `package.json` | `npx expo install expo-av` ✅ |
| AudioPlayerManager | [`src/services/audioPlayerManager.ts`](src/services/audioPlayerManager.ts) | 单例播放管理器：play/pause/stop/seek，只允许一个实例同时播放，进度回调 |
| AudioMessageBubble 集成 | [`src/components/chat/bubbles/AudioMessageBubble.tsx`](src/components/chat/bubbles/AudioMessageBubble.tsx) | 真实音频播放/暂停/进度条，替换 mock 波形动画 |

---

## 验证命令

```bash
# TypeScript 检查（必须零错误）
npx tsc --noEmit

# 启动开发服务器
npx expo start --port 8082

# 生成设计令牌（修改 variables.tokens.json 后执行）
node tool/gen_tokens_rn.mjs
```

---

## 常见问题

### Q: 怎么知道一个 token 属性名是什么？
A: 查看 `src/lib/theme/design_tokens.g.ts` 的 `front` 和 `TokensLight`/`TokensDark` 导出。

### Q: 服务器起不来说端口被占用？
A: frontend-blog-mobile 在 8081，用 `--port 8082`。

### Q: 新加一个 API endpoint 怎么做？
A: 使用 Apollo Client: 在 `src/api/operations.ts` 添加 gql 操作。对于 RTK Query: 用 `samaApi.injectEndpoints()`。

---

*最后更新: 2026-06-13*

### Phase 4.3 新增文件

| # | 文件 | 类型 | 说明 |
|---|------|------|------|
| 1 | `src/lib/observability/perfMonitor.ts` | 性能监控 | 屏幕加载耗时、API 调用耗时追踪。慢查询即时发送 Sentry transaction，其他批量 buffer 后 flush |
| 2 | `src/lib/observability/usageStats.ts` | 使用统计 | MMKV 持久化计数器，每分钟自动 flush 到 Sentry captureMessage，支持 increment/get/reset |
| 3 | `src/lib/abtest/abTestService.ts` | A/B 测试 | 基于 user_id hash 的确定性分组，MMKV 存储分配结果，trackExposure/trackConversion 埋点 |

#### 使用示例

```typescript
// 性能监控
import { perfMonitor } from '@/lib/observability/perfMonitor';
perfMonitor.startScreenLoad('ChatList');
// ... 渲染完成
perfMonitor.endScreenLoad('ChatList');

// A/B 测试
import { abTestService } from '@/lib/abtest/abTestService';
abTestService.init('user_abc123');
const variant = abTestService.getVariant('new_chat_ui');

// 使用统计
import { usageStats } from '@/lib/observability/usageStats';
usageStats.start();
usageStats.increment('message_sent');
usageStats.increment('call_minutes', 3);
```
