import React, { useState } from 'react';
import { Check, Copy, Pin, Search, Trash2, X } from 'lucide-react';
import { PinnedIdeaItem } from '../../types';
import { api } from '../../utils/api';
import { RichMarkdownMessage } from '../common/RichMarkdownMessage';

interface PinnedIdeasModalProps {
  pinnedIdeas: PinnedIdeaItem[];
  onClose: () => void;
  onSelectAgent: (agentId: string) => void;
  onRefreshState: () => void;
}

export const PinnedIdeasModal: React.FC<PinnedIdeasModalProps> = ({
  pinnedIdeas,
  onClose,
  onSelectAgent,
  onRefreshState,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filtered = pinnedIdeas.filter((item) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      item.title.toLowerCase().includes(q) ||
      item.content.toLowerCase().includes(q) ||
      item.agentName.toLowerCase().includes(q) ||
      item.agentRole.toLowerCase().includes(q)
    );
  });

  const handleCopyAll = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // ignore
    }
  };

  const handleDelete = async (id: string) => {
    await api.deletePinnedIdea(id);
    onRefreshState();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl max-h-[88vh] bg-slate-950 border border-slate-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-800 bg-gradient-to-r from-slate-900 via-amber-950/30 to-indigo-950/40 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-300 shadow-lg">
              <Pin className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-white">
                📌 Papan Ide Terbaik (Bookmark Chat & Output Spesialis)
              </h2>
              <p className="text-xs text-slate-400">
                Kumpulan hook, script, riset, dan strategi terbaik yang Anda pin dari chat atau workflow. Bisa diblok sebagian untuk copy manual!
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="px-6 py-3 bg-slate-900/70 border-b border-slate-800 flex items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari ide berdasarkan kata kunci, nama spesialis, hook, atau topik..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
            />
          </div>
          <span className="text-xs font-bold text-slate-400 shrink-0">
            {filtered.length} Ide Tersimpan
          </span>
        </div>

        {/* Ideas List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {filtered.length === 0 ? (
            <div className="p-12 rounded-2xl border border-dashed border-slate-800 text-center space-y-2">
              <div className="text-3xl">📌</div>
              <div className="text-sm font-bold text-slate-200">
                Belum Ada Ide yang Di-Pin
              </div>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Saat berbincang dengan Agent di kolom Chat, Brief & Comms, atau Workflow Studio, klik tombol{' '}
                <strong className="text-amber-300">"📌 Pin Ide"</strong> pada jawaban yang bagus agar tersimpan rapi di sini!
              </p>
            </div>
          ) : (
            filtered.map((idea) => (
              <div
                key={idea.id}
                className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3 shadow-lg"
              >
                <div className="flex items-start justify-between flex-wrap gap-2 border-b border-slate-800/80 pb-2.5">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onSelectAgent(idea.agentId);
                        }}
                        className="text-xs font-extrabold text-amber-300 hover:underline flex items-center gap-1"
                      >
                        <span>{idea.avatarEmoji}</span>
                        <span>{idea.agentName}</span>
                      </button>
                      <span className="text-[11px] text-slate-400">({idea.agentRole})</span>
                      <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 text-[10px] font-semibold">
                        {idea.category}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        {new Date(idea.createdAt).toLocaleString('id-ID', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <div className="text-sm font-extrabold text-white mt-1">{idea.title}</div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => void handleCopyAll(idea.id, idea.content)}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1"
                    >
                      {copiedId === idea.id ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" /> Tersalin
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" /> Salin Semua
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDelete(idea.id)}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-300 transition"
                      title="Hapus dari Papan Ide"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="max-h-72 overflow-y-auto pr-2">
                  <RichMarkdownMessage content={idea.content} compact />
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
