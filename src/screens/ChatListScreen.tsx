import React, { useCallback, useState, useEffect, useMemo, useLayoutEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery } from '@apollo/client/react';
import { useFront } from '@/lib/theme/ThemeContext';
import { useSocket } from '@/lib/hooks/useSocket';
import { CONVERSATIONS } from '@/api/operations';
import { SocketEvent } from '@/services/socketService';
import { RootStackParamList } from '@/Navigation';
import type { Conversation } from '@/types/graphql';
import { messageCache } from '@/services/messageCache';
import type { ConversationMeta } from '@/services/messageCache';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

/** Format an ISO date string as a relative time label */
function formatRelativeTime(isoDate: string | null | undefined): string {
  if (!isoDate) return '';
  const now = Date.now();
  const then = new Date(isoDate).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(isoDate).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

/** Extract initials from a name (up to 2 chars) */
function getInitials(name: string | null | undefined): string {
  if (!name) return '?';
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export default function ChatListScreen() {
  const { front, colors } = useFront();
  const navigation = useNavigation<NavigationProp>();

  const { loading, data, error, refetch } = useQuery<{ conversations: Conversation[] }>(CONVERSATIONS, {
    variables: { page: 1, pageSize: 200 },
    notifyOnNetworkStatusChange: true,
  });

  const conversations: Conversation[] = data?.conversations ?? [];

  // ── Cache state for instant display ───────────────────────────

  const [cachedMetas, setCachedMetas] = useState<Map<string, ConversationMeta>>(new Map());

  useEffect(() => {
    // Load cached conversation metadata for instant display
    const convIds = messageCache.getAllConversationIds();
    const metas = new Map<string, ConversationMeta>();
    for (const id of convIds) {
      const meta = messageCache.getConversationMeta(id);
      if (meta) metas.set(id, meta);
    }
    setCachedMetas(metas);
  }, []);

  // ── Header Right: New Group / Add Contact ───────────────────

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          onPress={() => navigation.navigate('CreateGroup')}
          style={{ marginRight: 16, padding: 4 }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={{ fontSize: 24, color: colors.utilityBrand500 || '#FF7A00', fontWeight: '300' }}>
            +
          </Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation, colors]);

  // Merge server conversations with cached metadata
  const displayConversations = useMemo(() => {
    return conversations.map((conv) => {
      const cachedMeta = cachedMetas.get(conv.id);
      if (!cachedMeta) return conv;

      return {
        ...conv,
        // Use cached unread count if it's higher (more recent than server)
        unreadCount: Math.max(
          cachedMeta.unreadCount,
          conv.unreadCount ?? 0,
        ),
        // Use cached last message preview if server has none
        lastMessagePreview:
          conv.lastMessagePreview ||
          cachedMeta.lastMsgContent ||
          conv.lastMessagePreview,
        // Use cached last message time if server has none
        lastMessageAt:
          conv.lastMessageAt ||
          cachedMeta.lastMsgTime ||
          conv.lastMessageAt,
      } as Conversation;
    });
  }, [conversations, cachedMetas]);

  // ── Real-time updates ──────────────────────────────────────────

  useSocket(
    SocketEvent.MESSAGE_CREATED,
    useCallback(
      (msg: any) => {
        // When a message arrives for a conversation NOT currently viewed,
        // increment its cache unread count for instant badge update
        if (msg.conversationId && msg.id) {
          messageCache.incrementUnread(msg.conversationId);
          // Reload cached metas
          const meta = messageCache.getConversationMeta(msg.conversationId);
          if (meta) {
            setCachedMetas((prev) => {
              const next = new Map(prev);
              next.set(msg.conversationId, meta);
              return next;
            });
          }
        }
        refetch();
      },
      [refetch],
    ),
  );
  useSocket(SocketEvent.CONVERSATION_UPDATED, useCallback(() => { refetch(); }, [refetch]));
  useSocket(SocketEvent.CONVERSATION_ADDED, useCallback(() => { refetch(); }, [refetch]));

  // ── Global group event handlers ──────────────────────────────
  useSocket(SocketEvent.GROUP_DISBANDED, useCallback(() => { refetch(); }, [refetch]));
  useSocket(SocketEvent.GROUP_UPDATED, useCallback(() => { refetch(); }, [refetch]));

  // ── Render ─────────────────────────────────────────────────────

  if (loading && conversations.length === 0) {
    return (
      <View style={[styles.center, { backgroundColor: colors.bgPrimary }]}>
        <ActivityIndicator size="large" color={colors.utilityBrand500 || '#FF7A00'} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.center, { backgroundColor: colors.bgPrimary }]}>
        <Text style={[styles.errorText, { color: colors.textSecondary || '#666' }]}>
          Failed to load conversations
        </Text>
        <TouchableOpacity onPress={() => refetch()} style={styles.retryButton}>
          <Text style={{ color: colors.utilityBrand500 || '#FF7A00' }}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
      <FlatList
        data={displayConversations}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: front.spacingMd || 16 }}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={refetch}
            tintColor={colors.utilityBrand500 || '#FF7A00'}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyText, { color: colors.textTertiary || '#999' }]}>
              No conversations yet
            </Text>
          </View>
        }
        removeClippedSubviews={true}
        maxToRenderPerBatch={10}
        windowSize={5}
        initialNumToRender={10}
        renderItem={({ item }) => (
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => navigation.navigate('Conversation', { conversationId: item.id, title: item.name || 'Chat' })}
            style={[
              styles.chatItem,
              {
                backgroundColor: colors.bgSecondary,
                marginBottom: front.spacingSm || 8,
                padding: front.spacingMd || 16,
                borderRadius: front.radiusMd || 8,
              },
            ]}
          >
            <View style={[styles.avatar, { backgroundColor: colors.utilityBrand200 || '#FFE0B3' }]}>
              <Text style={[styles.avatarText, { color: colors.utilityBrand500 || '#FF7A00' }]}>
                {getInitials(item.name)}
              </Text>
            </View>
            <View style={styles.chatInfo}>
              <View style={styles.chatHeader}>
                <Text style={[styles.name, { color: colors.textPrimary }]} numberOfLines={1}>
                  {item.name || 'Unknown'}
                </Text>
                <Text style={[styles.time, { color: colors.textTertiary || '#999' }]}>
                  {formatRelativeTime(item.lastMessageAt)}
                </Text>
              </View>
              <Text
                style={[styles.lastMessage, { color: colors.textSecondary || '#666' }]}
                numberOfLines={1}
              >
                {item.lastMessagePreview || 'No messages yet'}
              </Text>
            </View>
            <View style={styles.callActions}>
              {(item.unreadCount ?? 0) > 0 && (
                <View
                  style={[
                    styles.badge,
                    { backgroundColor: colors.utilityBrand500 || '#FF7A00' },
                  ]}
                >
                  <Text style={styles.badgeText}>
                    {item.unreadCount! > 99 ? '99+' : item.unreadCount}
                  </Text>
                </View>
              )}
              <TouchableOpacity
                style={styles.callActionButton}
                onPress={() =>
                  navigation.navigate('Call', {
                    sessionId: `${Date.now()}_audio_${item.id}`,
                    targetId: item.name || 'User',
                    mediaType: 'audio',
                  })
                }
              >
                <Text style={styles.callActionIcon}>📞</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.callActionButton}
                onPress={() =>
                  navigation.navigate('Call', {
                    sessionId: `${Date.now()}_video_${item.id}`,
                    targetId: item.name || 'User',
                    mediaType: 'video',
                  })
                }
              >
                <Text style={styles.callActionIcon}>📹</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  chatItem: { flexDirection: 'row', alignItems: 'center' },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: { fontSize: 16, fontWeight: '600' },
  chatInfo: { flex: 1 },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  name: { fontSize: 16, fontWeight: '600', flex: 1, marginRight: 8 },
  time: { fontSize: 12 },
  lastMessage: { fontSize: 14 },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    marginLeft: 8,
  },
  callActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
    gap: 4,
  },
  callActionButton: {
    padding: 6,
  },
  callActionIcon: {
    fontSize: 16,
  },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  errorText: { fontSize: 15, marginBottom: 12 },
  retryButton: { padding: 8 },
  emptyContainer: { paddingVertical: 60, alignItems: 'center' },
  emptyText: { fontSize: 15 },
});
