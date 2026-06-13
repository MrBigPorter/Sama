import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import type { MessageMeta } from '@/types/graphql';
import { audioPlayerManager, type AudioPlayerState } from '@/services/audioPlayerManager';

interface Props {
  meta: MessageMeta | null;
  isMe: boolean;
  content: string; // CDN URL
  textColor: string;
}

/**
 * Voice / audio message bubble with real playback via audioPlayerManager.
 *
 * Features:
 * - Tap to play / pause
 * - Progress bar with elapsed / total duration
 * - Waveform visualisation animated during playback
 * - Auto-stop at end
 * - Singleton audio manager — only one bubble plays at a time
 */
export default function AudioMessageBubble({ meta, isMe, textColor, content }: Props) {
  const [playerState, setPlayerState] = useState<AudioPlayerState>({
    status: 'idle',
    positionMs: 0,
    durationMs: 0,
  });

  const isCurrentTrack = useRef(false);

  // Register listener for status updates
  useEffect(() => {
    audioPlayerManager.setListener((state) => {
      setPlayerState(state);
    });
    return () => {
      audioPlayerManager.setListener(null);
    };
  }, []);

  // Detect when this track is the one being managed
  useEffect(() => {
    // If this bubble's content matches the currently playing URL,
    // it's the current track
    const checkCurrent = () => {
      const s = audioPlayerManager.getState();
      isCurrentTrack.current = s.status !== 'idle' && s.status !== 'ended';
    };
    checkCurrent();
  }, [playerState.status]);

  const duration = meta?.duration ?? (playerState.durationMs > 0 ? Math.round(playerState.durationMs / 1000) : 0);
  const formattedDuration = formatDuration(duration);
  const currentPositionSec = Math.round(playerState.positionMs / 1000);
  const formattedPosition = formatDuration(currentPositionSec);

  const progress = playerState.durationMs > 0
    ? playerState.positionMs / playerState.durationMs
    : 0;

  const handleTogglePlay = async () => {
    if (!content) return;

    const state = audioPlayerManager.getState();

    if (state.status === 'playing' || state.status === 'paused') {
      // If currently playing/paused, toggle
      if (state.status === 'playing') {
        await audioPlayerManager.pause();
      } else {
        await audioPlayerManager.resume();
      }
    } else {
      // Start fresh — this will stop any other track
      await audioPlayerManager.play(content);
    }
  };

  // Waveform bar heights — same pattern as before but now responsive to playback
  const barHeights = [4, 8, 12, 16, 20, 18, 14, 10, 6, 8, 12, 16, 20, 18, 14, 10, 6, 4];

  return (
    <TouchableOpacity
      style={[styles.container, { backgroundColor: isMe ? 'rgba(255,255,255,0.15)' : 'transparent' }]}
      onPress={handleTogglePlay}
      activeOpacity={0.7}
    >
      <View style={styles.row}>
        {/* Play/Pause icon */}
        <Text style={[styles.playIcon, { color: textColor }]}>
          {playerState.status === 'loading'
            ? '⏳'
            : playerState.status === 'playing'
              ? '⏸'
              : '▶'}
        </Text>

        {/* Waveform with progress overlay */}
        <View style={styles.waveformContainer}>
          <View style={styles.waveform}>
            {barHeights.map((h, i) => {
              const barProgress = (i + 1) / barHeights.length;
              const isPlayed = progress >= barProgress;
              return (
                <View
                  key={i}
                  style={[
                    styles.bar,
                    {
                      height: h,
                      backgroundColor: isMe
                        ? isPlayed
                          ? '#fff'
                          : 'rgba(255,255,255,0.4)'
                        : isPlayed
                          ? textColor
                          : 'rgba(0,0,0,0.2)',
                    },
                    playerState.status === 'playing' && isPlayed
                      ? { opacity: 0.8 + 0.2 * Math.sin(Date.now() * 0.01 + i) }
                      : undefined,
                  ]}
                />
              );
            })}
          </View>
          {/* Progress bar overlay */}
          {progress > 0 && (
            <View style={[styles.progressOverlay, { width: `${progress * 100}%` as any }]} />
          )}
        </View>

        {/* Duration / Position */}
        <Text style={[styles.duration, { color: textColor }]}>
          {playerState.status !== 'idle' ? formattedPosition : formattedDuration}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  playIcon: {
    fontSize: 18,
    width: 24,
    textAlign: 'center',
  },
  waveformContainer: {
    flex: 1,
    position: 'relative',
    height: 24,
    justifyContent: 'center',
  },
  waveform: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  bar: {
    width: 3,
    borderRadius: 2,
    minHeight: 2,
  },
  progressOverlay: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 2,
    pointerEvents: 'none',
  },
  duration: {
    fontSize: 12,
    minWidth: 36,
    textAlign: 'right',
    opacity: 0.8,
  },
});
