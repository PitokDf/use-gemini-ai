import { useState, useEffect, useRef, useCallback } from 'react';
import { GeminiChatService } from '@/lib/gemini';
import { ChatMessage, ChatSession, FileData } from '@/lib/indexdb';

const MESSAGE_BATCH_SIZE = 20;

export function useChat() {
    const [sessions, setSessions] = useState<ChatSession[]>([]);
    const [currentSession, setCurrentSession] = useState<ChatSession | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [streamingMessage, setStreamingMessage] = useState<string>('');

    const [isLoading, setIsLoading] = useState(false); // Untuk response dari AI
    const [isStreaming, setIsStreaming] = useState(false);
    const [loadingInitial, setLoadingInitial] = useState(true); // Untuk load awal
    const [loadingMore, setLoadingMore] = useState(false); // Untuk "load more"

    const [error, setError] = useState<string | null>(null);
    const [hasMoreMessages, setHasMoreMessages] = useState(false);
    const [messageOffset, setMessageOffset] = useState(0);

    const chatService = useRef(GeminiChatService.getInstance()).current;

    const loadSessions = useCallback(async () => {
        const loadedSessions = await chatService.getAllSessions();
        setSessions(loadedSessions);
        return loadedSessions;
    }, [chatService]);

    const loadMessages = useCallback(async (sessionId: string, reset: boolean = false) => {
        const offset = reset ? 0 : messageOffset;
        const sessionMessages = await chatService.getMessages(sessionId, MESSAGE_BATCH_SIZE, offset);

        setMessages(prev => reset ? sessionMessages.reverse() : [...sessionMessages.reverse(), ...prev]);
        const newOffset = offset + sessionMessages.length;
        setMessageOffset(newOffset);

        const sessionDetails = await chatService.getSession(sessionId);
        setHasMoreMessages(newOffset < sessionDetails.messageCount);
    }, [chatService, messageOffset]);

    const selectSession = useCallback(async (session: ChatSession) => {
        setLoadingInitial(true);
        setCurrentSession(session);
        setMessageOffset(0);
        await loadMessages(session.id, true);
        setLoadingInitial(false);
    }, [loadMessages]);

    const handleNewChat = useCallback(async () => {
        const newSession = await chatService.createSession();
        await loadSessions(); // Reload sessions to get the new one at the top
        await selectSession(newSession);
    }, [chatService, loadSessions, selectSession]);

    useEffect(() => {
        const initializeApp = async () => {
            setLoadingInitial(true);
            const loadedSessions = await loadSessions();
            if (loadedSessions.length > 0) {
                await selectSession(loadedSessions[0]);
            } else {
                await handleNewChat();
            }
            setLoadingInitial(false);
        };
        initializeApp();
    }, [loadSessions, selectSession, handleNewChat]);

    const handleSendMessage = useCallback(async (content: string, files?: FileData[], streamingEnabled: boolean = true) => {
        if (!currentSession) return;

        setIsLoading(true);
        setError(null);

        const userMessage: ChatMessage = {
            id: `${Date.now()}_user`,
            role: 'user',
            content,
            timestamp: new Date(),
            status: "sent",
            sessionId: currentSession.id,
            files
        };
        setMessages(prev => [...prev, userMessage]);

        if (streamingEnabled) {
            setIsStreaming(true);
            setStreamingMessage('');
            try {
                const assistantMessage = await chatService.sendMessageStream(
                    currentSession.id,
                    content,
                    files,
                    (chunk: string) => setStreamingMessage(prev => prev + chunk)
                );
                setMessages(prev => [...prev, assistantMessage]);
            } catch (e) {
                setError(e instanceof Error ? e.message : "An unknown streaming error occurred.");
            } finally {
                setIsStreaming(false);
                setStreamingMessage('');
            }
        } else {
            try {
                const assistantMessage = await chatService.sendMessage(currentSession.id, content, files);
                setMessages(prev => [...prev, assistantMessage]);
            } catch (e) {
                setError(e instanceof Error ? e.message : "An unknown error occurred.");
            }
        }

        setIsLoading(false);
        const updatedSession = await chatService.getSession(currentSession.id);
        setSessions(prev => prev.map(s => s.id === updatedSession.id ? updatedSession : s));
        setCurrentSession(updatedSession);

    }, [chatService, currentSession]);

    const handleDeleteSession = useCallback(async (sessionId: string) => {
        await chatService.deleteSession(sessionId);
        const updatedSessions = await chatService.getAllSessions();
        setSessions(updatedSessions);

        if (currentSession?.id === sessionId) {
            if (updatedSessions.length > 0) {
                await selectSession(updatedSessions[0]);
            } else {
                await handleNewChat();
            }
        }
    }, [chatService, currentSession?.id, handleNewChat, selectSession]);

    const handleLoadMoreMessages = useCallback(async () => {
        if (!currentSession || loadingMore || !hasMoreMessages) return;
        setLoadingMore(true);
        await loadMessages(currentSession.id, false);
        setLoadingMore(false);
    }, [currentSession, hasMoreMessages, loadMessages, loadingMore]);


    return {
        sessions,
        currentSession,
        messages,
        streamingMessage,
        isLoading,
        isStreaming,
        loadingInitial,
        loadingMore,
        error,
        hasMoreMessages,
        handleSendMessage,
        handleNewChat,
        handleDeleteSession,
        selectSession,
        handleLoadMoreMessages,
        // Pass-through functions for model/session updates
        updateSessionModel: chatService.updateSessionModel,
        // updateSessionTitle: chatService.updateSessionTitle,
    };
}