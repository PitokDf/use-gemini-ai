'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Settings, Zap, Brain, Sparkles, RefreshCw } from 'lucide-react';
import { GeminiModel, GeminiChatService } from '@/lib/gemini';
import { cn } from '@/lib/utils';

interface ModelSelectorProps {
  currentModel: string;
  onModelChange: (model: string) => void;
  disabled?: boolean;
}

export function ModelSelector({ currentModel, onModelChange, disabled }: ModelSelectorProps) {
  const [models, setModels] = useState<GeminiModel[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const chatService = GeminiChatService.getInstance();

  useEffect(() => {
    loadModels();
  }, []);

  const loadModels = async () => {
    setIsLoading(true);
    try {
      const availableModels = await chatService.fetchAvailableModels();
      setModels(availableModels);
    } catch (error) {
      console.error('Failed to load models:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getModelIcon = (modelName: string) => {
    if (modelName.includes('flash')) return <Zap className="h-4 w-4" />;
    if (modelName.includes('pro')) return <Brain className="h-4 w-4" />;
    return <Sparkles className="h-4 w-4" />;
  };

  const getModelBadge = (modelName: string) => {
    if (modelName.includes('flash')) return <Badge variant="secondary" className="text-xs">Fast</Badge>;
    if (modelName.includes('pro')) return <Badge variant="default" className="text-xs">Pro</Badge>;
    return <Badge variant="outline" className="text-xs">Standard</Badge>;
  };

  const formatTokenLimit = (limit: number) => {
    if (limit >= 1000000) return `${(limit / 1000000).toFixed(1)}M`;
    if (limit >= 1000) return `${(limit / 1000).toFixed(0)}K`;
    return limit.toString();
  };

  const currentModelData = models.find(m => m.name === currentModel);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled}
          className="h-8 gap-2 text-xs"
        >
          <Settings className="h-3 w-3" />
          {currentModelData ? (
            <>
              {getModelIcon(currentModel)}
              <span className="hidden sm:inline">{currentModelData.displayName}</span>
              <span className="sm:hidden">{currentModelData.name.split('-')[1]}</span>
            </>
          ) : (
            <span>Select Model</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="p-4 border-b">
          <div className="flex items-center justify-between">
            <h4 className="font-medium">AI Model</h4>
            <Button
              variant="ghost"
              size="sm"
              onClick={loadModels}
              disabled={isLoading}
              className="h-6 w-6 p-0"
            >
              <RefreshCw className={cn("h-3 w-3", isLoading && "animate-spin")} />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Choose the AI model for this conversation
          </p>
        </div>
        
        <div className="max-h-80 overflow-y-auto">
          {isLoading ? (
            <div className="p-4 text-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto"></div>
              <p className="text-xs text-muted-foreground mt-2">Loading models...</p>
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {models.map((model) => (
                <button
                  key={model.name}
                  onClick={() => {
                    onModelChange(model.name);
                    setIsOpen(false);
                  }}
                  className={cn(
                    "w-full p-3 rounded-lg text-left hover:bg-accent transition-colors",
                    currentModel === model.name && "bg-accent"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {getModelIcon(model.name)}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm truncate">
                            {model.displayName}
                          </span>
                          {getModelBadge(model.name)}
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                          {model.description}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  {(model.inputTokenLimit > 0 || model.outputTokenLimit > 0) && (
                    <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                      {model.inputTokenLimit > 0 && (
                        <span>Input: {formatTokenLimit(model.inputTokenLimit)}</span>
                      )}
                      {model.outputTokenLimit > 0 && (
                        <span>Output: {formatTokenLimit(model.outputTokenLimit)}</span>
                      )}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}