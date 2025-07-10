'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { GeminiChatService } from '@/lib/gemini';
import { MessageBubble } from './message-bubble';
import { StreamingMessage } from './streaming-message';
import { ChatInput } from './chat-input';
import { ChatSidebar } from './chat-sidebar';
import { ModelSelector } from './model-selector';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  Menu,
  X,
  Download,
  Moon,
  Sun,
  ChevronUp,
  Zap,
  ZapOff,
  MessageSquare,
  Sparkles,
  Clock,
  Users,
  MoreHorizontal,
  Loader2 // Tambahkan icon Loader2
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';
import { ChatMessage, ChatSession, FileData } from '@/lib/indexdb'; // Pastikan FileData diimport

export function ChatInterface() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSession, setCurrentSession] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // State baru untuk lazy loading
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [messageOffset, setMessageOffset] = useState(0); // Offset dari pesan terbaru
  const MESSAGE_BATCH_SIZE = 20; // Jumlah pesan yang dimuat per batch

  const [mounted, setMounted] = useState(false);
  const [streamingEnabled, setStreamingEnabled] = useState(true);
  const [streamingMessage, setStreamingMessage] = useState<string>('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [shouldScrollToBottom, setShouldScrollToBottom] = useState(true); // Untuk kontrol scroll
  const chatService = GeminiChatService.getInstance();
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    try {
      const loadedSessions = await chatService.getAllSessions();
      setSessions(loadedSessions);

      if (loadedSessions.length > 0) {
        await selectSession(loadedSessions[0]);
      } else {
        await handleNewChat();
      }
    } catch (error) {
      console.error('Failed to initialize app:', error);
      setError('Failed to load chat history');
    }
  };

  const selectSession = async (session: ChatSession) => {
    setCurrentSession(session);
    setMessageOffset(0); // Reset offset setiap kali sesi baru dipilih
    setHasMoreMessages(false); // Reset hasMoreMessages
    setShouldScrollToBottom(true); // Selalu scroll ke bawah saat sesi baru
    await loadMessages(session.id, true); // Muat batch awal
  };

  // Fungsi untuk memuat pesan
  const loadMessages = useCallback(async (sessionId: string, reset: boolean = false) => {
    try {
      const offsetToUse = reset ? 0 : messageOffset;
      // Ambil pesan dari DB, dimulai dari offset terbaru ke belakang
      const sessionMessages = await chatService.getMessages(
        sessionId,
        MESSAGE_BATCH_SIZE,
        offsetToUse
      );

      if (reset) {
        // Jika reset (sesi baru atau ganti sesi), tampilkan batch terbaru
        setMessages(sessionMessages);
        setMessageOffset(sessionMessages.length);
      } else {
        // Jika memuat pesan lama, tambahkan di bagian atas array
        setMessages(prev => [...sessionMessages, ...prev]);
        setMessageOffset(prev => prev + sessionMessages.length);
      }

      // Periksa apakah masih ada pesan lama yang bisa dimuat
      const session = await chatService.getSession(sessionId);
      setHasMoreMessages(offsetToUse + sessionMessages.length < session.messageCount);
      console.log(`Loaded ${sessionMessages.length} messages. Current offset: ${offsetToUse + sessionMessages.length}. Total: ${session.messageCount}`);

    } catch (error) {
      console.error('Failed to load messages:', error);
      setError('Failed to load messages.');
    }
  }, [messageOffset, chatService]); // messageOffset dan chatService menjadi dependency

  const loadMoreMessages = async () => {
    if (!currentSession || loadingMore || !hasMoreMessages) return;

    // Simpan posisi scroll sebelum memuat lebih banyak
    const scrollContainer = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]');
    const scrollTop = scrollContainer?.scrollTop || 0;
    const scrollHeight = scrollContainer?.scrollHeight || 0;

    setLoadingMore(true);
    setShouldScrollToBottom(false); // Jangan scroll ke bawah saat memuat pesan lama
    await loadMessages(currentSession.id, false); // Muat batch pesan lama
    setLoadingMore(false);

    // Pulihkan posisi scroll setelah pesan dimuat
    // Gunakan requestAnimationFrame untuk memastikan DOM sudah update
    requestAnimationFrame(() => {
      if (scrollContainer) {
        const newScrollHeight = scrollContainer.scrollHeight;
        const heightDifference = newScrollHeight - scrollHeight;
        scrollContainer.scrollTop = scrollTop + heightDifference;
      }
    });
  };

  // Efek untuk scroll ke bawah saat `messages` berubah dan `shouldScrollToBottom` true
  useEffect(() => {
    if (shouldScrollToBottom) {
      scrollToBottom();
    }
  }, [messages, shouldScrollToBottom]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); // Tambahkan block: 'end'
  };

  // Handler untuk event scroll pada ScrollArea
  const handleScroll = (event: React.UIEvent<HTMLDivElement>) => {
    const target = event.target as HTMLDivElement;
    // Deteksi jika scroll berada di paling atas (atau dekat atas, misal 50px dari atas)
    if (target.scrollTop < 50 && hasMoreMessages && !loadingMore) {
      loadMoreMessages();
    }
    // Jika user scroll ke atas (tidak di paling bawah), nonaktifkan auto-scroll ke bawah
    // Tambahkan sedikit buffer (misal 10px) agar tidak terlalu sensitif
    if (target.scrollHeight - target.scrollTop > target.clientHeight + 10) {
      setShouldScrollToBottom(false);
    } else {
      // Jika user scroll kembali ke paling bawah, aktifkan auto-scroll
      setShouldScrollToBottom(true);
    }
  };


  const handleSendMessage = async (message: string, files?: FileData[]) => {
    if (!currentSession || !message.trim()) return;

    setShouldScrollToBottom(true); // Selalu scroll ke bawah saat mengirim pesan baru
    setIsLoading(true);
    setIsStreaming(true);
    setStreamingMessage('');
    setError(null);

    try {
      // Tambahkan pesan user ke tampilan saat ini
      const userMessage: ChatMessage = {
        id: `${Date.now()}_user`,
        sessionId: currentSession.id, // Pastikan sessionId ada
        role: 'user',
        content: message,
        timestamp: new Date(),
        status: "sent",
        files
      };

      setMessages(prev => [...prev, userMessage]);

      let assistantMessage: ChatMessage;

      if (streamingEnabled) {
        assistantMessage = await chatService.sendMessageStream(
          currentSession.id,
          message,
          files,
          (chunk: string) => {
            setStreamingMessage(prev => prev + chunk);
          }
        );
      } else {
        assistantMessage = await chatService.sendMessage(currentSession.id, message, files);
      }

      // Tambahkan pesan asisten yang lengkap
      setMessages(prev => [...prev, assistantMessage]);
      setStreamingMessage('');
      setIsStreaming(false);

      // Perbarui sesi di daftar (untuk title dan messageCount)
      const updatedSession = await chatService.getSession(currentSession.id);
      setCurrentSession(updatedSession);

      // Perbarui daftar sesi di sidebar
      const allSessions = await chatService.getAllSessions();
      setSessions(allSessions);

      // Setelah pesan baru dikirim, kita perlu memperbarui total messageCount
      // dan memastikan hasMoreMessages diperbarui jika ada perubahan.
      // Karena addMessage di service sudah memperbarui messageCount,
      // dan getSession di atas mengambil data terbaru,
      // kita tidak perlu memuat ulang semua pesan di sini.
      // Cukup pastikan `messageOffset` diperbarui agar `hasMoreMessages` tetap akurat.
      // Karena kita selalu menambahkan pesan baru ke `messages` state, `messageOffset`
      // perlu dipertimbangkan ulang jika ingin selalu mengambil dari yang terbaru.
      // Untuk lazy loading, `messageOffset` hanya bertambah saat memuat pesan *lama*.
      // Pesan baru ditambahkan di akhir array, tidak mengubah `offset` relatif ke *pesan lama*.

    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
      setStreamingMessage('');
      // Jika ada error, kita mungkin ingin menghapus pesan user yang gagal dikirim
      // atau menandainya sebagai error. Untuk saat ini, biarkan saja dan tampilkan error message.
      // setMessages(prev => prev.filter(msg => msg.id !== userMessage.id)); // Opsional: hapus pesan user jika gagal
      setIsStreaming(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewChat = async () => {
    const newSession = await chatService.createSession();
    setSessions(prev => [newSession, ...prev]);
    setCurrentSession(newSession);
    setMessages([]); // Kosongkan pesan
    setMessageOffset(0); // Reset offset
    setHasMoreMessages(false); // Tidak ada pesan lama di chat baru
    setShouldScrollToBottom(true);
    setSidebarOpen(false);
  };

  const handleSelectSession = async (session: ChatSession) => {
    await selectSession(session);
    setSidebarOpen(false);
  };

  const handleDeleteSession = async (sessionId: string) => {
    await chatService.deleteSession(sessionId);
    const updatedSessions = await chatService.getAllSessions();
    setSessions(updatedSessions);

    if (currentSession?.id === sessionId) {
      if (updatedSessions.length > 0) {
        setCurrentSession(updatedSessions[0]);
        await selectSession(updatedSessions[0]); // Panggil selectSession untuk memuat pesan
      } else {
        handleNewChat();
      }
    }
  };

  const handleModelChange = async (model: string) => {
    if (!currentSession) return;

    await chatService.updateSessionModel(currentSession.id, model);
    setCurrentSession(prev => prev ? { ...prev, model } : null);
  };

  const handleExportChat = () => {
    if (!currentSession) return;

    const chatData = {
      title: currentSession.title,
      messages: messages,
      exportedAt: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(chatData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chat-${currentSession.title}-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Get status info for current session
  const getStatusInfo = () => {
    if (!currentSession) return null;

    // messageCount dari currentSession kini adalah total pesan di DB
    // messages.length adalah pesan yang sedang ditampilkan
    const messageCount = currentSession.messageCount;
    const lastMessage = messages[messages.length - 1]; // Ambil pesan terakhir yang ditampilkan
    const lastMessageTime = lastMessage?.timestamp ? new Date(lastMessage.timestamp) : null;

    return {
      messageCount,
      lastMessageTime,
      model: currentSession.model,
      isActive: isLoading || isStreaming
    };
  };

  const statusInfo = getStatusInfo();

  // Loading state with enhanced design
  if (!mounted) {
    return (
      <div className="flex h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-800 items-center justify-center">
        <div className="flex flex-col items-center gap-6 p-8">
          <div className="relative">
            <div className="absolute inset-0 animate-ping rounded-full bg-primary/20 h-16 w-16"></div>
            <div className="relative animate-spin rounded-full h-16 w-16 border-4 border-primary/20 border-t-primary shadow-lg"></div>
          </div>
          <div className="text-center space-y-2">
            <h3 className="text-lg font-semibold">Initializing Chat</h3>
            <p className="text-muted-foreground animate-pulse">Setting up your conversation...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-800 text-foreground overflow-hidden">
      {/* Fixed Sidebar - Only show/hide on mobile */}
      <div className={cn(
        "w-80 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-r border-slate-200/50 dark:border-slate-700/50 shadow-2xl flex-shrink-0 transition-all duration-300 ease-out",
        "lg:block", // Always visible on desktop
        "fixed inset-y-0 left-0 z-50 lg:relative lg:z-auto", // Fixed on mobile, relative on desktop
        sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0" // Hide on mobile when closed, always visible on desktop
      )}>
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none"></div>
        <div className="h-full overflow-hidden">
          <ChatSidebar
            sessions={sessions}
            currentSession={currentSession}
            onSelectSession={handleSelectSession}
            onNewChat={handleNewChat}
            onDeleteSession={handleDeleteSession}
            onClose={() => setSidebarOpen(false)}
          />
        </div>
      </div>

      {/* Main Chat Area - Fixed layout with proper scrolling */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Enhanced Header with Better Visual Hierarchy */}
        <div className="relative bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200/50 dark:border-slate-700/50 shadow-sm flex-shrink-0">
          <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-primary/5 pointer-events-none"></div>

          <div className="relative flex items-center justify-between px-4 py-3 sm:px-6 sm:py-4"> {/* Reduced padding for mobile */}
            <div className="flex items-center gap-4 min-w-0 flex-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden shrink-0 hover:bg-primary/10 transition-colors"
              >
                <Menu className="h-5 w-5" />
              </Button>

              <div className="flex items-center gap-4 min-w-0">
                <div className="relative p-2 bg-gradient-to-br from-primary/10 to-primary/20 rounded-xl shrink-0 shadow-sm"> {/* Reduced padding */}
                  <MessageSquare className="h-5 w-5 text-primary" />
                  {statusInfo?.isActive && (
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full animate-pulse shadow-sm"></div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h1 className="text-xl font-bold truncate text-slate-900 dark:text-slate-100">
                      {currentSession?.title || 'New Conversation'}
                    </h1>
                    {statusInfo?.isActive && (
                      <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                        <Sparkles className="h-3 w-3 mr-1" />
                        Active
                      </Badge>
                    )}
                  </div>

                  <div className="flex flex-col sm:flex-row items-center gap-4 mt-1"> {/* Stack vertically on mobile */}
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <MessageSquare className="h-3 w-3" />
                      <span>{statusInfo?.messageCount || 0} messages (showing {messages.length})</span>
                    </div>
                    {statusInfo?.lastMessageTime && (
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>{statusInfo.lastMessageTime.toLocaleTimeString()}</span>
                      </div>
                    )}
                    <div className="mt-1 sm:mt-0"> {/* Add margin for mobile layout */}
                      <Badge variant="outline" className="text-xs">
                        {statusInfo?.model || 'gemini-1.5-flash'}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex flex-col sm:flex-row gap-2"> {/* Stack vertically on mobile */}
                {/* Mobile-first approach:  Show all buttons in a stacked manner on mobile */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowSettings(!showSettings)}
                  className="hover:bg-primary/10"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setStreamingEnabled(!streamingEnabled)}
                  className={cn(
                    "gap-2 transition-all",
                    streamingEnabled
                      ? "text-primary bg-primary/10 shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {streamingEnabled ? <Zap className="h-4 w-4" /> : <ZapOff className="h-4 w-4" />}
                  <span className="hidden sm:inline font-medium"> {/*Only show text on larger screens*/}
                    {streamingEnabled ? 'Live' : 'Standard'}
                  </span>
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                  className="hover:bg-primary/10"
                >
                  {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                </Button>

                <ModelSelector
                  currentModel={currentSession?.model || 'gemini-1.5-flash'}
                  onModelChange={handleModelChange}
                  disabled={isLoading}
                />

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleExportChat}
                  disabled={!messages.length}
                  className="hover:bg-primary/10"
                >
                  <Download className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Enhanced Mobile Settings Panel */}
        {showSettings && (
          <div className="sm:hidden border-b bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-slate-200/50 dark:border-slate-700/50 p-4 space-y-4 flex-shrink-0">
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setStreamingEnabled(!streamingEnabled)}
                className={cn(
                  "gap-2 transition-all",
                  streamingEnabled
                    ? "text-primary border-primary bg-primary/10 shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {streamingEnabled ? <Zap className="h-4 w-4" /> : <ZapOff className="h-4 w-4" />}
                {streamingEnabled ? 'Live Mode' : 'Standard Mode'}
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              >
                {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                {theme === 'dark' ? 'Light' : 'Dark'}
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handleExportChat}
                disabled={!messages.length}
              >
                <Download className="h-4 w-4" />
                Export
              </Button>
            </div>

            <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
              <ModelSelector
                currentModel={currentSession?.model || 'gemini-1.5-flash'}
                onModelChange={handleModelChange}
                disabled={isLoading}
              />
            </div>
          </div>
        )}

        {/* Messages Area - This is the main scrollable area */}
        <div className="flex-1 overflow-hidden">
          <ScrollArea className="h-full" ref={scrollAreaRef} onScroll={handleScroll}> {/* Tambahkan onScroll */}
            <div className="max-w-5xl mx-auto px-6 py-8">
              {/* Enhanced Empty State */}
              {messages.length === 0 && !isLoading && !hasMoreMessages && ( // Perbarui kondisi
                <div className="flex flex-col items-center justify-center h-full min-h-[500px] text-center">
                  <div className="relative p-8 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent rounded-3xl mb-8 shadow-lg">
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent rounded-3xl"></div>
                    <div className="relative">
                      <div className="p-4 bg-white/80 dark:bg-slate-900/80 rounded-2xl shadow-sm mb-6">
                        <MessageSquare className="h-12 w-12 text-primary mx-auto" />
                      </div>
                      <h3 className="text-2xl font-bold mb-3 text-slate-900 dark:text-slate-100">
                        Ready to chat?
                      </h3>
                      <p className="text-muted-foreground max-w-md leading-relaxed">
                        Start a conversation with me! I can help you with questions, brainstorming,
                        writing, analysis, and creative projects.
                      </p>
                    </div>
                  </div>

                  {/* Quick Action Suggestions */}
                  <div className="grid grid-cols-2 gap-3 max-w-md">
                    <div className="p-3 bg-white/60 dark:bg-slate-800/60 rounded-xl border border-slate-200/50 dark:border-slate-700/50 text-sm">
                      <Sparkles className="h-4 w-4 text-primary mb-1" />
                      <span className="text-slate-700 dark:text-slate-300">Ask anything</span>
                    </div>
                    <div className="p-3 bg-white/60 dark:bg-slate-800/60 rounded-xl border border-slate-200/50 dark:border-slate-700/50 text-sm">
                      <Users className="h-4 w-4 text-primary mb-1" />
                      <span className="text-slate-700 dark:text-slate-300">Brainstorm ideas</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Enhanced Load More Messages */}
              {hasMoreMessages && (
                <div className="flex justify-center mb-8">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={loadMoreMessages}
                    disabled={loadingMore}
                    className="gap-2 hover:bg-primary/10 hover:border-primary/20 transition-all shadow-sm"
                  >
                    {loadingMore ? (
                      <>
                        <Loader2 className="animate-spin h-4 w-4" /> {/* Gunakan Loader2 */}
                        Loading messages...
                      </>
                    ) : (
                      <>
                        <ChevronUp className="h-4 w-4" />
                        Load older messages
                      </>
                    )}
                  </Button>
                </div>
              )}

              {/* Messages with Enhanced Spacing */}
              <div className="space-y-8">
                {messages.map((message) => (
                  <MessageBubble key={message.id} message={message} />
                ))}

                {/* Enhanced Streaming Message */}
                {isStreaming && streamingMessage && (
                  <div className="relative">
                    <div className="absolute -inset-4 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent rounded-2xl"></div>
                    <StreamingMessage
                      content={streamingMessage}
                      enableTypingEffect={streamingEnabled}
                    />
                  </div>
                )}
              </div>

              {/* Enhanced Loading Indicator */}
              {isLoading && !isStreaming && (
                <div className="flex justify-center py-12">
                  <div className="flex flex-col items-center gap-4 text-muted-foreground">
                    <div className="relative">
                      <div className="absolute inset-0 animate-ping rounded-full bg-primary/20 h-10 w-10"></div>
                      <div className="relative animate-spin rounded-full h-10 w-10 border-2 border-primary/30 border-t-primary"></div>
                    </div>
                    <div className="text-center">
                      <div className="font-medium">Thinking...</div>
                      <div className="text-sm text-muted-foreground/70">Processing your request</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Enhanced Error Message */}
              {error && (
                <div className="mx-4 p-6 text-red-700 dark:text-red-300 bg-red-50/80 dark:bg-red-900/20 border border-red-200/50 dark:border-red-800/50 rounded-2xl shadow-sm backdrop-blur-sm">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                    <span className="font-semibold">Something went wrong</span>
                  </div>
                  <p className="text-sm leading-relaxed">{error}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setError(null)}
                    className="mt-3 border-red-200 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-900/30"
                  >
                    Dismiss
                  </Button>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>
        </div>

        {/* Enhanced Input Area - Fixed at bottom */}
        <div className="relative bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-t border-slate-200/50 dark:border-slate-700/50 p-6 shadow-lg flex-shrink-0">
          <div className="absolute inset-0 bg-gradient-to-t from-primary/5 to-transparent pointer-events-none"></div>
          <div className="relative max-w-5xl mx-auto">
            <ChatInput
              onSendMessage={handleSendMessage}
              disabled={isLoading || isStreaming}
              isStreaming={isStreaming}
              placeholder="Type your message..."
            />
          </div>
        </div>
      </div>

      {/* Mobile Sidebar Overlay - Only shows on mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-40 lg:hidden backdrop-blur-md transition-opacity duration-300"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
}
