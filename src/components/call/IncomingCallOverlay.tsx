/**
 * IncomingCallOverlay — Full-screen incoming call notification.
 *
 * Displays when a call_invite socket event is received.
 * Allows user to accept (audio/video) or reject the call.
 */
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation } from '@apollo/client/react';
import { REQUEST_LIVEKIT_TOKEN } from '@/api/operations';
import { useLiveKit } from '@/lib/hooks/useLiveKit';
import type { LiveKitTokenResponse } from '@/types/graphql';

interface IncomingCallOverlayProps {
  sessionId: string;
  senderId: string;
  mediaType: 'audio' | 'video';
  onAccept: () => void;
  onReject: () => void;
}

export default function IncomingCallOverlay({
  sessionId,
  senderId,
  mediaType,
  onAccept,
  onReject,
}: IncomingCallOverlayProps) {
  const insets = useSafeAreaInsets();
  const { acceptCall, rejectCall } = useLiveKit();
  const [requestToken] = useMutation<{ requestLiveKitToken: LiveKitTokenResponse }>(REQUEST_LIVEKIT_TOKEN);

  const handleAccept = async () => {
    try {
      const { data } = await requestToken({
        variables: {
          input: { sessionId, roomName: sessionId },
        },
      });
      if (data?.requestLiveKitToken) {
        await acceptCall(
          { sessionId, mediaType },
          data.requestLiveKitToken,
        );
        onAccept();
      }
    } catch (err) {
      console.error('[IncomingCall] accept error:', err);
    }
  };

  const handleReject = () => {
    rejectCall(sessionId);
    onReject();
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={[styles.content, { paddingTop: insets.top + 40 }]}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {senderId.charAt(0).toUpperCase()}
          </Text>
        </View>

        <Text style={styles.callerName}>{senderId}</Text>
        <Text style={styles.callType}>
          Incoming {mediaType === 'video' ? 'Video' : 'Audio'} Call...
        </Text>

        <View style={styles.buttons}>
          <TouchableOpacity
            style={[styles.button, styles.rejectButton]}
            onPress={handleReject}
          >
            <Text style={styles.buttonIcon}>📞</Text>
            <Text style={styles.buttonLabel}>Decline</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.acceptButton]}
            onPress={handleAccept}
          >
            <Text style={styles.buttonIcon}>📞</Text>
            <Text style={styles.buttonLabel}>Accept</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.92)',
    zIndex: 9999,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#FF7A00',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  avatarText: {
    fontSize: 40,
    color: '#fff',
    fontWeight: '700',
  },
  callerName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
  },
  callType: {
    fontSize: 16,
    color: '#ccc',
    marginBottom: 60,
  },
  buttons: {
    flexDirection: 'row',
    gap: 60,
  },
  button: {
    alignItems: 'center',
  },
  rejectButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#FF3B30',
    justifyContent: 'center',
    alignItems: 'center',
  },
  acceptButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#34C759',
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonIcon: {
    fontSize: 30,
    transform: [{ rotate: '135deg' }],
  },
  buttonLabel: {
    fontSize: 12,
    color: '#fff',
    marginTop: 8,
  },
});
