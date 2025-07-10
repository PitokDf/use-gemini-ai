// src/components/chat/chat-welcome.tsx
import { Sparkles } from 'lucide-react';

export function ChatWelcome() {
    const examplePrompts = [
        "Buatkan saya rencana perjalanan 3 hari di Tokyo",
        "Tulis sebuah puisi tentang hujan di kota",
        "Jelaskan konsep 'Quantum Computing' dalam istilah sederhana",
        "Berikan saya 5 ide resep makan malam sehat",
    ];

    return (
        <div className="flex flex-col items-center justify-center h-full px-4 text-center">
            <div className="mb-4">
                <div className="bg-gradient-to-br from-sky-400 to-cyan-400 p-4 rounded-full inline-block">
                    <Sparkles className="h-10 w-10 text-white" />
                </div>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-slate-800 dark:text-slate-100">
                Mulai Percakapan
            </h1>
            <p className="mt-2 text-slate-600 dark:text-slate-400 max-w-md">
                Tanyakan apa saja, atau coba salah satu dari saran di bawah ini untuk memulai.
            </p>

            <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-3 w-full max-w-2xl">
                {examplePrompts.map((prompt, i) => (
                    <div
                        key={i}
                        className="p-4 bg-white/50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700/50 cursor-pointer hover:bg-slate-200/50 dark:hover:bg-slate-700/50 transition-colors"
                    >
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{prompt}</p>
                    </div>
                ))}
            </div>
        </div>
    );
}