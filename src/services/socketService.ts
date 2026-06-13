/**
 * Sama Socket.IO service for real-time messaging.
 *
 * Connects to SamaHub with JWT auth in the handshake query.
 * Automatically joins user:${userId} and conversation:${conversationId} rooms.
 *
 * Usage:
 *   import { socketService } from '@/services/socketService';
 *   socketService.connect(token);
 *   socketService.onMessageCreated((msg) => console.log(msg));
 */
import { io, Socket } from 'socket.io-client';
import { getWsUrl } from '@/lib/env';
import { authService } from './authService';

// ─── Socket event names (mirrors @samahub/shared SocketEvents enum) ──────

export const SocketEvent = {
  MESSAGE_CREATED: 'message_created',
  MESSAGE_RECALLED: 'message_recalled',
  MESSAGE_DELETED: 'message_deleted',
  CONVERSATION_READ: 'conversation_read',
  CONVERSATION_UPDATED: 'conversation_updated',
  CONVERSATION_ADDED: 'conversation_added',
  MEMBER_JOINED: 'member_joined',
  MEMBER_LEFT: 'member_left',
  MEMBER_KICKED: 'member_kicked',
  MEMBER_MUTED: 'member_muted',
  GROUP_UPDATED: 'group_updated',
  GROUP_DISBANDED: 'group_disbanded',
  FRIEND_REQUEST_SENT: 'friend_request_sent',
  FRIEND_REQUEST_HANDLED: 'friend_request_handled',
  CONTACT_REQUEST: 'contact_request',
  CONTACT_REQUEST_HANDLED: 'contact_request_handled',
  GROUP_APPLY: 'group_apply',
  GROUP_APPLY_RESULT: 'group_apply_result',
  GROUP_REQUEST_HANDLED: 'group_request_handled',
  REACTION_ADDED: 'reaction:added',
  REACTION_REMOVED: 'reaction:removed',
  TYPING_START: 'typing_start',
  TYPING_STOP: 'typing_stop',

  // Call events
  CALL_INVITE: 'call_invite',
  CALL_ACCEPT: 'call_accept',
  CALL_END: 'call_end',
  CALL_ICE_CANDIDATE: 'call_ice_candidate',
} as const;

// ─── Types ──────────────────────────────────────────────────────────────

type EventCallback<T = any> = (data: T) => void;

interface TypingPayload {
  conversationId: string;
  userId: string;
}

// ─── Service ────────────────────────────────────────────────────────────

class SocketService {
  private _socket: Socket | null = null;
  private _connected = false;

  /** Whether the socket is currently connected */
  get connected(): boolean {
    return this._connected;
  }

  /** Connect to SamaHub Socket.IO with the current auth token */
  connect(): void {
    if (this._socket?.connected) return;

    const token = authService.getAccessToken();
    if (!token) {
      console.warn('[Socket] No auth token — cannot connect');
      return;
    }

    this._socket = io(getWsUrl(), {
      transports: ['websocket', 'polling'],
      auth: { token },
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    this._socket.on('connect', () => {
      this._connected = true;
      console.debug('[Socket] Connected');
    });

    this._socket.on('disconnect', (reason) => {
      this._connected = false;
      console.debug(`[Socket] Disconnected: ${reason}`);
    });

    this._socket.on('connect_error', (err) => {
      console.warn(`[Socket] Connection error: ${err.message}`);
    });
  }

  /** Disconnect the socket */
  disconnect(): void {
    if (this._socket) {
      this._socket.disconnect();
      this._socket = null;
      this._connected = false;
      console.debug('[Socket] Disconnected');
    }
  }

  // ─── Client → Server (emit events) ───────────────────────────

  /** Start typing indicator */
  emitTypingStart(conversationId: string): void {
    this._socket?.emit('typing:start', { conversationId });
  }

  /** Stop typing indicator */
  emitTypingStop(conversationId: string): void {
    this._socket?.emit('typing:stop', { conversationId });
  }

  /** Join a conversation room (e.g., after being added to a new chat) */
  joinConversationRoom(conversationId: string): void {
    this._socket?.emit('chat:join', { conversationId });
  }

  /** Leave a conversation room */
  leaveConversationRoom(conversationId: string): void {
    this._socket?.emit('chat:leave', { conversationId });
  }

  // ─── Call signaling (Client → Server) ─────────────────────────

  /** Send a call invite to another user */
  emitCallInvite(payload: {
    sessionId: string;
    targetId: string;
    mediaType: 'audio' | 'video';
    conversationId?: string;
  }): void {
    this._socket?.emit('call_invite', payload);
  }

  /** Accept an incoming call */
  emitCallAccept(payload: { sessionId: string }): void {
    this._socket?.emit('call_accept', payload);
  }

  /** End an active call */
  emitCallEnd(payload: { sessionId: string; reason: string }): void {
    this._socket?.emit('call_end', payload);
  }

  /** Send ICE candidate for WebRTC */
  emitCallIceCandidate(payload: { sessionId: string; candidate: any }): void {
    this._socket?.emit('call_ice_candidate', payload);
  }

  // ─── Server → Client (listen events) ─────────────────────────

  /** New message received in a conversation */
  onMessageCreated(callback: EventCallback): () => void {
    return this._on(SocketEvent.MESSAGE_CREATED, callback);
  }

  /** Message recalled by sender */
  onMessageRecalled(callback: EventCallback): () => void {
    return this._on(SocketEvent.MESSAGE_RECALLED, callback);
  }

  /** Message deleted */
  onMessageDeleted(callback: EventCallback): () => void {
    return this._on(SocketEvent.MESSAGE_DELETED, callback);
  }

  /** Conversation marked as read by another participant */
  onConversationRead(callback: EventCallback): () => void {
    return this._on(SocketEvent.CONVERSATION_READ, callback);
  }

  /** Conversation details updated (name, avatar, etc.) */
  onConversationUpdated(callback: EventCallback): () => void {
    return this._on(SocketEvent.CONVERSATION_UPDATED, callback);
  }

  /** New conversation added (e.g., someone created a direct chat with you) */
  onConversationAdded(callback: EventCallback): () => void {
    return this._on(SocketEvent.CONVERSATION_ADDED, callback);
  }

  /** New member joined a conversation */
  onMemberJoined(callback: EventCallback): () => void {
    return this._on(SocketEvent.MEMBER_JOINED, callback);
  }

  /** Member left a conversation */
  onMemberLeft(callback: EventCallback): () => void {
    return this._on(SocketEvent.MEMBER_LEFT, callback);
  }

  /** Member kicked from conversation */
  onMemberKicked(callback: EventCallback): () => void {
    return this._on(SocketEvent.MEMBER_KICKED, callback);
  }

  /** Typing indicator — another user started typing */
  onTypingStart(callback: EventCallback<TypingPayload>): () => void {
    return this._on(SocketEvent.TYPING_START, callback);
  }

  /** Typing indicator — another user stopped typing */
  onTypingStop(callback: EventCallback<TypingPayload>): () => void {
    return this._on(SocketEvent.TYPING_STOP, callback);
  }

  /** Contact request received */
  onContactRequest(callback: EventCallback): () => void {
    return this._on(SocketEvent.CONTACT_REQUEST, callback);
  }

  /** Contact request handled */
  onContactRequestHandled(callback: EventCallback): () => void {
    return this._on(SocketEvent.CONTACT_REQUEST_HANDLED, callback);
  }

  // ─── Call signaling (Server → Client) ─────────────────────────

  /** Listen for incoming call invites */
  onCallInvite(callback: EventCallback): () => void {
    return this._on(SocketEvent.CALL_INVITE, callback);
  }

  /** Listen for call accept events */
  onCallAccept(callback: EventCallback): () => void {
    return this._on(SocketEvent.CALL_ACCEPT, callback);
  }

  /** Listen for call end events */
  onCallEnd(callback: EventCallback): () => void {
    return this._on(SocketEvent.CALL_END, callback);
  }

  /** Listen for ICE candidates */
  onCallIceCandidate(callback: EventCallback): () => void {
    return this._on(SocketEvent.CALL_ICE_CANDIDATE, callback);
  }

  // ─── Generic listener ────────────────────────────────────────

  /**
   * Subscribe to an arbitrary socket event.
   * Returns an unsubscribe function.
   */
  on(event: string, callback: EventCallback): () => void {
    return this._on(event, callback);
  }

  // ─── Private ─────────────────────────────────────────────────

  private _on(event: string, callback: EventCallback): () => void {
    this._socket?.on(event, callback);
    return () => {
      this._socket?.off(event, callback);
    };
  }
}

/** Singleton socket service instance */
export const socketService = new SocketService();
