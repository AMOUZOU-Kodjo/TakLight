import Dexie from 'dexie';
import { api } from './api';
import { useAuthStore } from '../store/authStore';

class TalkLightDB extends Dexie {
  constructor() {
    super('TalkLightDB');
    this.version(2).stores({
      messages: '++id, conversationId, tempId, retryCount, nextRetry, createdAt',
      pendingUploads: '++id, type, conversationId, retryCount, nextRetry, createdAt',
      cachedConversations: '++id, updatedAt',
      cachedMessages: '++id, conversationId, messageId, sentAt',
    });
  }
}

export const db = new TalkLightDB();

class OfflineQueue {
  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.processQueue();
        this.processPendingUploads();
      });
    }
  }

  async addMessage(message) {
    await db.messages.add({
      conversationId: message.conversationId,
      content: message.content || null,
      mediaUrl: message.mediaUrl || null,
      mediaType: message.mediaType || null,
      mediaThumbnailUrl: message.mediaThumbnailUrl || null,
      tempId: message.tempId,
      retryCount: 0,
      nextRetry: Date.now(),
      createdAt: Date.now(),
    });
    this.processQueue();
  }

  async trySend(conversationId, content, mediaData, tempId) {
    if (!navigator.onLine) {
      await this.addMessage({ conversationId, content, mediaUrl: mediaData?.mediaUrl, mediaType: mediaData?.mediaType, mediaThumbnailUrl: mediaData?.mediaThumbnailUrl, tempId });
      return false;
    }
    try {
      const payload = { content: content || '', tempId };
      if (mediaData?.mediaUrl) payload.mediaUrl = mediaData.mediaUrl;
      if (mediaData?.mediaType) payload.mediaType = mediaData.mediaType;
      if (mediaData?.mediaThumbnailUrl) payload.mediaThumbnailUrl = mediaData.mediaThumbnailUrl;
      await api.post(`/api/conversations/${conversationId}/messages`, payload);
      return true;
    } catch {
      await this.addMessage({ conversationId, content, mediaUrl: mediaData?.mediaUrl, mediaType: mediaData?.mediaType, mediaThumbnailUrl: mediaData?.mediaThumbnailUrl, tempId });
      return false;
    }
  }

  async addPendingUpload(file, conversationId) {
    const reader = new FileReader();
    const arrayBuffer = await new Promise((resolve, reject) => {
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
    const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
    await db.pendingUploads.add({
      type: file.type.startsWith('image/') ? 'image' : 'audio',
      fileName: file.name,
      fileData: base64,
      mimeType: file.type,
      conversationId,
      retryCount: 0,
      nextRetry: Date.now(),
      createdAt: Date.now(),
    });
    this.processPendingUploads();
  }

  async processQueue() {
    try {
      const now = Date.now();
      const pending = await db.messages
        .where('nextRetry')
        .belowOrEqual(now)
        .sortBy('createdAt');
      for (const msg of pending) {
        try {
          const payload = { content: msg.content || '', tempId: msg.tempId };
          if (msg.mediaUrl) payload.mediaUrl = msg.mediaUrl;
          if (msg.mediaType) payload.mediaType = msg.mediaType;
          if (msg.mediaThumbnailUrl) payload.mediaThumbnailUrl = msg.mediaThumbnailUrl;
          await api.post(`/api/conversations/${msg.conversationId}/messages`, payload);
          await db.messages.delete(msg.id);
        } catch (error) {
          const retryCount = msg.retryCount + 1;
          if (retryCount >= 5) {
            await db.messages.delete(msg.id);
            const { useChatStore } = await import('../store/chatStore');
            useChatStore.setState((state) => ({
              messages: state.messages.map((m) =>
                m.tempId === msg.tempId ? { ...m, localStatus: 'failed' } : m
              ),
            }));
          } else {
            const delay = Math.min(1000 * 2 ** retryCount, 16000);
            await db.messages.update(msg.id, {
              retryCount,
              nextRetry: Date.now() + delay,
            });
          }
        }
      }
    } catch {}
  }

  async processPendingUploads() {
    if (!navigator.onLine) return;
    const now = Date.now();
    const pending = await db.pendingUploads
      .where('nextRetry')
      .belowOrEqual(now)
      .sortBy('createdAt');
    for (const item of pending) {
      try {
        const binary = Uint8Array.from(atob(item.fileData), (c) => c.charCodeAt(0));
        const blob = new Blob([binary], { type: item.mimeType });
        const file = new File([blob], item.fileName, { type: item.mimeType });
        const formData = new FormData();
        formData.append('file', file);
        const endpoint = item.type === 'image' ? '/api/upload/image' : '/api/upload/audio';
        const res = await api.post(endpoint, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        const { mediaUrl, mediaType, mediaThumbnailUrl } = res.data;
        await this.addMessage({
          conversationId: item.conversationId,
          content: '',
          mediaUrl,
          mediaType,
          mediaThumbnailUrl,
          tempId: `temp-${Date.now()}-${Math.random()}`,
        });
        await db.pendingUploads.delete(item.id);
      } catch {
        const retryCount = item.retryCount + 1;
        if (retryCount >= 3) {
          await db.pendingUploads.delete(item.id);
        } else {
          const delay = Math.min(1000 * 2 ** retryCount, 16000);
          await db.pendingUploads.update(item.id, {
            retryCount,
            nextRetry: Date.now() + delay,
          });
        }
      }
    }
  }

  async retryFailed(tempId) {
    const msg = await db.messages.where('tempId').equals(tempId).first();
    if (msg) {
      await db.messages.update(msg.id, { retryCount: 0, nextRetry: Date.now() });
      this.processQueue();
    }
  }

  getQueuedMessagesCount() {
    return db.messages.count();
  }

  getQueuedUploadsCount() {
    return db.pendingUploads.count();
  }
}

export const offlineQueue = new OfflineQueue();

setInterval(() => {
  offlineQueue.processQueue();
  offlineQueue.processPendingUploads();
}, 5000);
