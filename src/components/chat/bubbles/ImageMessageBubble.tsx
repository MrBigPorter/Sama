import React, { useState } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import type { MessageMeta } from '@/types/graphql';

const SCREEN_WIDTH = Dimensions.get('window').width;
const MAX_IMAGE_SIZE = SCREEN_WIDTH * 0.55;

interface Props {
  content: string; // CDN URL
  meta: MessageMeta | null;
  isMe: boolean;
  onPress?: () => void;
}

/**
 * Image message bubble.
 * Uses expo-image for automatic disk + memory caching, placeholder support,
 * and performant image loading.
 *
 * Cache policy: 'memory-disk' — fast subsequent loads.
 */
export default function ImageMessageBubble({ content, meta, isMe, onPress }: Props) {
  const [error, setError] = useState(false);

  const imageSize = {
    width: meta?.width
      ? Math.min(meta.width, MAX_IMAGE_SIZE)
      : MAX_IMAGE_SIZE,
    height: meta?.height
      ? Math.min(meta.height, MAX_IMAGE_SIZE)
      : MAX_IMAGE_SIZE,
  };

  if (error) {
    return (
      <View
        style={[
          styles.container,
          styles.errorContainer,
          { backgroundColor: isMe ? 'rgba(255,255,255,0.2)' : '#e0e0e0' },
          { width: MAX_IMAGE_SIZE, height: 120 },
        ]}
      >
        <ActivityIndicator size="small" color="#999" />
      </View>
    );
  }

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} disabled={!onPress}>
      <View style={styles.container}>
        {content ? (
          <Image
            source={{ uri: content }}
            style={[styles.image, imageSize]}
            contentFit="cover"
            onError={() => setError(true)}
          />
        ) : (
          <View style={[styles.placeholder, imageSize]}>
            <ActivityIndicator size="small" color="#999" />
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 10,
    overflow: 'hidden',
  },
  image: {
    borderRadius: 10,
  },
  placeholder: {
    backgroundColor: '#e0e0e0',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  errorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
});
