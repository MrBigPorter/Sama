import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFront } from '@/lib/theme/ThemeContext';
import { authService } from '@/services/authService';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/Navigation';

type LoginScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Login'>;

interface Props {
  navigation: LoginScreenNavigationProp;
}

export default function LoginScreen({ navigation }: Props) {
  const { colors, front } = useFront();
  const insets = useSafeAreaInsets();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin() {
    if (!phone.trim() || !password.trim()) {
      setError('Please enter phone and password');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await authService.login(phone.trim(), password);
      // Navigation state will react to authService.isAuthenticated
    } catch (err: any) {
      const message =
        err?.graphQLErrors?.[0]?.message ||
        err?.message ||
        'Login failed. Please try again.';
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
      <View style={[styles.inner, { paddingTop: insets.top + 60 }]}>
        {/* Header */}
        <Text style={[styles.title, { color: colors.textPrimary }]}>Welcome Back</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Sign in to your Sama account
        </Text>

        {/* Error */}
        {error && (
          <View style={[styles.errorBox, { backgroundColor: colors.utilityError50 || '#FEF3F2' }]}>
            <Text style={[styles.errorText, { color: colors.utilityError500 || '#F04438' }]}>
              {error}
            </Text>
          </View>
        )}

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
          placeholder="••••••••"
          placeholderTextColor={colors.textTertiary || '#999'}
          secureTextEntry
          autoCapitalize="none"
          value={password}
          onChangeText={setPassword}
        />

        {/* Login Button */}
        <TouchableOpacity
          style={[
            styles.button,
            { backgroundColor: colors.utilityBrand500 || '#FF7A00' },
            loading && styles.buttonDisabled,
          ]}
          onPress={handleLogin}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Sign In</Text>
          )}
        </TouchableOpacity>

        {/* Register Link */}
        <TouchableOpacity
          style={styles.linkContainer}
          onPress={() => navigation.navigate('Register')}
        >
          <Text style={[styles.linkText, { color: colors.textSecondary }]}>
            Don't have an account?{' '}
            <Text style={[styles.linkHighlight, { color: colors.utilityBrand500 || '#FF7A00' }]}>
              Sign Up
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
    marginBottom: 32,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 16,
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
    marginTop: 32,
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
