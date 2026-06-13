/**
 * UserProfileScreen — User profile card with actions
 *
 * Flutter equivalent: contact_profile_page.dart
 * - Header: avatar + nickname + ID (copyable) + phone
 * - Bottom buttons: Send Message, Audio Call, Video Call
 * - Creates direct chat on "Send Message" tap
 */
import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMutation } from '@apollo/client/react';
import { useFront } from '@/lib/theme/ThemeContext';
import { RootStackParamList } from '@/Navigation';
import { CREATE_DIRECT_CHAT, REQUEST_LIVEKIT_TOKEN } from '@/api/operations';

// ── Types ────────────────────────────────────────────────────────────

type UserProfileRouteProp = RouteProp<RootStackParamList, 'UserProfile'>;
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

// ── Component ────────────────────────────────────────────────────────

export default function UserProfileScreen() {
  const route = useRoute<UserProfileRouteProp>();
  const navigation = useNavigation<NavigationProp>();
  const { front, colors } = useFront();
  const { userId, nickname, avatar } = route.params;

  // ── Mutations ────────────────────────────────────────────────────

  const [createDirectChat, { loading: creating }] = useMutation(CREATE_DIRECT_CHAT);
  const [requestToken] = useMutation(REQUEST_LIVEKIT_TOKEN);

  // ── Handlers ─────────────────────────────────────────────────────

  const handleSendMessage = useCallback(async () => {
    try {
      const { data } = await createDirectChat({
        variables: { userId },
        refetchQueries: ['Conversations'],
      });
      const conversation = (data as any)?.createDirectChat;
      if (conversation?.id) {
        navigation.replace('Conversation', {
          conversationId: conversation.id,
          title: nickname || 'Chat',
        });
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to create conversation');
    }
  }, [userId, nickname, createDirectChat, navigation]);

  const handleCopyId = useCallback(() => {
    Alert.alert('User ID', userId);
  }, [userId]);

  const handleAudioCall = useCallback(async () => {
    try {
      const { data } = await requestToken({
        variables: {
          input: {
            sessionId: `${userId}_${Date.now()}`,
            roomName: null,
          },
        },
      });
      const tokenData = (data as any)?.requestLiveKitToken;
      if (tokenData?.token) {
        navigation.navigate('Call', {
          sessionId: tokenData.roomName,
          targetId: userId,
          mediaType: 'audio',
        });
      }
    } catch (err: any) {
      Alert.alert('Call Failed', err.message || 'Unable to start audio call');
    }
  }, [userId, requestToken, navigation]);

  const handleVideoCall = useCallback(async () => {
    try {
      const { data } = await requestToken({
        variables: {
          input: {
            sessionId: `${userId}_${Date.now()}`,
            roomName: null,
          },
        },
      });
      const tokenData = (data as any)?.requestLiveKitToken;
      if (tokenData?.token) {
        navigation.navigate('Call', {
          sessionId: tokenData.roomName,
          targetId: userId,
          mediaType: 'video',
        });
      }
    } catch (err: any) {
      Alert.alert('Call Failed', err.message || 'Unable to start video call');
    }
  }, [userId, requestToken, navigation]);

  // ── Render ───────────────────────────────────────────────────────

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.bgPrimary }]}
      contentContainerStyle={styles.scrollContent}
    >
      {/* ── Profile Header ─────────────────────────────────────────── */}
      <View style={styles.headerSection}>
        {avatar ? (
          <Image
            source={{ uri: avatar }}
            style={styles.avatarImg}
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
              {getInitials(nickname)}
            </Text>
          </View>
        )}

        <Text style={[styles.nickname, { color: colors.textPrimary }]}>
          {nickname || 'User'}
        </Text>

        <TouchableOpacity
          style={[styles.idRow]}
          onPress={handleCopyId}
          activeOpacity={0.7}
        >
          <Text style={[styles.idLabel, { color: colors.textTertiary || '#999' }]}>
            ID:
          </Text>
          <Text style={[styles.idValue, { color: colors.utilityBrand500 || '#FF7A00' }]}>
            {userId.slice(0, 12)}...
          </Text>
          <Text style={[styles.copyIcon, { color: colors.textTertiary || '#999' }]}>
            📋
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── Action Buttons ─────────────────────────────────────────── */}
      <View style={[styles.actionsSection, { backgroundColor: colors.bgSecondary }]}>
        <TouchableOpacity
          style={styles.actionItem}
          onPress={handleSendMessage}
          disabled={creating}
          activeOpacity={0.7}
        >
          <View style={[styles.actionIconContainer, { backgroundColor: colors.utilityBrand500 || '#FF7A00' + '20' }]}>
            <Text style={styles.actionIcon}>💬</Text>
          </View>
          <Text style={[styles.actionLabel, { color: colors.textPrimary }]}>
            {creating ? 'Creating...' : 'Send Message'}
          </Text>
        </TouchableOpacity>

        <View style={[styles.divider, { backgroundColor: colors.borderSecondary }]} />

        <TouchableOpacity
          style={styles.actionItem}
          onPress={handleAudioCall}
          activeOpacity={0.7}
        >
          <View style={[styles.actionIconContainer, { backgroundColor: '#34C75920' }]}>
            <Text style={styles.actionIcon}>📞</Text>
          </View>
          <Text style={[styles.actionLabel, { color: colors.textPrimary }]}>
            Audio Call
          </Text>
        </TouchableOpacity>

        <View style={[styles.divider, { backgroundColor: colors.borderSecondary }]} />

        <TouchableOpacity
          style={styles.actionItem}
          onPress={handleVideoCall}
          activeOpacity={0.7}
        >
          <View style={[styles.actionIconContainer, { backgroundColor: '#007AFF20' }]}>
            <Text style={styles.actionIcon}>📹</Text>
          </View>
          <Text style={[styles.actionLabel, { color: colors.textPrimary }]}>
            Video Call
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── Info Section ───────────────────────────────────────────── */}
      <View style={[styles.infoSection, { backgroundColor: colors.bgSecondary }]}>
        <View style={styles.infoRow}>
          <Text style={[styles.infoLabel, { color: colors.textTertiary || '#999' }]}>
            User ID
          </Text>
          <TouchableOpacity onPress={handleCopyId}>
            <Text style={[styles.infoValue, { color: colors.utilityBrand500 || '#FF7A00' }]}>
              {userId}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

// ── Styles ───────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  // ── Header ────────────────────────────────────────────────────────
  headerSection: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  avatarImg: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: 16,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: '700',
  },
  nickname: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
  },
  idRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  idLabel: {
    fontSize: 14,
  },
  idValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  copyIcon: {
    fontSize: 14,
  },
  // ── Action Buttons ────────────────────────────────────────────────
  actionsSection: {
    marginHorizontal: 16,
    borderRadius: 14,
    padding: 4,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  actionIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  actionIcon: {
    fontSize: 18,
  },
  actionLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 66,
  },
  // ── Info Section ──────────────────────────────────────────────────
  infoSection: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 14,
    padding: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: 14,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '500',
  },
});
