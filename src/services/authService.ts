/**
 * Sama authentication service.
 *
 * Wraps Apollo Client mutations for login/register/logout/refresh,
 * manages JWT tokens in MMKV, and exposes auth state via a simple
 * observable pattern (compatible with React state or Redux).
 *
 * Automatically connects/disconnects the Socket.IO service
 * on login/logout for real-time messaging.
 *
 * Usage:
 *   import { authService } from '@/services/authService';
 *   await authService.login('+639...', 'password123');
 *   const isLoggedIn = authService.isAuthenticated;
 */
import { apolloClient } from '@/lib/apollo';
import { storage } from '@/lib/storage';
import { LOGIN, REGISTER, REFRESH_TOKEN, LOGOUT, ME } from '@/api/operations';
import { socketService } from './socketService';
import type { AuthPayload, TokenPayload, UserProfile } from '@/types/graphql';

// ─── Token storage keys (must match apollo.ts) ───────────────────

const AUTH_TOKEN_KEY = 'auth_access_token';
const REFRESH_TOKEN_KEY = 'auth_refresh_token';

// ─── Auth state ──────────────────────────────────────────────────

type AuthListener = (user: UserProfile | null) => void;

/**
 * AuthService manages authentication lifecycle:
 * - Login / Register → stores tokens in MMKV
 * - Token refresh on 401
 * - Logout → clears tokens
 * - Observable current user state
 */
class AuthService {
  private _currentUser: UserProfile | null = null;
  private _listeners: AuthListener[] = [];

  /** Get current user (null if not authenticated) */
  get currentUser(): UserProfile | null {
    return this._currentUser;
  }

  /** Whether the user has a valid access token stored */
  get isAuthenticated(): boolean {
    return !!storage.getString(AUTH_TOKEN_KEY);
  }

  /** Subscribe to auth state changes */
  subscribe(listener: AuthListener): () => void {
    this._listeners.push(listener);
    return () => {
      this._listeners = this._listeners.filter(l => l !== listener);
    };
  }

  private notify() {
    for (const listener of this._listeners) {
      listener(this._currentUser);
    }
  }

  // ─── Core auth operations ─────────────────────────────────────

  /**
   * Login with phone + password.
   * Stores tokens in MMKV and sets currentUser.
   */
  async login(phone: string, password: string): Promise<UserProfile> {
    const result = await apolloClient.mutate<{ login: AuthPayload }>({
      mutation: LOGIN,
      variables: { phone, password },
    });

    const { accessToken, refreshToken, user } = result.data!.login;
    this._storeTokens(accessToken, refreshToken);
    this._currentUser = user;
    this.notify();

    // Connect Socket.IO for real-time messaging
    socketService.connect();

    return user;
  }

  /**
   * Register a new account.
   * Stores tokens in MMKV and sets currentUser.
   */
  async register(
    phone: string,
    password: string,
    nickname: string,
  ): Promise<UserProfile> {
    const result = await apolloClient.mutate<{ register: AuthPayload }>({
      mutation: REGISTER,
      variables: { phone, password, nickname },
    });

    const { accessToken, refreshToken, user } = result.data!.register;
    this._storeTokens(accessToken, refreshToken);
    this._currentUser = user;
    this.notify();

    // Connect Socket.IO for real-time messaging
    socketService.connect();

    return user;
  }

  /**
   * Fetch the current user profile from the server.
   * Used on app startup to validate the stored token.
   */
  async fetchMe(): Promise<UserProfile | null> {
    if (!this.isAuthenticated) return null;

    try {
      const result = await apolloClient.query<{ me: UserProfile }>({
        query: ME,
        fetchPolicy: 'network-only',
      });
      this._currentUser = result.data!.me;
      this.notify();
      return result.data!.me;
    } catch {
      // Token invalid — clear and return null
      this.logout();
      return null;
    }
  }

  /**
   * Refresh the access token using the stored refresh token.
   * Called automatically by the Apollo error link on 401.
   */
  async refreshToken(): Promise<boolean> {
    const refreshToken = storage.getString(REFRESH_TOKEN_KEY);
    if (!refreshToken) return false;

    try {
      const result = await apolloClient.mutate<{
        refreshToken: TokenPayload;
      }>({
        mutation: REFRESH_TOKEN,
        variables: { refreshToken },
      });

      const { accessToken, refreshToken: newRefreshToken } =
        result.data!.refreshToken;
      this._storeTokens(accessToken, newRefreshToken);
      return true;
    } catch {
      this.logout();
      return false;
    }
  }

  /**
   * Logout — clears tokens and current user.
   * Tries to notify the server (best-effort).
   */
  async logout(): Promise<void> {
    const refreshToken = storage.getString(REFRESH_TOKEN_KEY);

    // Best-effort server-side logout
    if (refreshToken) {
      try {
        await apolloClient.mutate({
          mutation: LOGOUT,
          variables: { refreshToken },
        });
      } catch {
        // Ignore network errors on logout
      }
    }

    this._clearTokens();
    this._currentUser = null;
    this.notify();

    // Disconnect Socket.IO
    socketService.disconnect();
  }

  /** Get the stored access token */
  getAccessToken(): string | undefined {
    return storage.getString(AUTH_TOKEN_KEY);
  }

  /** Get the stored refresh token */
  getRefreshToken(): string | undefined {
    return storage.getString(REFRESH_TOKEN_KEY);
  }

  // ─── Private helpers ──────────────────────────────────────────

  private _storeTokens(accessToken: string, refreshToken: string) {
    storage.set(AUTH_TOKEN_KEY, accessToken);
    storage.set(REFRESH_TOKEN_KEY, refreshToken);
  }

  private _clearTokens() {
    storage.remove(AUTH_TOKEN_KEY);
    storage.remove(REFRESH_TOKEN_KEY);
  }
}

/** Singleton auth service instance */
export const authService = new AuthService();
