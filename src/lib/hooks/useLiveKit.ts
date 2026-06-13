/**
 * React Hook for LiveKit call management.
 *
 * Provides a simple interface for starting/accepting/rejecting calls
 * and tracking call state within a component.
 *
 * Usage:
 *   const { startCall, acceptCall, endCall, isCallActive, callState } = useLiveKit();
 *   await startCall(tokenData, targetId, 'video');
 */
import { useState, useCallback, useRef } from 'react';
import { useMutation } from '@apollo/client/react';
import { REQUEST_LIVEKIT_TOKEN } from '@/api/operations';
import { liveKitService } from '@/services/liveKitService';
import { socketService } from '@/services/socketService';
import type { LiveKitTokenResponse } from '@/types/graphql';

export type CallStateType = 'idle' | 'calling' | 'ringing' | 'connected' | 'ended';

interface CallState {
  type: CallStateType;
  sessionId: string;
  targetId: string;
  mediaType: 'audio' | 'video';
  duration: number;
}

export function useLiveKit() {
  const [callState, setCallState] = useState<CallState>({
    type: 'idle',
    sessionId: '',
    targetId: '',
    mediaType: 'video',
    duration: 0,
  });
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [requestToken] = useMutation<{ requestLiveKitToken: LiveKitTokenResponse }>(REQUEST_LIVEKIT_TOKEN);

  /** Start a call to a target user */
  const startCall = useCallback(async (
    targetId: string,
    mediaType: 'audio' | 'video',
    conversationId?: string,
  ) => {
    const sessionId = `${Date.now()}_${targetId}`;

    setCallState({
      type: 'calling',
      sessionId,
      targetId,
      mediaType,
      duration: 0,
    });

    try {
      // Get LiveKit token from backend
      const { data } = await requestToken({
        variables: {
          input: { sessionId, roomName: sessionId },
        },
      });

      if (!data?.requestLiveKitToken) {
        throw new Error('Failed to get LiveKit token');
      }

      const { token, url, roomName } = data.requestLiveKitToken;

      // Connect to LiveKit room
      await liveKitService.connect(token, url, roomName);

      // Send call invite via Socket.IO
      socketService.emitCallInvite({
        sessionId,
        targetId,
        mediaType,
        conversationId,
      });

      setCallState((prev) => ({ ...prev, type: 'calling' }));

      // Start duration timer
      timerRef.current = setInterval(() => {
        setCallState((prev) => ({
          ...prev,
          duration: prev.duration + 1,
        }));
      }, 1000);
    } catch (err) {
      console.error('[useLiveKit] startCall failed:', err);
      setCallState((prev) => ({ ...prev, type: 'ended' }));
      await liveKitService.disconnect();
    }
  }, [requestToken]);

  /** Accept an incoming call */
  const acceptCall = useCallback(async (
    payload: { sessionId: string; mediaType: 'audio' | 'video' },
    tokenData: LiveKitTokenResponse,
  ) => {
    try {
      const { token, url, roomName } = tokenData;

      // Connect to LiveKit room
      await liveKitService.connect(token, url, roomName);

      // Send accept via Socket.IO
      socketService.emitCallAccept({ sessionId: payload.sessionId });

      setCallState({
        type: 'connected',
        sessionId: payload.sessionId,
        targetId: '',
        mediaType: payload.mediaType,
        duration: 0,
      });

      // Start duration timer
      timerRef.current = setInterval(() => {
        setCallState((prev) => ({
          ...prev,
          duration: prev.duration + 1,
        }));
      }, 1000);
    } catch (err) {
      console.error('[useLiveKit] acceptCall failed:', err);
      setCallState((prev) => ({ ...prev, type: 'ended' }));
    }
  }, []);

  /** End the current call */
  const endCall = useCallback(async () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    socketService.emitCallEnd({
      sessionId: callState.sessionId,
      reason: callState.type === 'calling' ? 'cancelled' : 'completed',
    });

    await liveKitService.disconnect();

    setCallState((prev) => ({ ...prev, type: 'ended' }));
  }, [callState.sessionId, callState.type]);

  /** Reject an incoming call */
  const rejectCall = useCallback((sessionId: string) => {
    socketService.emitCallEnd({
      sessionId,
      reason: 'rejected',
    });
    setCallState((prev) => ({ ...prev, type: 'ended' }));
  }, []);

  /** Reset call state to idle */
  const resetCall = useCallback(() => {
    setCallState({
      type: 'idle',
      sessionId: '',
      targetId: '',
      mediaType: 'video',
      duration: 0,
    });
  }, []);

  return {
    callState,
    isCallActive: callState.type === 'connected' || callState.type === 'calling',
    startCall,
    acceptCall,
    endCall,
    rejectCall,
    resetCall,
  };
}
