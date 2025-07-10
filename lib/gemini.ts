import { GoogleGenerativeAI, GenerativeModel, ChatSession as GeminiChatSession, Part, Content } from '@google/generative-ai';
import { dbService, ChatMessage, ChatSession, FileData } from './indexdb'; // Pastikan import dbService sudah benar

// Ensure NEXT_PUBLIC_GEMINI_API_KEY is defined in your .env.local
const GEMINI_API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.warn('NEXT_PUBLIC_GEMINI_API_KEY is not set. Gemini services may not function correctly.');
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY || '');

/**
 * Interface representing a Gemini model's capabilities.
 */
export interface GeminiModel {
  name: string;
  displayName: string;
  description: string;
  inputTokenLimit: number;
  outputTokenLimit: number;
  supportedGenerationMethods: string[];
}

/**
 * Service class for interacting with the Google Gemini API.
 * Implements a singleton pattern to ensure only one instance exists.
 */
export class GeminiChatService {
  private static instance: GeminiChatService;
  private availableModels: GeminiModel[] = [];

  // Configuration for message management and context
  private readonly MESSAGE_LIMIT = 100; // Maximum messages to keep in DB per session (for cleanup)
  private readonly CONTEXT_LIMIT = 20; // Number of recent messages to send for context to Gemini

  /**
   * Private constructor to enforce singleton pattern.
   */
  private constructor() {
    // Initialize available models on service creation
    this.fetchAvailableModels();
  }

  /**
   * Gets the singleton instance of GeminiChatService.
   * @returns {GeminiChatService} The singleton instance.
   */
  static getInstance(): GeminiChatService {
    if (!GeminiChatService.instance) {
      GeminiChatService.instance = new GeminiChatService();
    }
    return GeminiChatService.instance;
  }

  /**
   * Fetches available Gemini models from the API.
   * This method is called once on service initialization.
   * @returns {Promise<GeminiModel[]>} A promise that resolves to an array of available Gemini models.
   */
  async fetchAvailableModels(): Promise<GeminiModel[]> {
    if (!GEMINI_API_KEY) {
      console.error('Gemini API Key is missing. Cannot fetch models.');
      // Fallback to default models if API key is not set
      this.availableModels = this._getDefaultModels();
      return this.availableModels;
    }

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${GEMINI_API_KEY}`
      );

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Failed to fetch models:', errorData);
        throw new Error(`Failed to fetch models: ${errorData.error?.message || response.statusText}`);
      }

      const data = await response.json();

      this.availableModels = data.models
        .filter((model: any) =>
          model.supportedGenerationMethods?.includes('generateContent') &&
          !model.name.includes('embedding') && // Exclude embedding models
          !model.name.includes('aqa') // Exclude AQA models if not needed
        )
        .map((model: any) => ({
          name: model.name.replace('models/', ''),
          displayName: model.displayName || model.name.replace('models/', ''),
          description: model.description || '',
          inputTokenLimit: model.inputTokenLimit || 0,
          outputTokenLimit: model.outputTokenLimit || 0,
          supportedGenerationMethods: model.supportedGenerationMethods || []
        }));

      // Sort models to prioritize common ones
      this.availableModels.sort((a, b) => {
        const order = ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-pro'];
        const aIndex = order.indexOf(a.name);
        const bIndex = order.indexOf(b.name);
        if (aIndex === -1 && bIndex === -1) return 0; // Both not in order, keep original relative order
        if (aIndex === -1) return 1; // a is not in order, b is, so b comes first
        if (bIndex === -1) return -1; // b is not in order, a is, so a comes first
        return aIndex - bIndex; // Sort by defined order
      });

      return this.availableModels;
    } catch (error) {
      console.error('Error fetching models:', error);
      // Fallback to default models on error
      this.availableModels = this._getDefaultModels();
      return this.availableModels;
    }
  }

  /**
   * Returns the list of currently available Gemini models.
   * @returns {GeminiModel[]} An array of available Gemini models.
   */
  getAvailableModels(): GeminiModel[] {
    return this.availableModels.length > 0 ? this.availableModels : this._getDefaultModels();
  }

  /**
   * Provides a fallback list of default Gemini models.
   * @returns {GeminiModel[]} An array of default Gemini models.
   */
  private _getDefaultModels(): GeminiModel[] {
    return [
      {
        name: 'gemini-1.5-flash',
        displayName: 'Gemini 1.5 Flash',
        description: 'Fast and efficient model for most tasks, 1M context window.',
        inputTokenLimit: 1000000,
        outputTokenLimit: 8192,
        supportedGenerationMethods: ['generateContent']
      },
      {
        name: 'gemini-1.5-pro',
        displayName: 'Gemini 1.5 Pro',
        description: 'Most capable model for complex tasks, 2M context window.',
        inputTokenLimit: 2000000,
        outputTokenLimit: 8192,
        supportedGenerationMethods: ['generateContent']
      },
      {
        name: 'gemini-pro',
        displayName: 'Gemini Pro',
        description: 'Previous generation general-purpose model.',
        inputTokenLimit: 30720, // Typical for gemini-pro
        outputTokenLimit: 2048, // Typical for gemini-pro
        supportedGenerationMethods: ['generateContent']
      }
    ];
  }

  /**
   * Creates a new chat session in the database.
   * @param {string} [title='New Chat'] - The initial title of the session.
   * @param {string} [model='gemini-1.5-flash'] - The Gemini model to use for this session.
   * @returns {Promise<ChatSession>} A promise that resolves to the newly created chat session.
   */
  async createSession(title?: string, model?: string): Promise<ChatSession> {
    const session: ChatSession = {
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      title: title || 'New Chat',
      messageCount: 0,
      model: model || 'gemini-1.5-flash', // Default to flash if not specified
      createdAt: new Date(),
      updatedAt: new Date(),
      lastMessagePreview: ''
    };

    await dbService.saveSession(session);
    return session;
  }

  /**
   * Retrieves a chat session by its ID. If the session doesn't exist, a new one is created.
   * @param {string} id - The ID of the session to retrieve.
   * @returns {Promise<ChatSession>} A promise that resolves to the chat session.
   */
  async getSession(id: string): Promise<ChatSession> {
    const session = await dbService.getSession(id);
    if (!session) {
      console.warn(`Session with ID ${id} not found. Creating a new session.`);
      // If a session is not found, it implies a fresh start or an invalid ID.
      // Creating a new session here handles that gracefully.
      return await this.createSession();
    }
    return session;
  }

  /**
   * Retrieves all chat sessions from the database.
   * @returns {Promise<ChatSession[]>} A promise that resolves to an array of all chat sessions.
   */
  async getAllSessions(): Promise<ChatSession[]> {
    return await dbService.getAllSessions();
  }

  /**
   * Deletes a chat session by its ID from the database.
   * @param {string} id - The ID of the session to delete.
   * @returns {Promise<void>} A promise that resolves when the session is deleted.
   */
  async deleteSession(id: string): Promise<void> {
    await dbService.deleteSession(id);
  }

  /**
   * Retrieves messages for a given session.
   * This function is designed to fetch messages for display (lazy loading).
   * It fetches `limit` messages starting from `offset` from the *end* of the message list.
   *
   * @param {string} sessionId - The ID of the session.
   * @param {number} limit - Maximum number of messages to retrieve.
   * @param {number} [offset=0] - Number of messages to skip from the *latest* ones.
   *   e.g., offset=0, limit=20 means get the 20 latest messages.
   *   e.g., offset=20, limit=20 means get messages 21-40 from the latest.
   * @returns {Promise<ChatMessage[]>} A promise that resolves to an array of chat messages.
   */
  async getMessages(sessionId: string, limit: number, offset: number = 0): Promise<ChatMessage[]> {
    // dbService.getMessages is already designed to handle limit and offset correctly
    // for retrieving messages from oldest to newest based on the parameters passed.
    // So, we can directly pass the limit and offset.
    return await dbService.getMessages(sessionId, limit, offset);
  }

  /**
   * Updates the Gemini model used for a specific session.
   * @param {string} sessionId - The ID of the session to update.
   * @param {string} model - The new model name to set for the session.
   * @returns {Promise<void>} A promise that resolves when the session is updated.
   */
  async updateSessionModel(sessionId: string, model: string): Promise<void> {
    const session = await this.getSession(sessionId);
    session.model = model;
    session.updatedAt = new Date();
    await dbService.saveSession(session);
  }

  /**
   * Internal helper to prepare content parts for Gemini API from message and files.
   * @param {string} message - The user's text message.
   * @param {FileData[]} [files] - Optional array of file data.
   * @returns {Part[]} An array of parts suitable for Gemini API.
   */
  private _prepareContentParts(message: string, files?: FileData[]): Part[] {
    const parts: Part[] = [{ text: message }];

    if (files && files.length > 0) {
      for (const file of files) {
        if (file.data && file.mimeType) {
          // Handle image/video files with base64 data
          const base64Clean = file.data.replace(/^data:[^;]+;base64,/, '');
          parts.push({
            inlineData: {
              data: base64Clean,
              mimeType: file.mimeType
            }
          });
        } else if (file.content !== undefined) {
          // Handle text/code files where content is directly provided
          // Use triple backticks for code blocks in markdown for better formatting
          parts.push({ text: `\n\nFile: ${file.name} (Type: ${file.type || 'unknown'})\nContent:\n\`\`\`\n${file.content}\n\`\`\`` });
        } else {
          // Fallback for files with no data or content (e.g., just name/size)
          console.warn(`File ${file.name} has no content or data suitable for Gemini.`);
          parts.push({ text: `\n\nFile: ${file.name} (Content not available)` });
        }
      }
    }
    return parts;
  }

  /**
   * Internal helper to update a chat session's metadata after a message exchange.
   * @param {ChatSession} session - The session object to update.
   * @param {string} lastMessageContent - The content of the last assistant message.
   * @param {string} userMessageContent - The content of the user's message.
   * @returns {Promise<void>}
   */
  private async _updateSessionMetadata(session: ChatSession, lastMessageContent: string, userMessageContent: string): Promise<void> {
    session.updatedAt = new Date();
    session.messageCount = await dbService.getMessageCount(session.id); // Get latest count
    session.lastMessagePreview = lastMessageContent.slice(0, 100) + (lastMessageContent.length > 100 ? '...' : '');

    // Update title if it's still "New Chat" and enough messages have been exchanged
    if (session.title === 'New Chat' && session.messageCount >= 2) {
      // Use the first user message for the title
      session.title = userMessageContent.slice(0, 50) + (userMessageContent.length > 50 ? '...' : '');
    }

    await dbService.saveSession(session);

    // Clean up old messages if there are too many
    if (session.messageCount > this.MESSAGE_LIMIT) {
      await dbService.clearOldMessages(session.id, this.MESSAGE_LIMIT);
      // Re-fetch message count after cleaning to reflect actual count
      session.messageCount = await dbService.getMessageCount(session.id);
      await dbService.saveSession(session);
    }
  }

  /**
   * Common logic for sending messages to Gemini (non-stream and stream).
   * @param {string} sessionId - The ID of the current chat session.
   * @param {string} message - The user's message.
   * @param {FileData[]} [files] - Optional array of file data.
   * @param {(chunk: string) => void} [onChunk] - Optional callback for streaming chunks.
   * @returns {Promise<ChatMessage>} A promise that resolves to the assistant's response message.
   */
  private async _sendToGemini(
    sessionId: string,
    message: string,
    files?: FileData[],
    onChunk?: (chunk: string) => void
  ): Promise<ChatMessage> {
    if (!GEMINI_API_KEY) {
      throw new Error('Gemini API Key is not configured. Please set NEXT_PUBLIC_GEMINI_API_KEY.');
    }

    const session = await this.getSession(sessionId);

    // 1. Add user message to DB (status will be 'sending' initially in UI, 'sent' after DB save)
    const userMessage: ChatMessage = {
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      role: 'user',
      content: message,
      timestamp: new Date(),
      sessionId: sessionId,
      status: "sent", // Assuming 'sent' means successfully saved to DB
      files
    };
    await dbService.saveMessage(userMessage, sessionId);

    try {
      // 2. Prepare chat history for context
      // Get the *latest* CONTEXT_LIMIT messages for history.
      // dbService.getMessages(sessionId, limit, offset) gets messages from oldest to newest
      // when limit is applied from the end.
      const rawRecentMessages = await dbService.getMessages(sessionId, this.CONTEXT_LIMIT);

      // Filter out the current user message to avoid duplication in history sent to Gemini
      // Map to Content[] for Gemini API history
      const history: Content[] = rawRecentMessages
        .filter(msg => msg.id !== userMessage.id) // Exclude the current user message if it's somehow included
        .map(msg => ({
          role: msg.role === 'assistant' ? 'model' : 'user', // Gemini expects 'model' for assistant
          parts: this._prepareContentParts(msg.content, msg.files)
        }));

      // 3. Create model instance
      const model: GenerativeModel = genAI.getGenerativeModel({
        model: session.model || 'gemini-1.5-flash',
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 8192,
        }
      });

      // 4. Start chat with history
      const chat: GeminiChatSession = model.startChat({ history });

      // 5. Prepare content for current message (user's input)
      const parts = this._prepareContentParts(message, files);

      let fullText = '';
      let assistantMessageId = `${Date.now() + 1}_${Math.random().toString(36).substr(2, 9)}`; // Generate ID early

      if (onChunk) {
        // Handle streaming response
        const result = await chat.sendMessageStream(parts);
        for await (const chunk of result.stream) {
          const chunkText = chunk.text();
          fullText += chunkText;
          onChunk(chunkText);
        }
      } else {
        // Handle non-streaming response
        const result = await chat.sendMessage(parts);
        fullText = result.response.text();
      }

      // 6. Add assistant message to DB
      const assistantMessage: ChatMessage = {
        id: assistantMessageId,
        role: 'assistant',
        content: fullText,
        timestamp: new Date(),
        status: "sent",
        sessionId
      };
      await dbService.saveMessage(assistantMessage, sessionId);

      // 7. Update session metadata (title, messageCount, lastMessagePreview)
      await this._updateSessionMetadata(session, fullText, message);

      return assistantMessage;

    } catch (error: any) {
      console.error('Error in _sendToGemini:', error);
      // More descriptive error message
      const errorMessage = error.message || 'An unknown error occurred.';
      if (error.response?.candidates?.[0]?.finishReason === 'SAFETY') {
        throw new Error('Message blocked by safety settings. Please try rephrasing.');
      }
      if (error.status === 400 || error.status === 429) { // Bad Request or Too Many Requests
        throw new Error(`Gemini API Error: ${errorMessage}. Check your API key, context window limits, or try again later.`);
      }
      throw new Error(`Failed to send message: ${errorMessage}.`);
    }
  }

  /**
   * Sends a message to Gemini and receives a streaming response.
   * @param {string} sessionId - The ID of the current chat session.
   * @param {string} message - The user's message.
   * @param {FileData[]} [files] - Optional array of file data to include.
   * @param {(chunk: string) => void} [onChunk] - Callback function called with each text chunk received.
   * @returns {Promise<ChatMessage>} A promise that resolves to the complete assistant's response message.
   */
  async sendMessageStream(
    sessionId: string,
    message: string,
    files?: FileData[],
    onChunk?: (chunk: string) => void
  ): Promise<ChatMessage> {
    return this._sendToGemini(sessionId, message, files, onChunk);
  }

  /**
   * Sends a message to Gemini and receives a single, non-streaming response.
   * @param {string} sessionId - The ID of the current chat session.
   * @param {string} message - The user's message.
   * @param {FileData[]} [files] - Optional array of file data to include.
   * @returns {Promise<ChatMessage>} A promise that resolves to the complete assistant's response message.
   */
  async sendMessage(sessionId: string, message: string, files?: FileData[]): Promise<ChatMessage> {
    return this._sendToGemini(sessionId, message, files);
  }
}