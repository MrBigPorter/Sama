/**
 * GraphQL operations (queries & mutations) for SamaHub API.
 *
 * Every operation mirrors exactly one resolver from the SamaHub backend.
 * Operations are grouped by domain and re-use fragments from `./fragments.ts`.
 *
 * Usage:
 *   import { ME, LOGIN } from '@/api/operations';
 *   const { data } = useQuery(ME);
 *   const [login] = useMutation(LOGIN);
 */
import { gql } from '@apollo/client';
import {
  USER_PROFILE_FIELDS,
  AUTH_PAYLOAD_FIELDS,
  CONVERSATION_FIELDS,
  MESSAGE_FIELDS,
  CONTACT_FIELDS,
  GROUP_FIELDS,
  FRIEND_REQUEST_FIELDS,
} from './fragments';

// ══════════════════════════════════════════════════════════════════
//  Auth / Identity
// ══════════════════════════════════════════════════════════════════

export const LOGIN = gql`
  mutation Login($phone: String!, $password: String!) {
    login(phone: $phone, password: $password) {
      ...AuthPayloadFields
    }
  }
  ${AUTH_PAYLOAD_FIELDS}
`;

export const REGISTER = gql`
  mutation Register($phone: String!, $password: String!, $nickname: String!) {
    register(phone: $phone, password: $password, nickname: $nickname) {
      ...AuthPayloadFields
    }
  }
  ${AUTH_PAYLOAD_FIELDS}
`;

export const REFRESH_TOKEN = gql`
  mutation RefreshToken($refreshToken: String!) {
    refreshToken(refreshToken: $refreshToken) {
      accessToken
      refreshToken
    }
  }
`;

export const LOGOUT = gql`
  mutation Logout($refreshToken: String!) {
    logout(refreshToken: $refreshToken)
  }
`;

export const ME = gql`
  query Me {
    me {
      ...UserProfileFields
    }
  }
  ${USER_PROFILE_FIELDS}
`;

export const UPDATE_PROFILE = gql`
  mutation UpdateProfile($nickname: String, $avatar: String) {
    updateProfile(nickname: $nickname, avatar: $avatar) {
      ...UserProfileFields
    }
  }
  ${USER_PROFILE_FIELDS}
`;

// ══════════════════════════════════════════════════════════════════
//  Conversation
// ══════════════════════════════════════════════════════════════════

export const CONVERSATIONS = gql`
  query Conversations($page: Float, $pageSize: Float) {
    conversations(page: $page, pageSize: $pageSize) {
      ...ConversationFields
    }
  }
  ${CONVERSATION_FIELDS}
`;

export const CONVERSATION = gql`
  query Conversation($id: String!) {
    conversation(id: $id) {
      ...ConversationFields
    }
  }
  ${CONVERSATION_FIELDS}
`;

export const CREATE_DIRECT_CHAT = gql`
  mutation CreateDirectChat($userId: String!) {
    createDirectChat(userId: $userId) {
      ...ConversationFields
    }
  }
  ${CONVERSATION_FIELDS}
`;

export const MARK_AS_READ = gql`
  mutation MarkAsRead($conversationId: String!, $lastReadSeqId: Float!) {
    markAsRead(conversationId: $conversationId, lastReadSeqId: $lastReadSeqId)
  }
`;

export const CLEAR_HISTORY = gql`
  mutation ClearHistory($conversationId: String!) {
    clearHistory(conversationId: $conversationId)
  }
`;

export const MUTE_CONVERSATION = gql`
  mutation MuteConversation($conversationId: String!, $isMuted: Boolean!) {
    muteConversation(conversationId: $conversationId, isMuted: $isMuted) {
      ...ConversationFields
    }
  }
  ${CONVERSATION_FIELDS}
`;

// ══════════════════════════════════════════════════════════════════
//  Message
// ══════════════════════════════════════════════════════════════════

export const MESSAGES = gql`
  query Messages($conversationId: String!, $cursor: String, $limit: Float) {
    messages(conversationId: $conversationId, cursor: $cursor, limit: $limit) {
      items {
        ...MessageFields
      }
      hasMore
      nextCursor
    }
  }
  ${MESSAGE_FIELDS}
`;

export const SEND_MESSAGE = gql`
  mutation SendMessage(
    $conversationId: String!
    $content: String!
    $type: Float!
    $clientTempId: String
    $meta: String
  ) {
    sendMessage(
      conversationId: $conversationId
      content: $content
      type: $type
      clientTempId: $clientTempId
      meta: $meta
    ) {
      ...MessageFields
    }
  }
  ${MESSAGE_FIELDS}
`;

export const RECALL_MESSAGE = gql`
  mutation RecallMessage($messageId: String!) {
    recallMessage(messageId: $messageId) {
      ...MessageFields
    }
  }
  ${MESSAGE_FIELDS}
`;

export const DELETE_MESSAGE = gql`
  mutation DeleteMessage($messageId: String!) {
    deleteMessage(messageId: $messageId) {
      ...MessageFields
    }
  }
  ${MESSAGE_FIELDS}
`;

export const FORWARD_MESSAGE = gql`
  mutation ForwardMessage($messageId: String!, $targetConversationId: String!) {
    forwardMessage(
      messageId: $messageId
      targetConversationId: $targetConversationId
    ) {
      ...MessageFields
    }
  }
  ${MESSAGE_FIELDS}
`;

export const ADD_REACTION = gql`
  mutation AddReaction($messageId: String!, $emoji: String!) {
    addReaction(messageId: $messageId, emoji: $emoji) {
      messageId
      emoji
      userId
      nickname
      createdAt
    }
  }
`;

export const REMOVE_REACTION = gql`
  mutation RemoveReaction($messageId: String!, $emoji: String!) {
    removeReaction(messageId: $messageId, emoji: $emoji)
  }
`;

// ══════════════════════════════════════════════════════════════════
//  LiveKit / Call
// ══════════════════════════════════════════════════════════════════

export const REQUEST_LIVEKIT_TOKEN = gql`
  mutation RequestLiveKitToken($input: RequestLiveKitTokenInput!) {
    requestLiveKitToken(input: $input) {
      token
      url
      roomName
    }
  }
`;

// ══════════════════════════════════════════════════════════════════
//  Contact
// ══════════════════════════════════════════════════════════════════

export const CONTACTS = gql`
  query Contacts {
    contacts {
      ...ContactFields
    }
  }
  ${CONTACT_FIELDS}
`;

export const SEARCH_USERS = gql`
  query SearchUsers($q: String!) {
    searchUsers(q: $q) {
      ...UserProfileFields
    }
  }
  ${USER_PROFILE_FIELDS}
`;

export const SEND_FRIEND_REQUEST = gql`
  mutation SendFriendRequest($userId: String!, $message: String) {
    sendFriendRequest(userId: $userId, message: $message) {
      ...FriendRequestFields
    }
  }
  ${FRIEND_REQUEST_FIELDS}
`;

export const HANDLE_FRIEND_REQUEST = gql`
  mutation HandleFriendRequest($requestId: String!, $accept: Boolean!) {
    handleFriendRequest(requestId: $requestId, accept: $accept) {
      ...FriendRequestFields
    }
  }
  ${FRIEND_REQUEST_FIELDS}
`;

export const FRIEND_REQUESTS = gql`
  query FriendRequests {
    friendRequests {
      ...FriendRequestFields
    }
  }
  ${FRIEND_REQUEST_FIELDS}
`;

export const REMOVE_CONTACT = gql`
  mutation RemoveContact($contactId: String!) {
    removeContact(contactId: $contactId)
  }
`;

export const BLOCK_CONTACT = gql`
  mutation BlockContact($contactId: String!) {
    blockContact(contactId: $contactId)
  }
`;

export const UNBLOCK_CONTACT = gql`
  mutation UnblockContact($contactId: String!) {
    unblockContact(contactId: $contactId)
  }
`;

// ══════════════════════════════════════════════════════════════════
//  Group
// ══════════════════════════════════════════════════════════════════

export const GROUP = gql`
  query Group($id: String!) {
    group(id: $id) {
      ...GroupFields
    }
  }
  ${GROUP_FIELDS}
`;

export const SEARCH_GROUPS = gql`
  query SearchGroups($q: String!) {
    searchGroups(q: $q) {
      ...GroupFields
    }
  }
  ${GROUP_FIELDS}
`;

export const CREATE_GROUP = gql`
  mutation CreateGroup($name: String!, $memberIds: [String!]!) {
    createGroup(name: $name, memberIds: $memberIds) {
      ...GroupFields
    }
  }
  ${GROUP_FIELDS}
`;

export const UPDATE_GROUP = gql`
  mutation UpdateGroup(
    $id: String!
    $name: String
    $avatar: String
    $announcement: String
    $joinNeedApproval: Boolean
    $isMuteAll: Boolean
  ) {
    updateGroup(
      id: $id
      name: $name
      avatar: $avatar
      announcement: $announcement
      joinNeedApproval: $joinNeedApproval
      isMuteAll: $isMuteAll
    ) {
      ...GroupFields
    }
  }
  ${GROUP_FIELDS}
`;

export const DISBAND_GROUP = gql`
  mutation DisbandGroup($groupId: String!) {
    disbandGroup(groupId: $groupId)
  }
`;

export const LEAVE_GROUP = gql`
  mutation LeaveGroup($groupId: String!) {
    leaveGroup(groupId: $groupId)
  }
`;

export const INVITE_TO_GROUP = gql`
  mutation InviteToGroup($groupId: String!, $userIds: [String!]!) {
    inviteToGroup(groupId: $groupId, userIds: $userIds) {
      success
      message
    }
  }
`;

export const KICK_MEMBER = gql`
  mutation KickMember($groupId: String!, $userId: String!) {
    kickMember(groupId: $groupId, userId: $userId)
  }
`;

export const SET_ADMIN = gql`
  mutation SetAdmin($groupId: String!, $userId: String!, $role: String!) {
    setAdmin(groupId: $groupId, userId: $userId, role: $role)
  }
`;

export const TRANSFER_OWNER = gql`
  mutation TransferOwner($groupId: String!, $userId: String!) {
    transferOwner(groupId: $groupId, userId: $userId)
  }
`;

export const APPLY_TO_GROUP = gql`
  mutation ApplyToGroup($groupId: String!, $reason: String) {
    applyToGroup(groupId: $groupId, reason: $reason) {
      id
      groupId
      userId
      reason
      status
      createdAt
    }
  }
`;

export const HANDLE_JOIN_REQUEST = gql`
  mutation HandleJoinRequest($requestId: String!, $action: String!) {
    handleJoinRequest(requestId: $requestId, action: $action) {
      success
      message
    }
  }
`;

export const GET_JOIN_REQUESTS = gql`
  query GetJoinRequests($groupId: String!) {
    getJoinRequests(groupId: $groupId) {
      id
      groupId
      userId
      reason
      status
      createdAt
    }
  }
`;

// ══════════════════════════════════════════════════════════════════
//  Push Notifications
// ══════════════════════════════════════════════════════════════════

export const REGISTER_PUSH_TOKEN = gql`
  mutation RegisterPushToken($platform: String!, $pushToken: String!) {
    registerPushToken(platform: $platform, pushToken: $pushToken)
  }
`;

export const UNREGISTER_PUSH_TOKEN = gql`
  mutation UnregisterPushToken($pushToken: String!) {
    unregisterPushToken(pushToken: $pushToken)
  }
`;

// ══════════════════════════════════════════════════════════════════
//  File / Upload
// ══════════════════════════════════════════════════════════════════

export const GENERATE_PRESIGNED_URL = gql`
  mutation GeneratePresignedUrl(
    $fileName: String!
    $mimeType: String!
    $module: String!
  ) {
    generatePresignedUrl(
      fileName: $fileName
      mimeType: $mimeType
      module: $module
    ) {
      url
      key
      cdnUrl
      isPrivate
    }
  }
`;

export const CONFIRM_UPLOAD = gql`
  mutation ConfirmUpload($key: String!, $module: String!) {
    confirmUpload(key: $key, module: $module) {
      id
      key
      cdnUrl
      mimeType
      size
      module
      createdAt
    }
  }
`;
