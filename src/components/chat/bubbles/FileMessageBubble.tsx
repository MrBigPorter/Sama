import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import type { MessageMeta } from '@/types/graphql';

interface Props {
  meta: MessageMeta | null;
  isMe: boolean;
  content: string; // CDN URL
  textColor: string;
  accentColor: string;
  onPress?: () => void;
}

/**
 * File message bubble.
 * Shows file name, extension badge, and file size.
 * Tap to download / open.
 */
export default function FileMessageBubble({
  meta,
  isMe,
  textColor,
  accentColor,
  onPress,
}: Props) {
  const fileName = meta?.fileName || 'Unknown file';
  const fileSize = meta?.fileSize ?? 0;
  const fileExt = meta?.fileExt || extractExt(fileName);

  const formattedSize = formatFileSize(fileSize);

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[styles.container, { backgroundColor: isMe ? 'rgba(255,255,255,0.1)' : '#f5f5f5' }]}
    >
      <View style={[styles.extBadge, { backgroundColor: accentColor }]}>
        <Text style={styles.extText}>{fileExt.toUpperCase()}</Text>
      </View>
      <View style={styles.info}>
        <Text
          style={[styles.fileName, { color: textColor }]}
          numberOfLines={2}
          ellipsizeMode="middle"
        >
          {fileName}
        </Text>
        {fileSize > 0 && (
          <Text style={[styles.fileSize, { color: isMe ? 'rgba(255,255,255,0.6)' : '#999' }]}>
            {formattedSize}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

function extractExt(name: string): string {
  const idx = name.lastIndexOf('.');
  return idx > 0 ? name.slice(idx + 1) : '?';
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    padding: 10,
    minWidth: 180,
    maxWidth: 260,
  },
  extBadge: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  extText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  info: {
    flex: 1,
  },
  fileName: {
    fontSize: 14,
    fontWeight: '500',
  },
  fileSize: {
    fontSize: 11,
    marginTop: 2,
  },
});
