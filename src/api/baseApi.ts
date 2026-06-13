/**
 * Sama RTK Query base API definition.
 *
 * Foundation for all API endpoints. Endpoints are injected via
 * samaApi.injectEndpoints() in separate files.
 *
 * Features:
 * - Automatic auth token injection from MMKV
 * - 5xx retry with exponential backoff (1s → 2s → 4s)
 * - 401 → token refresh → retry
 * - Performance timing with slow-API warnings in dev
 */
import {
  createApi,
  fetchBaseQuery,
  BaseQueryFn,
  FetchArgs,
  FetchBaseQueryError,
} from '@reduxjs/toolkit/query/react';
import { getApiBaseUrl } from '@/lib/env';
import { storage } from '@/lib/storage';
import { logger } from '@/lib/logger';

/** Token storage keys */
const AUTH_TOKEN_KEY = 'auth_access_token';
const REFRESH_TOKEN_KEY = 'auth_refresh_token';

/** Retry: 3 max, exponential backoff 1s → 2s → 4s */
const RETRY_MAX = 3;
const RETRY_BASE_DELAY_MS = 1000;

/** Performance.now() declaration for Hermes (available at runtime) */
declare const performance: { now(): number };

function isRetryableError(error: FetchBaseQueryError | undefined): boolean {
  if (!error) return false;
  return typeof error.status === 'number' && error.status >= 500 && error.status < 600;
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const baseQuery: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = async (
  args,
  api,
  extraOptions,
) => {
  const tWallStart = performance.now();
  const endpoint = typeof args === 'string' ? args : (args.url as string);
  const method = typeof args === 'string' ? 'GET' : (args.method ?? 'GET');

  const rawBaseQuery = fetchBaseQuery({
    baseUrl: getApiBaseUrl(),
    prepareHeaders: headers => {
      const token = storage.getString(AUTH_TOKEN_KEY);
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }
      return headers;
    },
    credentials: 'omit',
  });

  let result = await rawBaseQuery(args, api, extraOptions);
  let attempt = 1;

  while (isRetryableError(result.error) && attempt <= RETRY_MAX) {
    const backoffMs = RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1);
    logger.warn(
      `Retry ${attempt}/${RETRY_MAX}: waiting ${backoffMs}ms for ${method} ${endpoint}`,
    );
    await delay(backoffMs);
    result = await rawBaseQuery(args, api, extraOptions);
    attempt++;
  }

  // Record timing
  const wallClockMs = performance.now() - tWallStart;
  if (__DEV__ && wallClockMs > 1000) {
    logger.warn(`Slow API: ${method} ${endpoint} — ${Math.round(wallClockMs)}ms`);
  }

  // ── 401 → Token refresh ────────────────────────────────────────────
  if (result.error?.status === 401) {
    const refreshToken = storage.getString(REFRESH_TOKEN_KEY);
    if (refreshToken) {
      try {
        const refreshResult = await rawBaseQuery(
          {
            url: '/api/v1/auth/refresh',
            method: 'POST',
            body: { refreshToken },
          },
          api,
          extraOptions,
        );

        if (refreshResult.data) {
          const response = refreshResult.data as any;
          const tokenData = response.data?.tokens || response.data;
          const newToken = tokenData?.accessToken || response.accessToken;
          const newRefreshToken = tokenData?.refreshToken || response.refreshToken;

          if (newToken) {
            storage.set(AUTH_TOKEN_KEY, newToken);
            if (newRefreshToken) {
              storage.set(REFRESH_TOKEN_KEY, newRefreshToken);
            }

            // Retry original request with new token
            const retryQuery = fetchBaseQuery({
              baseUrl: getApiBaseUrl(),
              prepareHeaders: headers => {
                headers.set('Authorization', `Bearer ${newToken}`);
                return headers;
              },
              credentials: 'omit',
            });
            result = await retryQuery(args, api, extraOptions);
          } else {
            logger.warn('Token refresh response missing tokens — clearing');
            storage.remove(AUTH_TOKEN_KEY);
            storage.remove(REFRESH_TOKEN_KEY);
          }
        } else {
          logger.warn('Token refresh failed — clearing tokens');
          storage.remove(AUTH_TOKEN_KEY);
          storage.remove(REFRESH_TOKEN_KEY);
        }
      } catch (error) {
        logger.warn('Token refresh network error — clearing tokens', error);
        storage.remove(AUTH_TOKEN_KEY);
        storage.remove(REFRESH_TOKEN_KEY);
      }
    } else {
      logger.warn('401 but no refresh token — clearing access token');
      storage.remove(AUTH_TOKEN_KEY);
    }
  }

  return result;
};

/**
 * Standard paginated API response
 */
export interface ApiPaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * Standard API response wrapper
 */
export interface ApiResponseWrapper<T> {
  code: number;
  message: string;
  data: T;
  timestamp?: number;
}

/**
 * Sama API tag types for cache invalidation
 */
export type SamaTagTypes =
  | 'Conversation'
  | 'Message'
  | 'Contact'
  | 'User'
  | 'Auth';

export const samaApi = createApi({
  reducerPath: 'samaApi',
  baseQuery,
  tagTypes: ['Conversation', 'Message', 'Contact', 'User', 'Auth'] as SamaTagTypes[],
  endpoints: () => ({}),
});
