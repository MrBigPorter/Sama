/**
 * Reaction Picker — Horizontal emoji row for message reactions.
 *
 * Displays a scrollable row of emoji reactions (👍❤️😂😮😢🙏).
 * Tapping an emoji calls `onReaction` with that emoji.
 * If the current user already reacted with a given emoji, tapping again
 * removes the reaction (toggle behavior).
 *
 * Usage:
 *   <ReactionPicker
 *     myReactions={myReactions}
 *     onReaction={(emoji) => handleReaction(msgId, emoji)}
 *     onClose={() => setReactingToMessageId(null)}
 *   />
 */
import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Pressable,
} from 'react-native';

const REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

interface Props {
  /** Set of emojis the current user has already reacted with */
  myReactions: Set<string>;
  /** Called with the emoji string when a reaction is tapped */
  onReaction: (emoji: string) => void;
  /** Called when the overlay backdrop is pressed */
  onClose: () => void;
}

export default function ReactionPicker({ myReactions, onReaction, onClose }: Props) {
  return (
    <Pressable style={styles.overlay} onPress={onClose}>
      <View style={styles.container}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {REACTIONS.map((emoji) => {
            const isActive = myReactions.has(emoji);
            return (
              <TouchableOpacity
                key={emoji}
                style={[
                  styles.emojiButton,
                  isActive && styles.emojiButtonActive,
                ]}
                onPress={() => onReaction(emoji)}
                activeOpacity={0.6}
              >
                <Text style={styles.emoji}>{emoji}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.15)',
    zIndex: 100,
  },
  container: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingVertical: 12,
    paddingBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  scrollContent: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    gap: 6,
  },
  emojiButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f5f5f5',
  },
  emojiButtonActive: {
    backgroundColor: '#FFF0E0',
    borderWidth: 2,
    borderColor: '#FF7A00',
  },
  emoji: {
    fontSize: 26,
  },
});
