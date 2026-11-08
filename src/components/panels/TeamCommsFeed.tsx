import React, { useEffect, useRef, useState } from 'react';
import {
  Check,
  Copy,
  Laptop,
  Maximize2,
  Megaphone,
  MessageSquare,
  Minimize2,
  Paperclip,
  Pin,
  Send,
  X,
} from 'lucide-react';
import { AgentProfile, CommsMessage } from '../../types';
import { api } from '../../utils/api';
import {
  mergePromptWithAttachments,
  ParsedDroppedFile,
  parseDroppedFiles,
} from '../../utils/fileDropParser';
import { MentionTextarea } from '../common/MentionTextarea';
import { RichMarkdownMessage } from '../common/RichMarkdownMessage';

interface TeamCommsFeedProps {
  agents: AgentProfile[];
  messages: CommsMessage[];
  onClose: () => void;
  onSelectAgent: (agentId: string) => void;
  onRefreshState: () => void;
}

export const TeamCommsFeed: React.FC<TeamCommsFeedProps> = ({
  agents,
  messages,
  onClose,
  onSelectAgent,
  onRefreshState,
}) => {
  const [filter, setFilter] = useState<'all' | 'workflow' | 'report' | 'team'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [briefText, setBriefText] = useState('');
  const [sending, setSending] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  const [attachedFiles, setAttachedFiles] = useState<ParsedDroppedFile[]>([]);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const feedScrollRef = useRef<HTMLDivElement>(null);
  const [panelWidth, setPanelWidth] = useState<number>(() => {
    const saved = Number(localStorage.getItem('villa_comms_width'));
    return Number.isFinite(saved) && saved >= 380 ? saved : 520;
  });
  const [isMaximized, setIsMaximized] = useState(false);
  const [isResizing, setIsResizing] = useState(false);

  useEffect(() => {
    if (!isResizing) return;
    const onMove = (e: MouseEvent) => {
      const next = Math.max(380, Math.min(window.innerWidth - 24, e.clientX - 12));
      setIsMaximized(false);
      setPanelWidth(next);
      localStorage.setItem('villa_comms_width', String(Math.round(next)));
    };
    const onUp = () => setIsResizing(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [isResizing]);

  const visibleMessages = messages.filter((m) => {
    if (m.id.startsWith('msg-late-') || m.id.startsWith('msg-user-rem-')) return false;
    if (filter !== 'all' && m.channel !== filter) return false;
    if (searchQuery.trim()) {
      return m.content.toLowerCase().includes(searchQuery.trim().toLowerCase());
    }
    return true;
  });

  useEffect(() => {
    if (feedScrollRef.current) {
      feedScrollRef.current.scrollTop = feedScrollRef.current.scrollHeight;
    }
  }, [visibleMessages.length, sending]);

  const submitCommand = async () => {
    if ((!briefText.trim() && attachedFiles.length === 0) || sending) return;
    setSending(true);
    const finalText = mergePromptWithAttachments(briefText, attachedFiles);
    setBriefText('');
    setAttachedFiles([]);
    try {
      await api.submitHeadBrief(finalText);
      onRefreshState();
    } catch (err) {
      alert(`Gagal kirim arahan: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSending(false);
    }
  };

  const handleFilesSelected = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const parsed = await parseDroppedFiles(files);
    setAttachedFiles((prev) => [...prev, ...parsed]);
  };

  const handleCopyMessage = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1800);
    } catch {
      // ignore
    }
  };

  const handlePinMessage = async (m: CommsMessage) => {
    const ag = agents.find((a) => a.id === m.senderId);
    const firstLine =
      m.content
        .split('\n')
        .map((l) => l.replace(/^[#*>-]+\s*/, '').trim())
        .find((l) => l.length > 4 && !l.startsWith('⚡')) || `Ide dari ${m.senderName}`;
    await api.addPinnedIdea({
      agentId: m.senderId,
      agentName: m.senderName,
      agentRole: m.senderRole,
      avatarEmoji: ag?.avatarEmoji || '📌',
      title: firstLine.slice(0, 85),
      content: m.content,
      category: ag?.department || 'Kolaborasi Tim',
    });
    setPinnedId(m.id);
    setTimeout(() => setPinnedId(null), 2000);
    onRefreshState();
  };

  const handleSubmitBrief = async (e: React.FormEvent) => {
    e.preventDefault();
    await submitCommand();
  };

  return (
    <aside
      onDragOver={(e) => {
        e.preventDefault();
        setIsDraggingFile(true);
      }}
      onDragLeave={() => setIsDraggingFile(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDraggingFile(false);
        void handleFilesSelected(e.dataTransfer.files);
      }}
      style={{
        width: isMaximized ? 'min(94vw, 1280px)' : `min(94vw, ${panelWidth}px)`,
      }}
      className={`fixed ${
        isMaximized ? 'top-20 bottom-16' : 'top-24 bottom-20'
      } left-3 z-40 bg-slate-950/94 backdrop-blur-2xl border border-slate-700/90 rounded-2xl shadow-2xl flex flex-col overflow-hidden ${
        isResizing ? 'select-none border-cyan-500/70' : ''
      }`}
    >
      {isDraggingFile && (
        <div className="absolute inset-2 z-50 rounded-2xl bg-indigo-950/90 border-2 border-dashed border-cyan-400 flex flex-col items-center justify-center text-center p-6 pointer-events-none">
          <Paperclip className="w-8 h-8 text-cyan-300 mb-2 animate-bounce" />
          <div className="text-sm font-extrabold text-white">
            Lepaskan File untuk Dilampirkan ke Komando Tim
          </div>
          <div className="text-xs text-cyan-200 mt-1">
            CSV, TXT, Markdown (.md), JSON, Brief, atau Gambar
          </div>
        </div>
      )}
      {/* Right-Edge Drag-to-Resize Handle */}
      <div
        onMouseDown={(e) => {
          e.preventDefault();
          setIsResizing(true);
        }}
        title="Tarik tepi kanan ini untuk memperlebar panel laporan & komunikasi"
        className="absolute right-0 top-0 bottom-0 w-2.5 z-50 cursor-ew-resize group flex items-center justify-center hover:bg-cyan-500/20 transition"
      >
        <div className="h-12 w-1 rounded-full bg-slate-600/70 group-hover:bg-cyan-400 transition" />
      </div>

      <div className="p-4 border-b border-slate-800 bg-gradient-to-r from-slate-900 to-cyan-950/40 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-cyan-600 flex items-center justify-center text-white shrink-0">
            <MessageSquare className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-extrabold text-white">
              Live Inter-Agent Comms & Daily Brief
            </h2>
            <p className="text-[11px] text-slate-400">
              Komunikasi antar 11 spesialis, hasil report & arahan Head DM
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 pr-1">
          <button
            type="button"
            onClick={() => setIsMaximized((v) => !v)}
            title="Perbesar / Kembalikan ukuran panel"
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
          >
            {isMaximized ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="px-4 py-2 border-b border-slate-800 space-y-2 bg-slate-900/60">
        <div className="flex items-center gap-1.5 text-[11px] font-bold">
          {(
            [
              { id: 'all', label: 'Semua' },
              { id: 'workflow', label: 'Workflow Handoff' },
              { id: 'report', label: 'Daily Reports' },
              { id: 'team', label: 'Arahan Tim' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className={`px-2.5 py-1 rounded-lg transition ${
                filter === tab.id
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-white bg-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="🔍 Cari riwayat diskusi / ide konten di seluruh tim..."
            className="w-full bg-slate-950/90 border border-slate-700/80 rounded-lg px-2.5 py-1 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[10px] font-bold text-slate-300 shrink-0"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Feed */}
      <div ref={feedScrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {visibleMessages.slice(-250).map((m) => (
          <div
            key={m.id}
            className={`p-3 rounded-xl border text-xs leading-relaxed ${
              m.senderType === 'user'
                ? 'bg-indigo-950/50 border-indigo-500/40 text-indigo-100'
                : m.senderType === 'system'
                ? 'bg-slate-900/60 border-slate-800 text-slate-300'
                : 'bg-slate-900/95 border-slate-800 text-slate-200'
            }`}
          >
            <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
              <div className="flex items-center flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    if (m.senderType === 'agent') onSelectAgent(m.senderId);
                  }}
                  className="font-extrabold text-indigo-300 hover:underline text-left"
                >
                  {m.senderName}{' '}
                  <span className="font-normal text-[10px] text-slate-400">({m.senderRole})</span>
                </button>
                {m.handoffFromName && (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/35 text-emerald-300 text-[10px] font-bold">
                    🤝 Handoff dari {m.handoffFromName}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                {m.senderType !== 'user' && (
                  <>
                    <button
                      type="button"
                      onClick={() => void handleCopyMessage(m.id, m.content)}
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px]"
                      title="Salin seluruh isi pesan"
                    >
                      {copiedId === m.id ? (
                        <>
                          <Check className="w-2.5 h-2.5 text-emerald-400" /> Tersalin
                        </>
                      ) : (
                        <>
                          <Copy className="w-2.5 h-2.5" /> Salin Semua
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handlePinMessage(m)}
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/15 hover:bg-amber-500/30 border border-amber-500/30 text-amber-300 text-[10px] font-semibold"
                      title="Simpan ke Papan Ide Terbaik"
                    >
                      <Pin className="w-2.5 h-2.5" />
                      {pinnedId === m.id ? 'Tersimpan!' : 'Pin Ide'}
                    </button>
                  </>
                )}
                <span className="text-[10px] text-slate-500">
                  {new Date(m.timestamp).toLocaleString('id-ID', {
                    day: '2-digit',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
            </div>

            <div className="max-h-[420px] overflow-y-auto pr-2 pt-1">
              <RichMarkdownMessage content={m.content} isUser={m.senderType === 'user'} />
            </div>
          </div>
        ))}

        {sending && (
          <div className="flex items-center gap-2.5 p-3 rounded-xl bg-cyan-950/40 border border-cyan-500/35 text-cyan-200 text-xs animate-pulse">
            <Laptop className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>
              Tim sedang mengeksekusi arahan berantai di meja kerja masing-masing & mengoper hasil...
            </span>
          </div>
        )}
      </div>

      {/* Head DM Multi-Agent Tagging & Relay Composer */}
      <form
        onSubmit={handleSubmitBrief}
        className="p-3 border-t border-slate-800 bg-slate-900/90 space-y-2"
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".csv,.tsv,.txt,.md,.json,.html,.png,.jpg,.jpeg,.webp"
          onChange={(e) => {
            void handleFilesSelected(e.target.files);
            e.target.value = '';
          }}
          className="hidden"
        />

        {attachedFiles.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            {attachedFiles.map((af) => (
              <span
                key={af.id}
                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-indigo-950/90 border border-indigo-500/50 text-[10px] text-indigo-200"
              >
                <span>📎 {af.name}</span>
                <button
                  type="button"
                  onClick={() =>
                    setAttachedFiles((prev) => prev.filter((item) => item.id !== af.id))
                  }
                  className="text-slate-400 hover:text-rose-400"
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between gap-2 text-[11px] font-bold text-amber-300">
          <span className="flex items-center gap-1.5">
            <Megaphone className="w-3.5 h-3.5" />
            Komando Multi-Agent: Ketik @nama untuk estafet tugas
          </span>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[10px] text-cyan-300 font-semibold"
          >
            <Paperclip className="w-3 h-3" />
            Lampirkan File
          </button>
        </div>
        <div className="flex items-end gap-2">
          <MentionTextarea
            rows={2}
            value={briefText}
            onChange={setBriefText}
            onSubmit={() => void submitCommand()}
            agents={agents}
            disabled={sending}
            placeholder="Contoh: @arka carikan ide konten hari ini yang sedang ramai, lalu berikan ke @nadia biar cek di Notion tanggal berapa yang bagus..."
          />
          <button
            type="submit"
            disabled={sending}
            className="px-3.5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 disabled:opacity-50 transition shrink-0"
          >
            <Send className="w-3.5 h-3.5" />
            {sending ? 'Jalan...' : 'Kirim'}
          </button>
        </div>
      </form>
    </aside>
  );
};
