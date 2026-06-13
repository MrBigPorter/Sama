import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface Props {
  isMe: boolean;
}

/**
 * Recalled message placeholder.
 * Shows "You recalled a message" or "{name} recalled a message".
 */
export default function RecalledMessageBubble({ isMe }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.icon}>🚫</Text>
      <Text style={styles.text}>
        {isMe ? 'You recalled a message' : 'Message recalled'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  icon: {
    fontSize: 12,
  },
  text: {
    fontSize: 12,
    fontStyle: 'italic',
    color: '#999',
  },
});
