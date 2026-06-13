/**
 * LiveKit service for managing WebRTC audio/video call rooms.
 *
 * Handles room connection lifecycle using tokens from SamaHub backend.
 * Uses livekit-client directly for Room management, with @livekit/react-native
 * for video rendering components.
 *
 * Usage:
 *   import { liveKitService } from '@/services/liveKitService';
 *   await liveKitService.connect(token, url, roomName);
 *   liveKitService.disconnect();
 */
import { Room, RoomEvent, Track, VideoPresets } from 'livekit-client';
import type { Participant, LocalParticipant } from 'livekit-client';

class LiveKitService {
  private _room: Room | null = null;
  private _connected = false;

  /** Whether the LiveKit room is currently connected */
  get connected(): boolean {
    return this._connected;
  }

  /** Get the current Room instance */
  get room(): Room | null {
    return this._room;
  }

  /**
   * Connect to a LiveKit room using a token from SamaHub.
   * @param token - LiveKit JWT token from requestLiveKitToken mutation
   * @param url - LiveKit server WebSocket URL
   * @param roomName - Room name to join
   */
  async connect(token: string, url: string, roomName: string): Promise<void> {
    if (this._room) {
      await this.disconnect();
    }

    const room = new Room({
      adaptiveStream: true,
      dynacast: true,
      videoCaptureDefaults: {
        resolution: VideoPresets.h720.resolution,
      },
    });

    room.on(RoomEvent.Disconnected, () => {
      this._connected = false;
      console.debug('[LiveKit] Room disconnected');
    });

    room.on(RoomEvent.ParticipantDisconnected, (participant: Participant) => {
      console.debug(`[LiveKit] Participant disconnected: ${participant.identity}`);
    });

    room.on(RoomEvent.TrackSubscribed, () => {
      console.debug('[LiveKit] Track subscribed');
    });

    try {
      await room.connect(url, token, {
        autoSubscribe: true,
      });
      this._room = room;
      this._connected = true;
      console.debug(`[LiveKit] Connected to room: ${roomName}`);
    } catch (err) {
      console.error('[LiveKit] Connection failed:', err);
      throw err;
    }
  }

  /** Disconnect from the LiveKit room */
  async disconnect(): Promise<void> {
    if (this._room) {
      this._room.removeAllListeners();
      await this._room.disconnect();
      this._room = null;
      this._connected = false;
      console.debug('[LiveKit] Disconnected');
    }
  }

  /** Toggle local microphone mute */
  async toggleMic(): Promise<boolean> {
    if (!this._room?.localParticipant) return false;
    const pub = this._room.localParticipant;
    const audioTrack = pub.getTrackPublication(Track.Source.Microphone);
    if (audioTrack?.track) {
      if (audioTrack.track.isMuted) {
        await audioTrack.track.unmute();
      } else {
        await audioTrack.track.mute();
      }
      return audioTrack.track.isMuted;
    }
    return false;
  }

  /** Toggle local camera mute */
  async toggleCamera(): Promise<boolean> {
    if (!this._room?.localParticipant) return false;
    const pub = this._room.localParticipant;
    const videoTrack = pub.getTrackPublication(Track.Source.Camera);
    if (videoTrack?.track) {
      if (videoTrack.track.isMuted) {
        await videoTrack.track.unmute();
      } else {
        await videoTrack.track.mute();
      }
      return videoTrack.track.isMuted;
    }
    return false;
  }

  /** Switch between front and back camera */
  async switchCamera(): Promise<void> {
    if (!this._room?.localParticipant) return;
    const pub = this._room.localParticipant;
    const videoTrack = pub.getTrackPublication(Track.Source.Camera);
    if (videoTrack?.track && 'switchCamera' in videoTrack.track) {
      await (videoTrack.track as any).switchCamera();
    }
  }
}

/** Singleton LiveKit service instance */
export const liveKitService = new LiveKitService();
