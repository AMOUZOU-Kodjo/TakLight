import { create } from 'zustand';
import { api } from '../lib/api';
import { socket } from '../lib/socket';
import { offlineQueue, db } from '../lib/offlineQueue';
import { useAuthStore } from './authStore';
import { showMessageNotification } from '../lib/notifications';

export const useChatStore = create((set, get) => ({
  conversations: [],
  currentConversation: null,
  messages: [],
  isLoading: false,
  hasMore: true,
  nextCursor: null,
  typingUsers: new Set(),
  presence: {},
  selectedMessages: [],

  fetchConversations: async () => {
    set({ isLoading: true });
    try {
      const response = await api.get('/api/conversations');
      const conversations = response.data.conversations;
      set({ conversations });
      await db.cachedConversations.put({ id: 'all', data: conversations, updatedAt: Date.now() });
    } catch (error) {
      console.error('Failed to fetch conversations:', error);
      const cached = await db.cachedConversations.get('all');
      if (cached) set({ conversations: cached.data });
    } finally {
      set({ isLoading: false });
    }
  },

  fetchMessages: async (conversationId, cursor) => {
    set({ isLoading: true });
    try {
      const params = cursor ? { cursor, limit: 20 } : { limit: 20 };
      const response = await api.get(`/api/conversations/${conversationId}/messages`, { params });
      const { messages, nextCursor, hasNextPage } = response.data;

      set((state) => ({
        messages: cursor ? [...messages, ...state.messages] : messages,
        nextCursor,
        hasMore: hasNextPage,
      }));

      for (const msg of messages) {
        await db.cachedMessages.put({
          id: `${conversationId}-${msg.id}`,
          conversationId,
          messageId: msg.id,
          data: msg,
          sentAt: msg.sentAt,
        });
      }
    } catch (error) {
      console.error('Failed to fetch messages:', error);
      if (!cursor) {
        const cached = await db.cachedMessages
          .where('conversationId')
          .equals(conversationId)
          .reverse()
          .sortBy('sentAt');
        if (cached.length > 0) {
          set({ messages: cached.slice(-50).map((c) => c.data), hasMore: false });
        }
      }
    } finally {
      set({ isLoading: false });
    }
  },

  sendMessage: async (conversationId, content, mediaData = null, replyToId = null) => {
    const tempId = `temp-${Date.now()}-${Math.random()}`;
    const { user } = useAuthStore.getState();

    const localMessage = {
      id: tempId,
      conversationId,
      senderId: user.id,
      content,
      mediaUrl: mediaData?.mediaUrl || null,
      mediaType: mediaData?.mediaType || null,
      mediaThumbnailUrl: mediaData?.mediaThumbnailUrl || null,
      replyToId,
      isRead: false,
      isDeleted: false,
      sentAt: new Date().toISOString(),
      deliveredAt: null,
      readAt: null,
      sender: { id: user.id, username: user.username, avatarUrl: user.avatarUrl },
      localStatus: 'pending',
      tempId,
      replyTo: null,
    };

    set((state) => ({
      messages: [...state.messages, localMessage],
    }));

    const sent = await offlineQueue.trySend(conversationId, content, mediaData, tempId, replyToId);
    if (!sent) {
      set((state) => ({
        messages: state.messages.map((m) =>
          m.tempId === tempId ? { ...m, localStatus: 'pending' } : m
        ),
      }));
    }
  },

  selectConversation: (conv) => {
    set({ currentConversation: conv, messages: [], nextCursor: null, hasMore: true });
    if (conv) {
      get().fetchMessages(conv.id);
    }
  },

  markAsRead: (messageId, conversationId) => {
    socket.emit('message:read', { messageId, conversationId });
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === messageId ? { ...m, isRead: true, readAt: new Date().toISOString() } : m
      ),
    }));
  },

  setTyping: (conversationId, isTyping) => {
    socket.emit('user:typing', { conversationId, isTyping });
  },

  deleteMessage: async (conversationId, messageId, forEveryone = false) => {
    try {
      await api.delete(`/api/conversations/${conversationId}/messages/${messageId}`, {
        params: { forEveryone },
      });
      if (forEveryone) {
        useChatStore.setState((state) => ({
          messages: state.messages.map((m) =>
            m.id === messageId
              ? { ...m, isDeleted: true, content: null, mediaUrl: null, mediaType: null, mediaThumbnailUrl: null }
              : m
          ),
        }));
      } else {
        useChatStore.setState((state) => ({
          messages: state.messages.filter((m) => m.id !== messageId),
        }));
      }
    } catch (err) {
      console.error('Failed to delete message:', err);
    }
  },

  toggleSelectMessage: (messageId) => {
    set((state) => {
      const selected = state.selectedMessages.includes(messageId)
        ? state.selectedMessages.filter((id) => id !== messageId)
        : [...state.selectedMessages, messageId];
      return { selectedMessages: selected };
    });
  },

  clearSelection: () => {
    set({ selectedMessages: [] });
  },

  batchDeleteMessages: async (conversationId, forEveryone = false) => {
    const { selectedMessages } = get();
    if (selectedMessages.length === 0) return;
    try {
      await api.post(`/api/conversations/${conversationId}/batch-delete`, {
        messageIds: selectedMessages,
        forEveryone,
      });

      if (forEveryone) {
        set((state) => ({
          messages: state.messages.map((m) =>
            state.selectedMessages.includes(m.id)
              ? { ...m, isDeleted: true, content: null, mediaUrl: null, mediaType: null, mediaThumbnailUrl: null }
              : m
          ),
          selectedMessages: [],
        }));
      } else {
        set((state) => ({
          messages: state.messages.filter((m) => !state.selectedMessages.includes(m.id)),
          selectedMessages: [],
        }));
      }
    } catch (err) {
      console.error('Failed to batch delete messages:', err);
    }
  },
}));

socket.on('message:new', async (message) => {
  const { currentConversation, messages, conversations } = useChatStore.getState();
  const { user } = useAuthStore.getState();

  if (message.senderId === user?.id) return;

  showMessageNotification({
    username: message.sender?.username || 'Nouveau message',
    content: message.content,
    mediaType: message.mediaType,
    conversationId: message.conversationId,
  });

  if (currentConversation && message.conversationId === currentConversation.id) {
    const exists = messages.some((m) => m.id === message.id);
    if (!exists) {
      useChatStore.setState({ messages: [...messages, message] });
      useChatStore.getState().markAsRead(message.id, message.conversationId);
    }
  }

  const updatedConversations = conversations.map((c) =>
    c.id === message.conversationId
      ? {
          ...c,
          lastMessage: message.content || (message.mediaType === 'image' ? '📷 Photo' : message.mediaType === 'audio' ? '🎤 Audio' : '📎 Fichier'),
          lastMessageAt: message.sentAt,
        }
      : c
  );

  useChatStore.setState({ conversations: updatedConversations });
  db.cachedConversations.put({ id: 'all', data: updatedConversations, updatedAt: Date.now() });
});

socket.on('message:delivered', ({ messageId, tempId }) => {
  useChatStore.setState((state) => ({
    messages: state.messages.map((m) =>
      m.tempId === tempId
        ? { ...m, id: messageId, localStatus: 'delivered', tempId: undefined }
        : m
    ),
  }));
});

socket.on('message:read', ({ messageId, userId: _userId }) => {
  useChatStore.setState((state) => ({
    messages: state.messages.map((m) =>
      m.id === messageId ? { ...m, isRead: true, readAt: new Date().toISOString() } : m
    ),
  }));
});

socket.on('user:typing', ({ conversationId, userId, isTyping }) => {
  useChatStore.setState((state) => {
    if (conversationId === state.currentConversation?.id) {
      const newTyping = new Set(state.typingUsers);
      if (isTyping) {
        newTyping.add(userId);
      } else {
        newTyping.delete(userId);
      }
      return { typingUsers: newTyping };
    }
    return {};
  });
});

socket.on('user:presence', ({ userId, status, lastSeen }) => {
  useChatStore.setState((state) => ({
    presence: { ...state.presence, [userId]: { status, lastSeen } },
  }));
});

socket.on('message:deleted', ({ messageId, forEveryone }) => {
  useChatStore.setState((state) => ({
    messages: state.messages.map((m) =>
      m.id === messageId
        ? { ...m, isDeleted: true, content: null, mediaUrl: null, mediaType: null, mediaThumbnailUrl: null }
        : m
    ),
  }));
});
