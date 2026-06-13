/**
 * seqId Sync Service (Phase B.3)
 *
 * Monitors seqId continuity to detect message gaps and fills them.
 * Also handles read status synchronization when partnerLastReadSeqId advances.
 *
 * Key patterns:
 *   checkGap(convId, incomingSeqId)  → detects gaps and triggers fillGap
 *   fillGap(convId, fromSeqId, toSeqId) → fetches missing messages via MESSAGES query
 *   applyReadStatus(convId, partnerLastReadSeqId) → marks local messages as read
 *
 * @see file:///Users/porter/Developer/JoyMini_Flutter_App/lib/ui/chat/services/chat_sync_manager.dart
 */

import { apolloClient } from '@/lib/apollo';
import { MESSAGES } from '@/api/operations';
import { messageCache } from '@/services/messageCache';
import { MessageStatus } from '@/types/graphql';
import type { CachedMessage } from '@/services/messageCache';
import type { MessagesResult, Message } from '@/types/graphql';

// ═════════════════════════════════════════════════════════════════
//  SyncService
// ═════════════════════════════════════════════════════════════════

class SyncService {
  /**
   * Check seqId continuity for an incoming message.
   * If a gap is detected, trigger fillGap to fetch missing messages.
   *
   * @param conversationId - The conversation to check
   * @param incomingSeqId  - The seqId of the newly arrived message
   * @returns true if a gap was detected and filled (or attempted)
   */
  async checkGap(conversationId: string, incomingSeqId: number): Promise<boolean> {
    const meta = messageCache.getConversationMeta(conversationId);

    // No cached data yet — first message, no gap possible
    if (!meta || meta.lastSeqId == null) {
      return false;
    }

    const lastSeqId = meta.lastSeqId;

    // Normal case: seqId is exactly the next in sequence
    if (incomingSeqId === lastSeqId + 1) {
      return false;
    }

    // Duplicate or out-of-order: seqId <= lastSeqId
    if (incomingSeqId <= lastSeqId) {
      console.debug(
        `[SyncService] Duplicate/out-of-order seqId ${incomingSeqId} <= ${lastSeqId} — skipping`,
      );
      return false;
    }

    // Gap detected: incomingSeqId > lastSeqId + 1
    const fromSeqId = lastSeqId + 1;
    const toSeqId = incomingSeqId - 1;
    console.warn(
      `[SyncService] Gap detected in ${conversationId}: seqId ${fromSeqId}–${toSeqId} missing (lastSeqId=${lastSeqId}, incoming=${incomingSeqId})`,
    );

    await this.fillGap(conversationId, fromSeqId, toSeqId);
    return true;
  }

  /**
   * Fill a seqId gap by fetching missing messages from the server.
   *
   * MVP approach: fetches the most recent messages before the gap using
   * cursor-based pagination, then filters by seqId range and saves to cache.
   *
   * @param conversationId - The conversation to fill
   * @param fromSeqId       - Start of gap (inclusive)
   * @param toSeqId         - End of gap (inclusive)
   */
  async fillGap(
    conversationId: string,
    fromSeqId: number,
    toSeqId: number,
  ): Promise<CachedMessage[]> {
    const filled: CachedMessage[] = [];
    let cursor: string | null = null;
    let hasMore = true;
    const pageSize = 50;

    try {
      while (hasMore) {
        const result: any = await apolloClient.query({
          query: MESSAGES,
          variables: {
            conversationId,
            cursor,
            limit: pageSize,
          },
          fetchPolicy: 'network-only',
        });
        const data: { messages: MessagesResult } | undefined = result.data;

        if (!data?.messages?.items) break;

        for (const msg of data.messages.items) {
          // Filter messages within the seqId range
          if (msg.seqId != null && msg.seqId >= fromSeqId && msg.seqId <= toSeqId) {
            const cached = messageCache.fromGraphQL(msg, MessageStatus.SENT);
            filled.push(cached);
          }
        }

        hasMore = data.messages.hasMore ?? false;
        cursor = data.messages.nextCursor ?? null;

        // Safety limit: prevent infinite loop if server misbehaves
        if (filled.length > 200) break;
      }

      // Save all gap-filled messages to cache
      if (filled.length > 0) {
        messageCache.saveMessages(filled);
        console.debug(
          `[SyncService] Gap filled: ${filled.length} messages saved for ${conversationId}`,
        );
      } else {
        console.debug(
          `[SyncService] No gap messages found for ${conversationId} seqId ${fromSeqId}–${toSeqId}`,
        );
      }
    } catch (error) {
      console.error(`[SyncService] fillGap failed for ${conversationId}:`, error);
    }

    return filled;
  }

  /**
   * Apply read status based on partner's last read seqId.
   * Marks all cached messages with seqId <= partnerLastReadSeqId as READ.
   *
   * @see file:///Users/porter/Developer/JoyMini_Flutter_App/lib/ui/chat/services/chat_sync_manager.dart:81
   *
   * @param conversationId          - The conversation to update
   * @param partnerLastReadSeqId    - The seqId up to which partner has read
   */
  applyReadStatus(conversationId: string, partnerLastReadSeqId: number): void {
    const meta = messageCache.getConversationMeta(conversationId);

    // Skip if we've already processed this or higher seqId
    if (meta?.lastSeqIdRead != null && partnerLastReadSeqId <= meta.lastSeqIdRead) {
      return;
    }

    console.debug(
      `[SyncService] Applying read status for ${conversationId}: partner read up to seqId ${partnerLastReadSeqId}`,
    );

    messageCache.markMessagesAsRead(conversationId, partnerLastReadSeqId);
  }
}

/** Singleton sync service instance */
export const syncService = new SyncService();
export default syncService;
