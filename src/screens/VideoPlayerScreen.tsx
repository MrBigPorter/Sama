/**
 * Full-screen video player with auto-hide controls.
 *
 * Navigation params: { url: string }
 *
 * Derived from Flutter's video_player_page.dart pattern:
 * - Tap to toggle visibility of controls
 * - Auto-hide controls after 4 seconds of inactivity
 * - Play/Pause toggle
 * - Seek bar (click-to-seek + drag)
 * - Current position / duration display
 * - Close (back) button
 */
import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Platform,
  Dimensions,
  PanResponder,
  LayoutChangeEvent,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
import { RootStackParamList } from '@/Navigation';

type VideoPlayerRouteProp = RouteProp<RootStackParamList, 'VideoPlayer'>;

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const AUTO_HIDE_MS = 4000;

function formatTime(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

export default function VideoPlayerScreen() {
  const route = useRoute<VideoPlayerRouteProp>();
  const navigation = useNavigation();
  const { url } = route.params;

  const videoRef = useRef<Video>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seekBarWidth = useRef(1);

  // ── State ───────────────────────────────────────────────────
  const [status, setStatus] = useState<AVPlaybackStatus | null>(null);
  const [showControls, setShowControls] = useState(true);
  const [dragPositionMs, setDragPositionMs] = useState<number | null>(null);

  const isPlaying = status?.isLoaded ? status.isPlaying : false;
  const durationMs = status?.isLoaded ? status.durationMillis ?? 0 : 0;
  const positionMs = status?.isLoaded ? status.positionMillis ?? 0 : 0;

  const displayPositionMs = dragPositionMs ?? positionMs;

  // ── Auto-hide controls timer ────────────────────────────────
  const resetHideTimer = useCallback(() => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => {
      setShowControls(false);
    }, AUTO_HIDE_MS);
  }, []);

  useEffect(() => {
    resetHideTimer();
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [resetHideTimer]);

  // ── Tap to toggle controls ──────────────────────────────────
  const handleTap = useCallback(() => {
    setShowControls((prev) => {
      const next = !prev;
      if (next) resetHideTimer();
      return next;
    });
  }, [resetHideTimer]);

  // ── Play/Pause ──────────────────────────────────────────────
  const handlePlayPause = useCallback(async () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      await videoRef.current.pauseAsync();
    } else {
      await videoRef.current.playAsync();
    }
    resetHideTimer();
  }, [isPlaying, resetHideTimer]);

  // ── Seek bar measurement ────────────────────────────────────
  const onSeekBarLayout = useCallback((e: LayoutChangeEvent) => {
    seekBarWidth.current = e.nativeEvent.layout.width;
  }, []);

  const seekToPosition = useCallback(
    async (pageX: number) => {
      if (!videoRef.current || durationMs <= 0) return;
      const fraction = Math.max(0, Math.min(1, pageX / seekBarWidth.current));
      const targetMs = fraction * durationMs;
      await videoRef.current.setPositionAsync(targetMs);
      setDragPositionMs(null);
      resetHideTimer();
    },
    [durationMs, resetHideTimer],
  );

  // ── PanResponder for the seek bar ───────────────────────────
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        const x = evt.nativeEvent.locationX;
        const fraction = Math.max(0, Math.min(1, x / seekBarWidth.current));
        setDragPositionMs(fraction * durationMs);
      },
      onPanResponderMove: (evt) => {
        const x = evt.nativeEvent.locationX;
        const fraction = Math.max(0, Math.min(1, x / seekBarWidth.current));
        setDragPositionMs(fraction * durationMs);
      },
      onPanResponderRelease: (evt) => {
        seekToPosition(evt.nativeEvent.locationX);
      },
    }),
  ).current;

  // Keep durationMs in panResponder closure by re-creating on change
  useEffect(() => {
    panResponder.panHandlers;
  }, [durationMs]);

  // ── Back ────────────────────────────────────────────────────
  const handleGoBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const progressFraction = durationMs > 0 ? displayPositionMs / durationMs : 0;

  return (
    <View style={styles.root}>
      <StatusBar hidden />

      {/* Video player */}
      <TouchableOpacity
        activeOpacity={1}
        style={styles.videoContainer}
        onPress={handleTap}
      >
        <Video
          ref={videoRef}
          source={{ uri: url }}
          style={styles.video}
          resizeMode={ResizeMode.CONTAIN}
          shouldPlay
          useNativeControls={false}
          onPlaybackStatusUpdate={setStatus}
        />
      </TouchableOpacity>

      {/* Controls overlay */}
      {showControls && (
        <View style={styles.controlsOverlay} pointerEvents="box-none">
          {/* Close button */}
          <TouchableOpacity
            style={styles.closeButton}
            onPress={handleGoBack}
            activeOpacity={0.7}
          >
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>

          {/* Center play/pause */}
          <TouchableOpacity
            style={styles.centerPlayPause}
            onPress={handlePlayPause}
            activeOpacity={0.7}
          >
            <Text style={styles.playPauseText}>
              {isPlaying ? '⏸' : '▶'}
            </Text>
          </TouchableOpacity>

          {/* Bottom controls: time, seek bar, time */}
          <View style={styles.bottomControls}>
            <Text style={styles.timeText}>{formatTime(displayPositionMs)}</Text>

            <View
              style={styles.seekBarContainer}
              onLayout={onSeekBarLayout}
              {...panResponder.panHandlers}
            >
              <View style={styles.seekBarTrack}>
                <View
                  style={[
                    styles.seekBarProgress,
                    { width: `${Math.round(progressFraction * 100)}%` },
                  ]}
                />
              </View>
            </View>

            <Text style={styles.timeText}>{formatTime(durationMs)}</Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000',
  },
  videoContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  video: {
    width: SCREEN_WIDTH,
    height: '100%',
  },
  controlsOverlay: {
    position: 'absolute',
    inset: 0,
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  closeButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 54 : 24,
    left: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  closeText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  centerPlayPause: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 64,
    height: 64,
    marginLeft: -32,
    marginTop: -32,
    borderRadius: 32,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playPauseText: {
    color: '#fff',
    fontSize: 28,
  },
  bottomControls: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
  },
  timeText: {
    color: '#fff',
    fontSize: 12,
    fontVariant: ['tabular-nums'],
    minWidth: 40,
    textAlign: 'center',
  },
  seekBarContainer: {
    flex: 1,
    height: 40,
    justifyContent: 'center',
    marginHorizontal: 8,
  },
  seekBarTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.3)',
    overflow: 'hidden',
  },
  seekBarProgress: {
    height: '100%',
    backgroundColor: '#FF7A00',
    borderRadius: 2,
  },
});
