import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface Props {
  content: string;
}

/**
 * System message — centered, muted text (e.g. "Alice joined the group",
 * "Chat history is clear", etc.).
 */
export default function SystemMessageBubble({ content }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.badge}>
        <Text style={styles.text}>{content}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginVertical: 8,
  },
  badge: {
    backgroundColor: 'rgba(0,0,0,0.06)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  text: {
    fontSize: 12,
    color: '#888',
    textAlign: 'center',
  },
});
