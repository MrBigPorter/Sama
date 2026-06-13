/**
 * GroupProfileScreen — Group detail page.
 *
 * Shows member grid (with search), info menu items, admin controls,
 * and footer actions (send message / leave / disband / join).
 */
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ActionSheetIOS,
  Platform,
} from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery, useMutation } from '@apollo/client/react';
import { gql } from '@apollo/client';
import { Image } from 'expo-image';
import { useFront } from '@/lib/theme/ThemeContext';
import { RootStackParamList } from '@/Navigation';
import {
  LEAVE_GROUP,
  DISBAND_GROUP,
  CONVERSATION,
  KICK_MEMBER,
  SET_ADMIN,
  INVITE_TO_GROUP,
} from '@/api/operations';
import type { Group } from '@/types/graphql';
import { authService } from '@/services/authService';

// ── Types ────────────────────────────────────────────────────────────

type GroupProfileRouteProp = RouteProp<RootStackParamList, 'GroupProfile'>;
type GroupProfileNavProp = NativeStackNavigationProp<RootStackParamList>;

interface GroupMember {
  userId: string;
  nickname: string;
  avatar?: string | null;
  role: 'owner' | 'admin' | 'member';
  isMuted?: boolean;
}

interface GroupDetail extends Group {
  members: GroupMember[];
  joinNeedApproval: boolean;
  isMuteAll: boolean;
  announcement?: string | null;
}

// ── GraphQL: extended group query with members ──────────────────────

const GROUP_WITH_MEMBERS = gql`
  query GroupWithMembers($id: String!) {
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
        isMuted
      }
      createdAt
      updatedAt
    }
  }
`;

// ── Helpers ──────────────────────────────────────────────────────────

function getInitials(name: string | null | undefined): string {
  if (!name) return '?';
  return name.charAt(0).toUpperCase();
}

function formatMemberCount(count: number): string {
  if (count <= 0) return '0 members';
  return `${count} member${count !== 1 ? 's' : ''}`;
}

function getRoleLabel(role: string): string {
  switch (role) {
    case 'owner':
      return 'Owner';
    case 'admin':
      return 'Admin';
    default:
      return 'Member';
  }
}

function getRoleScore(role: string): number {
  switch (role) {
    case 'owner':
      return 3;
    case 'admin':
      return 2;
    default:
      return 1;
  }
}

// ── Component ────────────────────────────────────────────────────────

export default function GroupProfileScreen() {
  const route = useRoute<GroupProfileRouteProp>();
  const navigation = useNavigation<GroupProfileNavProp>();
  const { colors } = useFront();
  const { groupId, conversationId } = route.params;

  const [searchKeyword, setSearchKeyword] = useState('');
  const currentUserId = authService.currentUser?.id;

  // ── Queries ──────────────────────────────────────────────────────

  const {
    data: groupData,
    loading: groupLoading,
    error: groupError,
    refetch: refetchGroup,
  } = useQuery<any>(GROUP_WITH_MEMBERS, {
    variables: { id: groupId },
    fetchPolicy: 'cache-and-network',
  });

  const { data: convData } = useQuery(CONVERSATION, {
    variables: { id: conversationId },
    fetchPolicy: 'cache-first',
  });

  // ── Mutations ────────────────────────────────────────────────────

  const [leaveGroup, { loading: leaving }] = useMutation(LEAVE_GROUP, {
    refetchQueries: ['Conversations'],
  });

  const [disbandGroup, { loading: disbanding }] = useMutation(DISBAND_GROUP, {
    refetchQueries: ['Conversations'],
  });

  const [kickMember] = useMutation(KICK_MEMBER, {
    refetchQueries: ['GroupWithMembers'],
  });

  const [setAdmin] = useMutation(SET_ADMIN, {
    refetchQueries: ['GroupWithMembers'],
  });

  // ── Derived data ─────────────────────────────────────────────────

  const detail: GroupDetail | null = groupData?.group ?? null;
  const conversationName = (convData as any)?.conversation?.name ?? null;

  const me = detail?.members?.find((m) => m.userId === currentUserId) ?? null;
  const isMember = me !== null;
  const isOwner = me?.role === 'owner';
  const isAdmin = me?.role === 'admin' || isOwner;
  const isManagement = isOwner || isAdmin;

  // Sort members by role (owner > admin > member)
  const sortedMembers: GroupMember[] = React.useMemo(() => {
    if (!detail?.members) return [];
    const filtered = searchKeyword
      ? detail.members.filter((m) =>
          m.nickname.toLowerCase().includes(searchKeyword.toLowerCase()),
        )
      : [...detail.members];
    filtered.sort((a, b) => getRoleScore(b.role) - getRoleScore(a.role));
    return filtered;
  }, [detail?.members, searchKeyword]);

  // ── Handlers ─────────────────────────────────────────────────────

  const handleLeaveGroup = useCallback(() => {
    Alert.alert(
      'Leave Group',
      'Are you sure you want to leave this group?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            try {
              await leaveGroup({ variables: { groupId } });
              navigation.goBack();
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to leave group');
            }
          },
        },
      ],
    );
  }, [groupId, leaveGroup, navigation]);

  const handleDisbandGroup = useCallback(() => {
    Alert.alert(
      'Disband Group',
      'This will permanently delete the group. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disband',
          style: 'destructive',
          onPress: async () => {
            try {
              await disbandGroup({ variables: { groupId } });
              navigation.goBack();
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to disband group');
            }
          },
        },
      ],
    );
  }, [groupId, disbandGroup, navigation]);

  const handleMemberTap = useCallback(
    (member: GroupMember) => {
      if (member.userId === currentUserId) return; // Skip self

      if (Platform.OS === 'ios' && isManagement) {
        // Show admin actions sheet
        const options = ['View Profile'];
        const handlers: (() => void)[] = [
          () => {
            navigation.navigate('UserProfile', {
              userId: member.userId,
              nickname: member.nickname,
              avatar: member.avatar || undefined,
            });
          },
        ];

        // Admin actions (can't kick/set-admin other admins if not owner)
        if (isOwner || (isAdmin && member.role === 'member')) {
          // Kick
          options.push('Kick Member');
          handlers.push(() => {
            Alert.alert(
              'Kick Member',
              `Remove ${member.nickname} from the group?`,
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Kick',
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      await kickMember({
                        variables: { groupId, userId: member.userId },
                      });
                      Alert.alert('Done', `${member.nickname} has been removed.`);
                    } catch (err: any) {
                      Alert.alert('Error', err?.message || 'Failed to kick member');
                    }
                  },
                },
              ],
            );
          });

          // Set / Remove Admin (owner only)
          if (isOwner) {
            if (member.role === 'admin') {
              options.push('Remove Admin');
              handlers.push(async () => {
                try {
                  await setAdmin({
                    variables: {
                      groupId,
                      userId: member.userId,
                      role: 'member',
                    },
                  });
                  Alert.alert('Done', `${member.nickname} is now a member.`);
                } catch (err: any) {
                  Alert.alert('Error', err?.message || 'Failed to update role');
                }
              });
            } else {
              options.push('Set as Admin');
              handlers.push(async () => {
                try {
                  await setAdmin({
                    variables: {
                      groupId,
                      userId: member.userId,
                      role: 'admin',
                    },
                  });
                  Alert.alert('Done', `${member.nickname} is now an admin.`);
                } catch (err: any) {
                  Alert.alert('Error', err?.message || 'Failed to update role');
                }
              });
            }
          }
        }

        options.push('Cancel');
        ActionSheetIOS.showActionSheetWithOptions(
          { options, cancelButtonIndex: options.length - 1 },
          (index) => {
            if (handlers[index]) handlers[index]();
          },
        );
      } else {
        // Simple tap — show role info
        Alert.alert(member.nickname, `Role: ${getRoleLabel(member.role)}`);
      }
    },
    [currentUserId, isManagement, isOwner, isAdmin, groupId, kickMember, setAdmin, navigation],
  );

  const handleSendMessage = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const handleCopyGroupId = useCallback(() => {
    Alert.alert('Group ID', groupId);
  }, [groupId]);

  const handleNavigateToSettings = useCallback(() => {
    navigation.navigate('GroupSettings', { groupId, conversationId });
  }, [navigation, groupId, conversationId]);

  // ── Render: Loading ─────────────────────────────────────────────

  if (groupLoading && !detail) {
    return (
      <View style={[styles.center, { backgroundColor: colors.bgPrimary, flex: 1 }]}>
        <ActivityIndicator size="large" color={colors.utilityBrand500 || '#FF7A00'} />
      </View>
    );
  }

  // ── Render: Error ────────────────────────────────────────────────

  if (groupError && !detail) {
    return (
      <View style={[styles.center, { backgroundColor: colors.bgPrimary, flex: 1 }]}>
        <Text style={[styles.errorText, { color: colors.utilityError200 }]}>
          {groupError.message}
        </Text>
        <TouchableOpacity onPress={() => refetchGroup()} style={styles.retryButton}>
          <Text style={{ color: colors.utilityBrand500 || '#FF7A00' }}>Retry</Text>
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

  // ── Render: Content ──────────────────────────────────────────────

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.bgSecondary }]}
      contentContainerStyle={styles.contentContainer}
    >
      {/* ═══════════════════════════════════════════════════════════
           Section 1: Member Grid (Member view) / Public Header (Stranger view)
          ═══════════════════════════════════════════════════════════ */}
      {isMember ? (
        <View style={[styles.section, { backgroundColor: colors.bgPrimary }]}>
          {/* Search bar: visible when memberCount > 5 */}
          {detail.memberCount > 5 && (
            <View style={styles.searchContainer}>
              <TextInput
                style={[
                  styles.searchInput,
                  { backgroundColor: colors.bgSecondary, color: colors.textPrimary },
                ]}
                placeholder="Search members"
                placeholderTextColor={colors.textSecondary}
                value={searchKeyword}
                onChangeText={setSearchKeyword}
              />
            </View>
          )}

          {/* Member grid */}
          <View style={styles.memberGrid}>
            {sortedMembers.map((member) => (
              <TouchableOpacity
                key={member.userId}
                style={styles.memberItem}
                onPress={() => handleMemberTap(member)}
                activeOpacity={0.7}
              >
                <View style={styles.memberAvatarContainer}>
                  {member.avatar ? (
                    <Image
                      source={{ uri: member.avatar }}
                      style={styles.memberAvatarImg}
                      contentFit="cover"
                    />
                  ) : (
                    <View
                      style={[
                        styles.memberAvatar,
                        { backgroundColor: colors.utilityBrand200 || '#FFE0B3' },
                      ]}
                    >
                      <Text style={[styles.memberAvatarText, { color: colors.utilityBrand700 || '#CC5500' }]}>
                        {getInitials(member.nickname)}
                      </Text>
                    </View>
                  )}
                  {/* Role badge */}
                  {member.role === 'owner' && (
                    <View style={[styles.roleBadge, { backgroundColor: '#FF9500' }]}>
                      <Text style={styles.roleBadgeText}>★</Text>
                    </View>
                  )}
                  {member.role === 'admin' && (
                    <View style={[styles.roleBadge, { backgroundColor: '#007AFF' }]}>
                      <Text style={styles.roleBadgeText}>⚔</Text>
                    </View>
                  )}
                </View>
                <Text
                  style={[
                    styles.memberName,
                    {
                      color:
                        member.userId === currentUserId
                          ? colors.utilityBrand500 || '#FF7A00'
                          : colors.textPrimary,
                    },
                  ]}
                  numberOfLines={1}
                >
                  {member.userId === currentUserId ? 'You' : member.nickname}
                </Text>
              </TouchableOpacity>
            ))}

            {/* Invite member button */}
            {isManagement && (
              <TouchableOpacity style={styles.memberItem} activeOpacity={0.7}>
                <View style={[styles.addButton, { borderColor: colors.borderSecondary }]}>
                  <Text style={[styles.addButtonText, { color: colors.textSecondary }]}>+</Text>
                </View>
              </TouchableOpacity>
            )}
          </View>
        </View>
      ) : (
        /* Public group header for non-members */
        <View style={[styles.section, styles.publicHeader, { backgroundColor: colors.bgPrimary }]}>
          {detail.avatar ? (
            <Image
              source={{ uri: detail.avatar }}
              style={styles.publicAvatarImg}
              contentFit="cover"
            />
          ) : (
            <View style={[styles.publicAvatar, { backgroundColor: colors.utilityBrand200 || '#FFE0B3' }]}>
              <Text style={[styles.publicAvatarText, { color: colors.utilityBrand700 || '#CC5500' }]}>
                {getInitials(detail.name)}
              </Text>
            </View>
          )}
          <Text style={[styles.publicGroupName, { color: colors.textPrimary }]}>
            {detail.name}
          </Text>
          <Text style={[styles.publicMemberCount, { color: colors.textSecondary }]}>
            {formatMemberCount(detail.memberCount)}
          </Text>
        </View>
      )}

      {/* ═══════════════════════════════════════════════════════════
           Section 2: Menu Items (Members only)
          ═══════════════════════════════════════════════════════════ */}
      {isMember && (
        <View style={[styles.section, { backgroundColor: colors.bgPrimary, marginTop: 12 }]}>
          {/* Group Settings (Management only) */}
          {isManagement && (
            <TouchableOpacity
              style={styles.menuItem}
              activeOpacity={0.7}
              onPress={handleNavigateToSettings}
            >
              <Text style={[styles.menuItemLabel, { color: colors.textPrimary }]}>
                Group Settings
              </Text>
              <View style={styles.menuItemRight}>
                <Text style={[styles.menuItemValue, { color: colors.textSecondary }]}>
                  Admin panel
                </Text>
                <Text style={[styles.arrow, { color: colors.textSecondary }]}>›</Text>
              </View>
            </TouchableOpacity>
          )}

          {/* Join Requests (Management only) */}
          {isManagement && (
            <TouchableOpacity
              style={styles.menuItem}
              activeOpacity={0.7}
              onPress={() =>
                navigation.navigate('GroupRequestList', {
                  groupId,
                  conversationId,
                })
              }
            >
              <Text style={[styles.menuItemLabel, { color: colors.textPrimary }]}>
                Join Requests
              </Text>
              <View style={styles.menuItemRight}>
                <Text style={[styles.arrow, { color: colors.textSecondary }]}>›</Text>
              </View>
            </TouchableOpacity>
          )}

          {/* Group Avatar */}
          <TouchableOpacity
            style={styles.menuItem}
            activeOpacity={isManagement ? 0.7 : 1}
          >
            <Text style={[styles.menuItemLabel, { color: colors.textPrimary }]}>
              Group Avatar
            </Text>
            <View style={styles.menuItemRight}>
              {detail.avatar ? (
                <Image
                  source={{ uri: detail.avatar }}
                  style={styles.menuAvatarImg}
                  contentFit="cover"
                />
              ) : (
                <View
                  style={[
                    styles.menuAvatar,
                    { backgroundColor: colors.utilityBrand200 || '#FFE0B3' },
                  ]}
                >
                  <Text style={[styles.menuAvatarText, { color: colors.utilityBrand700 || '#CC5500' }]}>
                    {getInitials(detail.name)}
                  </Text>
                </View>
              )}
              {isManagement && (
                <Text style={[styles.arrow, { color: colors.textSecondary, marginLeft: 8 }]}>›</Text>
              )}
            </View>
          </TouchableOpacity>

          {/* Group Name */}
          <TouchableOpacity
            style={styles.menuItem}
            activeOpacity={isManagement ? 0.7 : 1}
          >
            <Text style={[styles.menuItemLabel, { color: colors.textPrimary }]}>
              Group Name
            </Text>
            <View style={styles.menuItemRight}>
              <Text style={[styles.menuItemValue, { color: colors.textSecondary }]} numberOfLines={1}>
                {detail.name}
              </Text>
              {isManagement && (
                <Text style={[styles.arrow, { color: colors.textSecondary, marginLeft: 8 }]}>›</Text>
              )}
            </View>
          </TouchableOpacity>

          {/* Announcement */}
          <TouchableOpacity
            style={styles.menuItem}
            activeOpacity={isManagement ? 0.7 : 1}
          >
            <Text style={[styles.menuItemLabel, { color: colors.textPrimary }]}>
              Announcement
            </Text>
            <View style={styles.menuItemRight}>
              <Text
                style={[styles.menuItemValue, { color: colors.textSecondary }]}
                numberOfLines={1}
              >
                {detail.announcement || 'None'}
              </Text>
              {isManagement && (
                <Text style={[styles.arrow, { color: colors.textSecondary, marginLeft: 8 }]}>›</Text>
              )}
            </View>
          </TouchableOpacity>

          {/* Group ID */}
          <TouchableOpacity style={styles.menuItem} onPress={handleCopyGroupId} activeOpacity={0.7}>
            <Text style={[styles.menuItemLabel, { color: colors.textPrimary }]}>
              Group ID
            </Text>
            <View style={styles.menuItemRight}>
              <Text style={[styles.menuItemValue, { color: colors.textSecondary }]}>
                {groupId.substring(0, 8).toUpperCase()}
              </Text>
              <Text style={[styles.arrow, { color: colors.textSecondary, marginLeft: 8 }]}>›</Text>
            </View>
          </TouchableOpacity>
        </View>
      )}

      {/* ═══════════════════════════════════════════════════════════
           Section 3: Toggle Controls (Management only)
          ═══════════════════════════════════════════════════════════ */}
      {isMember && isManagement && (
        <View style={[styles.section, { backgroundColor: colors.bgPrimary, marginTop: 12 }]}>
          {/* Join Need Approval toggle */}
          <View style={styles.menuItem}>
            <Text style={[styles.menuItemLabel, { color: colors.textPrimary }]}>
              Join Need Approval
            </Text>
            <Text style={[styles.menuItemValue, { color: colors.textSecondary }]}>
              {detail.joinNeedApproval ? 'On' : 'Off'}
            </Text>
          </View>

          {/* Mute All Members toggle */}
          <View style={styles.menuItem}>
            <Text style={[styles.menuItemLabel, { color: colors.textPrimary }]}>
              Mute All Members
            </Text>
            <Text style={[styles.menuItemValue, { color: colors.textSecondary }]}>
              {detail.isMuteAll ? 'On' : 'Off'}
            </Text>
          </View>
        </View>
      )}

      {/* ═══════════════════════════════════════════════════════════
           Section 4: Announcement card (Non-members only)
          ═══════════════════════════════════════════════════════════ */}
      {!isMember && detail.announcement && (
        <View
          style={[
            styles.section,
            styles.announcementCard,
            { backgroundColor: colors.bgPrimary, marginTop: 12 },
          ]}
        >
          <Text style={[styles.announcementTitle, { color: colors.textPrimary }]}>
            Announcement
          </Text>
          <Text style={[styles.announcementBody, { color: colors.textSecondary }]}>
            {detail.announcement}
          </Text>
        </View>
      )}

      {/* ═══════════════════════════════════════════════════════════
           Section 5: Footer Buttons
          ═══════════════════════════════════════════════════════════ */}
      <View style={styles.footerSection}>
        {isMember ? (
          <>
            <TouchableOpacity
              style={[styles.primaryButton, { backgroundColor: colors.utilityBrand500 || '#FF7A00' }]}
              onPress={handleSendMessage}
              activeOpacity={0.8}
            >
              <Text style={styles.primaryButtonText}>Send Message</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.dangerButton,
                { borderColor: colors.utilityError200 || '#F04438' },
              ]}
              onPress={isOwner ? handleDisbandGroup : handleLeaveGroup}
              disabled={leaving || disbanding}
              activeOpacity={0.8}
            >
              {leaving || disbanding ? (
                <ActivityIndicator size="small" color={colors.utilityError200 || '#F04438'} />
              ) : (
                <Text
                  style={[
                    styles.dangerButtonText,
                    { color: colors.utilityError200 || '#F04438' },
                  ]}
                >
                  {isOwner ? 'Disband Group' : 'Leave Group'}
                </Text>
              )}
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: colors.utilityBrand500 || '#FF7A00' }]}
            activeOpacity={0.8}
          >
            <Text style={styles.primaryButtonText}>Join Group</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={{ height: 50 }} />
    </ScrollView>
  );
}

// ── Styles ───────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingTop: 12,
    paddingBottom: 24,
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
  // ── Section ────────────────────────────────────────────────────
  section: {
    borderRadius: 12,
    marginHorizontal: 16,
    overflow: 'hidden',
  },
  // ── Search ─────────────────────────────────────────────────────
  searchContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  searchInput: {
    height: 36,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  // ── Member Grid ────────────────────────────────────────────────
  memberGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  memberItem: {
    width: 56,
    alignItems: 'center',
    marginBottom: 8,
  },
  memberAvatarContainer: {
    position: 'relative',
    marginBottom: 4,
  },
  memberAvatar: {
    width: 48,
    height: 48,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  memberAvatarImg: {
    width: 48,
    height: 48,
    borderRadius: 10,
  },
  memberAvatarText: {
    fontSize: 18,
    fontWeight: '700',
  },
  roleBadge: {
    position: 'absolute',
    right: -4,
    bottom: -4,
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },
  roleBadgeText: {
    color: '#fff',
    fontSize: 10,
  },
  memberName: {
    fontSize: 11,
    textAlign: 'center',
    maxWidth: 56,
  },
  addButton: {
    width: 48,
    height: 48,
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButtonText: {
    fontSize: 22,
    fontWeight: '300',
  },
  // ── Public Header ──────────────────────────────────────────────
  publicHeader: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  publicAvatar: {
    width: 72,
    height: 72,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  publicAvatarImg: {
    width: 72,
    height: 72,
    borderRadius: 16,
    marginBottom: 12,
  },
  publicAvatarText: {
    fontSize: 28,
    fontWeight: '700',
  },
  publicGroupName: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  publicMemberCount: {
    fontSize: 14,
  },
  // ── Menu Items ─────────────────────────────────────────────────
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.08)',
  },
  menuItemLabel: {
    fontSize: 16,
    flex: 1,
  },
  menuItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: '60%',
  },
  menuItemValue: {
    fontSize: 14,
    maxWidth: 180,
  },
  arrow: {
    fontSize: 20,
    fontWeight: '300',
  },
  menuAvatar: {
    width: 32,
    height: 32,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuAvatarImg: {
    width: 32,
    height: 32,
    borderRadius: 6,
  },
  menuAvatarText: {
    fontSize: 14,
    fontWeight: '700',
  },
  // ── Announcement ───────────────────────────────────────────────
  announcementCard: {
    padding: 16,
  },
  announcementTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  announcementBody: {
    fontSize: 14,
    lineHeight: 20,
  },
  // ── Footer Buttons ─────────────────────────────────────────────
  footerSection: {
    marginTop: 24,
    marginHorizontal: 16,
    gap: 12,
  },
  primaryButton: {
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  dangerButton: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dangerButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
