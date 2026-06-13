import React, { useState, useEffect, useRef, useCallback, useLayoutEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ActionSheetIOS,
  Alert,
} from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery, useMutation } from '@apollo/client/react';
import { useFront } from '@/lib/theme/ThemeContext';
import { useSocket } from '@/lib/hooks/useSocket';
import {
  MESSAGES,
  SEND_MESSAGE,
  RECALL_MESSAGE,
  DELETE_MESSAGE,
  FORWARD_MESSAGE,
  ADD_REACTION,
  REMOVE_REACTION,
} from '@/api/operations';
import { SocketEvent, socketService } from '@/services/socketService';
import { authService } from '@/services/authService';
import { RootStackParamList } from '@/Navigation';
import type { Message, MessagesResult, MessageType } from '@/types/graphql';
import { MessageStatus } from '@/types/graphql';
import MessageBubble from '@/components/chat/MessageBubble';
import ReactionPicker from '@/components/chat/ReactionPicker';
import { canRecall, parseMeta } from '@/components/chat/chatTypes';
import { messageCache } from '@/services/messageCache';
import type { CachedMessage } from '@/services/messageCache';
import { offlineQueue } from '@/services/offlineQueue';
import { syncService } from '@/services/syncService';

type ConversationRouteProp = RouteProp<RootStackParamList, 'Conversation'>;
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function ConversationScreen() {
  const route = useRoute<ConversationRouteProp>();
  const navigation = useNavigation<NavigationProp>();
  const { conversationId } = route.params;
  const { front, colors } = useFront();

  const [input, setInput] = useState('');
  const [typingUsers, setTypingUsers] = useState<Record<string, string>>({});
  const [showActionSheet, setShowActionSheet] = useState(false);
  const [cachedMessages, setCachedMessages] = useState<CachedMessage[]>([]);
  const [optimisticMessages, setOptimisticMessages] = useState<CachedMessage[]>([]);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [reactingToMessageId, setReactingToMessageId] = useState<string | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messagesRef = useRef<Message[]>([]);
  const messagePositionsRef = useRef<Map<string, number>>(new Map());

  const currentUserId = authService.currentUser?.id;

  // ── Cache: load on mount, persist on updates ───────────────

  useEffect(() => {
    // Load cached messages for instant display
    const cached = messageCache.getMessages(conversationId, { limit: 50 });
    setCachedMessages(cached.reverse()); // cache stores DESC, display needs ASC

    // Track conversation in cache registry
    messageCache.trackConversation(conversationId);

    // Reset unread count — user is viewing this conversation
    messageCache.resetUnread(conversationId);

    // Initialize offline queue (auto-flush on socket connect)
    offlineQueue.init();
    // Flush any pending messages on mount
    offlineQueue.flush();

    return () => {
      // Reset unread on leave as well (already read)
      messageCache.resetUnread(conversationId);
      // Clean up offline queue listener
      offlineQueue.destroy();
    };
  }, [conversationId]);

  // ── Fetch messages ─────────────────────────────────────────────

  const {
    loading,
    data,
    error,
    refetch,
    fetchMore,
  } = useQuery<{ messages: MessagesResult }>(MESSAGES, {
    variables: { conversationId, limit: 50 },
    notifyOnNetworkStatusChange: true,
  });

  const messages: Message[] = data?.messages?.items ?? [];
  const hasMore = data?.messages?.hasMore ?? false;
  const nextCursor = data?.messages?.nextCursor;

  // Keep a ref so socket callbacks always have latest messages
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // When Apollo returns data, persist to cache and clean up optimistic messages
  useEffect(() => {
    if (messages.length === 0) return;

    // Save server messages to cache
    messageCache.saveMessages(messages.map((msg) => messageCache.fromGraphQL(msg)));

    // Build set of clientTempIds confirmed by server
    const confirmedIds = new Set(
      messages
        .filter((m) => m.clientTempId)
        .map((m) => m.clientTempId),
    );

    if (confirmedIds.size > 0) {
      // Remove optimistic messages that server has confirmed
      setOptimisticMessages((prev) =>
        prev.filter((m) => !confirmedIds.has(m.clientTempId)),
      );

      // Clean up temp messages from cache
      for (const tempId of confirmedIds) {
        messageCache.untrackPending(tempId as string);
        messageCache.deleteMessage(tempId as string);
      }
    }
  }, [messages]);

  // ── Mutations ──────────────────────────────────────────────

  const [sendMessage, { loading: sending }] = useMutation(SEND_MESSAGE);
  const [recallMessage] = useMutation(RECALL_MESSAGE);
  const [deleteMessage] = useMutation(DELETE_MESSAGE);
  const [forwardMessage] = useMutation(FORWARD_MESSAGE);
  const [addReaction] = useMutation(ADD_REACTION);
  const [removeReaction] = useMutation(REMOVE_REACTION);

  // ── Send message handler ───────────────────────────────────────

  const handleSend = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || sending) return;

    const tempId = `temp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    // Build meta with optional replyTo
    const metaObj: Record<string, any> = {};
    if (replyingTo) {
      metaObj.replyTo = {
        messageId: replyingTo.id,
        content: replyingTo.content?.slice(0, 100) || '',
        senderId: replyingTo.senderId,
        senderName: undefined, // will be populated by server
      };
    }
    const metaStr = Object.keys(metaObj).length > 0 ? JSON.stringify(metaObj) : undefined;

    // Create optimistic message for instant display
    const optimistic: CachedMessage = {
      id: tempId,
      conversationId,
      senderId: currentUserId!,
      content: trimmed,
      type: 0 as any, // MessageType.TEXT
      clientTempId: tempId,
      createdAt: new Date().toISOString(),
      status: MessageStatus.SENDING,
      meta: metaStr,
    };

    // Persist to cache
    messageCache.saveMessage(optimistic);
    messageCache.trackPending(tempId);

    // Add to optimistic state for immediate UI
    setOptimisticMessages((prev) => [...prev, optimistic]);

    setInput('');
    setReplyingTo(null);
    try {
      await sendMessage({
        variables: {
          conversationId,
          content: trimmed,
          type: 0,
          clientTempId: tempId,
          meta: metaStr,
        },
      });
    } catch {
      // Mark as failed in cache
      const failed = messageCache.getMessageById(tempId);
      if (failed) {
        failed.status = MessageStatus.FAILED;
        messageCache.saveMessage(failed);
      }
      // Update optimistic state to show failure
      setOptimisticMessages((prev) =>
        prev.map((m) =>
          m.id === tempId ? { ...m, status: MessageStatus.FAILED } : m,
        ),
      );
    }
  }, [input, sending, sendMessage, conversationId, currentUserId, replyingTo]);

  // ── Header actions: Group info + Call buttons ──────────────────

  useLayoutEffect(() => {
    const { groupId, title } = route.params;
    navigation.setOptions({
      headerRight: () => (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, marginRight: 8 }}>
          {groupId && (
            <TouchableOpacity
              onPress={() => {
                navigation.navigate('GroupProfile', {
                  conversationId,
                  groupId,
                });
              }}
              style={styles.headerCallButton}
            >
              <Text style={[styles.headerCallIcon, { color: colors.utilityBrand500 || '#FF7A00' }]}>ℹ️</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={() => {
              navigation.navigate('Call', {
                sessionId: `${Date.now()}_audio`,
                targetId: title || 'User',
                mediaType: 'audio',
              });
            }}
            style={styles.headerCallButton}
          >
            <Text style={[styles.headerCallIcon, { color: colors.utilityBrand500 || '#FF7A00' }]}>📞</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              navigation.navigate('Call', {
                sessionId: `${Date.now()}_video`,
                targetId: title || 'User',
                mediaType: 'video',
              });
            }}
            style={styles.headerCallButton}
          >
            <Text style={[styles.headerCallIcon, { color: colors.utilityBrand500 || '#FF7A00' }]}>📹</Text>
          </TouchableOpacity>
        </View>
      ),
    });
  }, [navigation, colors, route.params.groupId, route.params.title, conversationId]);

  // ── Room lifecycle ─────────────────────────────────────────────

  useEffect(() => {
    socketService.joinConversationRoom(conversationId);
    return () => {
      socketService.leaveConversationRoom(conversationId);
    };
  }, [conversationId]);

  // ── Real-time updates ──────────────────────────────────────────

  useSocket(
    SocketEvent.MESSAGE_CREATED,
    useCallback(
      (msg: any) => {
        if (msg.conversationId === conversationId) {
          if (msg.id && msg.content != null) {
            messageCache.saveMessage(messageCache.fromGraphQL(msg as Message));

            // Check seqId continuity to detect gaps
            if (msg.seqId != null && msg.seqId > 0) {
              syncService.checkGap(conversationId, msg.seqId);
            }
          }
          refetch();
        }
      },
      [conversationId, refetch],
    ),
  );

  useSocket(
    SocketEvent.MESSAGE_RECALLED,
    useCallback(
      (payload: any) => {
        if (payload.conversationId === conversationId) {
          if (payload.messageId) {
            const cached = messageCache.getMessageById(payload.messageId);
            if (cached) {
              cached.isRecalled = true;
              cached.recalledAt = new Date().toISOString();
              messageCache.saveMessage(cached);
            }
          }
          refetch();
        }
      },
      [conversationId, refetch],
    ),
  );

  useSocket(
    SocketEvent.REACTION_ADDED,
    useCallback(
      (payload: any) => {
        if (payload.conversationId === conversationId) {
          refetch();
        }
      },
      [conversationId, refetch],
    ),
  );

  useSocket(
    SocketEvent.REACTION_REMOVED,
    useCallback(
      (payload: any) => {
        if (payload.conversationId === conversationId) {
          refetch();
        }
      },
      [conversationId, refetch],
    ),
  );

  // ── Group event handlers ──────────────────────────────────────
  // These only apply when the current conversation is a group chat.

  useSocket(
    SocketEvent.MEMBER_JOINED,
    useCallback(
      (payload: any) => {
        if (payload.conversationId === conversationId) {
          refetch();
          Alert.alert(
            'New Member',
            payload.nickname
              ? `${payload.nickname} joined the group`
              : 'A new member joined the group',
          );
        }
      },
      [conversationId, refetch],
    ),
  );

  useSocket(
    SocketEvent.MEMBER_LEFT,
    useCallback(
      (payload: any) => {
        if (payload.conversationId === conversationId) {
          refetch();
        }
      },
      [conversationId, refetch],
    ),
  );

  useSocket(
    SocketEvent.MEMBER_KICKED,
    useCallback(
      (payload: any) => {
        if (payload.conversationId === conversationId) {
          // If the current user was kicked, navigate away
          if (payload.userId === currentUserId) {
            Alert.alert('Removed', 'You have been removed from the group');
            navigation.goBack();
          } else {
            refetch();
          }
        }
      },
      [conversationId, currentUserId, refetch, navigation],
    ),
  );

  useSocket(
    SocketEvent.GROUP_UPDATED,
    useCallback(
      (payload: any) => {
        if (payload.conversationId === conversationId) {
          // Update group info in header (name/avatar)
          if (payload.name) {
            navigation.setOptions({ title: payload.name });
          }
          refetch();
        }
      },
      [conversationId, refetch, navigation],
    ),
  );

  useSocket(
    SocketEvent.GROUP_DISBANDED,
    useCallback(
      (payload: any) => {
        if (payload.conversationId === conversationId) {
          Alert.alert('Group Disbanded', 'This group has been disbanded');
          navigation.goBack();
        }
      },
      [conversationId, navigation],
    ),
  );

  // ── Typing indicator ───────────────────────────────────────────

  useSocket(
    SocketEvent.TYPING_START,
    useCallback(
      (payload: { conversationId: string; userId: string; nickname?: string }) => {
        if (
          payload.conversationId === conversationId &&
          payload.userId !== currentUserId
        ) {
          setTypingUsers((prev) => ({
            ...prev,
            [payload.userId]: payload.nickname || 'Someone',
          }));
        }
      },
      [conversationId, currentUserId],
    ),
  );

  useSocket(
    SocketEvent.TYPING_STOP,
    useCallback(
      (payload: { conversationId: string; userId: string }) => {
        if (payload.conversationId === conversationId) {
          setTypingUsers((prev) => {
            const next = { ...prev };
            delete next[payload.userId];
            return next;
          });
        }
      },
      [conversationId],
    ),
  );

  const handleInputChange = useCallback(
    (text: string) => {
      setInput(text);

      // Emit typing:start (throttled)
      socketService.emitTypingStart(conversationId);
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => {
        socketService.emitTypingStop(conversationId);
      }, 2000);
    },
    [conversationId],
  );

  // ── Merge cached + server + optimistic messages for display ────

  const displayMessages = useMemo(() => {
    // Build deduplicated map: server messages are authoritative
    const map = new Map<string, Message | CachedMessage>();

    // Server messages (from Apollo) go first — authoritative
    for (const msg of messages) {
      map.set(msg.id, msg);
    }

    // Add cached messages that haven't arrived from server yet
    for (const msg of cachedMessages) {
      if (!map.has(msg.id)) {
        map.set(msg.id, msg);
      }
    }

    // Add optimistic messages not yet confirmed by server
    const confirmedClientTempIds = new Set(
      messages.filter((m) => m.clientTempId).map((m) => m.clientTempId),
    );
    for (const msg of optimisticMessages) {
      if (msg.clientTempId && confirmedClientTempIds.has(msg.clientTempId)) continue;
      if (!map.has(msg.id)) {
        map.set(msg.id, msg);
      }
    }

    // Sort ASC (oldest first) for chat display
    return Array.from(map.values()).sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
  }, [messages, cachedMessages, optimisticMessages]);

  // ── Auto-scroll on new messages ────────────────────────────────

  useEffect(() => {
    if (displayMessages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [displayMessages.length]);

  // ── Load more (pagination) ─────────────────────────────────────

  const handleLoadMore = useCallback(() => {
    if (!hasMore || loading) return;
    fetchMore({ variables: { cursor: nextCursor } });
  }, [hasMore, loading, fetchMore, nextCursor]);

  // ── Long-press context menu ────────────────────────────────────

  const handleMessageLongPress = useCallback(
    (message: Message) => {
      const canRecallMsg = canRecall(message, currentUserId);
      const isMyMessage = message.senderId === currentUserId;
      const isText = message.type === 0;
      const isRecalled = !!message.recalledAt;
      const isDeleted = !!message.deletedAt;

      // Build options list dynamically
      const options: string[] = [];
      const handlers: (() => void)[] = [];

      // Copy (text only)
      if (isText && !isRecalled && !isDeleted) {
        options.push('Copy');
        handlers.push(() => {
          // Copy to clipboard is handled by the native action sheet
          // We'll use Alert to show content as a simple fallback
          Alert.alert('Message', message.content);
        });
      }

      // Reply
      if (!isRecalled && !isDeleted) {
        options.push('Reply');
        handlers.push(() => {
          setReplyingTo(message);
        });
      }

      // Forward
      if (!isRecalled && !isDeleted) {
        options.push('Forward');
        handlers.push(() => {
          // Show conversation picker
          Alert.alert('Forward', 'Select a conversation to forward to', [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Select',
              onPress: () => {
                // Navigate to conversation list for forwarding
                // For MVP, we forward to the first available conversation
                forwardMessage({
                  variables: {
                    messageId: message.id,
                    targetConversationId: conversationId,
                  },
                }).then(() => refetch());
              },
            },
          ]);
        });
      }

      // Delete
      if (isMyMessage && !isRecalled && !isDeleted) {
        options.push('Delete');
        handlers.push(() => {
          Alert.alert('Delete Message', 'Are you sure?', [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Delete',
              style: 'destructive',
              onPress: async () => {
                try {
                  await deleteMessage({ variables: { messageId: message.id } });
                  messageCache.deleteMessage(message.id);
                  refetch();
                } catch { /* handled by Apollo */ }
              },
            },
          ]);
        });
      }

      // Recall (only within 2 minutes)
      if (canRecallMsg) {
        options.push('Recall');
        handlers.push(() => {
          Alert.alert('Recall Message', 'Recall this message for everyone?', [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Recall',
              style: 'destructive',
              onPress: async () => {
                await handleRecall(message);
              },
            },
          ]);
        });
      }

      if (options.length === 0) return;

      options.push('Cancel');
      // No handler needed for Cancel

      if (Platform.OS === 'ios') {
        ActionSheetIOS.showActionSheetWithOptions(
          {
            options,
            cancelButtonIndex: options.length - 1,
            destructiveButtonIndex: options
              .map((opt, idx) => (opt === 'Delete' || opt === 'Recall' ? idx : -1))
              .filter((idx) => idx >= 0)
              .concat(-1)[0] ?? undefined,
          },
          (index) => {
            if (index < handlers.length) {
              handlers[index]();
            }
          },
        );
      } else {
        Alert.alert('Message Actions', undefined, [
          ...options.slice(0, -1).map((opt, idx) => ({
            text: opt,
            style: (opt === 'Delete' || opt === 'Recall' ? 'destructive' : 'default') as 'destructive' | 'default' | 'cancel',
            onPress: handlers[idx],
          })),
          { text: 'Cancel', style: 'cancel' as const },
        ]);
      }
    },
    [currentUserId, forwardMessage, deleteMessage, refetch, conversationId],
  );

  // ── Recall handler ─────────────────────────────────────────────

  const handleRecall = useCallback(
    async (message: Message) => {
      if (!canRecall(message, currentUserId)) return;
      try {
        await recallMessage({ variables: { messageId: message.id } });
        // Optimistically mark as recalled in cache
        const cached = messageCache.getMessageById(message.id);
        if (cached) {
          cached.isRecalled = true;
          cached.recalledAt = new Date().toISOString();
          messageCache.saveMessage(cached);
        }
        refetch();
      } catch {
        // Error handled by Apollo error link
      }
    },
    [recallMessage, currentUserId, refetch],
  );

  // ── Reaction handler ───────────────────────────────────────────

  const handleReaction = useCallback(
    async (messageId: string, emoji: string) => {
      const msg = messages.find((m) => m.id === messageId);
      if (!msg) return;

      // Check if current user already has this reaction
      const existingReaction = msg.reactions?.find(
        (r) => r.emoji === emoji && r.userId === currentUserId,
      );

      try {
        if (existingReaction) {
          await removeReaction({
            variables: { messageId, emoji },
          });
        } else {
          await addReaction({
            variables: { messageId, emoji },
          });
        }
        refetch();
      } catch {
        // Handled by Apollo
      }
    },
    [messages, currentUserId, addReaction, removeReaction, refetch],
  );

  // ── Reaction picker ────────────────────────────────────────────

  const handleReactionPickerOpen = useCallback(
    (messageId: string, emoji: string) => {
      // Called from ReactionPicker — toggle reaction and close
      handleReaction(messageId, emoji);
      setReactingToMessageId(null);
    },
    [handleReaction],
  );

  const handleReactionClose = useCallback(() => {
    setReactingToMessageId(null);
  }, []);

  // ── Scroll to message (for reply-to navigation) ────────────────

  const handleScrollToMessage = useCallback(
    (messageId: string) => {
      const index = displayMessages.findIndex((m) => m.id === messageId);
      if (index >= 0) {
        flatListRef.current?.scrollToIndex({
          index,
          animated: true,
          viewPosition: 0.5,
        });
      }
    },
    [displayMessages],
  );

  // ── Media press handler ────────────────────────────────────────

  const handleMediaPress = useCallback(
    (message: Message) => {
      // TODO: Implement media preview (Phase A.1–A.3)
      if (__DEV__) {
        console.log(`[MediaPress] type=${message.type} url=${message.content}`);
      }
    },
    [],
  );

  // ── Attachment ActionSheet ─────────────────────────────────────

  const handleAttachmentPress = useCallback(() => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Photo Library', 'Camera', 'File', 'Location', 'Voice'],
          cancelButtonIndex: 0,
        },
        (index) => {
          switch (index) {
            case 1: // Photo Library
              break;
            case 2: // Camera
              break;
            case 3: // File
              break;
            case 4: // Location
              break;
            case 5: // Voice
              break;
          }
        },
      );
    } else {
      setShowActionSheet(true);
    }
  }, []);

  // ── Compute my reactions for the active picker ─────────────────

  const activeMessageForPicker = reactingToMessageId
    ? displayMessages.find((m) => m.id === reactingToMessageId)
    : null;

  const myReactionsSet = useMemo(() => {
    if (!activeMessageForPicker || !currentUserId) return new Set<string>();
    const reactions = (activeMessageForPicker as any).reactions as
      | Array<{ userId: string; emoji: string }>
      | undefined;
    return new Set<string>(
      reactions
        ?.filter((r) => r.userId === currentUserId)
        .map((r) => r.emoji) ?? [],
    );
  }, [activeMessageForPicker, currentUserId]);

  // ── Render ─────────────────────────────────────────────────────

  // Show cached messages while loading (instant display)
  if (loading && messages.length === 0 && cachedMessages.length === 0) {
    return (
      <View style={[styles.center, { backgroundColor: colors.bgPrimary }]}>
        <ActivityIndicator size="large" color={colors.utilityBrand500 || '#FF7A00'} />
      </View>
    );
  }

  if (error && displayMessages.length === 0) {
    return (
      <View style={[styles.center, { backgroundColor: colors.bgPrimary }]}>
        <Text style={[styles.errorText, { color: colors.textSecondary || '#666' }]}>
          Failed to load messages
        </Text>
        <TouchableOpacity onPress={() => refetch()}>
          <Text style={{ color: colors.utilityBrand500 || '#FF7A00' }}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const typingCount = Object.keys(typingUsers).length;
  const typingLabel =
    typingCount === 1
      ? `${Object.values(typingUsers)[0]} is typing...`
      : typingCount > 1
        ? 'Several people are typing...'
        : null;

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.bgPrimary }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <FlatList
        ref={flatListRef}
        data={displayMessages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: front.spacingMd || 16 }}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        inverted={false}
        removeClippedSubviews={true}
        maxToRenderPerBatch={10}
        windowSize={5}
        initialNumToRender={15}
        maintainVisibleContentPosition={{
          minIndexForVisible: 0,
        }}
        ListFooterComponent={
          loading && displayMessages.length > 0 ? (
            <ActivityIndicator
              size="small"
              color={colors.utilityBrand500 || '#FF7A00'}
              style={{ marginVertical: 8 }}
            />
          ) : null
        }
        renderItem={({ item }) => {
          const isMe = item.senderId === currentUserId;
          const isFailed = 'status' in item && item.status === MessageStatus.FAILED;
          return (
            <View>
              <MessageBubble
                message={item}
                isMe={isMe}
                currentUserId={currentUserId}
                colors={colors}
                onMediaPress={handleMediaPress}
                onLongPress={handleMessageLongPress}
                onReaction={handleReaction}
                onReplyPress={handleScrollToMessage}
              />
              {isFailed && (
                <TouchableOpacity
                  onPress={() => offlineQueue.flush()}
                  style={[styles.retryButton, { backgroundColor: colors.utilityError50 || '#FEF3F2' }]}
                >
                  <Text style={[styles.retryText, { color: colors.utilityError500 || '#E53E3E' }]}>
                    Failed - Tap to retry
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          );
        }}
      />

      {/* Typing indicator */}
      {typingLabel && (
        <View style={[styles.typingContainer, { backgroundColor: colors.bgSecondary }]}>
          <Text style={[styles.typingText, { color: colors.textTertiary || '#999' }]}>
            {typingLabel}
          </Text>
        </View>
      )}

      {/* Reply banner */}
      {replyingTo && (
        <View style={[styles.replyBanner, { backgroundColor: colors.bgSecondary }]}>
          <View style={styles.replyBannerContent}>
            <View style={[styles.replyBannerBar, { backgroundColor: colors.utilityBrand500 || '#FF7A00' }]} />
            <View style={styles.replyBannerText}>
              <Text
                style={[styles.replyBannerLabel, { color: colors.utilityBrand500 || '#FF7A00' }]}
                numberOfLines={1}
              >
                Replying to {replyingTo.senderId === currentUserId ? 'yourself' : 'message'}
              </Text>
              <Text
                style={[styles.replyBannerPreview, { color: colors.textSecondary || '#666' }]}
                numberOfLines={1}
              >
                {replyingTo.content?.slice(0, 80) || '[Media]'}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.replyBannerClose}
              onPress={() => setReplyingTo(null)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={[styles.replyBannerCloseText, { color: colors.textSecondary || '#666' }]}>
                ✕
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Input bar */}
      <View
        style={[
          styles.inputBar,
          {
            backgroundColor: colors.bgSecondary,
            borderTopColor: colors.borderSecondary,
          },
        ]}
      >
        {/* Attachment button */}
        {!sending && (
          <TouchableOpacity
            style={styles.attachButton}
            onPress={handleAttachmentPress}
          >
            <Text style={[styles.attachIcon, { color: colors.textSecondary || '#666' }]}>
              +
            </Text>
          </TouchableOpacity>
        )}
        <TextInput
          style={[
            styles.input,
            { backgroundColor: colors.bgPrimary, color: colors.textPrimary },
          ]}
          placeholder="Type a message..."
          placeholderTextColor={colors.textPlaceholder || '#999'}
          value={input}
          onChangeText={handleInputChange}
          onSubmitEditing={handleSend}
          returnKeyType="send"
          editable={!sending}
        />
        <TouchableOpacity
          style={[
            styles.sendButton,
            {
              backgroundColor: input.trim()
                ? colors.utilityBrand500 || '#FF7A00'
                : colors.utilityBrand200 || '#FFE0B3',
            },
          ]}
          onPress={handleSend}
          disabled={!input.trim() || sending}
        >
          <Text style={styles.sendText}>Send</Text>
        </TouchableOpacity>
      </View>

      {/* Android ActionSheet fallback */}
      {showActionSheet && (
        <View style={styles.actionSheetOverlay}>
          <View style={[styles.actionSheet, { backgroundColor: colors.bgPrimary }]}>
            <TouchableOpacity
              style={styles.actionSheetOption}
              onPress={() => setShowActionSheet(false)}
            >
              <Text style={[styles.actionSheetCancel, { color: colors.textPrimary }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Reaction picker overlay */}
      {reactingToMessageId && (
        <ReactionPicker
          myReactions={myReactionsSet}
          onReaction={(emoji) => handleReactionPickerOpen(reactingToMessageId, emoji)}
          onClose={handleReactionClose}
        />
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderTopWidth: 1,
  },
  attachButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  attachIcon: {
    fontSize: 22,
    fontWeight: '300',
    lineHeight: 24,
  },
  input: {
    flex: 1,
    height: 40,
    borderRadius: 20,
    paddingHorizontal: 16,
    marginRight: 8,
  },
  sendButton: {
    width: 60,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendText: { color: '#fff', fontWeight: '600' },
  typingContainer: {
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  typingText: { fontSize: 12, fontStyle: 'italic' },
  headerCallButton: {
    padding: 4,
  },
  headerCallIcon: {
    fontSize: 20,
  },
  errorText: { fontSize: 15, marginBottom: 12 },
  actionSheetOverlay: {
    position: 'absolute',
    inset: 0,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  actionSheet: {
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  actionSheetOption: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  actionSheetCancel: {
    fontSize: 16,
    fontWeight: '600',
  },
  replyBanner: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  replyBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  replyBannerBar: {
    width: 3,
    height: 32,
    borderRadius: 2,
    marginRight: 10,
  },
  replyBannerText: {
    flex: 1,
  },
  replyBannerLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
  },
  replyBannerPreview: {
    fontSize: 12,
  },
  replyBannerClose: {
    padding: 4,
    marginLeft: 8,
  },
  replyBannerCloseText: {
    fontSize: 16,
    fontWeight: '600',
  },
  retryButton: {
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 12,
    marginBottom: 4,
  },
  retryText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
