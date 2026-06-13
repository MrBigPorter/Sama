/**
 * Apollo Client configuration for SamaHub GraphQL API.
 *
 * - HTTP Link → http://localhost:4000/graphql (dev) / https://api.sama.app/graphql (prod)
 * - Auth Link → injects JWT from MMKV into Authorization header
 * - Error Link → 401 triggers authService.refreshToken()
 * - InMemoryCache → type policies for normalized caching
 */
import { ApolloClient, InMemoryCache, createHttpLink, from, CombinedGraphQLErrors } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
import { ErrorLink } from '@apollo/client/link/error';
import { getApiBaseUrl } from './env';
import { storage } from '@/lib/storage';
import { authService } from '@/services/authService';

/** Token storage keys — must match authService.ts */
const AUTH_TOKEN_KEY = 'auth_access_token';
const REFRESH_TOKEN_KEY = 'auth_refresh_token';

// ─── HTTP Link ───────────────────────────────────────────────────

const httpLink = createHttpLink({
  uri: `${getApiBaseUrl()}/graphql`,
  credentials: 'omit',
});

// ─── Auth Link (inject JWT) ──────────────────────────────────────

const authLink = setContext((_, { headers }) => {
  const token = storage.getString(AUTH_TOKEN_KEY);
  return {
    headers: {
      ...headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  };
});

// ─── Error Link (401 → refresh token) ────────────────────────────

const errorLink = new ErrorLink(({ error }) => {
  if (CombinedGraphQLErrors.is(error)) {
    for (const err of error.errors) {
      if (
        err.extensions?.code === 'UNAUTHENTICATED' ||
        err.message.includes('Unauthorized')
      ) {
        // Token expired — attempt refresh
        authService.refreshToken();
      }
    }
  } else {
    console.warn(`[Apollo] Network error: ${error}`);
  }
});

// ─── Cache ───────────────────────────────────────────────────────

const cache = new InMemoryCache({
  typePolicies: {
    Query: {
      fields: {
        conversations: {
          merge(existing = [], incoming: any[]) {
            return incoming; // Replace on refetch
          },
        },
        messages: {
          // Cursor-based pagination merge
          keyArgs: ['conversationId'],
          merge(existing: any, incoming: any) {
            if (!existing) return incoming;
            return {
              ...incoming,
              items: [...(existing.items || []), ...(incoming.items || [])],
            };
          },
        },
      },
    },
  },
});

// ─── Apollo Client Instance ──────────────────────────────────────

export const apolloClient = new ApolloClient({
  link: from([errorLink, authLink, httpLink]),
  cache,
});
