/**
 * NewFriendScreen — Friend request list
 *
 * Flutter equivalent: new_friend_page.dart
 * - Shows received friend requests (pending) with Accept/Reject buttons
 * - Shows sent friend requests with status (pending/accepted/rejected)
 * - Real-time updates via socket events
 */
import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
  SectionList,
} from 'react-native';
import { useQuery, useMutation } from '@apollo/client/react';
import { useFront } from '@/lib/theme/ThemeContext';
import { useSocket } from '@/lib/hooks/useSocket';
import { SocketEvent } from '@/services/socketService';
import { authService } from '@/services/authService';
import { FRIEND_REQUESTS, HANDLE_FRIEND_REQUEST } from '@/api/operations';
import type { FriendRequest } from '@/types/graphql';

// ── Types ────────────────────────────────────────────────────────────

/** Extended friend request with resolved user info from the backend */
interface FriendRequestItem {
  id: string;
  fromUserId: string;
  toUserId: string;
  status: string; // PENDING | ACCEPTED | REJECTED
  message?: string | null;
  createdAt: string;
  handledAt?: string | null;
  /** Resolved sender user info (returned by backend) */
  fromUser?: {
    id: string;
    nickname?: string | null;
    avatar?: string | null;
  } | null;
  /** Resolved recipient user info */
  toUser?: {
    id: string;
    nickname?: string | null;
    avatar?: string | null;
  } | null;
}

interface Section {
  title: string;
  data: FriendRequestItem[];
}

// ── Helpers ──────────────────────────────────────────────────────────

function getInitials(name: string | null | undefined): string {
  if (!name) return '?';
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function formatDate(isoDate: string): string {
  const date = new Date(isoDate);
  const month = date.toLocaleString('default', { month: 'short' });
  const day = date.getDate();
  return `${month} ${day}`;
}

function getStatusDisplay(status: string): { label: string; color: string } {
  switch (status) {
    case 'PENDING':
      return { label: 'Pending', color: '#FF9500' };
    case 'ACCEPTED':
      return { label: 'Accepted', color: '#34C759' };
    case 'REJECTED':
      return { label: 'Rejected', color: '#FF3B30' };
    default:
      return { label: status, color: '#8E8E93' };
  }
}

/** Check if this request was sent by the given userId (i.e., current user) */
function isSentByMe(item: FriendRequestItem, myUserId: string): boolean {
  return item.fromUserId === myUserId;
}

// ── Component ────────────────────────────────────────────────────────

export default function NewFriendScreen() {
  const { front, colors } = useFront();

  // Get current user ID from authService (guaranteed non-null on authenticated screens)
  const myUserId = authService.currentUser?.id ?? '';

  // ── Queries ──────────────────────────────────────────────────────

  const {
    data,
    loading,
    error,
    refetch,
  } = useQuery<any>(FRIEND_REQUESTS, {
    fetchPolicy: 'cache-and-network',
  });

  // ── Mutations ────────────────────────────────────────────────────

  const [handleRequest, { loading: handling }] = useMutation(HANDLE_FRIEND_REQUEST, {
    refetchQueries: ['FriendRequests', 'Contacts'],
    awaitRefetchQueries: true,
  });

  // ── Socket listeners ─────────────────────────────────────────────

  useSocket(SocketEvent.FRIEND_REQUEST_SENT, useCallback(() => {
    refetch();
  }, [refetch]));

  useSocket(SocketEvent.FRIEND_REQUEST_HANDLED, useCallback(() => {
    refetch();
  }, [refetch]));

  // ── Derived: sectioned data ──────────────────────────────────────

  const received: FriendRequestItem[] = [];
  const sent: FriendRequestItem[] = [];

  const requests: FriendRequestItem[] = data?.friendRequests ?? [];
  for (const req of requests) {
    if (myUserId && isSentByMe(req, myUserId)) {
      sent.push(req);
    } else {
      received.push(req);
    }
  }

  const sections: Section[] = [];
  if (received.length > 0) {
    sections.push({ title: 'Received', data: received });
  }
  if (sent.length > 0) {
    sections.push({ title: 'Sent', data: sent });
  }

  // ── Handlers ─────────────────────────────────────────────────────

  const handleAccept = useCallback(
    async (requestId: string) => {
      try {
        await handleRequest({ variables: { requestId, accept: true } });
      } catch (err: any) {
        Alert.alert('Error', err.message || 'Failed to accept request');
      }
    },
    [handleRequest],
  );

  const handleReject = useCallback(
    async (requestId: string) => {
      Alert.alert(
        'Reject Request',
        'Are you sure you want to reject this friend request?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Reject',
            style: 'destructive',
            onPress: async () => {
              try {
                await handleRequest({ variables: { requestId, accept: false } });
              } catch (err: any) {
                Alert.alert('Error', err.message || 'Failed to reject request');
              }
            },
          },
        ],
      );
    },
    [handleRequest],
  );

  // ── Render helpers ───────────────────────────────────────────────

  const renderRequestItem = (item: FriendRequestItem) => {
    const isSent = myUserId ? isSentByMe(item, myUserId) : false;
    const displayUser = isSent ? item.toUser : item.fromUser;
    const displayName = displayUser?.nickname ?? 'Unknown User';
    const statusInfo = getStatusDisplay(item.status);
    const isPending = item.status === 'PENDING';

    return (
      <View style={[styles.requestCard, { backgroundColor: colors.bgPrimary }]}>
        <View style={styles.userInfo}>
          <View
            style={[
              styles.avatar,
              { backgroundColor: colors.utilityBrand200 || '#FFE0B3' },
            ]}
          >
            <Text
              style={[
                styles.avatarText,
                { color: colors.utilityBrand700 || '#CC5500' },
              ]}
            >
              {getInitials(displayName)}
            </Text>
          </View>
          <View style={styles.userDetails}>
            <Text style={[styles.nickname, { color: colors.textPrimary }]}>
              {displayName}
            </Text>
            {item.message && (
              <Text
                style={[styles.message, { color: colors.textSecondary }]}
                numberOfLines={1}
              >
                {item.message}
              </Text>
            )}
            <Text style={[styles.timestamp, { color: colors.textTertiary || '#999' }]}>
              {formatDate(item.createdAt)}
            </Text>
          </View>

          {/* Status badge for non-pending or sent items */}
          {(!isPending || isSent) && (
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: statusInfo.color + '20' },
              ]}
            >
              <Text style={[styles.statusText, { color: statusInfo.color }]}>
                {statusInfo.label}
              </Text>
            </View>
          )}
        </View>

        {/* Action buttons: only for RECEIVED pending requests */}
        {!isSent && isPending && (
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.actionButton, styles.acceptButton]}
              onPress={() => handleAccept(item.id)}
              disabled={handling}
              activeOpacity={0.8}
            >
              <Text style={styles.acceptButtonText}>Accept</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.rejectButton]}
              onPress={() => handleReject(item.id)}
              disabled={handling}
              activeOpacity={0.8}
            >
              <Text style={[styles.rejectButtonText, { color: colors.utilityError200 || '#F04438' }]}>
                Reject
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  const renderSectionHeader = ({ section }: { section: Section }) => (
    <View style={[styles.sectionHeader, { backgroundColor: colors.bgSecondary }]}>
      <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
        {section.title}
      </Text>
      <Text style={[styles.sectionCount, { color: colors.textTertiary || '#999' }]}>
        {section.data.length}
      </Text>
    </View>
  );

  // ── Loading state ────────────────────────────────────────────────

  if (loading && requests.length === 0) {
    return (
      <View style={[styles.center, { backgroundColor: colors.bgPrimary }]}>
        <ActivityIndicator size="large" color={colors.utilityBrand500 || '#FF7A00'} />
      </View>
    );
  }

  // ── Error state ──────────────────────────────────────────────────

  if (error && requests.length === 0) {
    return (
      <View style={[styles.center, { backgroundColor: colors.bgPrimary }]}>
        <Text style={[styles.errorText, { color: colors.utilityError200 }]}>
          {error.message}
        </Text>
        <TouchableOpacity onPress={() => refetch()} style={styles.retryButton}>
          <Text style={{ color: colors.utilityBrand500 || '#FF7A00' }}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Empty state ──────────────────────────────────────────────────

  if (requests.length === 0) {
    return (
      <View style={[styles.center, { backgroundColor: colors.bgPrimary }]}>
        <Text style={[styles.emptyIcon, { color: colors.textTertiary || '#999' }]}>
          👋
        </Text>
        <Text style={[styles.emptyTitle, { color: colors.textSecondary }]}>
          No Friend Requests
        </Text>
        <Text style={[styles.emptySubtitle, { color: colors.textTertiary || '#999' }]}>
          Search for users to add friends
        </Text>
      </View>
    );
  }

  // ── Main render ──────────────────────────────────────────────────

  return (
    <View style={[styles.container, { backgroundColor: colors.bgSecondary }]}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        stickySectionHeadersEnabled={false}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={refetch}
            tintColor={colors.utilityBrand500 || '#FF7A00'}
          />
        }
        renderSectionHeader={renderSectionHeader}
        removeClippedSubviews={true}
        maxToRenderPerBatch={10}
        windowSize={5}
        initialNumToRender={10}
        renderItem={({ item }) => renderRequestItem(item)}
      />
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  errorText: {
    fontSize: 14,
    marginBottom: 12,
    textAlign: 'center',
  },
  retryButton: {
    padding: 8,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
  },
  // ── Section Header ────────────────────────────────────────────────
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
    marginTop: 8,
    borderRadius: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionCount: {
    fontSize: 12,
    fontWeight: '500',
  },
  // ── Request Card ──────────────────────────────────────────────────
  requestCard: {
    borderRadius: 12,
    padding: 16,
    marginTop: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '700',
  },
  userDetails: {
    flex: 1,
  },
  nickname: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  message: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },
  timestamp: {
    fontSize: 11,
    marginTop: 4,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginLeft: 8,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  // ── Action Buttons ────────────────────────────────────────────────
  actions: {
    flexDirection: 'row',
    marginTop: 14,
    gap: 10,
  },
  actionButton: {
    flex: 1,
    height: 38,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  acceptButton: {
    backgroundColor: '#34C759',
  },
  acceptButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  rejectButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#F04438',
  },
  rejectButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
