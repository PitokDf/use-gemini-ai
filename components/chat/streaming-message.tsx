import { useState, useEffect } from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Bot } from 'lucide-react';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
// Import all available styles from prism
import * as prismStyles from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useTheme } from 'next-themes';
import { CSSProperties } from 'react';

// Define the expected type for the SyntaxHighlighter style prop more precisely
// based on the structure of react-syntax-highlighter's style objects
type CodeHighlightStyle = {
  [key: string]: React.CSSProperties;
};

interface StreamingMessageProps {
  content: string;
  enableTypingEffect: boolean;
}

export function StreamingMessage({ content, enableTypingEffect }: StreamingMessageProps) {
  const { theme } = useTheme();
  const [displayedContent, setDisplayedContent] = useState('');

  useEffect(() => {
    if (!enableTypingEffect) {
      setDisplayedContent(content);
      return;
    }

    // This effect handles the typing animation.
    // For now, we'll just display the full content if typing effect is enabled.
    // You might want to re-implement the typing animation logic here if needed.
    setDisplayedContent(content);
  }, [content, enableTypingEffect]);

  const showCursor = enableTypingEffect && content.length > 0;

  // Dynamically select the theme style.
  // We need to assert the type because the imported 'prismStyles' is a collection.
  const codeTheme = (theme === 'dark' ? prismStyles.oneDark : prismStyles.oneLight) as CodeHighlightStyle;

  return (
    <div className="flex gap-3 group justify-start">
      <Avatar className="h-8 w-8 mt-1">
        <AvatarFallback>
          <Bot className="h-4 w-4" />
        </AvatarFallback>
      </Avatar>

      <div className="max-w-[80%] rounded-lg px-4 py-2 relative bg-muted text-muted-foreground">
        <div className={cn(
          "prose prose-sm max-w-none",
          theme === 'dark' ? "prose-invert" : ""
        )}>
          <ReactMarkdown
            components={{
              code({ node, className, children, ...restProps }) {
                const match = /language-(\w+)/.exec(className || '');
                const language = match ? match[1] : '';

                // Ensure 'ref' is not passed directly to a DOM element if it's a ref object
                const { ref, ...remainingPropsForCode } = restProps;

                if (language) {
                  return (
                    <SyntaxHighlighter
                      // The 'style' prop expects an object where keys are class names and values are CSSProperties.
                      // 'oneDark' and 'oneLight' are already in this format.
                      style={codeTheme as any}
                      language={language}
                      PreTag="div" // Ensures the pre tag is rendered
                      className="rounded-md !bg-background !text-foreground"
                      {...remainingPropsForCode} // Pass any other props that might be relevant
                    >
                      {String(children).replace(/\n$/, '')}
                    </SyntaxHighlighter>
                  );
                }

                return (
                  <code className={cn(
                    "relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-sm",
                    className
                  )} {...remainingPropsForCode}>
                    {children}
                  </code>
                );
              }
            }}
          >
            {displayedContent}
          </ReactMarkdown>

          {/* Typing cursor */}
          {showCursor && (
            <span className="inline-block w-0.5 h-4 bg-primary ml-1 animate-pulse" />
          )}
        </div>
      </div>
    </div>
  );
}