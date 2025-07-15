import { openDB, DBSchema, IDBPDatabase } from 'idb';


export interface ChatFile {
  name: string;
  type: string;
  size: number;
  content: string; // Base64 encoded content
  preview?: string; // Data URL for image previews
}

export type MessageStatus = 'sent' | 'sending' | 'error';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sessionId: string;
  timestamp: Date;
  files?: FileData[];
  status: MessageStatus;
  imageUrl?: string;
}



export interface FileData {
  name: string;
  type: string;
  size: number;
  content?: string;
  preview?: string;
  data?: string; // Base64 data for images
  mimeType?: string; // MIME type for Gemini API
}

export interface ChatSession {
  id: string;
  title: string;
  messageCount: number;
  model: string;
  createdAt: Date;
  updatedAt: Date;
  lastMessagePreview?: string;
}

interface ChatDB extends DBSchema {
  sessions: {
    key: string;
    value: ChatSession;
    indexes: { 'by-updated': Date };
  };
  messages: {
    key: string;
    value: ChatMessage & { sessionId: string };
    indexes: { 'by-session': string; 'by-timestamp': Date };
  };
}

class IndexedDBService {
  private db: IDBPDatabase<ChatDB> | null = null;
  private readonly DB_NAME = 'GeminiChatDB';
  private readonly DB_VERSION = 1;

  async init(): Promise<void> {
    if (this.db) return;

    this.db = await openDB<ChatDB>(this.DB_NAME, this.DB_VERSION, {
      upgrade(db) {
        // Sessions store
        const sessionStore = db.createObjectStore('sessions', { keyPath: 'id' });
        sessionStore.createIndex('by-updated', 'updatedAt');

        // Messages store
        const messageStore = db.createObjectStore('messages', { keyPath: 'id' });
        messageStore.createIndex('by-session', 'sessionId');
        messageStore.createIndex('by-timestamp', 'timestamp');
      },
    });
  }

  async saveSession(session: ChatSession): Promise<void> {
    await this.init();
    await this.db!.put('sessions', session);
  }

  async getSession(id: string): Promise<ChatSession | undefined> {
    await this.init();
    return await this.db!.get('sessions', id);
  }

  async getAllSessions(): Promise<ChatSession[]> {
    await this.init();
    const sessions = await this.db!.getAllFromIndex('sessions', 'by-updated');
    return sessions.reverse(); // Most recent first
  }

  async deleteSession(id: string): Promise<void> {
    await this.init();
    const tx = this.db!.transaction(['sessions', 'messages'], 'readwrite');

    // Delete session
    await tx.objectStore('sessions').delete(id);

    // Delete all messages for this session
    const messageIndex = tx.objectStore('messages').index('by-session');
    const messages = await messageIndex.getAllKeys(id);
    for (const messageId of messages) {
      await tx.objectStore('messages').delete(messageId);
    }

    await tx.done;
  }

  async saveMessage(message: ChatMessage, sessionId: string): Promise<void> {
    await this.init();
    await this.db!.put('messages', { ...message, sessionId });
  }

  async getMessages(sessionId: string, limit?: number, offset?: number): Promise<ChatMessage[]> {
    await this.init();
    const tx = this.db!.transaction('messages', 'readonly');
    const index = tx.store.index('by-session');

    let messages = await index.getAll(sessionId);

    // Sort by timestamp
    messages.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    // Apply pagination
    if (limit !== undefined) {
      if (offset !== undefined && offset > 0) {
        // For loading older messages: get messages before the offset
        const startIndex = Math.max(0, messages.length - offset - limit);
        const endIndex = messages.length - offset;
        messages = messages.slice(startIndex, endIndex);
      } else {
        // For initial load: get last N messages
        messages = messages.slice(-limit);
      }
    }

    // Remove sessionId from returned messages
    return messages.map(({ ...message }) => message);
  }

  async getMessageCount(sessionId: string): Promise<number> {
    await this.init();
    const tx = this.db!.transaction('messages', 'readonly');
    const index = tx.store.index('by-session');
    return await index.count(sessionId);
  }

  async clearOldMessages(sessionId: string, keepCount: number = 50): Promise<void> {
    await this.init();
    const tx = this.db!.transaction('messages', 'readwrite');
    const index = tx.store.index('by-session');

    const messages = await index.getAll(sessionId);
    messages.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    if (messages.length > keepCount) {
      const messagesToDelete = messages.slice(0, messages.length - keepCount);
      for (const message of messagesToDelete) {
        await tx.store.delete(message.id);
      }
    }

    await tx.done;
  }
}

export const dbService = new IndexedDBService();