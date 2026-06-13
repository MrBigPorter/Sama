/**
 * Message Cache Service (Phase B.1)
 *
 * MMKV-based local message persistence.
 * Modeled after JoyMini Flutter's LocalDatabaseService pattern:
 *   - Each message stored individually as serialized JSON
 *   - Per-conversation message ID index for ordered listing
 *   - Per-conversation metadata (lastSeqId, unreadCount, etc.)
 *   - Merge-on-write strategy preserves local assets (localPath, meta)
 *
 * Key patterns:
 *   cache:msg:{msgId}        → JSON string of CachedMessage
 *   cache:idx:{convId}       → JSON string array of message IDs (sorted by createdAt DESC)
 *   cache:conv:{convId}:meta → JSON string of ConversationMeta
 *
 * @see file:///Users/porter/Developer/JoyMini_Flutter_App/lib/ui/chat/services/database/local_database_service.dart
 * @see file:///Users/porter/Developer/JoyMini_Flutter_App/lib/ui/chat/models/chat_ui_model.dart
 */

import { storage } from '@/lib/storage';
import type { Message } from '@/types/graphql';
import { MessageStatus } from '@/types/graphql';

// ═════════════════════════════════════════════════════════════════
//  Types
// ═════════════════════════════════════════════════════════════════

/** Extended message shape stored locally (superset of GraphQL Message) */
export interface CachedMessage {
  id: string;
  seqId?: number | null;
  conversationId: string;
  senderId: string;
  content: string;
  type: number;
  clientTempId?: string | null;
  /** JSON-serialized MessageMeta */
  meta?: string | null;
  createdAt: string;
  recalledAt?: string | null;
  deletedAt?: string | null;
  /** Client-side sending status */
  status?: MessageStatus;
  /** Whether this message has been locally recalled (type changed to recalled) */
  isRecalled?: boolean;
  /** Local file path (for media messages) */
  localPath?: string;
  /** Resolved remote URL */
  resolvedPath?: string;
  /** Resolved thumbnail URL */
  resolvedThumbPath?: string;
  /** Audio/Video duration in seconds */
  duration?: number;
}

/** Per-conversation metadata stored in MMKV */
export interface ConversationMeta {
  id: string;
  lastSeqId?: number | null;
  lastSeqIdRead?: number | null;
  unreadCount: number;
  lastMsgContent?: string | null;
  lastMsgTime?: string | null;
  lastMsgType?: number | null;
}

// ═════════════════════════════════════════════════════════════════
//  Constants
// ═════════════════════════════════════════════════════════════════

const KEY_PREFIX_MSG = 'cache:msg:';
const KEY_PREFIX_IDX = 'cache:idx:';
const KEY_PREFIX_CONV_META = 'cache:conv:meta:';
const MAX_MESSAGES_PER_CONV = 200;

// ═════════════════════════════════════════════════════════════════
//  Helpers
// ═════════════════════════════════════════════════════════════════

function msgKey(msgId: string): string {
  return `${KEY_PREFIX_MSG}${msgId}`;
}

function idxKey(convId: string): string {
  return `${KEY_PREFIX_IDX}${convId}`;
}

function convMetaKey(convId: string): string {
  return `${KEY_PREFIX_CONV_META}${convId}`;
}

/** Safely parse JSON from MMKV, returning fallback on failure */
function safeJsonParse<T>(raw: string | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

// ═════════════════════════════════════════════════════════════════
//  Internal helpers
// ═════════════════════════════════════════════════════════════════

/** Get the sorted message ID list for a conversation (DESC by createdAt) */
function getMessageIds(conversationId: string): string[] {
  const raw = storage.getString(idxKey(conversationId));
  return safeJsonParse<string[]>(raw, []);
}

/** Save the sorted message ID list */
function setMessageIds(conversationId: string, ids: string[]): void {
  storage.set(idxKey(conversationId), JSON.stringify(ids));
}

// ═════════════════════════════════════════════════════════════════
//  Public API — modeled after LocalDatabaseService
// ═════════════════════════════════════════════════════════════════

export const messageCache = {
  // ─── Single Message ──────────────────────────────────────────

  /**
   * Save or update a single message.
   * Uses merge-if-exists strategy to protect local assets.
   *
   * @see LocalDatabaseService.handleIncomingMessage()
   */
  saveMessage(msg: CachedMessage): void {
    const existing = this.getMessageById(msg.id);
    const merged = existing ? mergeMessageData(existing, msg) : msg;

    // Write message data
    storage.set(msgKey(msg.id), JSON.stringify(merged));

    // Update conversation index (only for non-recalled, non-deleted)
    if (!merged.isRecalled && !merged.deletedAt) {
      this._addToIndex(merged.conversationId, merged.id, merged.createdAt);
    }

    // Update conversation meta
    this._updateConvMetaOnNewMsg(merged);
  },

  /**
   * Batch save messages (e.g., from pagination or socket batch).
   *
   * @see LocalDatabaseService.saveMessages()
   */
  saveMessages(msgs: CachedMessage[]): void {
    if (msgs.length === 0) return;

    for (const msg of msgs) {
      const existing = this.getMessageById(msg.id);
      const merged = existing ? mergeMessageData(existing, msg) : msg;

      storage.set(msgKey(msg.id), JSON.stringify(merged));

      if (!merged.isRecalled && !merged.deletedAt) {
        this._addToIndex(merged.conversationId, merged.id, merged.createdAt);
      }
    }

    // Update conversation meta from most recent message
    const sorted = [...msgs].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    if (sorted.length > 0) {
      this._updateConvMetaOnNewMsg(sorted[0]);
    }
  },

  /**
   * Get a single message by ID.
   */
  getMessageById(msgId: string): CachedMessage | null {
    const raw = storage.getString(msgKey(msgId));
    if (!raw) return null;
    try {
      return JSON.parse(raw) as CachedMessage;
    } catch {
      return null;
    }
  },

  /**
   * Get cached messages for a conversation, paginated.
   *
   * @see LocalDatabaseService.getHistoryMessages()
   */
  getMessages(
    conversationId: string,
    options?: { offset?: number; limit?: number }
  ): CachedMessage[] {
    const ids = getMessageIds(conversationId);
    const offset = options?.offset ?? 0;
    const limit = options?.limit ?? 50;

    const slice = ids.slice(offset, offset + limit);
    const results: CachedMessage[] = [];

    for (const id of slice) {
      const msg = this.getMessageById(id);
      if (msg) results.push(msg);
    }

    return results;
  },

  /**
   * Get the maximum seqId for a conversation.
   *
   * @see LocalDatabaseService.getMaxSeqId()
   */
  getMaxSeqId(conversationId: string): number | null {
    const ids = getMessageIds(conversationId);
    let maxSeqId: number | null = null;

    for (const id of ids) {
      const msg = this.getMessageById(id);
      if (msg?.seqId != null) {
        if (maxSeqId == null || msg.seqId > maxSeqId) {
          maxSeqId = msg.seqId;
        }
      }
    }

    return maxSeqId;
  },

  /**
   * Delete a single message.
   */
  deleteMessage(msgId: string): void {
    const msg = this.getMessageById(msgId);
    if (msg) {
      this._removeFromIndex(msg.conversationId, msgId);
    }
    storage.remove(msgKey(msgId));
  },

  /**
   * Clear all messages for a conversation.
   *
   * @see LocalDatabaseService.clearMessagesByConversation()
   */
  clearConversationMessages(conversationId: string): void {
    const ids = getMessageIds(conversationId);
    for (const id of ids) {
      storage.remove(msgKey(id));
    }
    storage.remove(idxKey(conversationId));
    storage.remove(convMetaKey(conversationId));
  },

  // ─── Conversation Meta ──────────────────────────────────────

  /**
   * Get conversation metadata.
   */
  getConversationMeta(conversationId: string): ConversationMeta | null {
    const raw = storage.getString(convMetaKey(conversationId));
    if (!raw) return null;
    try {
      return JSON.parse(raw) as ConversationMeta;
    } catch {
      return null;
    }
  },

  /**
   * Update conversation metadata fields.
   */
  updateConversationMeta(
    conversationId: string,
    updates: Partial<ConversationMeta>
  ): void {
    const existing = this.getConversationMeta(conversationId) ?? {
      id: conversationId,
      unreadCount: 0,
    };
    const merged: ConversationMeta = { ...existing, ...updates };
    storage.set(convMetaKey(conversationId), JSON.stringify(merged));
  },

  /**
   * Increment unread count for a conversation.
   */
  incrementUnread(conversationId: string): void {
    const meta = this.getConversationMeta(conversationId);
    const count = (meta?.unreadCount ?? 0) + 1;
    this.updateConversationMeta(conversationId, { unreadCount: count });
  },

  /**
   * Reset unread count to zero.
   *
   * @see LocalDatabaseService.clearUnreadCount()
   */
  resetUnread(conversationId: string): void {
    this.updateConversationMeta(conversationId, { unreadCount: 0 });
  },

  /**
   * Mark messages as read up to a given seqId.
   * Updates status field for eligible messages.
   *
   * @see LocalDatabaseService.markMessagesAsRead()
   */
  markMessagesAsRead(conversationId: string, maxSeqId: number): void {
    const ids = getMessageIds(conversationId);
    for (const id of ids) {
      const msg = this.getMessageById(id);
      if (
        msg &&
        msg.seqId != null &&
        msg.seqId <= maxSeqId &&
        msg.status !== MessageStatus.READ
      ) {
        msg.status = MessageStatus.READ;
        storage.set(msgKey(id), JSON.stringify(msg));
      }
    }
    this.updateConversationMeta(conversationId, {
      unreadCount: 0,
      lastSeqIdRead: maxSeqId,
    });
  },

  /**
   * Get all pending or failed messages (offline queue).
   *
   * @see LocalDatabaseService.getPendingMessages()
   */
  getPendingMessages(): CachedMessage[] {
    // Since MMKV doesn't support queries, scan all msg keys
    // This is fine for offline queue size (typically < 50 items)
    // In production, maintain a separate index of pending IDs
    const pending: CachedMessage[] = [];
    const prefixLen = KEY_PREFIX_MSG.length;

    // We can't enumerate MMKV keys directly, so maintain a pending index
    const pendingIds = safeJsonParse<string[]>(
      storage.getString('cache:pending:ids'),
      []
    );

    for (const id of pendingIds) {
      const msg = this.getMessageById(id);
      if (
        msg &&
        (msg.status === MessageStatus.SENDING || msg.status === MessageStatus.FAILED)
      ) {
        pending.push(msg);
      }
    }

    // Sort by createdAt ascending
    pending.sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    return pending;
  },

  /**
   * Track a message ID in the pending index.
   */
  trackPending(msgId: string): void {
    const pendingIds = safeJsonParse<string[]>(
      storage.getString('cache:pending:ids'),
      []
    );
    if (!pendingIds.includes(msgId)) {
      pendingIds.push(msgId);
      storage.set('cache:pending:ids', JSON.stringify(pendingIds));
    }
  },

  /**
   * Remove a message ID from the pending index.
   */
  untrackPending(msgId: string): void {
    const pendingIds = safeJsonParse<string[]>(
      storage.getString('cache:pending:ids'),
      []
    );
    const filtered = pendingIds.filter((id) => id !== msgId);
    storage.set('cache:pending:ids', JSON.stringify(filtered));
  },

  /**
   * Get all cached conversation IDs.
   */
  getAllConversationIds(): string[] {
    // We maintain a separate index of active conversation IDs
    return safeJsonParse<string[]>(
      storage.getString('cache:conv:ids'),
      []
    );
  },

  /**
   * Track a conversation ID.
   */
  trackConversation(convId: string): void {
    const ids = this.getAllConversationIds();
    if (!ids.includes(convId)) {
      ids.push(convId);
      storage.set('cache:conv:ids', JSON.stringify(ids));
    }
  },

  /**
   * Remove a conversation ID from tracking.
   */
  untrackConversation(convId: string): void {
    const ids = this.getAllConversationIds().filter((id) => id !== convId);
    storage.set('cache:conv:ids', JSON.stringify(ids));
  },

  /**
   * Convert a GraphQL Message to CachedMessage.
   */
  fromGraphQL(msg: Message, status?: MessageStatus): CachedMessage {
    return {
      id: msg.id,
      seqId: msg.seqId,
      conversationId: msg.conversationId,
      senderId: msg.senderId,
      content: msg.content,
      type: msg.type,
      clientTempId: msg.clientTempId,
      meta: msg.meta,
      createdAt: msg.createdAt,
      recalledAt: msg.recalledAt,
      deletedAt: msg.deletedAt,
      status: status ?? (msg.status ?? MessageStatus.SENT),
      isRecalled: msg.recalledAt != null,
    };
  },

  /**
   * Check if a conversation has cached data.
   */
  hasConversation(conversationId: string): boolean {
    const raw = storage.getString(idxKey(conversationId));
    return raw != null && raw.length > 2; // at least "[]"
  },

  // ─── Private helpers ─────────────────────────────────────────

  /** Add a message ID to the conversation's sorted index */
  _addToIndex(conversationId: string, msgId: string, createdAt: string): void {
    const ids = getMessageIds(conversationId);

    // Deduplicate
    if (ids.includes(msgId)) {
      // Update position if re-added (e.g., createdAt changed)
      const idx = ids.indexOf(msgId);
      ids.splice(idx, 1);
    }

    // Insert in DESC order (newest first)
    const ts = new Date(createdAt).getTime();
    let inserted = false;
    for (let i = 0; i < ids.length; i++) {
      const existing = this.getMessageById(ids[i]);
      if (existing && new Date(existing.createdAt).getTime() < ts) {
        ids.splice(i, 0, msgId);
        inserted = true;
        break;
      }
    }
    if (!inserted) ids.push(msgId);

    // Enforce max limit (trim oldest)
    while (ids.length > MAX_MESSAGES_PER_CONV) {
      const removed = ids.pop();
      if (removed) storage.remove(msgKey(removed));
    }

    setMessageIds(conversationId, ids);
  },

  /** Remove a message ID from the conversation's index */
  _removeFromIndex(conversationId: string, msgId: string): void {
    const ids = getMessageIds(conversationId).filter((id) => id !== msgId);
    setMessageIds(conversationId, ids);
  },

  /** Update conversation meta when a new message arrives */
  _updateConvMetaOnNewMsg(msg: CachedMessage): void {
    const meta = this.getConversationMeta(msg.conversationId) ?? {
      id: msg.conversationId,
      unreadCount: 0,
    };

    // Only update last message info if this message is newer
    if (
      !meta.lastMsgTime ||
      new Date(msg.createdAt).getTime() > new Date(meta.lastMsgTime).getTime()
    ) {
      meta.lastMsgContent = msg.content;
      meta.lastMsgTime = msg.createdAt;
      meta.lastMsgType = msg.type;
    }

    // Update max seqId
    if (msg.seqId != null) {
      if (meta.lastSeqId == null || msg.seqId > meta.lastSeqId) {
        meta.lastSeqId = msg.seqId;
      }
    }

    storage.set(convMetaKey(msg.conversationId), JSON.stringify(meta));
  },
};

// ═════════════════════════════════════════════════════════════════
//  Merge Strategy
// ═════════════════════════════════════════════════════════════════

/**
 * Merge existing cached data with incoming server data.
 * Preserves local assets that the server doesn't know about.
 *
 * @see LocalDatabaseService._mergeMessageData()
 * @see ChatUiModel.merge()
 */
function mergeMessageData(
  existing: CachedMessage,
  incoming: CachedMessage
): CachedMessage {
  return {
    // Identity — always trust incoming
    id: incoming.id,
    conversationId: incoming.conversationId,
    senderId: incoming.senderId,

    // Content — trust server if non-empty
    type: incoming.type,
    content: incoming.content || existing.content,
    seqId: incoming.seqId ?? existing.seqId,
    createdAt: incoming.createdAt || existing.createdAt,

    // ClientTempId — trust incoming
    clientTempId: incoming.clientTempId ?? existing.clientTempId,

    // Meta — deep merge (preserve local fields)
    meta: mergeMeta(existing.meta, incoming.meta),

    // Timestamps — trust server for authoritative state
    recalledAt: incoming.recalledAt ?? existing.recalledAt,
    deletedAt: incoming.deletedAt ?? existing.deletedAt,

    // ── Local-only fields (server doesn't provide these) ──

    // Status: upgrade from sending→sent→read, never downgrade
    status: promoteStatus(existing.status, incoming.status),

    // isRecalled: trust incoming if set
    isRecalled: incoming.isRecalled ?? existing.isRecalled ?? false,

    // Local assets: protect from being overwritten by server nulls
    localPath: incoming.localPath || existing.localPath || undefined,
    resolvedPath: incoming.resolvedPath || existing.resolvedPath || undefined,
    resolvedThumbPath:
      incoming.resolvedThumbPath || existing.resolvedThumbPath || undefined,

    // Duration: trust incoming if set
    duration: incoming.duration ?? existing.duration,
  };
}

/**
 * Merge meta JSON strings (deep merge).
 * Prevents server empty meta from wiping local meta.
 */
function mergeMeta(
  existingMeta: string | null | undefined,
  incomingMeta: string | null | undefined
): string | null | undefined {
  if (!incomingMeta && existingMeta) return existingMeta;
  if (!existingMeta && !incomingMeta) return null;

  try {
    const existing = existingMeta ? JSON.parse(existingMeta) : {};
    const incoming = incomingMeta ? JSON.parse(incomingMeta) : {};
    const merged = { ...existing, ...incoming };
    return Object.keys(merged).length > 0 ? JSON.stringify(merged) : null;
  } catch {
    return incomingMeta ?? existingMeta;
  }
}

/**
 * Status promotion: sending → sent → read (one-way).
 */
function promoteStatus(
  existing?: MessageStatus,
  incoming?: MessageStatus
): MessageStatus | undefined {
  if (!existing) return incoming;
  if (!incoming) return existing;

  const order: Record<MessageStatus, number> = {
    [MessageStatus.SENDING]: 0,
    [MessageStatus.SENT]: 1,
    [MessageStatus.FAILED]: 0, // failed can be retried
    [MessageStatus.READ]: 2,
  };

  return (order[incoming] ?? 0) >= (order[existing] ?? 0)
    ? incoming
    : existing;
}

export default messageCache;
