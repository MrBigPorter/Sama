import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery, useMutation } from '@apollo/client/react';
import { useFront } from '@/lib/theme/ThemeContext';
import { CONTACTS, CREATE_GROUP } from '@/api/operations';
import { RootStackParamList } from '@/Navigation';
import type { Contact } from '@/types/graphql';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

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

export default function CreateGroupScreen() {
  const { front, colors } = useFront();
  const navigation = useNavigation<NavigationProp>();

  // ── Form State ────────────────────────────────────────────────
  const [groupName, setGroupName] = useState('');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // ── Queries & Mutations ───────────────────────────────────────

  const { loading, data, error, refetch } = useQuery<{ contacts: Contact[] }>(CONTACTS, {
    notifyOnNetworkStatusChange: true,
  });

  const [createGroup, { loading: creating }] = useMutation(CREATE_GROUP, {
    refetchQueries: ['Conversations'],
    awaitRefetchQueries: true,
  });

  const contacts: Contact[] = data?.contacts ?? [];

  // ── Filtered contacts ─────────────────────────────────────────

  const filteredContacts = useMemo(() => {
    if (!searchKeyword.trim()) return contacts;
    const kw = searchKeyword.toLowerCase().trim();
    return contacts.filter((c) => c.nickname?.toLowerCase().includes(kw));
  }, [contacts, searchKeyword]);

  // ── Selection handlers ────────────────────────────────────────

  const toggleSelection = useCallback((contactId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(contactId)) {
        next.delete(contactId);
      } else {
        next.add(contactId);
      }
      return next;
    });
  }, []);

  const removeSelected = useCallback((contactId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(contactId);
      return next;
    });
  }, []);

  // ── Create group ──────────────────────────────────────────────

  const canCreate = groupName.trim().length > 0 && selectedIds.size > 0;

  const handleCreate = useCallback(async () => {
    if (!canCreate || creating) return;

    try {
      const { data: result } = await createGroup({
        variables: {
          name: groupName.trim(),
          memberIds: Array.from(selectedIds),
        },
      });

      const newGroup = (result as any)?.createGroup;
      if (newGroup?.id) {
        // Navigate to the new group's conversation (conversationId === groupId for groups)
        navigation.replace('Conversation', {
          conversationId: newGroup.id,
          title: newGroup.name || groupName.trim(),
          groupId: newGroup.id,
        });
      }
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to create group');
    }
  }, [canCreate, creating, createGroup, groupName, selectedIds, navigation]);

  // ── Render ────────────────────────────────────────────────────

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
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.bgPrimary }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
    >
      {/* ── Group Name Input ─────────────────────────────────── */}
      <View style={[styles.nameInputContainer, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSecondary }]}>
        <TextInput
          style={[styles.nameInput, { color: colors.textPrimary }]}
          placeholder="Group Name"
          placeholderTextColor={colors.textTertiary || '#999'}
          value={groupName}
          onChangeText={setGroupName}
          maxLength={50}
          autoFocus={false}
        />
      </View>

      {/* ── Search Bar ───────────────────────────────────────── */}
      <View style={[styles.searchContainer, { backgroundColor: colors.bgSecondary }]}>
        <TextInput
          style={[styles.searchInput, { color: colors.textPrimary }]}
          placeholder="Search friends..."
          placeholderTextColor={colors.textTertiary || '#999'}
          value={searchKeyword}
          onChangeText={setSearchKeyword}
        />
      </View>

      {/* ── Selected Members Horizontal List ─────────────────── */}
      {selectedIds.size > 0 && (
        <View style={styles.selectedContainer}>
          <FlatList
            horizontal
            data={Array.from(selectedIds)}
            keyExtractor={(id) => id}
            contentContainerStyle={styles.selectedList}
            showsHorizontalScrollIndicator={false}
            renderItem={({ item: id }) => {
              const contact = contacts.find((c) => c.userId === id);
              const name = contact?.nickname || '?';
              return (
                <View style={styles.selectedItem}>
                  <View style={[styles.selectedAvatar, { backgroundColor: colors.utilityBrand200 || '#FFE0B3' }]}>
                    <Text style={[styles.selectedAvatarText, { color: colors.utilityBrand700 || '#C25A00' }]}>
                      {getInitials(name)}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.removeButton, { backgroundColor: colors.utilityError300 || '#FCA5A5' }]}
                    onPress={() => removeSelected(id)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text style={styles.removeButtonText}>×</Text>
                  </TouchableOpacity>
                  <Text
                    style={[styles.selectedName, { color: colors.textSecondary }]}
                    numberOfLines={1}
                  >
                    {name}
                  </Text>
                </View>
              );
            }}
          />
        </View>
      )}

      {/* ── Contact List ─────────────────────────────────────── */}
      <FlatList
        data={filteredContacts}
        keyExtractor={(item) => item.userId}
        contentContainerStyle={{ paddingHorizontal: front.spacingMd || 16 }}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyText, { color: colors.textTertiary || '#999' }]}>
              {searchKeyword ? `No results for "${searchKeyword}"` : 'No contacts available'}
            </Text>
          </View>
        }
        removeClippedSubviews={true}
        maxToRenderPerBatch={10}
        windowSize={5}
        initialNumToRender={10}
        renderItem={({ item }) => {
          const isSelected = selectedIds.has(item.userId);
          return (
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => toggleSelection(item.userId)}
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
              {/* Circular checkbox */}
              <View
                style={[
                  styles.checkbox,
                  {
                    borderColor: isSelected ? (colors.utilityBrand500 || '#FF7A00') : (colors.borderPrimary || '#ccc'),
                    backgroundColor: isSelected ? (colors.utilityBrand500 || '#FF7A00') : 'transparent',
                  },
                ]}
              >
                {isSelected && <Text style={styles.checkmark}>✓</Text>}
              </View>

              {/* Avatar */}
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

              {/* Name */}
              <Text style={[styles.contactName, { color: colors.textPrimary }]}>
                {item.nickname}
              </Text>
            </TouchableOpacity>
          );
        }}
      />

      {/* ── Create Button (Fixed Bottom) ─────────────────────── */}
      <View style={[styles.bottomBar, { backgroundColor: colors.bgPrimary, borderTopColor: colors.borderSecondary }]}>
        <TouchableOpacity
          style={[
            styles.createButton,
            {
              backgroundColor: canCreate ? (colors.utilityBrand500 || '#FF7A00') : (colors.bgSecondary || '#E5E7EB'),
            },
          ]}
          disabled={!canCreate || creating}
          onPress={handleCreate}
          activeOpacity={0.8}
        >
          {creating ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text
              style={[
                styles.createButtonText,
                { color: canCreate ? '#fff' : (colors.textDisabled || '#9CA3AF') },
              ]}
            >
              Create Group ({selectedIds.size})
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText: { fontSize: 15, marginBottom: 12 },

  // ── Group Name Input ──────────────────────────────────────
  nameInputContainer: {
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
  },
  nameInput: {
    height: 44,
    fontSize: 16,
    fontWeight: '500',
  },

  // ── Search Bar ────────────────────────────────────────────
  searchContainer: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
    paddingHorizontal: 14,
  },
  searchInput: {
    height: 40,
    fontSize: 15,
  },

  // ── Selected Members ──────────────────────────────────────
  selectedContainer: {
    maxHeight: 80,
    marginBottom: 8,
  },
  selectedList: {
    paddingHorizontal: 16,
    gap: 12,
  },
  selectedItem: {
    alignItems: 'center',
    width: 56,
  },
  selectedAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedAvatarText: {
    fontSize: 14,
    fontWeight: '600',
  },
  removeButton: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 16,
  },
  selectedName: {
    fontSize: 11,
    marginTop: 4,
    textAlign: 'center',
  },

  // ── Contact List ──────────────────────────────────────────
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  checkmark: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: { fontSize: 16, fontWeight: '600' },
  contactName: { fontSize: 16, fontWeight: '500', flex: 1 },
  emptyContainer: { paddingVertical: 60, alignItems: 'center' },
  emptyText: { fontSize: 15 },

  // ── Bottom Create Button ──────────────────────────────────
  bottomBar: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  createButton: {
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
