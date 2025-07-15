'use client';

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, MessageSquare, Trash2, X, History } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ChatSession } from '@/lib/indexdb';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// ... (Interface dan Helper Function tidak berubah) ...
interface ChatSidebarProps {
  sessions: ChatSession[];
  currentSession: ChatSession | null;
  onSelectSession: (session: ChatSession) => void;
  onNewChat: () => void;
  onDeleteSession: (sessionId: string) => void;
  onUpdateTitle: (sessionId: string, newTitle: string) => void;
  onClose: () => void;
}
const groupSessionsByDate = (sessions: ChatSession[]) => {
  const groups: { [key: string]: ChatSession[] } = { "Hari Ini": [], "Kemarin": [], "7 Hari Terakhir": [], "Lebih Lama": [] };
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const sortedSessions = [...sessions].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  sortedSessions.forEach(session => {
    const sessionDate = new Date(session.updatedAt);
    const sessionDay = new Date(sessionDate.getFullYear(), sessionDate.getMonth(), sessionDate.getDate());
    const diffTime = today.getTime() - sessionDay.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays === 0) groups["Hari Ini"].push(session);
    else if (diffDays === 1) groups["Kemarin"].push(session);
    else if (diffDays <= 7) groups["7 Hari Terakhir"].push(session);
    else groups["Lebih Lama"].push(session);
  });
  Object.keys(groups).forEach(key => { if (groups[key].length === 0) delete groups[key]; });
  return groups;
};


// --- Komponen Utama dengan Latar Belakang Baru ---
export function ChatSidebar({
  sessions,
  currentSession,
  onSelectSession,
  onNewChat,
  onDeleteSession,
  onUpdateTitle,
  onClose
}: ChatSidebarProps) {
  const [isDeleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState<ChatSession | null>(null);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');

  const groupedSessions = useMemo(() => groupSessionsByDate(sessions), [sessions]);

  const handleDeleteClick = (e: React.MouseEvent, session: ChatSession) => {
    e.stopPropagation();
    setSessionToDelete(session);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (sessionToDelete) onDeleteSession(sessionToDelete.id);
    setDeleteDialogOpen(false);
    setSessionToDelete(null);
  };

  const handleDoubleClick = (session: ChatSession) => {
    setEditingSessionId(session.id);
    setEditingTitle(session.title);
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditingTitle(e.target.value);
  };

  const handleTitleBlur = () => {
    if (editingSessionId && editingTitle) {
      onUpdateTitle(editingSessionId, editingTitle);
    }
    setEditingSessionId(null);
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleTitleBlur();
    } else if (e.key === 'Escape') {
      setEditingSessionId(null);
    }
  };

  return (
    <TooltipProvider delayDuration={200}>
      {/* ===== DIV UTAMA DENGAN LATAR BELAKANG BARU (OPSI 1) ===== */}
      <div className="flex flex-col h-full border-r border-slate-200/80 dark:border-slate-800/80 bg-white/60 dark:bg-slate-900/70 backdrop-blur-xl supports-[backdrop-filter]:bg-white/60">

        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200/80 dark:border-slate-800/80">
          <div className="flex items-center gap-2">
            <History className="h-5 w-5 text-slate-500 dark:text-slate-400" />
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">Riwayat Chat</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="lg:hidden text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200" aria-label="Tutup sidebar">
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Tombol Aksi Utama (New Chat) */}
        <div className="p-4">
          <Button
            onClick={onNewChat}
            className="w-full justify-start gap-2 h-10 px-3 text-slate-700 bg-white/70 dark:text-slate-200 dark:bg-slate-800/70 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors"
            variant="ghost"
            aria-label="Mulai chat baru"
          >
            <Plus className="h-4 w-4" />
            Chat Baru
          </Button>
        </div>

        {/* Daftar Sesi */}
        <ScrollArea className="flex-1 px-2">
          <div className="space-y-4 py-2">
            {Object.keys(groupedSessions).length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center text-slate-500 dark:text-slate-400 pt-16 space-y-4">
                <MessageSquare className="h-12 w-12" />
                <h3 className="text-lg font-medium text-slate-800 dark:text-slate-200">Belum Ada Riwayat</h3>
                <p className="text-sm">Mulai percakapan untuk melihat riwayat Anda.</p>
              </div>
            ) : (
              Object.entries(groupedSessions).map(([groupTitle, groupSessions]) => (
                <div key={groupTitle} className="space-y-1">
                  <h3 className="px-3 pt-3 pb-1 text-xs font-bold uppercase text-slate-400 dark:text-slate-500 tracking-widest">
                    {groupTitle}
                  </h3>
                  {groupSessions.map((session) => {
                    const isActive = currentSession?.id === session.id;
                    return (
                      <div
                        key={session.id}
                        className={cn(
                          "group relative flex items-center gap-3 py-2.5 px-3 rounded-md cursor-pointer transition-all duration-200 ease-in-out",
                          isActive
                            ? "bg-slate-200/60 dark:bg-slate-800/80"
                            : "hover:bg-slate-200/50 dark:hover:bg-slate-800/50",
                        )}
                        onClick={() => onSelectSession(session)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSelectSession(session); }}
                      >
                        {isActive && (
                          <div className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-gradient-to-b from-sky-400 to-cyan-400" />
                        )}

                        <MessageSquare className={cn("h-4 w-4 flex-shrink-0", isActive ? "text-slate-800 dark:text-slate-200" : "text-slate-500 dark:text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-300")} />
                        {editingSessionId === session.id ? (
                          <input
                            type="text"
                            value={editingTitle}
                            onChange={handleTitleChange}
                            onBlur={handleTitleBlur}
                            onKeyDown={handleTitleKeyDown}
                            className="flex-1 bg-transparent border-b border-primary focus:outline-none text-sm font-medium"
                            autoFocus
                          />
                        ) : (
                          <p onDoubleClick={() => handleDoubleClick(session)} className={cn("flex-1 text-sm font-medium truncate", isActive ? "text-slate-900 dark:text-slate-100" : "text-slate-700 dark:text-slate-300")}>
                            {session.title || "Untitled Chat"}
                          </p>
                        )}

                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" onClick={(e) => handleDeleteClick(e, session)} className={cn("h-7 w-7 p-0 opacity-0 group-hover:opacity-100 focus-visible:opacity-100", "transition-all duration-200 scale-90 group-hover:scale-100", "text-slate-500 hover:text-red-500 dark:text-slate-400 dark:hover:text-red-500 hover:bg-red-500/10")} aria-label={`Hapus sesi chat: ${session.title}`}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="right"><p>Hapus Chat</p></TooltipContent>
                        </Tooltip>
                      </div>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Dialog Konfirmasi Hapus (Tidak Berubah) */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Hapus Sesi Chat</DialogTitle>
            <DialogDescription className="pt-2">
              Anda yakin ingin menghapus chat berjudul <br />
              <span className="font-semibold text-foreground">`{sessionToDelete?.title}`</span>?
              <br />Aksi ini tidak dapat dibatalkan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 sm:justify-end gap-2">
            <DialogClose asChild><Button variant="outline">Batal</Button></DialogClose>
            <Button variant="destructive" onClick={handleConfirmDelete}>Hapus Permanen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}