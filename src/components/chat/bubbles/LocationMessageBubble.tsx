import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import type { MessageMeta } from '@/types/graphql';

interface Props {
  meta: MessageMeta | null;
  isMe: boolean;
  textColor: string;
  accentColor: string;
}

/**
 * Location message bubble.
 * Shows address / coordinates. Tap to open in maps app.
 */
export default function LocationMessageBubble({
  meta,
  isMe,
  textColor,
  accentColor,
}: Props) {
  const lat = meta?.lat;
  const lng = meta?.lng;
  const address = meta?.address;
  const title = meta?.title || 'Location';

  const handleOpenMap = () => {
    if (lat != null && lng != null) {
      const url = `https://maps.apple.com/?ll=${lat},${lng}&q=${encodeURIComponent(title)}`;
      Linking.openURL(url).catch(() => {
        // Fallback to Google Maps
        const googleUrl = `https://maps.google.com/?q=${lat},${lng}`;
        Linking.openURL(googleUrl);
      });
    }
  };

  return (
    <TouchableOpacity
      onPress={handleOpenMap}
      activeOpacity={0.7}
      style={[styles.container, { backgroundColor: accentColor }]}
    >
      {/* Placeholder map preview */}
      <View style={styles.mapPreview}>
        <Text style={styles.mapPin}>📍</Text>
      </View>
      <View style={[styles.info, { backgroundColor: isMe ? 'rgba(255,255,255,0.15)' : '#fff' }]}>
        <Text style={[styles.title, { color: textColor }]} numberOfLines={1}>
          {title}
        </Text>
        {address && (
          <Text
            style={[styles.address, { color: isMe ? 'rgba(255,255,255,0.7)' : '#666' }]}
            numberOfLines={2}
          >
            {address}
          </Text>
        )}
        {lat != null && lng != null && (
          <Text style={[styles.coords, { color: isMe ? 'rgba(255,255,255,0.5)' : '#999' }]}>
            {lat.toFixed(4)}, {lng.toFixed(4)}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 10,
    overflow: 'hidden',
    width: 200,
  },
  mapPreview: {
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  mapPin: {
    fontSize: 32,
  },
  info: {
    padding: 8,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
  },
  address: {
    fontSize: 12,
    marginTop: 2,
  },
  coords: {
    fontSize: 10,
    marginTop: 2,
  },
});
