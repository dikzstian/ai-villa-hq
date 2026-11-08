import React, { useEffect, useState } from 'react';
import {
  Bell,
  BookOpen,
  Calendar,
  Clock,
  Globe,
  LayoutGrid,
  MessageSquare,
  Mountain,
  Palette,
  Pin,
  Settings,
  Sparkles,
  Sun,
  Target,
  Waves,
  Workflow,
} from 'lucide-react';
import {
  AppConfig,
  TimeAmbience,
  VillaRoomId,
  VillaScenery,
} from '../../types';
import { VILLA_ROOMS } from '../../utils/villaCoords';

interface TopHudBarProps {
  config: AppConfig;
  isWorkingHoursNow: boolean;
  unreadReminderCount: number;
  waitingApprovalCount: number;
  pinnedIdeasCount?: number;
  focusedRoom: VillaRoomId | null;
  freeRoamEnabled: boolean;
  ecoMode?: boolean;
  view2DMode?: boolean;
  onToggleFreeRoam: () => void;
  onToggleEcoMode?: () => void;
  onToggleView2DMode?: () => void;
  onFocusRoom: (room: VillaRoomId | null) => void;
  onChangeScenery: (scenery: VillaScenery) => void;
  onChangeAmbience: (ambience: TimeAmbience) => void;
  onToggleForceWorkHours: () => void;
  onOpenWorkflows: () => void;
  onOpenProductFocus?: () => void;
  onOpenPinnedIdeas?: () => void;
  onOpenSocialBrowser: () => void;
  onOpenNotionCalendar: () => void;
  onOpenComms: () => void;
  onOpenCharacterCreator: () => void;
  onOpenReferences: () => void;
  onOpenReminders: () => void;
  onOpenSettings: () => void;
}

const LiveClock: React.FC = React.memo(() => {
  const [clockStr, setClockStr] = useState('');

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setClockStr(
        now.toLocaleTimeString('id-ID', {
          hour: '2-digit',
          minute: '2-digit',
        })
      );
    };
    update();
    const id = setInterval(update, 10000);
    return () => clearInterval(id);
  }, []);

  return (
    <span className="flex items-center gap-1 font-mono-code text-slate-200">
      <Clock className="w-3 h-3 text-indigo-400" />
      {clockStr} WIB
    </span>
  );
});

export const TopHudBar: React.FC<TopHudBarProps> = React.memo(({
  config,
  isWorkingHoursNow,
  unreadReminderCount,
  waitingApprovalCount,
  pinnedIdeasCount = 0,
  focusedRoom,
  freeRoamEnabled,
  ecoMode = true,
  view2DMode = false,
  onToggleFreeRoam,
  onToggleEcoMode,
  onToggleView2DMode,
  onFocusRoom,
  onChangeScenery,
  onChangeAmbience,
  onToggleForceWorkHours,
  onOpenWorkflows,
  onOpenProductFocus,
  onOpenPinnedIdeas,
  onOpenSocialBrowser,
  onOpenNotionCalendar,
  onOpenComms,
  onOpenCharacterCreator,
  onOpenReferences,
  onOpenReminders,
  onOpenSettings,
}) => {
  const isLocalGateway =
    config.provider.baseUrl?.includes('localhost') ||
    config.provider.baseUrl?.includes('127.0.0.1');
  const isMuseProvider =
    config.provider.baseUrl?.includes('meta.ai') ||
    config.provider.defaultModel?.includes('muse');
  const hasApiKey = Boolean(config.provider.apiKey?.trim()) || isLocalGateway;
  const providerStatusLabel = hasApiKey
    ? isLocalGateway
      ? '● 9Router Local Aktif'
      : isMuseProvider
      ? '● Muse AI Aktif'
      : '● Live API Aktif'
    : '● Mode Simulasi (API Key Menyusul)';
  const hasActiveProductFocus = Boolean(
    config.activeProductFocus?.enabled && config.activeProductFocus?.productName?.trim()
  );

  return (
    <header className="pointer-events-none fixed top-0 left-0 right-0 z-30 p-3 flex flex-col gap-2">
      {/* Row 1: Brand + Working Hours + Main Controls */}
      <div className="pointer-events-auto flex flex-wrap items-center justify-between gap-2 bg-slate-950/95 border border-slate-800/90 rounded-2xl px-4 py-2.5 shadow-2xl">
        {/* Left: Brand & Clock */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-indigo-500/25 text-lg font-bold">
            🏡
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-extrabold tracking-tight text-white">
                Digital Marketing Villa HQ
              </h1>
              <span
                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                  hasApiKey
                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                    : 'bg-amber-500/15 text-amber-300 border-amber-500/40'
                }`}
              >
                {providerStatusLabel}
              </span>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-slate-400">
              <LiveClock />
              <span>•</span>
              <button
                onClick={onToggleForceWorkHours}
                title="Klik untuk toggle mode paksa aktif di luar jam 09:00-17:00"
                className={`px-2 py-0.5 rounded-md font-semibold transition ${
                  isWorkingHoursNow
                    ? 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                }`}
              >
                {isWorkingHoursNow
                  ? `🟢 Shift Aktif (${String(config.workHours.startHour).padStart(2, '0')}:00-${String(
                      config.workHours.endHour
                    ).padStart(2, '0')}:00${config.workHours.forceActiveOutsideHours ? ' • Override ON' : ''})`
                  : '🌙 Luar Jam Kerja (Klik untuk Aktifkan Tim)'}
              </button>
            </div>
          </div>
        </div>

        {/* Middle: Scenery View Toggle (Mountain vs Ocean) & Lighting */}
        <div className="flex items-center gap-1.5 bg-slate-900/90 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => onChangeScenery('mountain')}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition ${
              config.villa.scenery === 'mountain'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Mountain className="w-3.5 h-3.5" />
            View Gunung
          </button>
          <button
            onClick={() => onChangeScenery('ocean')}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition ${
              config.villa.scenery === 'ocean'
                ? 'bg-sky-600 text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Waves className="w-3.5 h-3.5" />
            View Laut
          </button>

          <div className="h-4 w-px bg-slate-800 mx-1" />

          <div className="flex items-center gap-1 pr-1">
            <Sun className="w-3.5 h-3.5 text-amber-400 ml-1" />
            <select
              value={config.villa.ambience}
              onChange={(e) => onChangeAmbience(e.target.value as TimeAmbience)}
              className="bg-transparent text-xs text-slate-200 font-medium focus:outline-none cursor-pointer"
            >
              <option value="auto" className="bg-slate-900">
                Cahaya Auto
              </option>
              <option value="morning" className="bg-slate-900">
                Pagi Cerah
              </option>
              <option value="day" className="bg-slate-900">
                Siang Terik
              </option>
              <option value="sunset" className="bg-slate-900">
                Golden Sunset
              </option>
              <option value="night" className="bg-slate-900">
                Malam Cozy
              </option>
            </select>
          </div>
        </div>

        {/* Right: Primary Command Action Buttons */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {onOpenProductFocus && (
            <button
              onClick={onOpenProductFocus}
              title="Fokus Produk & Promo Aktif (1x Isi untuk 11 Agent)"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition ${
                hasActiveProductFocus
                  ? 'bg-amber-500/20 hover:bg-amber-500/30 border-amber-400 text-amber-200 shadow-lg shadow-amber-500/10'
                  : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'
              }`}
            >
              <Target className="w-3.5 h-3.5 text-amber-400" />
              <span>
                {hasActiveProductFocus
                  ? `Fokus: ${config.activeProductFocus!.productName.slice(0, 16)}`
                  : 'Fokus Produk'}
              </span>
            </button>
          )}

          {onOpenPinnedIdeas && (
            <button
              onClick={onOpenPinnedIdeas}
              title="Papan Ide Terbaik (Bookmark Chat & Output Spesialis)"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-amber-300 transition"
            >
              <Pin className="w-3.5 h-3.5" />
              <span className="hidden xl:inline">Papan Ide</span>
              {pinnedIdeasCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-amber-500/25 text-amber-200 text-[10px]">
                  {pinnedIdeasCount}
                </span>
              )}
            </button>
          )}

          <button
            onClick={onOpenWorkflows}
            className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/25 transition"
          >
            <Workflow className="w-3.5 h-3.5" />
            <span>Workflow Studio</span>
            {waitingApprovalCount > 0 && (
              <span className="ml-0.5 px-1.5 py-0.2 bg-amber-400 text-slate-950 rounded-full text-[10px] font-extrabold animate-pulse">
                {waitingApprovalCount} ACC
              </span>
            )}
          </button>

          <button
            onClick={onOpenSocialBrowser}
            title="Akses Medsos Live (Chrome Khusus + Hermes Browser Bridge)"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-600/90 hover:bg-cyan-500 text-white text-xs font-bold shadow-lg shadow-cyan-600/20 transition"
          >
            <Globe className="w-3.5 h-3.5" />
            <span>Akses Medsos</span>
          </button>

          <button
            onClick={onOpenNotionCalendar}
            title="Notion Konten Kalender — Khusus Nadia (Sosial Media Spesialist)"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-violet-600/90 hover:bg-violet-500 text-white text-xs font-bold shadow-lg shadow-violet-600/20 transition"
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Notion Kalender</span>
          </button>

          <button
            onClick={onOpenComms}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 text-xs font-semibold transition"
          >
            <MessageSquare className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden md:inline">Brief & Comms</span>
          </button>

          <button
            onClick={onOpenCharacterCreator}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 text-xs font-semibold transition"
          >
            <Palette className="w-3.5 h-3.5 text-pink-400" />
            <span className="hidden lg:inline">3D Character</span>
          </button>

          <button
            onClick={onOpenReferences}
            title="Referensi Editing 3D Character & Villa"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition"
          >
            <BookOpen className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden xl:inline">Referensi 3D</span>
          </button>

          <button
            onClick={onOpenReminders}
            className={`relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-bold transition ${
              unreadReminderCount > 0
                ? 'bg-rose-600/90 border-rose-400 text-white animate-pulse'
                : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'
            }`}
          >
            <Bell className="w-3.5 h-3.5" />
            {unreadReminderCount > 0 && <span>{unreadReminderCount}</span>}
          </button>

          <button
            onClick={onOpenSettings}
            title="API Key api.openai.com/v1 & Hermes Settings"
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 transition"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Row 2: Quick Villa Room Camera Teleporter + Free Roam Mode Toggle */}
      <div className="pointer-events-auto flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
        {onToggleView2DMode && (
          <button
            onClick={onToggleView2DMode}
            title="Mode 2D Command Center mematikan mesin 3D WebGL sepenuhnya (0% GPU) agar laptop tetap dingin saat kerja berjam-jam"
            className={`px-3 py-1 rounded-full text-[11px] font-extrabold border shadow transition shrink-0 flex items-center gap-1 ${
              view2DMode
                ? 'bg-amber-500 border-amber-300 text-slate-950'
                : 'bg-slate-900/95 border-slate-700 text-cyan-300 hover:text-white'
            }`}
          >
            <LayoutGrid className="w-3 h-3" />
            {view2DMode ? '🏡 Kembali ke 3D Villa' : '🖼️ Mode 2D (Zero-GPU)'}
          </button>
        )}

        {onToggleEcoMode && !view2DMode && (
          <button
            onClick={onToggleEcoMode}
            title="Mode Dingin menghemat kerja GPU/CPU laptop hingga 75% (membatasi FPS 3D & mematikan bayangan berat) tanpa mengubah fitur"
            className={`px-3 py-1 rounded-full text-[11px] font-extrabold border shadow transition shrink-0 ${
              ecoMode
                ? 'bg-teal-600/95 border-teal-400 text-white'
                : 'bg-slate-900/95 border-slate-700 text-slate-300 hover:text-white'
            }`}
          >
            {ecoMode ? '🍃 Mode Dingin (Hemat GPU: ON)' : '✨ Grafis Penuh (Eco OFF)'}
          </button>
        )}

        <button
          onClick={onToggleFreeRoam}
          title="Jika ON, agent yang sedang kosong tugas otomatis keliling Villa (main, ngobrol, ngopi, biliar, karaoke)"
          className={`px-3 py-1 rounded-full text-[11px] font-extrabold border shadow transition shrink-0 ${
            freeRoamEnabled
              ? 'bg-emerald-600/95 border-emerald-400 text-white'
              : 'bg-amber-600/95 border-amber-400 text-white'
          }`}
        >
          {freeRoamEnabled ? '🕺 Mode Aktif & Bebas (Free Roam)' : '💼 Panggil Semua ke Meja'}
        </button>

        <button
          onClick={() => onFocusRoom(null)}
          className={`px-3 py-1 rounded-full text-[11px] font-bold border transition shrink-0 ${
            focusedRoom === null
              ? 'bg-indigo-600/95 border-indigo-400 text-white shadow'
              : 'bg-slate-950/90 border-slate-800 text-slate-300 hover:bg-slate-900'
          }`}
        >
          <Sparkles className="w-3 h-3 inline mr-1" />
          Full View Villa
        </button>

        {Object.values(VILLA_ROOMS).map((room) => (
          <button
            key={room.id}
            onClick={() => onFocusRoom(room.id)}
            className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition shrink-0 ${
              focusedRoom === room.id
                ? 'bg-indigo-600/95 border-indigo-400 text-white shadow'
                : 'bg-slate-950/90 border-slate-800 text-slate-300 hover:bg-slate-900 hover:text-white'
            }`}
          >
            {room.emoji} {room.label}
          </button>
        ))}
      </div>
    </header>
  );
});
