/**
 * SearchScreen — Global search for users and groups
 *
 * Flutter equivalents: contact_search_page.dart, local_contact_search_page.dart
 * - Search users by nickname/phone with debounced input
 * - Search groups by name
 * - Results in two sections: Users / Groups
 * - User tap → UserProfileScreen, Group tap → GroupProfileScreen
 * - "Add Friend" button for users who are not yet contacts
 */
import React, { useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  SectionList,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery, useMutation } from '@apollo/client/react';
import { useFront } from '@/lib/theme/ThemeContext';
import { RootStackParamList } from '@/Navigation';
import { SEARCH_USERS, SEARCH_GROUPS, SEND_FRIEND_REQUEST, CONTACTS } from '@/api/operations';
import type { UserProfile, Group, Contact } from '@/types/graphql';

// ── Types ────────────────────────────────────────────────────────────

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface SearchSection {
  title: string;
  type: 'users' | 'groups';
  data: (UserProfile | Group)[];
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

// ── Component ────────────────────────────────────────────────────────

export default function SearchScreen() {
  const { front, colors } = useFront();
  const navigation = useNavigation<NavigationProp>();
  const [query, setQuery] = useState('');
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [debouncedQuery, setDebouncedQuery] = useState('');

  // ── Debounced search input ───────────────────────────────────────

  const handleQueryChange = useCallback((text: string) => {
    setQuery(text);
    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current);
    }
    searchTimerRef.current = setTimeout(() => {
      setDebouncedQuery(text.trim());
    }, 400);
  }, []);

  // ── Queries ──────────────────────────────────────────────────────

  const shouldSearch = debouncedQuery.length >= 1;

  const {
    data: userData,
    loading: loadingUsers,
  } = useQuery<{ searchUsers: UserProfile[] }>(SEARCH_USERS, {
    variables: { q: debouncedQuery },
    skip: !shouldSearch,
    fetchPolicy: 'cache-and-network',
  });

  const {
    data: groupData,
    loading: loadingGroups,
  } = useQuery<{ searchGroups: Group[] }>(SEARCH_GROUPS, {
    variables: { q: debouncedQuery },
    skip: !shouldSearch,
    fetchPolicy: 'cache-and-network',
  });

  // Get contacts to determine which users are already friends
  const { data: contactsData } = useQuery<{ contacts: Contact[] }>(CONTACTS, {
    fetchPolicy: 'cache-only',
  });

  const contactUserIds = useMemo(() => {
    const set = new Set<string>();
    (contactsData?.contacts ?? []).forEach((c) => set.add(c.userId));
    return set;
  }, [contactsData]);

  // ── Mutations ────────────────────────────────────────────────────

  const [sendRequest, { loading: sendingRequest }] = useMutation(SEND_FRIEND_REQUEST, {
    refetchQueries: ['FriendRequests'],
  });

  // ── Derived ──────────────────────────────────────────────────────

  const users = userData?.searchUsers ?? [];
  const groups = groupData?.searchGroups ?? [];

  const sections: SearchSection[] = [];
  if (users.length > 0) {
    sections.push({ title: `Users (${users.length})`, type: 'users', data: users });
  }
  if (groups.length > 0) {
    sections.push({ title: `Groups (${groups.length})`, type: 'groups', data: groups });
  }

  const isLoading = loadingUsers || loadingGroups;

  // ── Handlers ─────────────────────────────────────────────────────

  const handleUserPress = useCallback(
    (user: UserProfile) => {
      navigation.navigate('UserProfile', {
        userId: user.id,
        nickname: user.nickname || undefined,
        avatar: user.avatar || undefined,
      });
    },
    [navigation],
  );

  const handleGroupPress = useCallback(
    (group: Group) => {
      navigation.navigate('GroupProfile', {
        conversationId: group.id,
        groupId: group.id,
      });
    },
    [navigation],
  );

  const handleAddFriend = useCallback(
    async (userId: string) => {
      try {
        await sendRequest({ variables: { userId, message: null } });
      } catch (err: any) {
        // Silently handle — user may already have sent a request
      }
    },
    [sendRequest],
  );

  // ── Render ───────────────────────────────────────────────────────

  const renderUserItem = (user: UserProfile) => {
    const isContact = contactUserIds.has(user.id);
    return (
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => handleUserPress(user)}
        style={[
          styles.resultItem,
          {
            backgroundColor: colors.bgSecondary,
            marginBottom: front.spacingSm || 8,
            padding: front.spacingMd || 16,
            borderRadius: front.radiusMd || 8,
          },
        ]}
      >
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
            {getInitials(user.nickname)}
          </Text>
        </View>
        <View style={styles.itemInfo}>
          <Text style={[styles.itemName, { color: colors.textPrimary }]}>
            {user.nickname || user.phone}
          </Text>
          <Text style={[styles.itemSub, { color: colors.textTertiary || '#999' }]}>
            {user.phone}
          </Text>
        </View>
        {!isContact && (
          <TouchableOpacity
            style={[styles.addButton, { backgroundColor: colors.utilityBrand500 || '#FF7A00' }]}
            onPress={() => handleAddFriend(user.id)}
            disabled={sendingRequest}
            activeOpacity={0.7}
          >
            <Text style={styles.addButtonText}>Add</Text>
          </TouchableOpacity>
        )}
        {isContact && (
          <View style={[styles.contactBadge]}>
            <Text style={[styles.contactBadgeText, { color: colors.utilityBrand500 || '#FF7A00' }]}>
              Friend
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderGroupItem = (group: Group) => (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() => handleGroupPress(group)}
      style={[
        styles.resultItem,
        {
          backgroundColor: colors.bgSecondary,
          marginBottom: front.spacingSm || 8,
          padding: front.spacingMd || 16,
          borderRadius: front.radiusMd || 8,
        },
      ]}
    >
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
          {getInitials(group.name)}
        </Text>
      </View>
      <View style={styles.itemInfo}>
        <Text style={[styles.itemName, { color: colors.textPrimary }]}>
          {group.name}
        </Text>
        <Text style={[styles.itemSub, { color: colors.textTertiary || '#999' }]}>
          {group.memberCount} members
        </Text>
      </View>
    </TouchableOpacity>
  );

  const renderSectionHeader = ({ section }: { section: SearchSection }) => (
    <View style={styles.sectionHeader}>
      <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
        {section.title}
      </Text>
    </View>
  );

  const renderItem = ({ section, item }: { section: SearchSection; item: any }) => {
    if (section.type === 'users') {
      return renderUserItem(item as UserProfile);
    }
    return renderGroupItem(item as Group);
  };

  // ── Empty/initial states ─────────────────────────────────────────

  const renderEmpty = () => {
    if (!shouldSearch) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyIcon, { color: colors.textTertiary || '#999' }]}>
            🔍
          </Text>
          <Text style={[styles.emptyTitle, { color: colors.textSecondary }]}>
            Search users & groups
          </Text>
          <Text style={[styles.emptySubtitle, { color: colors.textTertiary || '#999' }]}>
            Enter a name or phone number to search
          </Text>
        </View>
      );
    }
    if (isLoading) {
      return (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color={colors.utilityBrand500 || '#FF7A00'} />
        </View>
      );
    }
    return (
      <View style={styles.emptyContainer}>
        <Text style={[styles.emptyTitle, { color: colors.textSecondary }]}>
          No results found
        </Text>
        <Text style={[styles.emptySubtitle, { color: colors.textTertiary || '#999' }]}>
          Try a different search term
        </Text>
      </View>
    );
  };

  // ── Main render ──────────────────────────────────────────────────

  return (
    <View style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
      {/* Search input */}
      <View style={[styles.searchBar, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSecondary }]}>
        <TextInput
          style={[styles.searchInput, { color: colors.textPrimary }]}
          placeholder="Search by name or phone..."
          placeholderTextColor={colors.textTertiary || '#999'}
          value={query}
          onChangeText={handleQueryChange}
          autoFocus
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
      </View>

      {/* Results */}
      {sections.length > 0 ? (
        <SectionList
          sections={sections}
          keyExtractor={(item: any) => item.id}
          contentContainerStyle={styles.listContent}
          stickySectionHeadersEnabled={false}
          renderSectionHeader={renderSectionHeader}
          removeClippedSubviews={true}
          maxToRenderPerBatch={10}
          windowSize={5}
          initialNumToRender={10}
          renderItem={renderItem}
          ListFooterComponent={<View style={{ height: 40 }} />}
        />
      ) : (
        <View style={styles.emptyWrapper}>
          {renderEmpty()}
        </View>
      )}
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  // ── Search Bar ────────────────────────────────────────────────────
  searchBar: {
    margin: 16,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    height: 44,
    justifyContent: 'center',
  },
  searchInput: {
    fontSize: 16,
    padding: 0,
  },
  // ── List ──────────────────────────────────────────────────────────
  listContent: {
    paddingHorizontal: 16,
  },
  sectionHeader: {
    paddingVertical: 8,
    paddingHorizontal: 4,
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  // ── Result Items ──────────────────────────────────────────────────
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '600',
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  itemSub: {
    fontSize: 13,
  },
  // ── Action Button ─────────────────────────────────────────────────
  addButton: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  contactBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  contactBadgeText: {
    fontSize: 12,
    fontWeight: '500',
  },
  // ── Empty States ──────────────────────────────────────────────────
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyWrapper: {
    flex: 1,
    justifyContent: 'center',
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
});
