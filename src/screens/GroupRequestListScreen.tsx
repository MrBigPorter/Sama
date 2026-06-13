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
} from 'react-native';
import { useRoute, RouteProp } from '@react-navigation/native';
import { useQuery, useMutation } from '@apollo/client/react';
import { useFront } from '@/lib/theme/ThemeContext';
import { RootStackParamList } from '@/Navigation';
import { GET_JOIN_REQUESTS, HANDLE_JOIN_REQUEST } from '@/api/operations';

// ── Types ────────────────────────────────────────────────────────────

type GroupRequestListRouteProp = RouteProp<RootStackParamList, 'GroupRequestList'>;

interface JoinRequestItem {
  id: string;
  groupId: string;
  userId: string;
  reason?: string | null;
  status: string;
  createdAt: string;
  user?: {
    nickname: string;
    avatar?: string | null;
  };
}

// ── Helpers ──────────────────────────────────────────────────────────

function getInitials(name: string | null | undefined): string {
  if (!name) return '?';
  return name.charAt(0).toUpperCase();
}

function formatTimestamp(isoDate: string): string {
  const date = new Date(isoDate);
  const month = date.toLocaleString('default', { month: 'short' });
  const day = date.getDate();
  return `${month} ${day}`;
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'PENDING':
      return '#FF9500';
    case 'APPROVED':
      return '#34C759';
    case 'REJECTED':
      return '#FF3B30';
    default:
      return '#8E8E93';
  }
}

// ── Component ────────────────────────────────────────────────────────

export default function GroupRequestListScreen() {
  const route = useRoute<GroupRequestListRouteProp>();
  const { colors } = useFront();
  const { groupId } = route.params;

  // ── Queries ──────────────────────────────────────────────────────

  const {
    data,
    loading,
    error,
    refetch,
  } = useQuery<any>(GET_JOIN_REQUESTS, {
    variables: { groupId },
    fetchPolicy: 'cache-and-network',
  });

  // ── Mutations ────────────────────────────────────────────────────

  const [handleRequest, { loading: handling }] = useMutation(HANDLE_JOIN_REQUEST, {
    refetchQueries: ['GetJoinRequests'],
  });

  // ── Derived ──────────────────────────────────────────────────────

  const requests: JoinRequestItem[] = data?.getJoinRequests ?? [];

  // ── Handlers ─────────────────────────────────────────────────────

  const handleAccept = useCallback(
    async (requestId: string) => {
      try {
        await handleRequest({ variables: { requestId, action: 'APPROVE' } });
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
        'Are you sure you want to reject this request?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Reject',
            style: 'destructive',
            onPress: async () => {
              try {
                await handleRequest({ variables: { requestId, action: 'REJECT' } });
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

  // ── Render: Loading ──────────────────────────────────────────────

  if (loading && requests.length === 0) {
    return (
      <View style={[styles.center, { backgroundColor: colors.bgPrimary, flex: 1 }]}>
        <ActivityIndicator size="large" color={colors.utilityBrand500 || '#FF7A00'} />
      </View>
    );
  }

  // ── Render: Error ────────────────────────────────────────────────

  if (error && requests.length === 0) {
    return (
      <View style={[styles.center, { backgroundColor: colors.bgPrimary, flex: 1 }]}>
        <Text style={[styles.errorText, { color: colors.utilityError200 }]}>
          {error.message}
        </Text>
        <TouchableOpacity onPress={() => refetch()} style={styles.retryButton}>
          <Text style={{ color: colors.utilityBrand500 || '#FF7A00' }}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Render: Empty ────────────────────────────────────────────────

  if (requests.length === 0) {
    return (
      <View style={[styles.center, { backgroundColor: colors.bgPrimary, flex: 1 }]}>
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
          No pending join requests
        </Text>
      </View>
    );
  }

  // ── Render: List ─────────────────────────────────────────────────

  return (
    <View style={[styles.container, { backgroundColor: colors.bgSecondary }]}>
      <FlatList
        data={requests}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={refetch}
            tintColor={colors.utilityBrand500 || '#FF7A00'}
          />
        }
        removeClippedSubviews={true}
        maxToRenderPerBatch={10}
        windowSize={5}
        initialNumToRender={10}
        renderItem={({ item }) => (
          <View style={[styles.requestCard, { backgroundColor: colors.bgPrimary }]}>
            {/* User info */}
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
                  {getInitials(item.user?.nickname)}
                </Text>
              </View>
              <View style={styles.userDetails}>
                <Text style={[styles.nickname, { color: colors.textPrimary }]}>
                  {item.user?.nickname ?? 'Unknown User'}
                </Text>
                <Text style={[styles.timestamp, { color: colors.textSecondary }]}>
                  {formatTimestamp(item.createdAt)}
                </Text>
                {item.reason && (
                  <Text
                    style={[styles.reason, { color: colors.textSecondary }]}
                    numberOfLines={2}
                  >
                    {item.reason}
                  </Text>
                )}
              </View>
              {/* Status badge */}
              <View
                style={[
                  styles.statusBadge,
                  { backgroundColor: getStatusColor(item.status) + '20' },
                ]}
              >
                <Text
                  style={[
                    styles.statusText,
                    { color: getStatusColor(item.status) },
                  ]}
                >
                  {item.status}
                </Text>
              </View>
            </View>

            {/* Action buttons (only for PENDING requests) */}
            {item.status === 'PENDING' && (
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
        )}
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
    gap: 12,
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 14,
    marginBottom: 12,
  },
  retryButton: {
    padding: 8,
  },
  emptyText: {
    fontSize: 15,
  },
  // ── Request Card ────────────────────────────────────────────────
  requestCard: {
    borderRadius: 12,
    padding: 16,
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
  timestamp: {
    fontSize: 12,
    marginBottom: 4,
  },
  reason: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
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
  // ── Action Buttons ──────────────────────────────────────────────
  actions: {
    flexDirection: 'row',
    marginTop: 12,
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
