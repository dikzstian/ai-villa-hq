import React, { useState } from 'react';
import {
  CheckCircle2,
  MessageSquare,
  Play,
  SkipForward,
  Sparkles,
  Target,
  Workflow,
} from 'lucide-react';
import {
  AgentProfile,
  AppConfig,
  VillaRoomId,
  WorkflowRun,
} from '../../types';
import { api } from '../../utils/api';
import { VILLA_ROOMS } from '../../utils/villaCoords';

interface Villa2DCommandCenterProps {
  agents: AgentProfile[];
  config: AppConfig;
  workflowRuns: WorkflowRun[];
  selectedAgentId: string | null;
  focusedRoom: VillaRoomId | null;
  onSelectAgent: (id: string) => void;
  onSelectRoom: (room: VillaRoomId | null) => void;
  onOpenWorkflows: () => void;
  onOpenProductFocus: () => void;
  onRefreshState: () => void;
}

export const Villa2DCommandCenter: React.FC<Villa2DCommandCenterProps> = ({
  agents,
  config,
  workflowRuns,
  selectedAgentId,
  focusedRoom,
  onSelectAgent,
  onSelectRoom,
  onOpenWorkflows,
  onOpenProductFocus,
  onRefreshState,
}) => {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [skippingAll, setSkippingAll] = useState(false);

  const todayStr = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
      d.getDate()
    ).padStart(2, '0')}`;
  })();

  const handleRequestReport = async (e: React.MouseEvent, agentId: string) => {
    e.stopPropagation();
    setBusyId(`rep-${agentId}`);
    try {
      await api.triggerAgentReportNow(agentId);
      onRefreshState();
    } finally {
      setBusyId(null);
    }
  };

  const handleSkipReport = async (e: React.MouseEvent, agentId: string) => {
    e.stopPropagation();
    setBusyId(`skip-${agentId}`);
    try {
      await api.skipAgentReport(agentId);
      onRefreshState();
    } finally {
      setBusyId(null);
    }
  };

  const handleSkipAllReports = async () => {
    setSkippingAll(true);
    try {
      await api.skipAllAgentReports();
      onRefreshState();
    } finally {
      setSkippingAll(false);
    }
  };

  const visibleAgents = focusedRoom
    ? agents.filter((a) => a.currentRoom === focusedRoom)
    : agents;

  const activeFocus = config.activeProductFocus;

  return (
    <div className="w-full h-full pt-28 pb-20 px-4 overflow-y-auto bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950/60">
      <div className="max-w-7xl mx-auto space-y-4">
        {/* Top Status & Zero-GPU Banner */}
        <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-wrap items-center justify-between gap-3 shadow-xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center text-xl">
              ⚡
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm font-extrabold text-white">
                  Mode 2D Command Center (Zero-GPU • Beban Grafis 0%)
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold">
                  Mesin 3D WebGL Dimatikan Sementara — Laptop Super Adem
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Pantau 11 Spesialis di 8 Ruangan Villa, baca status live, chat langsung, atau skip laporan harian jam 17:00 dengan 1 klik.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={onOpenProductFocus}
              className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition ${
                activeFocus?.enabled && activeFocus.productName
                  ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                  : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'
              }`}
            >
              <Target className="w-3.5 h-3.5 text-amber-400" />
              {activeFocus?.enabled && activeFocus.productName
                ? `🎯 Fokus: ${activeFocus.productName.slice(0, 24)}`
                : '🎯 Set Fokus Produk'}
            </button>

            <button
              type="button"
              onClick={() => void handleSkipAllReports()}
              disabled={skippingAll}
              title="Skip seluruh laporan harian divisi untuk hari ini agar tidak ada tagihan jam 17:00"
              className="px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/35 text-amber-300 text-xs font-bold flex items-center gap-1.5 transition disabled:opacity-50"
            >
              <SkipForward className="w-3.5 h-3.5" />
              {skippingAll ? 'Skip Semua...' : 'Skip Semua Laporan Hari Ini'}
            </button>

            <button
              type="button"
              onClick={onOpenWorkflows}
              className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 shadow"
            >
              <Workflow className="w-3.5 h-3.5" />
              Workflow ({workflowRuns.filter((r) => r.status === 'running').length} Jalan)
            </button>
          </div>
        </div>

        {/* 8 Rooms Overview Pills */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
          {Object.values(VILLA_ROOMS).map((room) => {
            const occupants = agents.filter((a) => a.currentRoom === room.id);
            const isSelected = focusedRoom === room.id;
            return (
              <button
                key={room.id}
                type="button"
                onClick={() => onSelectRoom(isSelected ? null : room.id)}
                className={`p-2.5 rounded-2xl border text-left transition ${
                  isSelected
                    ? 'bg-indigo-600/30 border-indigo-400 shadow-lg'
                    : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-base">{room.emoji}</span>
                  <span className="px-1.5 py-0.5 rounded-full bg-slate-800 text-[10px] font-bold text-slate-300">
                    {occupants.length} Agent
                  </span>
                </div>
                <div className="text-xs font-bold text-white mt-1 truncate">{room.label}</div>
                <div className="flex items-center gap-1 mt-1 overflow-hidden">
                  {occupants.length === 0 ? (
                    <span className="text-[10px] text-slate-500">Kosong</span>
                  ) : (
                    occupants.map((occ) => (
                      <span key={occ.id} title={occ.name} className="text-xs">
                        {occ.avatarEmoji}
                      </span>
                    ))
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* 11 Specialist Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {visibleAgents.map((ag) => {
            const isSelected = selectedAgentId === ag.id;
            const roomInfo = VILLA_ROOMS[ag.currentRoom];
            const isSkipped = ag.dailyReportSkippedDate === todayStr;
            const isSubmitted = ag.dailyReportSubmittedDate === todayStr && !isSkipped;

            const statusBadge =
              ag.status === 'late_report'
                ? { label: '⚠️ Belum Report', cls: 'bg-rose-500/20 text-rose-300 border-rose-500/40' }
                : ag.status === 'waiting_user'
                ? { label: '⏸️ Menunggu Bos', cls: 'bg-amber-500/20 text-amber-300 border-amber-500/40' }
                : ag.status === 'collaborating'
                ? { label: '🤝 Kolaborasi', cls: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40' }
                : ag.status === 'working'
                ? { label: '💻 Fokus Kerja', cls: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' }
                : { label: '☕ Santai / Break', cls: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40' };

            return (
              <div
                key={ag.id}
                onClick={() => onSelectAgent(ag.id)}
                className={`p-4 rounded-2xl border cursor-pointer transition flex flex-col justify-between gap-3 ${
                  isSelected
                    ? 'bg-indigo-950/60 border-indigo-400 shadow-xl'
                    : 'bg-slate-900/90 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-10 h-10 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center text-xl shrink-0">
                        {ag.avatarEmoji}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-extrabold text-white truncate">
                          {ag.name}
                        </div>
                        <div className="text-[11px] font-semibold text-indigo-300 truncate">
                          {ag.role}
                        </div>
                      </div>
                    </div>

                    <span
                      className={`px-2 py-0.5 rounded-full border text-[10px] font-bold shrink-0 ${statusBadge.cls}`}
                    >
                      {statusBadge.label}
                    </span>
                  </div>

                  {/* Location & Report Status */}
                  <div className="flex items-center justify-between text-[11px] px-2.5 py-1.5 rounded-xl bg-slate-950/80 border border-slate-800/80">
                    <span className="text-slate-300 truncate">
                      {roomInfo?.emoji} {roomInfo?.label}
                    </span>
                    {isSubmitted ? (
                      <span className="text-emerald-400 font-bold flex items-center gap-1 shrink-0">
                        <CheckCircle2 className="w-3 h-3" /> Report Beres
                      </span>
                    ) : isSkipped ? (
                      <span className="text-amber-300 font-bold shrink-0">
                        ⏭️ Report Di-Skip
                      </span>
                    ) : (
                      <span className="text-slate-400 shrink-0">
                        ⏰ Deadline {ag.reportDeadlineTime}
                      </span>
                    )}
                  </div>

                  {/* Live Activity / Speech Bubble */}
                  <div className="text-xs text-slate-300 bg-slate-950/50 border border-slate-800/60 rounded-xl p-2.5">
                    <div className="text-[10px] font-bold text-slate-400 mb-0.5">
                      Status: {ag.statusText}
                    </div>
                    {ag.speechBubble && (
                      <div className="text-xs text-cyan-200 italic line-clamp-2">
                        "{ag.speechBubble}"
                      </div>
                    )}
                  </div>
                </div>

                {/* Quick Action Footer */}
                <div className="flex items-center gap-1.5 pt-1 border-t border-slate-800/80">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectAgent(ag.id);
                    }}
                    className="flex-1 py-1.5 px-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-bold flex items-center justify-center gap-1 transition"
                  >
                    <MessageSquare className="w-3 h-3" />
                    Chat & Tugas
                  </button>

                  <button
                    type="button"
                    onClick={(e) => void handleRequestReport(e, ag.id)}
                    disabled={busyId === `rep-${ag.id}`}
                    title="Minta laporan harian sekarang"
                    className="py-1.5 px-2.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/35 text-emerald-300 text-[11px] font-bold flex items-center gap-1 transition disabled:opacity-50"
                  >
                    <Play className="w-3 h-3" />
                    {busyId === `rep-${ag.id}` ? '...' : 'Report'}
                  </button>

                  {!isSubmitted && !isSkipped && (
                    <button
                      type="button"
                      onClick={(e) => void handleSkipReport(e, ag.id)}
                      disabled={busyId === `skip-${ag.id}`}
                      title="Skip laporan harian divisi ini hari ini"
                      className="py-1.5 px-2.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/35 text-amber-300 text-[11px] font-bold flex items-center gap-1 transition disabled:opacity-50"
                    >
                      <SkipForward className="w-3 h-3" />
                      Skip
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
