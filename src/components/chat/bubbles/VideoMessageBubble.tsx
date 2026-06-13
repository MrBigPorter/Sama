import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import type { MessageMeta } from '@/types/graphql';

const SCREEN_WIDTH = Dimensions.get('window').width;
const MAX_VIDEO_SIZE = SCREEN_WIDTH * 0.6;

interface Props {
  content: string; // CDN URL of the video
  meta: MessageMeta | null;
  isMe: boolean;
  onPress?: () => void;
}

/**
 * Video message bubble.
 * Shows a thumbnail (if meta.thumbnail exists) with a play overlay.
 * Uses expo-image for automatic disk + memory caching of thumbnails.
 * Falls back to a placeholder when no thumbnail is available.
 */
export default function VideoMessageBubble({ content, meta, isMe, onPress }: Props) {
  const [error, setError] = useState(false);

  const thumbnail = meta?.thumbnail || '';
  const duration = meta?.duration ?? 0;

  const videoSize = {
    width: MAX_VIDEO_SIZE,
    height: MAX_VIDEO_SIZE * 0.75, // 4:3 aspect ratio
  };

  if (error) {
    return (
      <View
        style={[
          styles.container,
          { backgroundColor: isMe ? 'rgba(255,255,255,0.2)' : '#e0e0e0' },
          videoSize,
          styles.errorContainer,
        ]}
      >
        <ActivityIndicator size="small" color="#999" />
      </View>
    );
  }

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} disabled={!onPress}>
      <View style={[styles.container, videoSize]}>
        {thumbnail ? (
          <Image
            source={{ uri: thumbnail }}
            style={[styles.thumbnail, videoSize]}
            contentFit="cover"
            onError={() => setError(true)}
          />
        ) : (
          <View style={[styles.placeholder, videoSize]}>
            <ActivityIndicator size="small" color="#999" />
          </View>
        )}
        {/* Play button overlay */}
        <View style={styles.playOverlay}>
          <View style={styles.playButton}>
            <Text style={styles.playIcon}>▶</Text>
          </View>
        </View>
        {/* Duration badge */}
        {duration > 0 && (
          <View style={styles.durationBadge}>
            <Text style={styles.durationText}>{formatDuration(duration)}</Text>
          </View>
        )}
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
    overflow: 'hidden',
    position: 'relative',
  },
  thumbnail: {
    borderRadius: 10,
  },
  placeholder: {
    backgroundColor: '#222',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  errorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  playOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playIcon: {
    color: '#fff',
    fontSize: 20,
    marginLeft: 3,
  },
  durationBadge: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  durationText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
});
