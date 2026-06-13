/**
 * Shared types and helpers for chat components.
 */
import type { Message, MessageMeta } from '@/types/graphql';

/**
 * Parse the `meta` JSON string on a Message into a structured object.
 * Returns `null` if meta is undefined, null, or unparseable.
 */
export function parseMeta(msg: Message): MessageMeta | null {
  if (!msg.meta) return null;
  try {
    return JSON.parse(msg.meta) as MessageMeta;
  } catch {
    return null;
  }
}

/**
 * Determine whether the current user can still recall a message
 * (within 2 minutes of sending).
 */
export function canRecall(msg: Message, currentUserId?: string): boolean {
  if (!currentUserId) return false;
  if (msg.senderId !== currentUserId) return false;
  if (msg.recalledAt) return false;
  if (msg.deletedAt) return false;
  const created = new Date(msg.createdAt).getTime();
  const now = Date.now();
  return now - created < 2 * 60 * 1000; // 2 minutes
}

/**
 * Generate a short preview text for a message based on its type.
 * Used in conversation list items and push notifications.
 */
export function getPreviewText(msg: Pick<Message, 'type' | 'content'>): string {
  switch (msg.type) {
    case 0: // TEXT
      return msg.content;
    case 1: // IMAGE
      return '[Image]';
    case 2: // AUDIO
      return '[Voice message]';
    case 3: // VIDEO
      return '[Video]';
    case 4: // FILE
      return '[File]';
    case 5: // LOCATION
      return '[Location]';
    case 99: // SYSTEM
      return msg.content;
    default:
      return msg.content;
  }
}
