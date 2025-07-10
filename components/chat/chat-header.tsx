// components/chat/ChatHeader.tsx
import React from 'react';
import { Button } from '@/components/ui/button';
import { ModelSelector } from './model-selector';
import { Menu, Download, Moon, Sun, Zap, ZapOff } from 'lucide-react';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';
import { ChatSession } from '@/lib/indexdb';

interface ChatHeaderProps {
    currentSession: ChatSession | null;
    onMenuClick: () => void;
    onModelChange: (model: string) => void;
    onExportChat: () => void;
    isExportDisabled: boolean;
    isLoading: boolean;
    streamingEnabled: boolean;
    onStreamingToggle: () => void;
}

export function ChatHeader({
    currentSession,
    onMenuClick,
    onModelChange,
    onExportChat,
    isExportDisabled,
    isLoading,
    streamingEnabled,
    onStreamingToggle,
}: ChatHeaderProps) {
    const { theme, setTheme } = useTheme();

    return (
        <div className="flex items-center justify-between p-4 border-b bg-card shrink-0">
            <div className="flex items-center gap-2">
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={onMenuClick}
                    className="lg:hidden h-8 w-8"
                >
                    <Menu className="h-5 w-5" />
                </Button>
                <h1 className="text-lg md:text-xl font-semibold truncate pr-2">
                    {currentSession?.title || 'New Chat'}
                </h1>
            </div>

            <div className="flex items-center gap-1 md:gap-2">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={onStreamingToggle}
                    className={cn("gap-2", streamingEnabled ? "text-primary" : "text-muted-foreground")}
                >
                    {streamingEnabled ? <Zap className="h-4 w-4" /> : <ZapOff className="h-4 w-4" />}
                    <span className="hidden sm:inline">
                        {streamingEnabled ? 'Stream' : 'Standard'}
                    </span>
                </Button>

                <ModelSelector
                    currentModel={currentSession?.model || 'gemini-1.5-flash'}
                    onModelChange={onModelChange}
                    disabled={isLoading}
                />

                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
                    {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                </Button>

                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onExportChat} disabled={isExportDisabled}>
                    <Download className="h-4 w-4" />
                </Button>
            </div>
        </div>
    );
}