/**
 * GroupSettingsScreen — Admin panel for group management.
 *
 * Allows group owners/admins to:
 * - Edit group name / avatar / announcement
 * - Toggle join approval & mute-all settings
 * - Transfer ownership to another member
 * - Disband group (owner only)
 */
import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery, useMutation } from '@apollo/client/react';
import { gql } from '@apollo/client';
import { useFront } from '@/lib/theme/ThemeContext';
import { RootStackParamList } from '@/Navigation';
import {
  UPDATE_GROUP,
  DISBAND_GROUP,
  TRANSFER_OWNER,
} from '@/api/operations';
import { authService } from '@/services/authService';

type GroupSettingsRouteProp = RouteProp<RootStackParamList, 'GroupSettings'>;
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface GroupMember {
  userId: string;
  nickname: string;
  avatar?: string | null;
  role: 'owner' | 'admin' | 'member';
}

interface GroupDetail {
  id: string;
  name: string;
  avatar?: string | null;
  announcement?: string | null;
  ownerId: string;
  memberCount: number;
  joinNeedApproval: boolean;
  isMuteAll: boolean;
  members: GroupMember[];
}

const GROUP_SETTINGS = gql`
  query GroupSettings($id: String!) {
    group(id: $id) {
      id
      name
      avatar
      announcement
      ownerId
      memberCount
      joinNeedApproval
      isMuteAll
      members {
        userId
        nickname
        avatar
        role
      }
    }
  }
`;

function getInitials(name: string | null | undefined): string {
  if (!name) return '?';
  return name.charAt(0).toUpperCase();
}

export default function GroupSettingsScreen() {
  const route = useRoute<GroupSettingsRouteProp>();
  const navigation = useNavigation<NavigationProp>();
  const { colors } = useFront();
  const { groupId, conversationId } = route.params;

  const currentUserId = authService.currentUser?.id;

  // ── Editable fields (initialised from query data) ─────────────
  const [editName, setEditName] = useState('');
  const [editAnnouncement, setEditAnnouncement] = useState('');
  const [editJoinNeedApproval, setEditJoinNeedApproval] = useState(false);
  const [editIsMuteAll, setEditIsMuteAll] = useState(false);
  const [fieldsInitialised, setFieldsInitialised] = useState(false);

  // ── Queries ──────────────────────────────────────────────────
  const {
    data,
    loading,
    error,
    refetch,
  } = useQuery<any>(GROUP_SETTINGS, {
    variables: { id: groupId },
    fetchPolicy: 'cache-and-network',
  });

  const detail: GroupDetail | null = data?.group ?? null;

  // Initialise editable fields once
  if (detail && !fieldsInitialised) {
    setEditName(detail.name || '');
    setEditAnnouncement(detail.announcement || '');
    setEditJoinNeedApproval(detail.joinNeedApproval);
    setEditIsMuteAll(detail.isMuteAll);
    setFieldsInitialised(true);
  }

  const isOwner = detail?.ownerId === currentUserId;
  const isAdmin =
    isOwner ||
    !!detail?.members?.find(
      (m) => m.userId === currentUserId && m.role === 'admin',
    );
  const canEdit = isOwner || isAdmin;

  // Options sorted by role: owner first, then admins, then members
  const candidateOwners = useMemo(() => {
    if (!detail?.members) return [];
    const sorted = [...detail.members].sort((a, b) => {
      const score = { owner: 3, admin: 2, member: 1 };
      return (score[b.role] || 0) - (score[a.role] || 0);
    });
    return sorted.filter((m) => m.userId !== currentUserId);
  }, [detail?.members, currentUserId]);

  // ── Mutations ────────────────────────────────────────────────
  const [updateGroup, { loading: updating }] = useMutation(UPDATE_GROUP, {
    refetchQueries: ['GroupSettings', 'Conversations'],
  });

  const [disbandGroup, { loading: disbanding }] = useMutation(DISBAND_GROUP, {
    refetchQueries: ['Conversations'],
  });

  const [transferOwner, { loading: transferring }] = useMutation(
    TRANSFER_OWNER,
    { refetchQueries: ['GroupSettings', 'Conversations'] },
  );

  // ── Handlers ─────────────────────────────────────────────────
  const handleSaveName = useCallback(async () => {
    if (!editName.trim() || !canEdit) return;
    try {
      await updateGroup({
        variables: { id: groupId, name: editName.trim() },
      });
      Alert.alert('Saved', 'Group name updated.');
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to update name');
    }
  }, [editName, canEdit, updateGroup, groupId]);

  const handleSaveAnnouncement = useCallback(async () => {
    if (!canEdit) return;
    try {
      await updateGroup({
        variables: { id: groupId, announcement: editAnnouncement.trim() },
      });
      Alert.alert('Saved', 'Announcement updated.');
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to update announcement');
    }
  }, [editAnnouncement, canEdit, updateGroup, groupId]);

  const handleToggleJoinApproval = useCallback(
    async (value: boolean) => {
      setEditJoinNeedApproval(value);
      if (!canEdit) return;
      try {
        await updateGroup({
          variables: { id: groupId, joinNeedApproval: value },
        });
      } catch (err: any) {
        setEditJoinNeedApproval(!value); // revert
        Alert.alert('Error', err?.message || 'Failed to update setting');
      }
    },
    [canEdit, updateGroup, groupId],
  );

  const handleToggleMuteAll = useCallback(
    async (value: boolean) => {
      setEditIsMuteAll(value);
      if (!canEdit) return;
      try {
        await updateGroup({
          variables: { id: groupId, isMuteAll: value },
        });
      } catch (err: any) {
        setEditIsMuteAll(!value); // revert
        Alert.alert('Error', err?.message || 'Failed to update setting');
      }
    },
    [canEdit, updateGroup, groupId],
  );

  const handleTransferOwnership = useCallback(() => {
    if (!isOwner || candidateOwners.length === 0) return;

    const options = candidateOwners.map(
      (m) => `${m.nickname} (${m.role})`,
    );
    const cancelIndex = options.length;

    Alert.alert(
      'Transfer Ownership',
      'Select a new group owner:',
      [
        ...options.map((_, index) => ({
          text: candidateOwners[index].nickname,
          onPress: async () => {
            try {
              await transferOwner({
                variables: {
                  groupId,
                  userId: candidateOwners[index].userId,
                },
              });
              Alert.alert('Done', 'Ownership transferred.');
              navigation.goBack();
            } catch (err: any) {
              Alert.alert(
                'Error',
                err?.message || 'Failed to transfer ownership',
              );
            }
          },
        })),
        { text: 'Cancel', style: 'cancel' as const },
      ],
    );
  }, [isOwner, candidateOwners, transferOwner, groupId, navigation]);

  const handleDisbandGroup = useCallback(() => {
    Alert.alert(
      'Disband Group',
      'This action is irreversible. All messages will be lost. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disband',
          style: 'destructive',
          onPress: async () => {
            try {
              await disbandGroup({ variables: { groupId } });
              navigation.navigate('MainTabs');
            } catch (err: any) {
              Alert.alert(
                'Error',
                err?.message || 'Failed to disband group',
              );
            }
          },
        },
      ],
    );
  }, [disbandGroup, groupId, navigation]);

  // ── Render: Loading / Error ──────────────────────────────────
  if (loading && !detail) {
    return (
      <View style={[styles.center, { backgroundColor: colors.bgPrimary, flex: 1 }]}>
        <ActivityIndicator size="large" color={colors.utilityBrand500 || '#FF7A00'} />
      </View>
    );
  }

  if (error && !detail) {
    return (
      <View style={[styles.center, { backgroundColor: colors.bgPrimary, flex: 1 }]}>
        <Text style={[styles.errorText, { color: colors.utilityError200 }]}>
          {error.message}
        </Text>
        <TouchableOpacity onPress={() => refetch()}>
          <Text style={{ color: colors.utilityBrand500 || '#FF7A00', marginTop: 8 }}>
            Retry
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!detail) {
    return (
      <View style={[styles.center, { backgroundColor: colors.bgPrimary, flex: 1 }]}>
        <Text style={{ color: colors.textSecondary }}>Group not found</Text>
      </View>
    );
  }

  // ── Render ───────────────────────────────────────────────────
  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.bgSecondary }]}
      contentContainerStyle={styles.contentContainer}
      keyboardShouldPersistTaps="handled"
    >
      {/* ═══════════════════════════════════════════════════════════
           Section 1: Group Name
          ═══════════════════════════════════════════════════════════ */}
      <View style={[styles.section, { backgroundColor: colors.bgPrimary }]}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
          Group Name
        </Text>
        <View style={styles.editRow}>
          <TextInput
            style={[
              styles.textInput,
              { color: colors.textPrimary, backgroundColor: colors.bgSecondary },
            ]}
            value={editName}
            onChangeText={setEditName}
            editable={canEdit}
            maxLength={50}
          />
          {canEdit && (
            <TouchableOpacity
              style={[
                styles.saveButton,
                { backgroundColor: colors.utilityBrand500 || '#FF7A00' },
              ]}
              onPress={handleSaveName}
              disabled={updating}
            >
              {updating ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.saveButtonText}>Save</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ═══════════════════════════════════════════════════════════
           Section 2: Announcement
          ═══════════════════════════════════════════════════════════ */}
      <View
        style={[
          styles.section,
          { backgroundColor: colors.bgPrimary, marginTop: 12 },
        ]}
      >
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
          Announcement
        </Text>
        <TextInput
          style={[
            styles.textArea,
            {
              color: colors.textPrimary,
              backgroundColor: colors.bgSecondary,
            },
          ]}
          value={editAnnouncement}
          onChangeText={setEditAnnouncement}
          editable={canEdit}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
          placeholder="No announcement"
          placeholderTextColor={colors.textTertiary || '#999'}
        />
        {canEdit && (
          <TouchableOpacity
            style={[
              styles.saveButton,
              {
                backgroundColor: colors.utilityBrand500 || '#FF7A00',
                alignSelf: 'flex-end',
                marginTop: 8,
              },
            ]}
            onPress={handleSaveAnnouncement}
            disabled={updating}
          >
            {updating ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.saveButtonText}>Save</Text>
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* ═══════════════════════════════════════════════════════════
           Section 3: Toggle Settings
          ═══════════════════════════════════════════════════════════ */}
      <View
        style={[
          styles.section,
          { backgroundColor: colors.bgPrimary, marginTop: 12 },
        ]}
      >
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
          Settings
        </Text>

        {/* Join Need Approval */}
        <View style={[styles.toggleRow, { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderSecondary || 'rgba(0,0,0,0.08)' }]}>
          <View style={styles.toggleLabel}>
            <Text style={[styles.toggleTitle, { color: colors.textPrimary }]}>
              Join Need Approval
            </Text>
            <Text style={[styles.toggleDesc, { color: colors.textTertiary || '#999' }]}>
              New members require admin approval
            </Text>
          </View>
          <Switch
            value={editJoinNeedApproval}
            onValueChange={handleToggleJoinApproval}
            disabled={!canEdit}
            trackColor={{
              true: colors.utilityBrand500 || '#FF7A00',
              false: colors.borderSecondary || '#ccc',
            }}
          />
        </View>

        {/* Mute All Members */}
        <View style={styles.toggleRow}>
          <View style={styles.toggleLabel}>
            <Text style={[styles.toggleTitle, { color: colors.textPrimary }]}>
              Mute All Members
            </Text>
            <Text style={[styles.toggleDesc, { color: colors.textTertiary || '#999' }]}>
              Only admins can send messages
            </Text>
          </View>
          <Switch
            value={editIsMuteAll}
            onValueChange={handleToggleMuteAll}
            disabled={!canEdit}
            trackColor={{
              true: colors.utilityBrand500 || '#FF7A00',
              false: colors.borderSecondary || '#ccc',
            }}
          />
        </View>
      </View>

      {/* ═══════════════════════════════════════════════════════════
           Section 4: Danger Zone (Owner only)
          ═══════════════════════════════════════════════════════════ */}
      {isOwner && (
        <View
          style={[
            styles.section,
            { backgroundColor: colors.bgPrimary, marginTop: 12 },
          ]}
        >
          <Text
            style={[
              styles.sectionTitle,
              { color: colors.utilityError200 || '#F04438' },
            ]}
          >
            Danger Zone
          </Text>

          {/* Transfer Ownership */}
          <TouchableOpacity
            style={styles.dangerMenuItem}
            onPress={handleTransferOwnership}
            activeOpacity={0.7}
            disabled={transferring}
          >
            <Text style={[styles.dangerMenuItemLabel, { color: colors.textPrimary }]}>
              Transfer Ownership
            </Text>
            <View style={styles.menuItemRight}>
              {transferring ? (
                <ActivityIndicator size="small" color={colors.textSecondary} />
              ) : (
                <Text style={[styles.arrow, { color: colors.textSecondary }]}>›</Text>
              )}
            </View>
          </TouchableOpacity>

          {/* Disband Group */}
          <TouchableOpacity
            style={styles.dangerMenuItem}
            onPress={handleDisbandGroup}
            activeOpacity={0.7}
            disabled={disbanding}
          >
            <Text style={[styles.dangerActionText, { color: colors.utilityError200 || '#F04438' }]}>
              Disband Group
            </Text>
            <View style={styles.menuItemRight}>
              {disbanding ? (
                <ActivityIndicator size="small" color={colors.utilityError200 || '#F04438'} />
              ) : (
                <Text style={[styles.arrow, { color: colors.utilityError200 || '#F04438' }]}>›</Text>
              )}
            </View>
          </TouchableOpacity>
        </View>
      )}

      <View style={{ height: 50 }} />
    </ScrollView>
  );
}

// ── Styles ───────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1 },
  contentContainer: { paddingTop: 12, paddingBottom: 24 },
  center: { justifyContent: 'center', alignItems: 'center' },
  errorText: { fontSize: 14, marginBottom: 12 },

  section: {
    borderRadius: 12,
    marginHorizontal: 16,
    overflow: 'hidden',
    padding: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },

  // ── Edit Row (Name) ──────────────────────────────────────────
  editRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  textInput: {
    flex: 1,
    height: 44,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 16,
  },
  textArea: {
    minHeight: 80,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    lineHeight: 20,
  },
  saveButton: {
    height: 36,
    paddingHorizontal: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },

  // ── Toggle Row ──────────────────────────────────────────────
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  toggleLabel: {
    flex: 1,
    marginRight: 12,
  },
  toggleTitle: {
    fontSize: 16,
    fontWeight: '500',
  },
  toggleDesc: {
    fontSize: 12,
    marginTop: 2,
  },

  // ── Danger Zone ─────────────────────────────────────────────
  dangerMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.08)',
  },
  dangerMenuItemLabel: {
    fontSize: 16,
  },
  dangerActionText: {
    fontSize: 16,
    fontWeight: '600',
  },
  menuItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  arrow: {
    fontSize: 20,
    fontWeight: '300',
  },
});
