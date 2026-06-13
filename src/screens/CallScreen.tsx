/**
 * CallScreen — Full-screen audio/video call UI with LiveKit.
 *
 * States:
 *   - calling:   Outgoing call (ringing on receiver side)
 *   - connected: Active call with video/audio tracks
 *   - ended:     Call finished (auto-dismiss after 2s)
 *
 * Props from navigation: sessionId, targetId, mediaType
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useMutation } from '@apollo/client/react';
import { VideoView } from '@livekit/react-native';
import { Track } from 'livekit-client';
import { useFront } from '@/lib/theme/ThemeContext';
import { REQUEST_LIVEKIT_TOKEN } from '@/api/operations';
import { useLiveKit } from '@/lib/hooks/useLiveKit';
import { liveKitService } from '@/services/liveKitService';
import { socketService } from '@/services/socketService';
import type { LiveKitTokenResponse } from '@/types/graphql';
import type { RootStackParamList } from '@/Navigation';

type CallRouteProp = RouteProp<RootStackParamList, 'Call'>;

/** Get the first remote video track from the LiveKit room */
function getRemoteVideoTrack(room: any) {
  if (!room) return undefined;
  const participants: any[] = Array.from(room.remoteParticipants?.values() ?? []);
  for (const p of participants) {
    const pub = p.getTrackPublication(Track.Source.Camera);
    if (pub?.track) return pub.track;
  }
  return undefined;
}

/** Get the local video track */
function getLocalVideoTrack(room: any) {
  if (!room?.localParticipant) return undefined;
  const pub = room.localParticipant.getTrackPublication(Track.Source.Camera);
  return pub?.track;
}

export default function CallScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute<CallRouteProp>();
  const { colors } = useFront();
  const { sessionId, targetId, mediaType } = route.params;
  const { callState, endCall, resetCall } = useLiveKit();
  const [requestToken] = useMutation<{ requestLiveKitToken: LiveKitTokenResponse }>(REQUEST_LIVEKIT_TOKEN);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);

  // Derive track references for video rendering
  const room = liveKitService.room;
  const remoteVideoTrack = getRemoteVideoTrack(room);
  const localVideoTrack = getLocalVideoTrack(room);

  // Connect to LiveKit room on mount
  useEffect(() => {
    async function initCall() {
      try {
        const { data } = await requestToken({
          variables: {
            input: { sessionId, roomName: sessionId },
          },
        });
        if (!data?.requestLiveKitToken) {
          Alert.alert('Call Failed', 'Could not connect to call server');
          navigation.goBack();
          return;
        }
        const { token, url, roomName } = data.requestLiveKitToken;
        await liveKitService.connect(token, url, roomName);
      } catch (err) {
        console.error('[CallScreen] init failed:', err);
        Alert.alert('Call Failed', 'Connection error');
        navigation.goBack();
      }
    }
    initCall();
    return () => {
      liveKitService.disconnect();
    };
  }, [sessionId, requestToken, navigation]);

  // Auto-dismiss when call ends
  useEffect(() => {
    if (callState.type === 'ended') {
      const timer = setTimeout(() => {
        resetCall();
        navigation.goBack();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [callState.type, resetCall, navigation]);

  const handleEndCall = useCallback(async () => {
    await endCall();
  }, [endCall]);

  const handleToggleMic = useCallback(async () => {
    const muted = await liveKitService.toggleMic();
    setIsMicMuted(muted);
  }, []);

  const handleToggleCamera = useCallback(async () => {
    const off = await liveKitService.toggleCamera();
    setIsCameraOff(off);
  }, []);

  const handleSwitchCamera = useCallback(async () => {
    await liveKitService.switchCamera();
  }, []);

  const formatDuration = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const isConnected = callState.type === 'connected';
  const isEnded = callState.type === 'ended';

  return (
    <View style={[styles.container, { backgroundColor: '#1a1a1a' }]}>
      <StatusBar barStyle="light-content" />

      {/* Remote video (full screen) */}
      <View style={styles.remoteVideo}>
        {isConnected && remoteVideoTrack ? (
          <VideoView
            style={styles.remoteVideo}
            videoTrack={remoteVideoTrack}
          />
        ) : (
          <View style={styles.avatarContainer}>
            <View style={[styles.avatar, { backgroundColor: colors.utilityBrand500 || '#FF7A00' }]}>
              <Text style={styles.avatarText}>
                {targetId.charAt(0).toUpperCase()}
              </Text>
            </View>
          </View>
        )}
      </View>

      {/* Local video (picture-in-picture) */}
      {isConnected && localVideoTrack && !isCameraOff && (
        <View style={styles.localVideo}>
          <VideoView
            style={styles.localVideo}
            videoTrack={localVideoTrack}
            mirror={true}
          />
        </View>
      )}

      {/* Top info bar */}
      <View style={[styles.topBar, { paddingTop: insets.top + 10 }]}>
        <Text style={styles.callerName}>{targetId}</Text>
        <Text style={styles.callStatus}>
          {isEnded
            ? 'Call Ended'
            : isConnected
              ? formatDuration(callState.duration)
              : mediaType === 'video'
                ? 'Video Calling...'
                : 'Audio Calling...'}
        </Text>
      </View>

      {/* Bottom controls */}
      {!isEnded && (
        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 30 }]}>
          {mediaType === 'video' && (
            <View style={styles.controlRow}>
              <TouchableOpacity
                style={[styles.controlButton, isCameraOff && styles.controlButtonActive]}
                onPress={handleToggleCamera}
              >
                <Text style={styles.controlIcon}>
                  {isCameraOff ? '📷' : '📹'}
                </Text>
                <Text style={styles.controlLabel}>
                  {isCameraOff ? 'Off' : 'Camera'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.controlButton}
                onPress={handleSwitchCamera}
              >
                <Text style={styles.controlIcon}>🔄</Text>
                <Text style={styles.controlLabel}>Flip</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.controlRow}>
            <TouchableOpacity
              style={[styles.controlButton, isMicMuted && styles.controlButtonActive]}
              onPress={handleToggleMic}
            >
              <Text style={styles.controlIcon}>
                {isMicMuted ? '🔇' : '🎤'}
              </Text>
              <Text style={styles.controlLabel}>
                {isMicMuted ? 'Muted' : 'Mic'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.endCallButton]}
              onPress={handleEndCall}
            >
              <Text style={styles.endCallIcon}>📞</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.controlButton, isSpeakerOn && styles.controlButtonActive]}
              onPress={() => setIsSpeakerOn(!isSpeakerOn)}
            >
              <Text style={styles.controlIcon}>
                {isSpeakerOn ? '🔊' : '🔈'}
              </Text>
              <Text style={styles.controlLabel}>
                {isSpeakerOn ? 'Speaker' : 'Earpiece'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  remoteVideo: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 40,
    color: '#fff',
    fontWeight: '700',
  },
  localVideo: {
    position: 'absolute',
    top: 100,
    right: 16,
    width: 120,
    height: 180,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#fff',
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingVertical: 10,
  },
  callerName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  callStatus: {
    fontSize: 14,
    color: '#ccc',
    marginTop: 4,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingVertical: 20,
  },
  controlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 8,
    gap: 24,
  },
  controlButton: {
    alignItems: 'center',
    padding: 10,
  },
  controlButtonActive: {
    opacity: 0.6,
  },
  controlIcon: {
    fontSize: 28,
  },
  controlLabel: {
    fontSize: 11,
    color: '#ccc',
    marginTop: 4,
  },
  endCallButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FF3B30',
    justifyContent: 'center',
    alignItems: 'center',
  },
  endCallIcon: {
    fontSize: 28,
    transform: [{ rotate: '135deg' }],
  },
});
