import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFront } from '@/lib/theme/ThemeContext';
import { authService } from '@/services/authService';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/Navigation';

type RegisterScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Register'>;

interface Props {
  navigation: RegisterScreenNavigationProp;
}

export default function RegisterScreen({ navigation }: Props) {
  const { colors, front } = useFront();
  const insets = useSafeAreaInsets();
  const [nickname, setNickname] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRegister() {
    if (!nickname.trim()) {
      setError('Please enter a nickname');
      return;
    }
    if (!phone.trim()) {
      setError('Please enter your phone number');
      return;
    }
    if (!password.trim() || password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await authService.register(phone.trim(), password, nickname.trim());
      // Navigation state will react to authService.isAuthenticated
    } catch (err: any) {
      const message =
        err?.graphQLErrors?.[0]?.message ||
        err?.message ||
        'Registration failed. Please try again.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.bgPrimary }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={[styles.inner, { paddingTop: insets.top + 40 }]}>
        {/* Header */}
        <Text style={[styles.title, { color: colors.textPrimary }]}>Create Account</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Join Sama and start chatting
        </Text>

        {/* Error */}
        {error && (
          <View style={[styles.errorBox, { backgroundColor: colors.utilityError50 || '#FEF3F2' }]}>
            <Text style={[styles.errorText, { color: colors.utilityError500 || '#F04438' }]}>
              {error}
            </Text>
          </View>
        )}

        {/* Nickname */}
        <Text style={[styles.label, { color: colors.textPrimary }]}>Nickname</Text>
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: colors.bgSecondary,
              color: colors.textPrimary,
              borderColor: colors.borderSecondary,
            },
          ]}
          placeholder="Your display name"
          placeholderTextColor={colors.textTertiary || '#999'}
          autoCapitalize="words"
          autoCorrect={false}
          value={nickname}
          onChangeText={setNickname}
        />

        {/* Phone */}
        <Text style={[styles.label, { color: colors.textPrimary }]}>Phone Number</Text>
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: colors.bgSecondary,
              color: colors.textPrimary,
              borderColor: colors.borderSecondary,
            },
          ]}
          placeholder="+639123456789"
          placeholderTextColor={colors.textTertiary || '#999'}
          keyboardType="phone-pad"
          autoCapitalize="none"
          autoCorrect={false}
          value={phone}
          onChangeText={setPhone}
        />

        {/* Password */}
        <Text style={[styles.label, { color: colors.textPrimary }]}>Password</Text>
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: colors.bgSecondary,
              color: colors.textPrimary,
              borderColor: colors.borderSecondary,
            },
          ]}
          placeholder="At least 6 characters"
          placeholderTextColor={colors.textTertiary || '#999'}
          secureTextEntry
          autoCapitalize="none"
          value={password}
          onChangeText={setPassword}
        />

        {/* Register Button */}
        <TouchableOpacity
          style={[
            styles.button,
            { backgroundColor: colors.utilityBrand500 || '#FF7A00' },
            loading && styles.buttonDisabled,
          ]}
          onPress={handleRegister}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Create Account</Text>
          )}
        </TouchableOpacity>

        {/* Login Link */}
        <TouchableOpacity
          style={styles.linkContainer}
          onPress={() => navigation.goBack()}
        >
          <Text style={[styles.linkText, { color: colors.textSecondary }]}>
            Already have an account?{' '}
            <Text style={[styles.linkHighlight, { color: colors.utilityBrand500 || '#FF7A00' }]}>
              Sign In
            </Text>
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  inner: {
    flex: 1,
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 12,
  },
  input: {
    height: 48,
    borderRadius: 10,
    paddingHorizontal: 16,
    fontSize: 16,
    borderWidth: 1,
  },
  button: {
    height: 50,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 28,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  linkContainer: {
    alignItems: 'center',
    marginTop: 20,
  },
  linkText: {
    fontSize: 14,
  },
  linkHighlight: {
    fontWeight: '600',
  },
  errorBox: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
  },
});
