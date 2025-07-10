// components/chat/MessageList.tsx
import React, { useRef, useEffect, useState } from 'react';
import { ChatMessage } from '@/lib/indexdb';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { MessageBubble } from './message-bubble';
import { StreamingMessage } from './streaming-message';
import { ChevronUp } from 'lucide-react';

interface MessageListProps {
    messages: ChatMessage[];
    isStreaming: boolean;
    streamingMessage: string;
    hasMoreMessages: boolean;
    loadingMore: boolean;
    onLoadMore: () => void;
}

export function MessageList({
    messages,
    isStreaming,
    streamingMessage,
    hasMoreMessages,
    loadingMore,
    onLoadMore,
}: MessageListProps) {
    const scrollAreaRef = useRef<HTMLDivElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // Hanya scroll ke bawah jika pengguna sudah berada di dekat bagian bawah
        const scrollContainer = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]');
        if (scrollContainer) {
            const isScrolledToBottom =
                scrollContainer.scrollHeight - scrollContainer.clientHeight <= scrollContainer.scrollTop + 100;

            if (isScrolledToBottom) {
                messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
            }
        }
    }, [messages, streamingMessage]);

    return (
        <ScrollArea className="flex-1" ref={scrollAreaRef}>
            <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
                {hasMoreMessages && (
                    <div className="flex justify-center">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={onLoadMore}
                            disabled={loadingMore}
                            className="gap-2"
                        >
                            {loadingMore ? (
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                            ) : (
                                <ChevronUp className="h-4 w-4" />
                            )}
                            {loadingMore ? 'Loading...' : 'Load older messages'}
                        </Button>
                    </div>
                )}

                {messages.map((message) => (
                    <MessageBubble key={message.id} message={message} />
                ))}

                {isStreaming && streamingMessage && (
                    <StreamingMessage enableTypingEffect content={streamingMessage} />
                )}

                <div ref={messagesEndRef} />
            </div>
        </ScrollArea>
    );
}