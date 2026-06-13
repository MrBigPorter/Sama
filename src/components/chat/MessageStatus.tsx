import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { MessageStatus as MsgStatus } from '@/types/graphql';

interface Props {
  status?: MsgStatus;
  isMe: boolean;
  failedColor?: string;
}

/**
 * Small status indicator shown below sent messages.
 *   SENDING  → spinner
 *   SENT     → single check
 *   READ     → double check
 *   FAILED   → red "!" text
 *   undefined / null → nothing rendered
 */
export default function MessageStatus({
  status,
  isMe,
  failedColor = '#FF3B30',
}: Props) {
  if (!isMe || !status) return null;

  switch (status) {
    case MsgStatus.SENDING:
      return (
        <View style={styles.container}>
          <ActivityIndicator size={10} color="#999" />
        </View>
      );
    case MsgStatus.SENT:
      return (
        <View style={styles.container}>
          <Text style={styles.check}>✓</Text>
        </View>
      );
    case MsgStatus.READ:
      return (
        <View style={styles.container}>
          <Text style={[styles.check, styles.readCheck]}>✓✓</Text>
        </View>
      );
    case MsgStatus.FAILED:
      return (
        <View style={styles.container}>
          <Text style={[styles.failed, { color: failedColor }]}>!</Text>
        </View>
      );
    default:
      return null;
  }
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 4,
  },
  check: {
    fontSize: 10,
    color: '#999',
  },
  readCheck: {
    color: '#34C759',
    fontSize: 9,
  },
  failed: {
    fontSize: 11,
    fontWeight: '700',
  },
});
