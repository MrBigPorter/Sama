import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from 'expo-av';

export type PlaybackStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'ended' | 'error';

export interface AudioPlayerState {
  status: PlaybackStatus;
  positionMs: number;
  durationMs: number;
  error?: string;
}

export type AudioPlayerListener = (state: AudioPlayerState) => void;

/**
 * Singleton audio player manager.
 *
 * Only one audio instance plays at a time — starting a new track
 * automatically stops any currently playing track.
 *
 * Features:
 * - Play / Pause / Resume / Stop / Seek
 * - Progress tracking via listener callback
 * - Automatic cleanup on stop
 * - Sets audio mode for playback (mixWithOthers = false)
 */
class AudioPlayerManager {
  private _sound: Audio.Sound | null = null;
  private _listener: AudioPlayerListener | null = null;
  private _status: AudioPlayerState = {
    status: 'idle',
    positionMs: 0,
    durationMs: 0,
  };
  private _initialized = false;

  /**
   * Initialize audio mode. Call once early in app lifecycle.
   */
  async init(): Promise<void> {
    if (this._initialized) return;
    this._initialized = true;
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        interruptionModeIOS: InterruptionModeIOS.DuckOthers,
        interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
        shouldDuckAndroid: true,
      });
    } catch (err) {
      console.warn('[AudioPlayerManager] Failed to set audio mode:', err);
    }
  }

  /**
   * Register a listener for playback status updates.
   * Only one listener is supported at a time (per-audio-bubble usage).
   */
  setListener(listener: AudioPlayerListener | null): void {
    this._listener = listener;
  }

  /**
   * Get current playback state synchronously.
   */
  getState(): AudioPlayerState {
    return { ...this._status };
  }

  /**
   * Play audio from a remote URL.
   * Stops any currently playing audio first.
   */
  async play(url: string): Promise<void> {
    await this._ensureInitialized();
    await this.stop();

    try {
      this._updateState({ status: 'loading' });

      const { sound } = await Audio.Sound.createAsync(
        { uri: url },
        { shouldPlay: true, progressUpdateIntervalMillis: 250 },
        this._onPlaybackStatusUpdate,
      );

      this._sound = sound;
    } catch (err: any) {
      console.warn('[AudioPlayerManager] Failed to load audio:', err);
      this._updateState({
        status: 'error',
        error: err?.message ?? 'Failed to load audio',
      });
    }
  }

  /**
   * Pause playback.
   */
  async pause(): Promise<void> {
    if (!this._sound) return;
    try {
      await this._sound.pauseAsync();
      this._updateState({ status: 'paused' });
    } catch (err) {
      console.warn('[AudioPlayerManager] Failed to pause:', err);
    }
  }

  /**
   * Resume playback from paused state.
   */
  async resume(): Promise<void> {
    if (!this._sound) return;
    try {
      await this._sound.playAsync();
      this._updateState({ status: 'playing' });
    } catch (err) {
      console.warn('[AudioPlayerManager] Failed to resume:', err);
    }
  }

  /**
   * Stop playback and unload the sound.
   */
  async stop(): Promise<void> {
    if (!this._sound) return;
    try {
      await this._sound.stopAsync();
      await this._sound.unloadAsync();
    } catch (err) {
      console.warn('[AudioPlayerManager] Failed to stop:', err);
    } finally {
      this._sound = null;
      this._updateState({
        status: 'idle',
        positionMs: 0,
        error: undefined,
      });
    }
  }

  /**
   * Seek to a specific position in milliseconds.
   */
  async seek(positionMs: number): Promise<void> {
    if (!this._sound) return;
    try {
      await this._sound.setPositionAsync(Math.max(0, positionMs));
      this._updateState({ positionMs: Math.max(0, positionMs) });
    } catch (err) {
      console.warn('[AudioPlayerManager] Failed to seek:', err);
    }
  }

  /**
   * Check if this manager is currently playing the given URL.
   */
  isPlaying(url: string): boolean {
    return this._status.status === 'playing';
  }

  /**
   * Clean up all resources.
   */
  async destroy(): Promise<void> {
    await this.stop();
    this._listener = null;
    this._initialized = false;
  }

  // ── Private ──────────────────────────────────────────────────────

  private async _ensureInitialized(): Promise<void> {
    if (!this._initialized) {
      await this.init();
    }
  }

  private _onPlaybackStatusUpdate = (status: any): void => {
    if (!status) return;

    if (status.isLoaded) {
      this._updateState({
        positionMs: status.positionMillis ?? 0,
        durationMs: status.durationMillis ?? 0,
        status: status.didJustFinish
          ? 'ended'
          : status.isPlaying
            ? 'playing'
            : 'paused',
      });
    } else if (status.error) {
      console.warn('[AudioPlayerManager] Playback error:', status.error);
      this._updateState({
        status: 'error',
        error: status.error,
      });
    }
  };

  private _updateState(partial: Partial<AudioPlayerState>): void {
    this._status = { ...this._status, ...partial };
    this._listener?.(this._status);
  }
}

/** Singleton instance */
export const audioPlayerManager = new AudioPlayerManager();
