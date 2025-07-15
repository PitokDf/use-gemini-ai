'use client';

import React, { useState, useEffect } from 'react';
import { ChatMessage, MessageStatus } from '@/lib/indexdb'; // Perbarui path jika perlu
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Copy, User, Bot, FileText, Image as ImageIcon, Code, Check, AlertTriangle, Clock, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useTheme } from 'next-themes';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';

interface CodeBlockProps {
  language: string;
  value: string;
}

const CodeBlock: React.FC<CodeBlockProps> = ({ language, value }) => {
  const { theme } = useTheme();
  const [isCopied, setIsCopied] = useState(false);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(value);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000); // Reset setelah 2 detik
  };

  return (
    <div className="relative rounded-md border bg-background text-sm not-prose">
      <div className="flex items-center justify-between rounded-t-md bg-muted px-4 py-2 text-xs text-muted-foreground">
        <span>{language}</span>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={copyToClipboard}
        >
          {isCopied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
        </Button>
      </div>
      <SyntaxHighlighter
        style={theme === "dark" ? oneDark : oneLight}
        language={language}
        PreTag="div"
        customStyle={{
          margin: 0,
          padding: '1rem',
          // backgroundColor: 'transparent',
        }}
      >
        {value}
      </SyntaxHighlighter>
    </div>
  );
};

const FileAttachments: React.FC<{ files: ChatMessage['files'] }> = ({ files }) => {
  if (!files || files.length === 0) return null;

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return <ImageIcon className="h-6 w-6 text-muted-foreground" />;
    if (type.includes('text/') || type.includes('application/json')) return <Code className="h-6 w-6 text-muted-foreground" />;
    return <FileText className="h-6 w-6 text-muted-foreground" />;
  };

  const imageFiles = files.filter(f => f.type.startsWith('image/'));
  const otherFiles = files.filter(f => !f.type.startsWith('image/'));

  return (
    <div className="mb-2 flex flex-col gap-2">
      {/* Grid untuk gambar */}
      {imageFiles.length > 0 && (
        <div className={cn(
          "grid gap-2",
          imageFiles.length > 1 ? "grid-cols-2" : "grid-cols-1"
        )}>
          {imageFiles.map((file, index) => (
            <div key={index} className="group relative overflow-hidden rounded-lg border">
              <img
                src={file.preview}
                alt={file.name}
                className="h-48 w-full object-cover transition-transform group-hover:scale-105"
              />
              <div className="absolute bottom-0 w-full bg-gradient-to-t from-black/60 to-transparent p-2 text-xs text-white">
                <p className="truncate font-medium">{file.name}</p>
                <p>{(file.size / 1024).toFixed(1)} KB</p>
              </div>
            </div>
          ))}
        </div>
      )}
      {/* List untuk file lain */}
      {otherFiles.length > 0 && (
        <div className="space-y-2">
          {otherFiles.map((file, index) => (
            <div key={index} className="flex items-center gap-3 rounded-md border bg-background/50 p-2">
              {getFileIcon(file.type)}
              <div className="flex-1 text-sm">
                <p className="truncate font-medium">{file.name}</p>
                <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};


// --- Komponen Utama ---

interface MessageBubbleProps {
  message: ChatMessage;
  onResend?: (message: ChatMessage) => void;
}

export const MessageBubble = React.memo(({ message, onResend }: MessageBubbleProps) => {
  const { theme } = useTheme();
  const isUser = message.role === 'user';

  const copyMessageContent = () => {
    navigator.clipboard.writeText(message.content);
  };

  const MessageStatusIndicator = ({ status }: { status: MessageStatus }) => {
    if (status === 'sending') return <Clock className="h-4 w-4 text-muted-foreground animate-spin" />;
    if (status === 'error') return <AlertTriangle className="h-4 w-4 text-destructive" />;
    return null;
  }

  return (
    <div className={cn("group flex w-full items-start gap-3", isUser ? "justify-end" : "justify-start")}>
      {/* Actions & Timestamp (muncul saat hover) */}
      {/* Untuk pesan bot, pastikan ada ruang di kiri agar sejajar dengan avatar */}
      {!isUser && <div className="w-10 flex-shrink-0"></div>}
      <div className={cn(
        "flex items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100",
        isUser ? "order-1" : "order-3"
      )}>
        <span className="text-xs text-muted-foreground">
          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={copyMessageContent}>
          <Copy className="h-3.5 w-3.5" />
        </Button>
        {isUser && message.status === 'error' && onResend && (
          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => onResend(message)}>
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {/* Avatar */}
      <Avatar className={cn("h-8 w-8 flex-shrink-0", isUser ? "order-3" : "order-1")}>
        <AvatarFallback>
          {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
        </AvatarFallback>
      </Avatar>

      {/* Message Content */}
      <div className={cn(
        "relative max-w-[75%] rounded-lg px-4 py-2",
        "order-2",
        isUser
          ? "bg-primary/50 text-red-500 dark:text-white rounded-br-none"
          : "bg-muted text-muted-foreground rounded-bl-none"
      )}>
        <FileAttachments files={message.files} />

        {/* LOGIKA PERUBAHAN DI SINI */}
        {message.imageUrl ? (
          <div className="flex flex-col gap-2">
            <img
              src={message.imageUrl}
              alt="Generated image"
              className="rounded-lg border object-cover"
            />
            {message.content && (
              <p className="text-sm text-muted-foreground italic">
                {message.content}
              </p>
            )}
          </div>
        ) : (
          <div className={cn(
            "prose prose-sm max-w-none dark:prose-invert",
            isUser && "prose-invert"
          )}>
            {isUser ? (
              <p className="whitespace-pre-wrap text-white">{message.content}</p>
            ) : (
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeRaw]}
                components={{
                  code({ node, className, children, ...props }) {
                    const match = /language-(\w+)/.exec(className || '');
                    return match ? (
                      <CodeBlock language={match[1]} value={String(children).replace(/\n$/, '')} />
                    ) : (
                      <code className="rounded bg-black/10 px-1.5 py-0.5 font-mono text-sm dark:bg-white/10" {...props}>
                        {children}
                      </code>
                    );
                  }
                }}
              >
                {message.content}
              </ReactMarkdown>
            )}
          </div>
        )}

        {/* Status Indicator (pojok kanan bawah bubble) */}
        {isUser && message.status !== 'sent' && (
          <div className="absolute bottom-1 right-2">
            <MessageStatusIndicator status={message.status} />
          </div>
        )}
      </div>
    </div>
  );
});

MessageBubble.displayName = 'MessageBubble';