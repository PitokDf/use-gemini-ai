'use client';

import { useState, useRef, KeyboardEvent, useEffect, ChangeEvent, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, Paperclip, X, FileText, Image, Loader2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FileData } from '@/lib/indexdb'; // Pastikan tipe ini diperbarui

// Perbarui tipe FileData untuk mendukung preview dan status error
interface ExtendedFileData extends FileData {
  preview?: string; // Untuk pratinjau gambar di UI
  error?: string; // Untuk menampilkan pesan error per file
}

// Helper untuk konversi file tetap sama
const fileToBase64 = (file: File): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.readAsDataURL(file);
  reader.onload = () => resolve(reader.result as string);
  reader.onerror = reject;
});

const fileToText = (file: File): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.readAsText(file);
  reader.onload = () => resolve(reader.result as string);
  reader.onerror = reject;
});


// === Fungsi Helper untuk Memproses Satu File (Refactored) ===
async function processFile(file: File): Promise<ExtendedFileData> {
  const baseData: ExtendedFileData = {
    name: file.name,
    type: file.type,
    size: file.size,
  };

  try {
    if (file.type.startsWith('image/')) {
      return {
        ...baseData,
        data: await fileToBase64(file),
        mimeType: file.type,
        preview: URL.createObjectURL(file),
      };
    }
    // Cek untuk tipe teks atau ekstensi kode yang umum
    if (file.type.startsWith('text/') || /\.(md|json|csv|js|ts|html|css|py|java|xml|sh|txt)$/i.test(file.name)) {
      return {
        ...baseData,
        content: await fileToText(file),
      };
    }
    // Fallback: Anggap sebagai file teks, jika gagal, tandai sebagai tidak didukung
    try {
      return {
        ...baseData,
        content: await fileToText(file),
      };
    } catch {
      return { ...baseData, error: "Unsupported file type" };
    }
  } catch (error) {
    console.error(`Error processing file ${file.name}:`, error);
    return { ...baseData, error: "Processing failed" };
  }
}

interface ChatInputProps {
  onSendMessage: (message: string, files?: ExtendedFileData[]) => void;
  disabled?: boolean;
  placeholder?: string;
  isStreaming?: boolean;
}

export function ChatInput({ onSendMessage, disabled, placeholder, isStreaming }: ChatInputProps) {
  const [message, setMessage] = useState('');
  const [files, setFiles] = useState<ExtendedFileData[]>([]);
  const [isProcessingFiles, setIsProcessingFiles] = useState(false);
  const [attachmentErrors, setAttachmentErrors] = useState<string[]>([]);
  const [ariaLiveStatus, setAriaLiveStatus] = useState(''); // Untuk Aksesibilitas
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = `${scrollHeight}px`;
    }
  }, [message, files]);

  // Cleanup object URLs saat komponen unmount
  useEffect(() => {
    return () => {
      files.forEach(file => {
        if (file.preview) URL.revokeObjectURL(file.preview);
      });
    };
  }, [files]);

  const handleFiles = useCallback(async (acceptedFiles: File[]) => {
    const currentFileCount = files.length;
    if (currentFileCount >= 5) {
      setAttachmentErrors(["You can only attach a maximum of 5 files."]);
      return;
    }

    const filesToAdd = acceptedFiles.slice(0, 5 - currentFileCount);
    if (filesToAdd.length < acceptedFiles.length) {
      setAttachmentErrors([`Only ${5 - currentFileCount} more files can be added.`]);
    } else {
      setAttachmentErrors([]);
    }

    setIsProcessingFiles(true);
    setAriaLiveStatus(`Processing ${filesToAdd.length} files...`);

    // Proses file secara konkuren untuk performa lebih baik
    const processedFiles = await Promise.all(filesToAdd.map(processFile));

    setFiles(prev => [...prev, ...processedFiles]);
    setIsProcessingFiles(false);
    setAriaLiveStatus(`Finished processing files. ${processedFiles.filter(f => !f.error).length} files ready.`);
  }, [files]);

  const handlePaste = useCallback((e: ClipboardEvent) => {
    if (disabled || isProcessingFiles) return;
    const pastedFiles = Array.from(e.clipboardData?.files || []);
    if (pastedFiles.length > 0) {
      e.preventDefault();
      handleFiles(pastedFiles);
    }
  }, [disabled, isProcessingFiles, handleFiles]);

  useEffect(() => {
    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [handlePaste]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (accepted, rejected) => {
      if (disabled || isProcessingFiles) return;

      const newErrors: string[] = [];
      if (rejected.length > 0) {
        rejected.forEach(({ file, errors }) => {
          newErrors.push(`${file.name}: ${errors.map(e => e.message).join(', ')}`);
        });
      }
      setAttachmentErrors(newErrors);

      if (accepted.length > 0) {
        handleFiles(accepted);
      }
    },
    noClick: true,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp'],
      'text/*': ['.txt', '.md', '.json', '.csv', '.js', '.ts', '.html', '.css', '.py'],
      'application/json': ['.json'],
      'application/xml': ['.xml'],
      'application/pdf': ['.pdf'], // Example: add other types if needed
    },
    maxFiles: 5,
    maxSize: 10 * 1024 * 1024, // 10MB
  });

  const removeFile = (indexToRemove: number) => {
    const fileToRemove = files[indexToRemove];
    if (fileToRemove?.preview) {
      URL.revokeObjectURL(fileToRemove.preview);
    }
    setFiles(prev => prev.filter((_, index) => index !== indexToRemove));
  };

  const handleSend = () => {
    const validFiles = files.filter(f => !f.error);
    if (!message.trim() && validFiles.length === 0) return;

    onSendMessage(message, validFiles);
    setMessage('');
    setFiles([]);
    setAttachmentErrors([]);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const isSendDisabled = disabled || isStreaming || isProcessingFiles || (!message.trim() && files.filter(f => !f.error).length === 0);

  return (
    <div className="flex flex-col gap-2">
      {/* Area Notifikasi Error */}
      {attachmentErrors.length > 0 && (
        <div className="p-2 bg-destructive/10 border-l-4 border-destructive text-destructive-foreground rounded-md text-sm">
          {attachmentErrors.map((error, i) => <p key={i}>{error}</p>)}
        </div>
      )}

      <div
        {...getRootProps()}
        className={cn(
          "relative bg-background border rounded-xl p-2 pl-4 flex flex-col transition-all duration-200",
          isDragActive ? "border-primary ring-2 ring-primary/50" : "border-border",
          disabled && "opacity-60 cursor-not-allowed"
        )}
      >
        <input {...getInputProps()} ref={fileInputRef} />
        {/* Visually hidden text for screen readers */}
        <div className="sr-only" aria-live="polite">{ariaLiveStatus}</div>

        {/* Pratinjau File Lampiran */}
        {files.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2 p-2 bg-muted/50 rounded-lg max-h-32 overflow-y-auto">
            {files.map((file, index) => (
              <div
                key={`${file.name}-${index}`}
                className={cn(
                  "flex items-center gap-2 pl-2 pr-1 py-1 rounded-full text-sm group relative",
                  file.error ? "bg-destructive/20 text-destructive-foreground" : "bg-primary/10"
                )}
                title={file.error ? `${file.name}: ${file.error}` : file.name}
              >
                {file.error ? (
                  <AlertCircle className="h-4 w-4 shrink-0" />
                ) : file.preview ? (
                  <img src={file.preview} alt={file.name} className="w-6 h-6 rounded-full object-cover shrink-0" />
                ) : (
                  <FileText className="h-4 w-4 shrink-0" />
                )}
                <span className="truncate max-w-32">{file.name}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 w-5 p-0 rounded-full hover:bg-destructive/80 hover:text-destructive-foreground z-10"
                  onClick={(e) => { e.stopPropagation(); removeFile(index); }}
                  aria-label={`Remove file ${file.name}`}
                  disabled={disabled}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Overlay Drag & Drop */}
        {isDragActive && (
          <div className="absolute inset-0 bg-primary/10 border-2 border-dashed border-primary rounded-lg flex items-center justify-center z-10">
            <div className="text-center text-primary pointer-events-none">
              <p className="font-bold text-lg">Drop files to attach</p>
              <p className="text-sm">Up to 5 files, 10MB each</p>
            </div>
          </div>
        )}

        {/* Input Utama */}
        <div className="flex items-end gap-2">
          <Textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder || "Type a message or drop files..."}
            disabled={disabled || isProcessingFiles}
            className="flex-1 min-h-[44px] max-h-48 resize-none border-0 p-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 text-base"
            rows={1}
            aria-label="Message input"
          />
          <div className="flex items-center gap-1 self-end">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled || isProcessingFiles || files.length >= 5}
              className="shrink-0"
              title={files.length >= 5 ? "Maximum 5 files attached" : "Attach files"}
            >
              <Paperclip className="h-5 w-5" />
              <span className="sr-only">Attach files</span>
            </Button>
            <Button
              onClick={handleSend}
              disabled={isSendDisabled}
              size="icon"
              className="shrink-0 bg-primary text-primary-foreground hover:bg-primary/90"
              title="Send message"
            >
              {isStreaming || isProcessingFiles ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Send className="h-5 w-5" />
              )}
              <span className="sr-only">Send message</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}