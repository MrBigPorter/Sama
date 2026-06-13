/**
 * Reaction Bar — Displays accumulated reactions below a message bubble.
 *
 * Groups reactions by emoji, showing a count for each.
 * Reactions by the current user are highlighted.
 * Tapping a reaction toggles it (add if not present, remove if already present).
 *
 * Usage:
 *   <ReactionBar
 *     reactions={message.reactions ?? []}
 *     currentUserId={currentUserId}
 *     onToggleReaction={(emoji) => handleReaction(message.id, emoji)}
 *   />
 */
import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import type { Reaction } from '@/types/graphql';

interface ReactionSummary {
  emoji: string;
  count: number;
  hasMe: boolean;
}

interface Props {
  /** Raw reactions array from the message */
  reactions: Reaction[];
  /** Current user ID to determine which reactions are "mine" */
  currentUserId?: string;
  /** Called when a reaction is tapped — toggles it */
  onToggleReaction?: (emoji: string) => void;
}

export default function ReactionBar({
  reactions,
  currentUserId,
  onToggleReaction,
}: Props) {
  const summary = useMemo<ReactionSummary[]>(() => {
    const map = new Map<string, ReactionSummary>();
    for (const r of reactions) {
      const existing = map.get(r.emoji);
      if (existing) {
        existing.count++;
        if (r.userId === currentUserId) existing.hasMe = true;
      } else {
        map.set(r.emoji, {
          emoji: r.emoji,
          count: 1,
          hasMe: r.userId === currentUserId,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [reactions, currentUserId]);

  if (summary.length === 0) return null;

  return (
    <View style={styles.container}>
      {summary.map((item) => (
        <TouchableOpacity
          key={item.emoji}
          style={[
            styles.reactionChip,
            item.hasMe && styles.reactionChipActive,
          ]}
          onPress={() => onToggleReaction?.(item.emoji)}
          activeOpacity={0.7}
        >
          <Text style={styles.emoji}>{item.emoji}</Text>
          <Text
            style={[
              styles.count,
              item.hasMe && styles.countActive,
            ]}
          >
            {item.count}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 4,
  },
  reactionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 2,
    gap: 2,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  reactionChipActive: {
    backgroundColor: '#FFF0E0',
    borderColor: '#FF7A00',
  },
  emoji: {
    fontSize: 14,
  },
  count: {
    fontSize: 11,
    color: '#666',
    fontWeight: '600',
    minWidth: 10,
    textAlign: 'center',
  },
  countActive: {
    color: '#FF7A00',
  },
});
