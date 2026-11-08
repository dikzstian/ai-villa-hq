import React, { useEffect, useRef, useState } from 'react';
import {
  Calendar,
  Check,
  CheckCircle2,
  Copy,
  FileCode2,
  FolderOpen,
  FolderPlus,
  Globe,
  GripVertical,
  Laptop,
  Maximize2,
  MessageSquare,
  Minimize2,
  Palette,
  Paperclip,
  Pin,
  Play,
  Plus,
  RefreshCw,
  Save,
  Send,
  SkipForward,
  Trash2,
  X,
} from 'lucide-react';
import {
  AgentProfile,
  CommsMessage,
  JobdeskItem,
  VillaRoomId,
} from '../../types';
import { api } from '../../utils/api';
import {
  mergePromptWithAttachments,
  ParsedDroppedFile,
  parseDroppedFiles,
} from '../../utils/fileDropParser';
import { VILLA_ROOMS } from '../../utils/villaCoords';
import { MentionTextarea } from '../common/MentionTextarea';
import { RichMarkdownMessage } from '../common/RichMarkdownMessage';

interface AgentDrawerProps {
  agent: AgentProfile;
  agents: AgentProfile[];
  messages: CommsMessage[];
  onClose: () => void;
  onEditAppearance: (agent: AgentProfile) => void;
  onOpenSocialBrowser: (agentId: string) => void;
  onOpenNotionCalendar: () => void;
  onRefreshState: () => void;
}

type DrawerTab = 'chat' | 'jobdesk' | 'markdown' | 'files';
type MarkdownFileKey = 'soulMd' | 'toolsMd' | 'userMd' | 'agentsMd';

export const AgentDrawer: React.FC<AgentDrawerProps> = ({
  agent,
  agents,
  messages,
  onClose,
  onEditAppearance,
  onOpenSocialBrowser,
  onOpenNotionCalendar,
  onRefreshState,
}) => {
  const [activeTab, setActiveTab] = useState<DrawerTab>('chat');
  const [activeMdKey, setActiveMdKey] = useState<MarkdownFileKey>('soulMd');

  // Chat state
  const [chatInput, setChatInput] = useState('');
  const [saveAsReport, setSaveAsReport] = useState(false);
  const [forceEngine, setForceEngine] = useState<'hybrid_api' | 'hermes_cli'>(
    agent.preferredEngine
  );
  const [isSending, setIsSending] = useState(false);
  const [isReportingNow, setIsReportingNow] = useState(false);
  const [isSkippingReport, setIsSkippingReport] = useState(false);
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);
  const [pinnedMsgId, setPinnedMsgId] = useState<string | null>(null);
  const [chatSearchQuery, setChatSearchQuery] = useState('');
  const [attachedFiles, setAttachedFiles] = useState<ParsedDroppedFile[]>([]);
  const [isDraggingOverChat, setIsDraggingOverChat] = useState(false);
  const fileAttachInputRef = useRef<HTMLInputElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  // Flexible & Resizable Drawer Width + Maximize state
  const [drawerWidth, setDrawerWidth] = useState<number>(() => {
    const saved = Number(localStorage.getItem('villa_chat_drawer_width'));
    return Number.isFinite(saved) && saved >= 400 ? saved : 640;
  });
  const [isMaximized, setIsMaximized] = useState(false);
  const [isResizing, setIsResizing] = useState(false);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const nextWidth = Math.max(
        400,
        Math.min(window.innerWidth - 24, window.innerWidth - e.clientX - 12)
      );
      setIsMaximized(false);
      setDrawerWidth(nextWidth);
      localStorage.setItem('villa_chat_drawer_width', String(Math.round(nextWidth)));
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  // Editable Jobdesks
  const [jobdesks, setJobdesks] = useState<JobdeskItem[]>(agent.jobdesks);
  const [reportDeadline, setReportDeadline] = useState(agent.reportDeadlineTime);

  // Editable Hermes Markdown Docs (SOUL.md, TOOLS.md, USER.md, AGENTS.md)
  const [docs, setDocs] = useState(agent.docs);
  const [saveBanner, setSaveBanner] = useState<string | null>(null);
  const [modelOverride, setModelOverride] = useState<string>(agent.modelOverride || '');
  const [availableModels, setAvailableModels] = useState<string[]>([
    'gpt-6-astra',
    'deepseek-v4-pro',
    'deepseek-v4.1-flash',
    'gemini-4-argon',
    'glm-5.3',
    'mimo-v2.6-pro',
    'gpt-6-luna',
    'auto',
  ]);

  useEffect(() => {
    api
      .fetchModels()
      .then((res) => {
        if (res.ok && res.models.length > 0) {
          const priority = [
            'gpt-6-astra',
            'deepseek-v4-pro',
            'deepseek-v4.1-flash',
            'gemini-4-argon',
            'glm-5.3',
            'mimo-v2.6-pro',
            'gpt-6-luna',
            'auto',
          ];
          const rest = res.models.filter((m) => !priority.includes(m));
          setAvailableModels([...priority.filter((p) => res.models.includes(p)), ...rest]);
        }
      })
      .catch(() => {});
  }, []);

  // Local Files state
  const [connectedPaths, setConnectedPaths] = useState<string[]>(agent.connectedPaths);
  const [manualPathInput, setManualPathInput] = useState('');
  const [agentWorkspaceDir, setAgentWorkspaceDir] = useState('');
  const [pathSummary, setPathSummary] = useState<
    Array<{
      inputPath: string;
      exists: boolean;
      type: string;
      fileCount: number;
      sampleFiles: Array<{ name: string; fullPath: string; sizeBytes: number }>;
    }>
  >([]);

  useEffect(() => {
    setJobdesks(agent.jobdesks);
    setDocs(agent.docs);
    setConnectedPaths(agent.connectedPaths);
    setReportDeadline(agent.reportDeadlineTime);
    setForceEngine(agent.preferredEngine);
    setModelOverride(agent.modelOverride || '');
  }, [agent.id, agent.modelOverride]);

  const handleChangeModelOverride = async (nextModel: string) => {
    const clean = nextModel === '__default__' ? undefined : nextModel;
    setModelOverride(clean || '');
    await api.updateAgent(agent.id, { modelOverride: clean || '' });
    setSaveBanner(
      clean
        ? `Model khusus ${agent.name} dikunci ke "${clean}" (dilengkapi Auto-Fallback ke auto)`
        : `${agent.name} kembali menggunakan Default Model global (auto)`
    );
    setTimeout(() => setSaveBanner(null), 3200);
    onRefreshState();
  };

  useEffect(() => {
    if (activeTab === 'files') {
      void loadPathInspection(connectedPaths);
    }
  }, [activeTab, agent.id]);

  const loadPathInspection = async (pathsList: string[]) => {
    try {
      const res = await api.inspectAgentPaths(agent.id, pathsList);
      setAgentWorkspaceDir(res.agentWorkspaceDir);
      setPathSummary(res.summary);
    } catch {
      // ignore
    }
  };

  const baseAgentMessages = messages.filter(
    (m) =>
      !m.id.startsWith('msg-late-') &&
      !m.id.startsWith('msg-user-rem-') &&
      (m.senderId === agent.id ||
        m.recipientId === agent.id ||
        (Array.isArray(m.relatedAgentIds) && m.relatedAgentIds.includes(agent.id)) ||
        (m.channel === 'team' && m.senderType === 'user'))
  );

  const agentMessages = chatSearchQuery.trim()
    ? baseAgentMessages.filter((m) =>
        m.content.toLowerCase().includes(chatSearchQuery.trim().toLowerCase())
      )
    : baseAgentMessages;

  useEffect(() => {
    if (activeTab === 'chat' && chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [agentMessages.length, isSending, activeTab, agent.id]);

  const submitChatPrompt = async () => {
    if ((!chatInput.trim() && attachedFiles.length === 0) || isSending) return;
    setIsSending(true);
    const finalPrompt = mergePromptWithAttachments(chatInput, attachedFiles);
    setChatInput('');
    setAttachedFiles([]);
    try {
      await api.chatWithAgent(agent.id, finalPrompt, { forceEngine, saveAsReport });
      onRefreshState();
    } catch (err) {
      alert(`Gagal mengirim pesan: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsSending(false);
    }
  };

  const handleFilesSelected = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const parsed = await parseDroppedFiles(files);
    setAttachedFiles((prev) => [...prev, ...parsed]);
  };

  const handlePinMessageToBoard = async (m: CommsMessage) => {
    const firstLine =
      m.content
        .split('\n')
        .map((l) => l.replace(/^[#*>-]+\s*/, '').trim())
        .find((l) => l.length > 4 && !l.startsWith('⚡')) || `Ide dari ${m.senderName}`;
    await api.addPinnedIdea({
      agentId: agent.id,
      agentName: m.senderName || agent.name,
      agentRole: m.senderRole || agent.role,
      avatarEmoji: agent.avatarEmoji,
      title: firstLine.slice(0, 85),
      content: m.content,
      category: agent.department,
    });
    setPinnedMsgId(m.id);
    setTimeout(() => setPinnedMsgId(null), 2200);
    onRefreshState();
  };

  const handleSkipReportToday = async () => {
    setIsSkippingReport(true);
    try {
      await api.skipAgentReport(agent.id);
      setSaveBanner(`Laporan harian ${agent.name} hari ini berhasil di-skip!`);
      setTimeout(() => setSaveBanner(null), 3000);
      onRefreshState();
    } finally {
      setIsSkippingReport(false);
    }
  };

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    await submitChatPrompt();
  };

  const handleCopyMessage = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedMsgId(id);
      setTimeout(() => setCopiedMsgId(null), 2000);
    } catch {
      // ignore clipboard errors
    }
  };

  const handleTriggerReportNow = async () => {
    setIsReportingNow(true);
    try {
      await api.triggerAgentReportNow(agent.id);
      onRefreshState();
    } finally {
      setIsReportingNow(false);
    }
  };

  const handleSaveJobdesks = async () => {
    await api.updateAgent(agent.id, {
      jobdesks,
      reportDeadlineTime: reportDeadline,
    });
    setSaveBanner('Jobdesk 09:00-17:00 & jam deadline report berhasil disimpan!');
    setTimeout(() => setSaveBanner(null), 3000);
    onRefreshState();
  };

  const handleAddJobdeskSlot = () => {
    setJobdesks([
      ...jobdesks,
      {
        id: `jd-${Date.now()}`,
        time: '14:00',
        title: 'Tugas Baru Spesialis',
        description: 'Deskripsi detail eksekusi tugas harian...',
        room: 'office',
        requiresReport: false,
        completedToday: false,
        lastCompletedDate: null,
      },
    ]);
  };

  const handleSaveMarkdownDocs = async () => {
    await api.updateAgent(agent.id, { docs });
    setSaveBanner('File SOUL.md, TOOLS.md, USER.md & AGENTS.md tersimpan ke folder hermes_workspace!');
    setTimeout(() => setSaveBanner(null), 3500);
    onRefreshState();
  };

  const handleReloadFromDisk = async () => {
    const res = await api.reloadHermesDisk();
    const fresh = res.state.agents.find((a) => a.id === agent.id);
    if (fresh) setDocs(fresh.docs);
    setSaveBanner('Berhasil memuat ulang isi .md terbaru dari disk!');
    setTimeout(() => setSaveBanner(null), 3000);
    onRefreshState();
  };

  const handlePickLocalPath = async (mode: 'folder' | 'file') => {
    const res = await api.pickLocalPath(mode);
    if (res.ok && res.path) {
      const updated = Array.from(new Set([...connectedPaths, res.path]));
      setConnectedPaths(updated);
      await api.updateAgent(agent.id, { connectedPaths: updated });
      await loadPathInspection(updated);
      onRefreshState();
    }
  };

  const handleAddManualPath = async () => {
    const trimmed = manualPathInput.trim();
    if (!trimmed) return;
    const updated = Array.from(new Set([...connectedPaths, trimmed]));
    setConnectedPaths(updated);
    setManualPathInput('');
    await api.updateAgent(agent.id, { connectedPaths: updated });
    await loadPathInspection(updated);
    onRefreshState();
  };

  const handleRemovePath = async (target: string) => {
    const updated = connectedPaths.filter((p) => p !== target);
    setConnectedPaths(updated);
    await api.updateAgent(agent.id, { connectedPaths: updated });
    await loadPathInspection(updated);
    onRefreshState();
  };

  const handleMoveAgentRoom = async (room: VillaRoomId) => {
    await api.updateAgent(agent.id, {
      currentRoom: room,
      status: room === 'office' ? 'working' : 'break',
      statusText: `Pindah ke ${VILLA_ROOMS[room].label}`,
    });
    onRefreshState();
  };

  const mdLabels: Record<MarkdownFileKey, { filename: string; subtitle: string }> = {
    soulMd: {
      filename: 'SOUL.md',
      subtitle: 'Identitas, persona, gaya komunikasi & KPI utama agent',
    },
    toolsMd: {
      filename: 'TOOLS.md',
      subtitle: 'Panduan pemakaian tools, format deliverable & pembacaan file lokal',
    },
    userMd: {
      filename: 'USER.md',
      subtitle: 'Profil Head of Digital Marketing, nama brand & preferensi laporan',
    },
    agentsMd: {
      filename: 'AGENTS.md',
      subtitle: 'Aturan kolaborasi lintas agent, handoff workflow & reminder',
    },
  };

  const effectiveStyle: React.CSSProperties = isMaximized
    ? { width: 'min(94vw, 1360px)' }
    : { width: `min(94vw, ${drawerWidth}px)` };

  const applyPresetWidth = (px: number) => {
    setIsMaximized(false);
    setDrawerWidth(px);
    localStorage.setItem('villa_chat_drawer_width', String(px));
  };

  return (
    <aside
      style={effectiveStyle}
      className={`fixed ${
        isMaximized ? 'top-20 bottom-16' : 'top-24 bottom-20'
      } right-3 z-40 bg-slate-950/94 backdrop-blur-2xl border border-slate-700/90 rounded-2xl shadow-2xl flex flex-col overflow-hidden transition-[top,bottom] duration-200 ${
        isResizing ? 'select-none border-cyan-500/70' : ''
      }`}
    >
      {/* Left-Edge Drag-to-Resize Handle */}
      <div
        onMouseDown={(e) => {
          e.preventDefault();
          setIsResizing(true);
        }}
        title="Tarik tepi kiri ini untuk memperbesar / mengecilkan lebar panel chat secara bebas"
        className="absolute left-0 top-0 bottom-0 w-2.5 z-50 cursor-ew-resize group flex items-center justify-center hover:bg-cyan-500/20 transition"
      >
        <div className="h-12 w-1 rounded-full bg-slate-600/70 group-hover:bg-cyan-400 transition" />
      </div>

      {/* Header */}
      <div className="pl-5 pr-4 py-3.5 border-b border-slate-800 bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950/50 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-11 h-11 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center text-2xl shadow-inner shrink-0">
            {agent.avatarEmoji}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-extrabold text-white">{agent.name}</h2>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-semibold">
                {agent.appearance.style.toUpperCase()} 3D
              </span>
              <span
                title="Model AI yang sedang digunakan oleh agen ini"
                className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono-code font-bold"
              >
                🧠 {modelOverride || 'auto (Default)'}
              </span>
            </div>
            <p className="text-xs font-semibold text-indigo-300">{agent.role}</p>
            <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">{agent.statusText}</p>
          </div>
        </div>

        {/* Flexible Width Controls + Close */}
        <div className="flex items-center gap-1.5 shrink-0">
          <div
            title="Ukuran cepat panel chat (atau tarik garis kiri panel secara bebas)"
            className="hidden sm:flex items-center bg-slate-900/90 border border-slate-700/80 rounded-lg p-0.5 text-[10px] font-bold"
          >
            <GripVertical className="w-3 h-3 text-slate-500 ml-1 mr-0.5" />
            <button
              type="button"
              onClick={() => applyPresetWidth(480)}
              className={`px-2 py-1 rounded-md transition ${
                !isMaximized && drawerWidth < 600
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Ringkas
            </button>
            <button
              type="button"
              onClick={() => applyPresetWidth(760)}
              className={`px-2 py-1 rounded-md transition ${
                !isMaximized && drawerWidth >= 600 && drawerWidth < 980
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Lebar
            </button>
            <button
              type="button"
              onClick={() => setIsMaximized((v) => !v)}
              className={`px-2 py-1 rounded-md flex items-center gap-1 transition ${
                isMaximized ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              {isMaximized ? (
                <>
                  <Minimize2 className="w-3 h-3" /> Normal
                </>
              ) : (
                <>
                  <Maximize2 className="w-3 h-3" /> Penuh
                </>
              )}
            </button>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Quick Bar: Move Room, Model Selector, Edit 3D Avatar, Trigger Report Now */}
      <div className="px-4 py-2 bg-slate-900/70 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1">
            <span className="text-slate-400 text-[11px]">Lokasi:</span>
            <select
              value={agent.currentRoom}
              onChange={(e) => handleMoveAgentRoom(e.target.value as VillaRoomId)}
              className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-[11px] text-slate-100 font-medium focus:outline-none"
            >
              {Object.values(VILLA_ROOMS).map((r) => (
                <option key={r.id} value={r.id}>
                  {r.emoji} {r.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1">
            <span className="text-slate-400 text-[11px]">🧠 Model:</span>
            <select
              value={modelOverride || '__default__'}
              onChange={(e) => handleChangeModelOverride(e.target.value)}
              title="Pilih model AI khusus untuk agen ini (otomatis fallback ke auto jika sibuk)"
              className="bg-slate-800 border border-emerald-500/40 hover:border-emerald-400 rounded-lg px-2 py-1 text-[11px] text-emerald-200 font-mono-code font-semibold focus:outline-none"
            >
              <option value="__default__">⚡ Ikuti Global (auto)</option>
              <optgroup label="🟣 Muse AI (Local Bridge 8765, Meta API & 9Router)">
                <option value="muse">🟢 muse (Muse Local Bridge 127.0.0.1:8765)</option>
                <option value="muse-spark-1.3">🟣 muse-spark-1.3 (Muse Spark 1.3 - Cepat & Tajam)</option>
                <option value="muse-wonder-1.0">✨ muse-wonder-1.0 (Muse Wonder 1.0 - Strategi & Riset)</option>
                <option value="muse-spark-1.2">⚡ muse-spark-1.2 (Muse Spark 1.2)</option>
                <option value="muse/muse-spark-1.3">🔀 muse/muse-spark-1.3 (Format Prefix 9Router)</option>
                <option value="muse/muse-wonder-1.0">🔀 muse/muse-wonder-1.0 (Format Prefix 9Router)</option>
              </optgroup>
              <optgroup label="⭐ Model Terbaik & Aktif (Rekomendasi)">
                <option value="gpt-6-astra">🔥 gpt-6-astra (ChatGPT Astra - Sosmed/Copy)</option>
                <option value="deepseek-v4-pro">📊 deepseek-v4-pro (Riset/Data/Ads)</option>
                <option value="deepseek-v4.1-flash">⚡ deepseek-v4.1-flash (Cepat/Operasional)</option>
                <option value="gemini-4-argon">🌐 gemini-4-argon (SEO/UI-UX/Strategi)</option>
                <option value="glm-5.3">🧩 glm-5.3 (Struktur & Analisis)</option>
                <option value="mimo-v2.6-pro">🎯 mimo-v2.6-pro (Eksekusi Cepat)</option>
                <option value="gpt-6-luna">🌙 gpt-6-luna (Kreatif Mendalam)</option>
                <option value="auto">🔄 auto (Router Otomatis)</option>
              </optgroup>
              <optgroup label="Daftar Semua Model Provider">
                {availableModels.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {agent.id === 'social-media' && (
            <button
              onClick={onOpenNotionCalendar}
              title="Buka Notion Konten Kalender (Khusus Nadia)"
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-violet-500/20 hover:bg-violet-500/30 text-violet-200 border border-violet-500/40 text-[11px] font-bold transition"
            >
              <Calendar className="w-3 h-3" />
              Notion Kalender
            </button>
          )}
          <button
            onClick={() => onOpenSocialBrowser(agent.id)}
            title="Buka jembatan Chrome Medsos Live untuk agen ini"
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/30 text-[11px] font-semibold transition"
          >
            <Globe className="w-3 h-3" />
            Medsos Live
          </button>
          <button
            onClick={() => onEditAppearance(agent)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-pink-500/15 hover:bg-pink-500/25 text-pink-300 border border-pink-500/30 text-[11px] font-semibold transition"
          >
            <Palette className="w-3 h-3" />
            Edit 3D
          </button>
          <button
            onClick={handleTriggerReportNow}
            disabled={isReportingNow}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 text-[11px] font-semibold transition disabled:opacity-50"
          >
            <Play className="w-3 h-3" />
            {isReportingNow ? 'Menyusun...' : 'Minta Report'}
          </button>
          <button
            onClick={handleSkipReportToday}
            disabled={isSkippingReport}
            title="Skip kewajiban laporan harian divisi ini untuk hari ini (tidak akan ditagih jam 17:00)"
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-[11px] font-semibold transition disabled:opacity-50"
          >
            <SkipForward className="w-3 h-3" />
            {isSkippingReport ? 'Skip...' : 'Skip Laporan'}
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="grid grid-cols-4 border-b border-slate-800 bg-slate-950/60 text-xs font-bold">
        {[
          { id: 'chat', label: 'Chat & Tugas', icon: MessageSquare },
          { id: 'jobdesk', label: 'Jobdesk 9-5', icon: CheckCircle2 },
          { id: 'markdown', label: 'SOUL / MD', icon: FileCode2 },
          { id: 'files', label: 'File Laptop', icon: FolderOpen },
        ].map((t) => {
          const Icon = t.icon;
          const active = activeTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as DrawerTab)}
              className={`flex items-center justify-center gap-1.5 py-2.5 border-b-2 transition ${
                active
                  ? 'border-indigo-500 text-indigo-300 bg-indigo-500/10'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {saveBanner && (
        <div className="mx-4 mt-2 px-3 py-1.5 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 text-xs font-medium">
          ✅ {saveBanner}
        </div>
      )}

      {/* TAB 1: DIRECT CHAT & TASK EXECUTION */}
      {activeTab === 'chat' && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDraggingOverChat(true);
          }}
          onDragLeave={() => setIsDraggingOverChat(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDraggingOverChat(false);
            void handleFilesSelected(e.dataTransfer.files);
          }}
          className="flex-1 flex flex-col overflow-hidden relative"
        >
          {isDraggingOverChat && (
            <div className="absolute inset-2 z-30 rounded-2xl bg-indigo-950/90 border-2 border-dashed border-cyan-400 flex flex-col items-center justify-center text-center p-6 pointer-events-none">
              <Paperclip className="w-8 h-8 text-cyan-300 mb-2 animate-bounce" />
              <div className="text-sm font-extrabold text-white">
                Lepaskan File di Sini untuk Dilampirkan ke {agent.name}
              </div>
              <div className="text-xs text-cyan-200 mt-1">
                Mendukung CSV, TXT, Markdown (.md), JSON, Brief, atau Gambar
              </div>
            </div>
          )}
          <div ref={chatScrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            <div className="px-3 py-2 rounded-xl bg-slate-900/80 border border-slate-800/80 text-[11px] text-slate-400 space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span>
                  💡 <strong>Tips Copy Manual:</strong> Blok/sorot kalimat atau tabel apa pun di bawah untuk menyalin sebagian teks saja, atau klik <strong>Salin Semua</strong>.
                </span>
                <span className="text-[10px] font-bold text-indigo-300 bg-indigo-950/60 border border-indigo-500/30 px-2 py-0.5 rounded-full">
                  💬 {baseAgentMessages.length} Riwayat Chat Tersimpan
                </span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={chatSearchQuery}
                  onChange={(e) => setChatSearchQuery(e.target.value)}
                  placeholder={`🔍 Cari di riwayat percakapan ${agent.name} (contoh: consumable, sparepart, judul, hook)...`}
                  className="w-full bg-slate-950/90 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
                />
                {chatSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setChatSearchQuery('')}
                    className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[10px] font-bold text-slate-300 shrink-0"
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>
            {agentMessages.length === 0 ? (
              <div className="text-center text-slate-500 text-xs py-12">
                {chatSearchQuery
                  ? `Tidak ditemukan pesan dengan kata kunci "${chatSearchQuery}" di riwayat ${agent.name}.`
                  : `Belum ada percakapan khusus dengan ${agent.name}. Kirim pertanyaan atau arahan di bawah—${agent.name} akan langsung menuju mejanya untuk mencari data & menjawab!`}
              </div>
            ) : (
              agentMessages.slice(-300).map((m) => {
                const isUser = m.senderType === 'user';
                return (
                  <div
                    key={m.id}
                    className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
                  >
                    <div className="flex items-center flex-wrap gap-2 text-[11px] text-slate-400 mb-1.5 px-1">
                      <span className="font-semibold text-slate-200">{m.senderName}</span>
                      {m.handoffFromName && (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/35 text-emerald-300 text-[10px] font-bold">
                          🤝 Handoff dari {m.handoffFromName}
                        </span>
                      )}
                      <span>•</span>
                      <span>
                        {new Date(m.timestamp).toLocaleString('id-ID', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      {m.engineUsed && (
                        <span className="px-1.5 py-0.2 rounded bg-indigo-500/15 text-indigo-300 text-[10px]">
                          {m.engineUsed}
                        </span>
                      )}
                      {!isUser && (
                        <>
                          <button
                            type="button"
                            onClick={() => void handleCopyMessage(m.id, m.content)}
                            className="ml-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-800/90 hover:bg-slate-700 text-slate-300 hover:text-white text-[10px] transition"
                            title="Salin seluruh isi chat box ini"
                          >
                            {copiedMsgId === m.id ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-400" /> Tersalin
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" /> Salin Semua
                              </>
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => void handlePinMessageToBoard(m)}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/15 hover:bg-amber-500/30 border border-amber-500/30 text-amber-300 text-[10px] font-semibold transition"
                            title="Simpan ke Papan Ide Terbaik (Bookmark)"
                          >
                            <Pin className="w-3 h-3" />
                            {pinnedMsgId === m.id ? 'Tersimpan di Papan Ide!' : 'Pin Ide'}
                          </button>
                        </>
                      )}
                    </div>

                    <div
                      className={
                        isUser
                          ? 'max-w-[85%] rounded-2xl rounded-tr-sm px-4 py-3 bg-indigo-600 text-white border border-indigo-500 shadow-md'
                          : 'w-full max-w-[97%] rounded-2xl rounded-tl-sm px-5 py-4 bg-slate-900/95 text-slate-100 border border-slate-800/90 shadow-lg'
                      }
                    >
                      <RichMarkdownMessage content={m.content} isUser={isUser} />

                      {m.savedFilePath && (
                        <div className="mt-3 pt-2 border-t border-slate-800 text-[11px] text-emerald-300 font-mono-code">
                          💾 Tersimpan ke file: {m.savedFilePath}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}

            {(isSending || isReportingNow) && (
              <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-cyan-950/40 border border-cyan-500/35 text-cyan-200 text-xs animate-pulse">
                <Laptop className="w-4 h-4 text-cyan-400 shrink-0" />
                <div>
                  <div className="font-bold">
                    {agent.name} sedang berjalan ke meja kerjanya & mengecek data di komputer...
                  </div>
                  <div className="text-[11px] text-cyan-300/80">
                    Menyusun jawaban terstruktur untuk Anda
                  </div>
                </div>
              </div>
            )}
          </div>

          <form
            onSubmit={handleSendChat}
            className="pl-5 pr-4 py-3 border-t border-slate-800 bg-slate-900/85 space-y-2"
          >
            <input
              ref={fileAttachInputRef}
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
              <div className="flex flex-wrap items-center gap-1.5 pb-1">
                {attachedFiles.map((af) => (
                  <span
                    key={af.id}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-950/90 border border-indigo-500/50 text-[11px] text-indigo-200"
                  >
                    <span>📎 {af.name}</span>
                    <span className="text-[10px] text-slate-400">({af.summary})</span>
                    <button
                      type="button"
                      onClick={() =>
                        setAttachedFiles((prev) => prev.filter((item) => item.id !== af.id))
                      }
                      className="text-slate-400 hover:text-rose-400 ml-1"
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between flex-wrap gap-2 text-[11px] text-slate-300">
              <div className="flex items-center gap-3 flex-wrap">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={saveAsReport}
                    onChange={(e) => setSaveAsReport(e.target.checked)}
                    className="rounded border-slate-600 bg-slate-800 text-indigo-500"
                  />
                  <span>Simpan ke Report (.md)</span>
                </label>

                <button
                  type="button"
                  onClick={() => fileAttachInputRef.current?.click()}
                  title="Lampirkan atau Drag & Drop file CSV, Brief, TXT, Markdown, atau Gambar langsung ke chat"
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700 text-cyan-300 font-semibold transition"
                >
                  <Paperclip className="w-3 h-3" />
                  <span>Lampirkan File / Drop CSV & Brief</span>
                </button>
              </div>

              <select
                value={forceEngine}
                onChange={(e) => setForceEngine(e.target.value as 'hybrid_api' | 'hermes_cli')}
                className="bg-slate-800 border border-slate-700 rounded-md px-2 py-0.5 text-[11px]"
              >
                <option value="hybrid_api">Engine: Direct API (api.openai.com)</option>
                <option value="hermes_cli">Engine: Hermes CLI Bridge</option>
              </select>
            </div>

            <div className="flex items-end gap-2">
              <MentionTextarea
                rows={2}
                value={chatInput}
                onChange={setChatInput}
                onSubmit={() => void submitChatPrompt()}
                agents={agents}
                excludeCurrentAgentId={agent.id}
                disabled={isSending}
                placeholder={`Arahkan ${agent.name} atau ketik @nama untuk oper tugas berantai (contoh: Cari ide konten hari ini lalu berikan ke @nadia)...`}
              />
              <button
                type="submit"
                disabled={isSending}
                className="px-4 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 disabled:opacity-50 transition shrink-0"
              >
                <Send className="w-3.5 h-3.5" />
                {isSending ? 'Eksekusi...' : 'Kirim'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 2: JOBDESK SCHEDULE (09:00 - 17:00) */}
      {activeTab === 'jobdesk' && (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-white">Batas Jam Daily Report</div>
                <div className="text-[11px] text-slate-400">
                  Jika lewat jam ini belum report, sistem otomatis kirim reminder ke Head DM.
                </div>
              </div>
              <input
                type="time"
                value={reportDeadline}
                onChange={(e) => setReportDeadline(e.target.value)}
                className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono-code text-amber-300"
              />
            </div>

            {jobdesks.map((jd, idx) => (
              <div
                key={jd.id}
                className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2"
              >
                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    value={jd.time}
                    onChange={(e) => {
                      const copy = [...jobdesks];
                      copy[idx] = { ...jd, time: e.target.value };
                      setJobdesks(copy);
                    }}
                    className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs font-mono-code text-indigo-300"
                  />
                  <input
                    type="text"
                    value={jd.title}
                    onChange={(e) => {
                      const copy = [...jobdesks];
                      copy[idx] = { ...jd, title: e.target.value };
                      setJobdesks(copy);
                    }}
                    className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-xs font-bold text-white"
                  />
                  <button
                    onClick={() => setJobdesks(jobdesks.filter((_, i) => i !== idx))}
                    className="p-1 text-slate-500 hover:text-rose-400"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <textarea
                  rows={2}
                  value={jd.description}
                  onChange={(e) => {
                    const copy = [...jobdesks];
                    copy[idx] = { ...jd, description: e.target.value };
                    setJobdesks(copy);
                  }}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
                />

                <div className="flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-400">Ruangan 3D:</span>
                    <select
                      value={jd.room}
                      onChange={(e) => {
                        const copy = [...jobdesks];
                        copy[idx] = { ...jd, room: e.target.value as VillaRoomId };
                        setJobdesks(copy);
                      }}
                      className="bg-slate-950 border border-slate-700 rounded px-2 py-0.5 text-slate-200"
                    >
                      {Object.values(VILLA_ROOMS).map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.emoji} {r.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <label className="flex items-center gap-1.5 text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={jd.requiresReport}
                      onChange={(e) => {
                        const copy = [...jobdesks];
                        copy[idx] = { ...jd, requiresReport: e.target.checked };
                        setJobdesks(copy);
                      }}
                    />
                    <span>Wajib Submit Report</span>
                  </label>
                </div>
              </div>
            ))}

            <button
              onClick={handleAddJobdeskSlot}
              className="w-full py-2 rounded-xl border border-dashed border-slate-700 hover:border-indigo-500 text-xs font-semibold text-slate-300 hover:text-indigo-300 flex items-center justify-center gap-1.5 transition"
            >
              <Plus className="w-3.5 h-3.5" />
              Tambah Slot Jobdesk Manual
            </button>
          </div>

          <div className="p-3 border-t border-slate-800 bg-slate-900/80">
            <button
              onClick={handleSaveJobdesks}
              className="w-full py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-lg transition"
            >
              <Save className="w-3.5 h-3.5" />
              Simpan Perubahan Jobdesk (09:00 - 17:00)
            </button>
          </div>
        </div>
      )}

      {/* TAB 3: HERMES MARKDOWN EDITORS (SOUL.md, TOOLS.md, USER.md, AGENTS.md) */}
      {activeTab === 'markdown' && (
        <div className="flex-1 flex flex-col overflow-hidden p-4 gap-3">
          <div className="grid grid-cols-4 gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800">
            {(['soulMd', 'toolsMd', 'userMd', 'agentsMd'] as MarkdownFileKey[]).map((key) => (
              <button
                key={key}
                onClick={() => setActiveMdKey(key)}
                className={`py-1.5 rounded-lg text-[11px] font-mono-code font-bold transition ${
                  activeMdKey === key
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {mdLabels[key].filename}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span>{mdLabels[activeMdKey].subtitle}</span>
            <button
              onClick={handleReloadFromDisk}
              title="Baca ulang file .md dari disk laptop"
              className="flex items-center gap-1 text-indigo-400 hover:text-indigo-300 font-semibold"
            >
              <RefreshCw className="w-3 h-3" />
              Reload Disk
            </button>
          </div>

          <textarea
            value={docs[activeMdKey]}
            onChange={(e) => setDocs({ ...docs, [activeMdKey]: e.target.value })}
            spellCheck={false}
            className="flex-1 w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl p-3 text-xs font-mono-code text-slate-200 leading-relaxed focus:outline-none resize-none"
          />

          <div className="flex items-center justify-between gap-2">
            <div className="text-[10px] text-slate-500 font-mono-code truncate">
              hermes_workspace/agents/{agent.id}/{mdLabels[activeMdKey].filename}
            </div>
            <button
              onClick={handleSaveMarkdownDocs}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 shrink-0 transition"
            >
              <Save className="w-3.5 h-3.5" />
              Simpan Semua .MD
            </button>
          </div>
        </div>
      )}

      {/* TAB 4: LOCAL LAPTOP FILE & FOLDER CONNECTOR */}
      {activeTab === 'files' && (
        <div className="flex-1 flex flex-col overflow-hidden p-4 space-y-3 overflow-y-auto">
          <div className="p-3 rounded-xl bg-indigo-950/30 border border-indigo-500/30 space-y-1">
            <div className="text-xs font-bold text-indigo-200">
              Koneksi File Internal Laptop & Hermes Workspace
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              Hubungkan folder kerja atau file lokal di laptop Anda (CSV laporan Ads/Shopee, Brief
              Campaign, Markdown, JSON, TXT). Agent ini otomatis membacanya sebagai konteks kerja!
            </p>
            {agentWorkspaceDir && (
              <div className="pt-1 text-[10px] font-mono-code text-emerald-300 break-all">
                📂 Folder Hermes Agent: {agentWorkspaceDir}
              </div>
            )}
          </div>

          {/* Native Picker Buttons */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => handlePickLocalPath('folder')}
              className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-white flex items-center justify-center gap-1.5 transition"
            >
              <FolderPlus className="w-4 h-4 text-amber-400" />
              Pilih Folder Laptop
            </button>
            <button
              onClick={() => handlePickLocalPath('file')}
              className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-white flex items-center justify-center gap-1.5 transition"
            >
              <FileCode2 className="w-4 h-4 text-cyan-400" />
              Pilih File Spesifik
            </button>
          </div>

          {/* Manual Path Input */}
          <div className="flex gap-2">
            <input
              type="text"
              value={manualPathInput}
              onChange={(e) => setManualPathInput(e.target.value)}
              placeholder="Atau ketik path manual, misal: D:\Data-Marketing\Briefs"
              className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono-code text-slate-200 focus:outline-none focus:border-indigo-500"
            />
            <button
              onClick={handleAddManualPath}
              className="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold"
            >
              Tambah
            </button>
          </div>

          {/* Connected Paths Inspection List */}
          <div className="space-y-2 pt-1">
            <div className="text-xs font-bold text-slate-300">
              Path Laptop yang Terhubung ({connectedPaths.length})
            </div>

            {connectedPaths.length === 0 ? (
              <div className="p-4 rounded-xl border border-dashed border-slate-800 text-center text-xs text-slate-500">
                Belum ada folder/file eksternal yang dihubungkan ke {agent.name}.
              </div>
            ) : (
              pathSummary.map((item) => (
                <div
                  key={item.inputPath}
                  className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-mono-code text-slate-100 break-all">
                      {item.inputPath}
                    </span>
                    <button
                      onClick={() => handleRemovePath(item.inputPath)}
                      className="text-slate-500 hover:text-rose-400 shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="text-[11px]">
                    {item.exists ? (
                      <span className="text-emerald-400 font-semibold">
                        ✅ Terbaca ({item.type} • {item.fileCount} file terdeteksi)
                      </span>
                    ) : (
                      <span className="text-rose-400 font-semibold">
                        ⚠️ Path tidak ditemukan di laptop
                      </span>
                    )}
                  </div>
                  {item.sampleFiles.length > 0 && (
                    <div className="pt-1 flex flex-wrap gap-1">
                      {item.sampleFiles.slice(0, 6).map((sf) => (
                        <span
                          key={sf.fullPath}
                          className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-[10px] font-mono-code text-slate-300"
                        >
                          {sf.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </aside>
  );
};
