/**
 * Unified message bubble with long-press context menu, reply preview, and reactions.
 *
 * Dispatches to the correct sub-bubble based on `message.type`.
 * Supports:
 *   - Long-press → context menu (handled via onLongPress callback)
 *   - Reply preview bar when message has replyTo in meta
 *   - ReactionBar below the content
 *   - Recalled message overlay
 *   - System messages (full-width, centered)
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import type { Message } from '@/types/graphql';
import { parseMeta, canRecall } from './chatTypes';
import MessageStatus from './MessageStatus';
import ReactionBar from './ReactionBar';
import TextMessageBubble from './bubbles/TextMessageBubble';
import ImageMessageBubble from './bubbles/ImageMessageBubble';
import AudioMessageBubble from './bubbles/AudioMessageBubble';
import VideoMessageBubble from './bubbles/VideoMessageBubble';
import FileMessageBubble from './bubbles/FileMessageBubble';
import LocationMessageBubble from './bubbles/LocationMessageBubble';
import SystemMessageBubble from './bubbles/SystemMessageBubble';
import RecalledMessageBubble from './bubbles/RecalledMessageBubble';

interface Props {
  message: Message;
  isMe: boolean;
  currentUserId?: string;
  colors: Record<string, string>;
  /** Called when a non-text media message is tapped */
  onMediaPress?: (message: Message) => void;
  /** Called on long-press to show context menu */
  onLongPress?: (message: Message) => void;
  /** Called when a reaction emoji is toggled */
  onReaction?: (messageId: string, emoji: string) => void;
  /** Called when a reply preview is tapped — scrolls to the referenced message */
  onReplyPress?: (messageId: string) => void;
}

/** Format ISO date → short time string (e.g. "10:30 AM") */
function formatTime(isoDate: string): string {
  const d = new Date(isoDate);
  return d.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Unified message bubble dispatcher.
 *
 * Renders the correct bubble component based on `message.type`:
 *   0  = TEXT
 *   1  = IMAGE
 *   2  = AUDIO
 *   3  = VIDEO
 *   4  = FILE
 *   5  = LOCATION
 *   99 = SYSTEM
 *
 * Also handles:
 *   - Recalled message display (overrides type when recalledAt is set)
 *   - Reply preview bar when meta.replyTo is present
 *   - ReactionBar below the content
 *   - Long-press context menu trigger
 *   - Message status indicator (sending/sent/failed/read)
 *   - Timestamp display
 */
export default function MessageBubble({
  message,
  isMe,
  currentUserId,
  colors,
  onMediaPress,
  onLongPress,
  onReaction,
  onReplyPress,
}: Props) {
  const meta = parseMeta(message);
  const canRecallMsg = canRecall(message, currentUserId);
  const replyTo = meta?.replyTo;

  // ── Content color ──────────────────────────────────────────────
  const textColor = isMe ? '#fff' : colors.textPrimary || '#000';

  // ── Background color ───────────────────────────────────────────
  const bgColor = isMe
    ? colors.utilityBrand500 || '#FF7A00'
    : colors.bgSecondary || '#f0f0f0';

  // ── System messages are full-width, centered ───────────────────
  if (message.type === 99) {
    return <SystemMessageBubble content={message.content} />;
  }

  // ── Recalled messages ──────────────────────────────────────────
  if (message.recalledAt) {
    return <RecalledMessageBubble isMe={isMe} />;
  }

  // ── Render appropriate bubble ─────────────────────────────────
  const renderContent = () => {
    switch (message.type) {
      case 0: // TEXT
        return (
          <TextMessageBubble
            content={message.content}
            isMe={isMe}
            textColor={textColor}
          />
        );
      case 1: // IMAGE
        return (
          <ImageMessageBubble
            content={message.content}
            meta={meta}
            isMe={isMe}
            onPress={() => onMediaPress?.(message)}
          />
        );
      case 2: // AUDIO
        return (
          <AudioMessageBubble
            content={message.content}
            meta={meta}
            isMe={isMe}
            textColor={textColor}
          />
        );
      case 3: // VIDEO
        return (
          <VideoMessageBubble
            content={message.content}
            meta={meta}
            isMe={isMe}
            onPress={() => onMediaPress?.(message)}
          />
        );
      case 4: // FILE
        return (
          <FileMessageBubble
            content={message.content}
            meta={meta}
            isMe={isMe}
            textColor={textColor}
            accentColor={colors.utilityBrand500 || '#FF7A00'}
            onPress={() => onMediaPress?.(message)}
          />
        );
      case 5: // LOCATION
        return (
          <LocationMessageBubble
            meta={meta}
            isMe={isMe}
            textColor={textColor}
            accentColor={isMe ? colors.utilityBrand500 || '#FF7A00' : colors.bgSecondary || '#f0f0f0'}
          />
        );
      default:
        return (
          <TextMessageBubble
            content={message.content}
            isMe={isMe}
            textColor={textColor}
          />
        );
    }
  };

  // ── Reply preview bar ─────────────────────────────────────────
  const renderReplyPreview = () => {
    if (!replyTo) return null;
    return (
      <TouchableOpacity
        style={styles.replyPreview}
        onPress={() => onReplyPress?.(replyTo.messageId)}
        activeOpacity={0.7}
      >
        <View style={[styles.replyBar, { backgroundColor: isMe ? 'rgba(255,255,255,0.25)' : '#ddd' }]} />
        <View style={styles.replyContent}>
          <Text
            style={[styles.replySender, { color: isMe ? 'rgba(255,255,255,0.9)' : colors.utilityBrand500 || '#FF7A00' }]}
            numberOfLines={1}
          >
            {replyTo.senderName || 'Reply'}
          </Text>
          <Text
            style={[styles.replyText, { color: isMe ? 'rgba(255,255,255,0.6)' : colors.textTertiary || '#999' }]}
            numberOfLines={1}
          >
            {replyTo.content}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  // ── Timestamp ──────────────────────────────────────────────────
  const showTime = () => (
    <Text style={[styles.time, { color: isMe ? 'rgba(255,255,255,0.7)' : colors.textTertiary || '#999' }]}>
      {formatTime(message.createdAt)}
    </Text>
  );

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onLongPress={() => onLongPress?.(message)}
      delayLongPress={500}
      style={[
        styles.bubble,
        isMe ? styles.myBubble : styles.theirBubble,
        { backgroundColor: bgColor, marginBottom: 8 },
      ]}
    >
      {/* Reply preview (shown above the main content) */}
      {renderReplyPreview()}

      {/* Message content */}
      {renderContent()}

      {/* Reactions bar */}
      {message.reactions && message.reactions.length > 0 && (
        <ReactionBar
          reactions={message.reactions}
          currentUserId={currentUserId}
          onToggleReaction={(emoji) => onReaction?.(message.id, emoji)}
        />
      )}

      {/* Footer: timestamp + status */}
      <View style={styles.footer}>
        {showTime()}
        <MessageStatus status={message.status} isMe={isMe} />
      </View>

      {/* Recall hint for messages still in the 2-min window */}
      {canRecallMsg && (
        <Text style={[styles.recallHint, { color: isMe ? 'rgba(255,255,255,0.5)' : '#999' }]}>
          Tap & hold to recall
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  bubble: {
    maxWidth: '75%',
    padding: 10,
    borderRadius: 12,
  },
  myBubble: {
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  theirBubble: {
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  time: {
    fontSize: 10,
  },
  recallHint: {
    fontSize: 9,
    fontStyle: 'italic',
    marginTop: 2,
  },
  replyPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  replyBar: {
    width: 3,
    height: '100%',
    borderRadius: 2,
    marginRight: 8,
  },
  replyContent: {
    flex: 1,
  },
  replySender: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 1,
  },
  replyText: {
    fontSize: 11,
  },
});
