/**
 * Offline Queue Service (Phase B.2)
 *
 * MMKV-persisted queue for messages that failed to send or were queued while offline.
 * Wraps messageCache.getPendingMessages() / trackPending() / untrackPending() with:
 *   - Auto-flush on socket connect event
 *   - Exponential backoff retry (3 attempts max, then FAILED)
 *   - Sequential send in createdAt order
 *
 * Key patterns:
 *   offlineQueue.flush() → scans pending index → sends each pending message in order
 *   offlineQueue.init()  → subscribes to socket connect for auto-flush
 *
 * @see file:///Users/porter/Developer/JoyMini_Flutter_App/lib/ui/chat/services/database/local_database_service.dart:172
 * @see file:///Users/porter/Developer/JoyMini_Flutter_App/lib/ui/chat/models/chat_ui_model.dart
 */

import { apolloClient } from '@/lib/apollo';
import { SEND_MESSAGE } from '@/api/operations';
import { messageCache } from '@/services/messageCache';
import { socketService } from '@/services/socketService';
import { MessageStatus } from '@/types/graphql';
import type { CachedMessage } from '@/services/messageCache';

/** Maximum retry attempts before marking as permanently failed */
const MAX_RETRY_COUNT = 3;

/** Base delay for exponential backoff (milliseconds) */
const BASE_RETRY_DELAY = 1000;

/** Cap for exponential backoff delay */
const MAX_RETRY_DELAY = 30000;

/**
 * Compute exponential backoff delay.
 * Retry 0 → 1s, Retry 1 → 2s, Retry 2 → 4s, ... capped at 30s
 */
function getRetryDelay(retryCount: number): number {
  return Math.min(BASE_RETRY_DELAY * Math.pow(2, retryCount), MAX_RETRY_DELAY);
}

// ═════════════════════════════════════════════════════════════════
//  OfflineQueue
// ═════════════════════════════════════════════════════════════════

class OfflineQueue {
  private _unsubConnect: (() => void) | null = null;
  private _flushing = false;

  /**
   * Initialize the offline queue.
   * Subscribes to socket connect event for auto-flush.
   * Safe to call multiple times (only subscribes once).
   */
  init(): void {
    if (this._unsubConnect) return; // already initialized
    this._unsubConnect = socketService.on('connect', () => {
      console.debug('[OfflineQueue] Socket connected — flushing pending messages');
      this.flush();
    });
  }

  /**
   * Tear down socket listener.
   */
  destroy(): void {
    this._unsubConnect?.();
    this._unsubConnect = null;
  }

  /**
   * Flush all pending/failed messages.
   * Sends each message sequentially in createdAt order.
   * Already-sending items are skipped to avoid duplicates.
   */
  async flush(): Promise<void> {
    if (this._flushing) {
      console.debug('[OfflineQueue] Already flushing — skipping');
      return;
    }
    this._flushing = true;

    try {
      const items = messageCache.getPendingMessages();
      if (items.length === 0) {
        return;
      }

      console.debug(`[OfflineQueue] Flushing ${items.length} pending messages`);

      for (const item of items) {
        // Skip if already marked as sending (another flush may be running)
        const current = messageCache.getMessageById(item.id);
        if (!current || current.status === MessageStatus.SENDING) continue;

        await this._sendWithRetry(item);
      }
    } finally {
      this._flushing = false;
    }
  }

  /**
   * Send a single queued message with exponential backoff retry.
   * Returns true if sent successfully, false if permanently failed.
   */
  private async _sendWithRetry(item: CachedMessage): Promise<boolean> {
    let retryCount = 0;

    while (retryCount <= MAX_RETRY_COUNT) {
      // Mark as sending
      item.status = MessageStatus.SENDING;
      messageCache.saveMessage(item);

      try {
        await apolloClient.mutate({
          mutation: SEND_MESSAGE,
          variables: {
            conversationId: item.conversationId,
            content: item.content,
            type: item.type,
            clientTempId: item.clientTempId ?? item.id,
            meta: item.meta ?? undefined,
          },
        });

        // Success — mark as sent and remove from pending index
        item.status = MessageStatus.SENT;
        messageCache.saveMessage(item);
        messageCache.untrackPending(item.id);

        console.debug(`[OfflineQueue] Sent message ${item.id}`);
        return true;
      } catch (error) {
        retryCount++;
        console.warn(
          `[OfflineQueue] Failed to send ${item.id} (attempt ${retryCount}/${MAX_RETRY_COUNT})`,
          error,
        );

        if (retryCount > MAX_RETRY_COUNT) {
          // Permanently failed
          item.status = MessageStatus.FAILED;
          messageCache.saveMessage(item);
          console.warn(`[OfflineQueue] Message ${item.id} permanently failed`);
          return false;
        }

        // Wait before retry (exponential backoff)
        const delay = getRetryDelay(retryCount - 1);
        console.debug(`[OfflineQueue] Retrying ${item.id} in ${delay}ms`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    return false;
  }
}

/** Singleton offline queue instance */
export const offlineQueue = new OfflineQueue();
export default offlineQueue;
