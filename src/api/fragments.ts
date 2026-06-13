/**
 * Shared GraphQL fragments for SamaHub API.
 *
 * These fragments define reusable fields for core domain models,
 * matching the SamaHub NestJS GraphQL schema exactly.
 *
 * Usage:
 *   import { USER_PROFILE_FIELDS } from '@/api/fragments';
 *   const ME = gql`
 *     query Me { me { ...UserProfileFields } }
 *     ${USER_PROFILE_FIELDS}
 *   `;
 */
import { gql } from '@apollo/client';

// ─── Auth / User ─────────────────────────────────────────────────

export const USER_PROFILE_FIELDS = gql`
  fragment UserProfileFields on UserProfile {
    id
    phone
    nickname
    avatar
  }
`;

export const AUTH_PAYLOAD_FIELDS = gql`
  fragment AuthPayloadFields on AuthPayload {
    accessToken
    refreshToken
    user {
      ...UserProfileFields
    }
  }
  ${USER_PROFILE_FIELDS}
`;

// ─── Conversation ────────────────────────────────────────────────

export const CONVERSATION_FIELDS = gql`
  fragment ConversationFields on Conversation {
    id
    type
    name
    avatar
    lastMessageAt
    lastMessagePreview
    unreadCount
    createdAt
    updatedAt
  }
`;

// ─── Message ─────────────────────────────────────────────────────

export const REACTION_FIELDS = gql`
  fragment ReactionFields on Reaction {
    messageId
    emoji
    userId
    nickname
    createdAt
  }
`;

export const MESSAGE_FIELDS = gql`
  fragment MessageFields on Message {
    id
    seqId
    conversationId
    senderId
    content
    type
    clientTempId
    meta
    createdAt
    recalledAt
    deletedAt
    reactions {
      ...ReactionFields
    }
  }
  ${REACTION_FIELDS}
`;

// ─── Contact ─────────────────────────────────────────────────────

export const CONTACT_FIELDS = gql`
  fragment ContactFields on Contact {
    id
    userId
    nickname
    avatar
    status
    createdAt
  }
`;

// ─── Group ───────────────────────────────────────────────────────

export const GROUP_FIELDS = gql`
  fragment GroupFields on Group {
    id
    name
    avatar
    announcement
    ownerId
    memberCount
    createdAt
    updatedAt
  }
`;

// ─── Friend Request ──────────────────────────────────────────────

export const FRIEND_REQUEST_FIELDS = gql`
  fragment FriendRequestFields on FriendRequest {
    id
    fromUserId
    toUserId
    status
    message
    createdAt
    handledAt
  }
`;
