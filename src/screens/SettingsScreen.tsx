import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useMutation } from '@apollo/client/react';
import { useFront, useTheme } from '@/lib/theme/ThemeContext';
import { UPDATE_PROFILE } from '@/api/operations';
import { authService } from '@/services/authService';

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

export default function SettingsScreen() {
  const { front, colors } = useFront();
  const { toggleTheme, isDark } = useTheme();

  const user = authService.currentUser;

  const [editing, setEditing] = useState(false);
  const [nickname, setNickname] = useState(user?.nickname ?? '');

  const [updateProfile, { loading: updating }] = useMutation(UPDATE_PROFILE);

  const handleSaveNickname = useCallback(async () => {
    const trimmed = nickname.trim();
    if (!trimmed || trimmed === user?.nickname) {
      setEditing(false);
      return;
    }

    try {
      await updateProfile({ variables: { nickname: trimmed } });
      // Re-fetch user profile
      await authService.fetchMe();
      setEditing(false);
    } catch {
      Alert.alert('Error', 'Failed to update nickname');
    }
  }, [nickname, user, updateProfile]);

  const handleLogout = useCallback(() => {
    Alert.alert('Logout', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: () => authService.logout(),
      },
    ]);
  }, []);

  const menuItems = [
    { label: 'Notifications', icon: '🔔' },
    { label: 'Privacy', icon: '🔒' },
    { label: 'Language', icon: '🌐' },
    { label: 'About', icon: 'ℹ️' },
  ];

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
      {/* Profile */}
      <View
        style={[
          styles.profileSection,
          {
            backgroundColor: colors.bgSecondary,
            margin: front.spacingMd || 16,
            padding: front.spacingLg || 24,
            borderRadius: front.radiusLg || 10,
          },
        ]}
      >
        <View
          style={[
            styles.profileAvatar,
            { backgroundColor: colors.utilityBrand500 || '#FF7A00' },
          ]}
        >
          <Text style={styles.profileAvatarText}>
            {getInitials(user?.nickname)}
          </Text>
        </View>

        {editing ? (
          <View style={styles.editRow}>
            <TextInput
              style={[
                styles.editInput,
                {
                  backgroundColor: colors.bgPrimary,
                  color: colors.textPrimary,
                  borderColor: colors.borderSecondary,
                },
              ]}
              value={nickname}
              onChangeText={setNickname}
              placeholder="Enter nickname"
              placeholderTextColor={colors.textPlaceholder || '#999'}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleSaveNickname}
            />
            <TouchableOpacity
              style={[
                styles.saveButton,
                { backgroundColor: colors.utilityBrand500 || '#FF7A00' },
              ]}
              onPress={handleSaveNickname}
              disabled={updating}
            >
              {updating ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.saveButtonText}>Save</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity onPress={() => setEditing(true)}>
            <Text style={[styles.profileName, { color: colors.textPrimary }]}>
              {user?.nickname || 'Set nickname'}
            </Text>
          </TouchableOpacity>
        )}

        <Text style={[styles.profilePhone, { color: colors.textTertiary || '#999' }]}>
          {user?.phone || ''}
        </Text>
      </View>

      {/* Theme Toggle */}
      <View
        style={[
          styles.menuItem,
          {
            backgroundColor: colors.bgSecondary,
            marginHorizontal: front.spacingMd || 16,
            marginBottom: front.spacingSm || 8,
            padding: front.spacingMd || 16,
            borderRadius: front.radiusMd || 8,
          },
        ]}
      >
        <Text style={[styles.menuLabel, { color: colors.textPrimary }]}>
          Dark Mode
        </Text>
        <TouchableOpacity
          style={[
            styles.toggle,
            {
              backgroundColor: isDark
                ? colors.utilityBrand500 || '#FF7A00'
                : '#E5E5EA',
            },
          ]}
          onPress={toggleTheme}
        >
          <View
            style={[
              styles.toggleCircle,
              { alignSelf: isDark ? 'flex-end' : 'flex-start' },
            ]}
          />
        </TouchableOpacity>
      </View>

      {/* Menu Items */}
      {menuItems.map((item) => (
        <View
          key={item.label}
          style={[
            styles.menuItem,
            {
              backgroundColor: colors.bgSecondary,
              marginHorizontal: front.spacingMd || 16,
              marginBottom: front.spacingSm || 8,
              padding: front.spacingMd || 16,
              borderRadius: front.radiusMd || 8,
            },
          ]}
        >
          <Text style={styles.menuIcon}>{item.icon}</Text>
          <Text
            style={[
              styles.menuLabel,
              { color: colors.textPrimary, marginLeft: 12 },
            ]}
          >
            {item.label}
          </Text>
        </View>
      ))}

      {/* Logout */}
      <TouchableOpacity
        style={[
          styles.logoutButton,
          {
            backgroundColor: colors.bgSecondary,
            marginHorizontal: front.spacingMd || 16,
            marginTop: front.spacingMd || 16,
            padding: front.spacingMd || 16,
            borderRadius: front.radiusMd || 8,
          },
        ]}
        onPress={handleLogout}
      >
        <Text style={[styles.logoutText, { color: colors.utilityError500 || '#F04438' }]}>
          Logout
        </Text>
      </TouchableOpacity>

      <Text
        style={[
          styles.version,
          { color: colors.textTertiary || '#999', textAlign: 'center', padding: 24 },
        ]}
      >
        Sama v1.0.0
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  profileSection: { alignItems: 'center' },
  profileAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  profileAvatarText: { color: '#fff', fontSize: 24, fontWeight: '600' },
  profileName: { fontSize: 20, fontWeight: '700', marginBottom: 4 },
  profilePhone: { fontSize: 14 },
  editRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  editInput: {
    flex: 1,
    height: 36,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    fontSize: 16,
    marginRight: 8,
  },
  saveButton: {
    height: 36,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  menuItem: { flexDirection: 'row', alignItems: 'center' },
  menuIcon: { fontSize: 18 },
  menuLabel: { fontSize: 16, flex: 1 },
  toggle: {
    width: 48,
    height: 28,
    borderRadius: 14,
    padding: 2,
    justifyContent: 'center',
  },
  toggleCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#fff',
  },
  logoutButton: { alignItems: 'center' },
  logoutText: { fontSize: 16, fontWeight: '600' },
  version: { fontSize: 12 },
});
