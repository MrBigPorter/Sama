import React from 'react';
import { Text, StyleSheet } from 'react-native';

interface Props {
  content: string;
  isMe: boolean;
  textColor: string;
}

/**
 * Plain text message bubble.
 * Supports basic emoji rendering via system font.
 */
export default function TextMessageBubble({ content, isMe, textColor }: Props) {
  return (
    <Text style={[styles.text, { color: textColor }]}>
      {content}
    </Text>
  );
}

const styles = StyleSheet.create({
  text: {
    fontSize: 15,
    lineHeight: 20,
  },
});
