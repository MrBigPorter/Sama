/**
 * ContactsScreen — Contact list with search, new friends, and long-press actions
 *
 * Flutter equivalent: contact_list_page.dart
 * - Search bar at top → navigates to SearchScreen
 * - "New Friends" row with pending request badge count
 * - Contact list with status indicators
 * - Long-press menu: Remove Contact / Block Contact
 * - Real-time updates via socket events
 */
import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  ActionSheetIOS,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery, useMutation } from '@apollo/client/react';
import { useFront } from '@/lib/theme/ThemeContext';
import { useSocket } from '@/lib/hooks/useSocket';
import { SocketEvent } from '@/services/socketService';
import { CONTACTS, FRIEND_REQUESTS, REMOVE_CONTACT, BLOCK_CONTACT } from '@/api/operations';
import { RootStackParamList } from '@/Navigation';
import type { Contact, FriendRequest } from '@/types/graphql';

// ── Types ────────────────────────────────────────────────────────────

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

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

function getStatusInfo(status: number): { label: string; color: string } {
  switch (status) {
    case 1:
      return { label: 'online', color: '#34C759' };
    case 2:
      return { label: 'away', color: '#FF9500' };
    case 3:
      return { label: 'busy', color: '#FF3B30' };
    default:
      return { label: 'offline', color: '#C7C7CC' };
  }
}

// ── Component ────────────────────────────────────────────────────────

export default function ContactsScreen() {
  const { front, colors } = useFront();
  const navigation = useNavigation<NavigationProp>();
  const [longPressedContact, setLongPressedContact] = useState<Contact | null>(null);

  // ── Queries ──────────────────────────────────────────────────────

  // Contacts
  const { loading, data, error, refetch } = useQuery<{ contacts: Contact[] }>(CONTACTS, {
    notifyOnNetworkStatusChange: true,
  });

  // Friend request count for badge
  const { data: friendRequestData } = useQuery<any>(FRIEND_REQUESTS, {
    fetchPolicy: 'cache-and-network',
  });

  const contacts: Contact[] = data?.contacts ?? [];

  // Count pending received friend requests
  const pendingRequestCount = (friendRequestData?.friendRequests ?? []).filter(
    (req: any) => req.status === 'PENDING',
  ).length;

  // ── Mutations ────────────────────────────────────────────────────

  const [removeContact] = useMutation(REMOVE_CONTACT, {
    refetchQueries: ['Contacts'],
  });

  const [blockContact] = useMutation(BLOCK_CONTACT, {
    refetchQueries: ['Contacts'],
  });

  // ── Real-time updates ────────────────────────────────────────────

  useSocket(SocketEvent.CONTACT_REQUEST_HANDLED, useCallback(() => {
    refetch();
  }, [refetch]));

  useSocket(SocketEvent.FRIEND_REQUEST_HANDLED, useCallback(() => {
    refetch();
  }, [refetch]));

  // ── Navigation handlers ──────────────────────────────────────────

  const handleSearchPress = useCallback(() => {
    navigation.navigate('Search');
  }, [navigation]);

  const handleNewFriendsPress = useCallback(() => {
    navigation.navigate('NewFriend');
  }, [navigation]);

  const handleContactPress = useCallback(
    (contact: Contact) => {
      navigation.navigate('Conversation', {
        conversationId: contact.userId,
        title: contact.nickname || 'Chat',
      });
    },
    [navigation],
  );

  // ── Long-press handler (iOS ActionSheet / Android Alert) ─────────

  const handleLongPress = useCallback(
    (contact: Contact) => {
      setLongPressedContact(contact);

      if (Platform.OS === 'ios') {
        ActionSheetIOS.showActionSheetWithOptions(
          {
            options: ['Cancel', 'Remove Contact', 'Block Contact'],
            cancelButtonIndex: 0,
            destructiveButtonIndex: 1,
            title: contact.nickname || 'Contact',
          },
          (buttonIndex) => {
            if (buttonIndex === 1) {
              confirmRemoveContact(contact);
            } else if (buttonIndex === 2) {
              confirmBlockContact(contact);
            }
            setLongPressedContact(null);
          },
        );
      } else {
        // Android: use Alert
        Alert.alert(
          contact.nickname || 'Contact',
          'Choose an action',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Remove Contact',
              style: 'destructive',
              onPress: () => confirmRemoveContact(contact),
            },
            {
              text: 'Block Contact',
              style: 'destructive',
              onPress: () => confirmBlockContact(contact),
            },
          ],
        );
        setLongPressedContact(null);
      }
    },
    [],
  );

  const confirmRemoveContact = useCallback(
    (contact: Contact) => {
      Alert.alert(
        'Remove Contact',
        `Are you sure you want to remove ${contact.nickname || 'this contact'}?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Remove',
            style: 'destructive',
            onPress: async () => {
              try {
                await removeContact({ variables: { contactId: contact.id } });
              } catch (err: any) {
                Alert.alert('Error', err.message || 'Failed to remove contact');
              }
            },
          },
        ],
      );
    },
    [removeContact],
  );

  const confirmBlockContact = useCallback(
    (contact: Contact) => {
      Alert.alert(
        'Block Contact',
        `Are you sure you want to block ${contact.nickname || 'this contact'}? They will be removed from your contacts.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Block',
            style: 'destructive',
            onPress: async () => {
              try {
                await blockContact({ variables: { contactId: contact.id } });
              } catch (err: any) {
                Alert.alert('Error', err.message || 'Failed to block contact');
              }
            },
          },
        ],
      );
    },
    [blockContact],
  );

  // ── Render: Header Components ────────────────────────────────────

  const renderListHeader = () => (
    <View style={styles.listHeader}>
      {/* Search bar entry */}
      <TouchableOpacity
        style={[styles.searchBar, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSecondary }]}
        onPress={handleSearchPress}
        activeOpacity={0.7}
      >
        <Text style={[styles.searchIcon, { color: colors.textTertiary || '#999' }]}>
          🔍
        </Text>
        <Text style={[styles.searchPlaceholder, { color: colors.textTertiary || '#999' }]}>
          Search users & groups
        </Text>
      </TouchableOpacity>

      {/* New Friends entry */}
      <TouchableOpacity
        style={[styles.newFriendsRow, { backgroundColor: colors.bgSecondary }]}
        onPress={handleNewFriendsPress}
        activeOpacity={0.7}
      >
        <View style={[styles.newFriendsIcon, { backgroundColor: colors.utilityBrand200 || '#FFE0B3' }]}>
          <Text style={[styles.newFriendsEmoji, { color: colors.utilityBrand700 || '#C25A00' }]}>
            👥
          </Text>
        </View>
        <View style={styles.newFriendsInfo}>
          <Text style={[styles.newFriendsLabel, { color: colors.textPrimary }]}>
            New Friends
          </Text>
          <Text style={[styles.newFriendsSub, { color: colors.textTertiary || '#999' }]}>
            Friend requests & invitations
          </Text>
        </View>
        {pendingRequestCount > 0 && (
          <View style={[styles.badge, { backgroundColor: colors.utilityBrand500 || '#FF7A00' }]}>
            <Text style={styles.badgeText}>
              {pendingRequestCount > 99 ? '99+' : pendingRequestCount}
            </Text>
          </View>
        )}
        <Text style={[styles.chevron, { color: colors.textTertiary || '#999' }]}>›</Text>
      </TouchableOpacity>

      {/* Section title for contacts */}
      {contacts.length > 0 && (
        <View style={styles.contactsHeader}>
          <Text style={[styles.contactsSectionTitle, { color: colors.textSecondary }]}>
            Contacts ({contacts.length})
          </Text>
        </View>
      )}
    </View>
  );

  // ── Render: Main Content ─────────────────────────────────────────

  if (loading && contacts.length === 0) {
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
          Failed to load contacts
        </Text>
        <TouchableOpacity onPress={() => refetch()}>
          <Text style={{ color: colors.utilityBrand500 || '#FF7A00' }}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
      <FlatList
        data={contacts}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: front.spacingMd || 16 }}
        ListHeaderComponent={renderListHeader}
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
              No contacts yet
            </Text>
            <Text style={[styles.emptyHint, { color: colors.textTertiary || '#999' }]}>
              Search for users to add friends
            </Text>
          </View>
        }
        removeClippedSubviews={true}
        maxToRenderPerBatch={10}
        windowSize={5}
        initialNumToRender={10}
        renderItem={({ item }) => {
          const statusInfo = getStatusInfo(item.status);
          return (
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => handleContactPress(item)}
              onLongPress={() => handleLongPress(item)}
              delayLongPress={500}
              style={[
                styles.contactItem,
                {
                  backgroundColor: colors.bgSecondary,
                  marginBottom: front.spacingSm || 8,
                  padding: front.spacingMd || 16,
                  borderRadius: front.radiusMd || 8,
                },
              ]}
            >
              {item.avatar ? (
                <Image
                  source={{ uri: item.avatar }}
                  style={styles.contactAvatarImg}
                  contentFit="cover"
                />
              ) : (
                <View
                  style={[
                    styles.avatar,
                    { backgroundColor: colors.utilityBrand200 || '#FFE0B3' },
                  ]}
                >
                  <Text
                    style={[
                      styles.avatarText,
                      { color: colors.utilityBrand700 || '#C25A00' },
                    ]}
                  >
                    {getInitials(item.nickname)}
                  </Text>
                </View>
              )}
              <View style={styles.contactInfo}>
                <View style={styles.nameRow}>
                  <Text style={[styles.name, { color: colors.textPrimary }]}>
                    {item.nickname}
                  </Text>
                  <View
                    style={[styles.statusDot, { backgroundColor: statusInfo.color }]}
                  />
                </View>
                <Text style={[styles.statusLabel, { color: colors.textTertiary || '#999' }]}>
                  {statusInfo.label}
                </Text>
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  // ── Header ────────────────────────────────────────────────────────
  listHeader: {
    marginBottom: 8,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    height: 44,
    marginBottom: 12,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  searchPlaceholder: {
    fontSize: 15,
  },
  // ── New Friends Row ───────────────────────────────────────────────
  newFriendsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    marginBottom: 12,
  },
  newFriendsIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  newFriendsEmoji: {
    fontSize: 20,
  },
  newFriendsInfo: {
    flex: 1,
  },
  newFriendsLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  newFriendsSub: {
    fontSize: 13,
  },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  chevron: {
    fontSize: 22,
    fontWeight: '300',
  },
  // ── Contacts Section Header ───────────────────────────────────────
  contactsHeader: {
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  contactsSectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  // ── Contact Items ─────────────────────────────────────────────────
  contactItem: { flexDirection: 'row', alignItems: 'center' },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: { fontSize: 16, fontWeight: '600' },
  contactAvatarImg: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
  },
  contactInfo: { flex: 1 },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  name: { fontSize: 16, fontWeight: '600', marginRight: 8 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusLabel: { fontSize: 13 },
  // ── Empty & Error states ──────────────────────────────────────────
  errorText: { fontSize: 15, marginBottom: 12 },
  emptyContainer: { paddingVertical: 60, alignItems: 'center' },
  emptyText: { fontSize: 15, marginBottom: 4 },
  emptyHint: { fontSize: 13 },
});
