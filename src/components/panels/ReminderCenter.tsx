import React, { useState } from 'react';
import {
  AlertTriangle,
  Bell,
  CheckCheck,
  Play,
  Send,
  SkipForward,
  Workflow,
  X,
} from 'lucide-react';
import { AgentProfile, ReminderItem } from '../../types';
import { api } from '../../utils/api';

interface ReminderCenterProps {
  reminders: ReminderItem[];
  agents: AgentProfile[];
  onClose: () => void;
  onOpenWorkflows: () => void;
  onOpenBriefComposer: () => void;
  onRefreshState: () => void;
}

export const ReminderCenter: React.FC<ReminderCenterProps> = ({
  reminders,
  agents,
  onClose,
  onOpenWorkflows,
  onOpenBriefComposer,
  onRefreshState,
}) => {
  const [simAgentId, setSimAgentId] = useState(agents[4]?.id || 'ads');
  const [busyAgentId, setBusyAgentId] = useState<string | null>(null);
  const [isSkippingAll, setIsSkippingAll] = useState(false);

  const todayStr = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
      d.getDate()
    ).padStart(2, '0')}`;
  })();

  const handleTagihReportNow = async (agentId: string, reminderId?: string) => {
    setBusyAgentId(agentId);
    try {
      await api.triggerAgentReportNow(agentId);
      if (reminderId) {
        await api.ackReminder(reminderId);
      }
      onRefreshState();
    } finally {
      setBusyAgentId(null);
    }
  };

  const handleSkipAgentReport = async (agentId: string, reminderId?: string) => {
    setBusyAgentId(agentId);
    try {
      await api.skipAgentReport(agentId);
      if (reminderId) {
        await api.ackReminder(reminderId);
      }
      onRefreshState();
    } finally {
      setBusyAgentId(null);
    }
  };

  const handleSkipAllReports = async () => {
    setIsSkippingAll(true);
    try {
      await api.skipAllAgentReports();
      onRefreshState();
    } finally {
      setIsSkippingAll(false);
    }
  };

  const handleSimulate = async (type: 'agent_missing' | 'user_missing') => {
    await api.simulateReminder(type, simAgentId);
    onRefreshState();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-3xl max-h-[85vh] bg-slate-950 border border-slate-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-800 bg-gradient-to-r from-slate-900 to-rose-950/40 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-600 flex items-center justify-center text-white shadow-lg">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-white">
                Two-Way Reminder & Watchdog Center
              </h2>
              <p className="text-xs text-slate-400">
                Notifikasi timbal-balik: jika Agent telat report ke Anda, atau Anda belum beri
                brief/approval ke Agent
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {reminders.some((r) => !r.acknowledged) && (
              <button
                onClick={async () => {
                  await api.ackAllReminders();
                  onRefreshState();
                }}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 flex items-center gap-1.5"
              >
                <CheckCheck className="w-3.5 h-3.5 text-emerald-400" />
                Tandai Semua Dibaca
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Simulation Bar for Instant Testing */}
        <div className="px-6 py-3 bg-slate-900/80 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-300">🧪 Uji Coba Notifikasi Dua Arah:</span>
            <select
              value={simAgentId}
              onChange={(e) => setSimAgentId(e.target.value)}
              className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-[11px] text-white"
            >
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.avatarEmoji} {a.name} ({a.role.replace(' Spesialist', '')})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleSimulate('agent_missing')}
              className="px-2.5 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 font-bold text-[11px] transition"
            >
              Simulasi: Agent Belum Report
            </button>
            <button
              onClick={() => handleSimulate('user_missing')}
              className="px-2.5 py-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 font-bold text-[11px] transition"
            >
              Simulasi: Agent Tagih Brief ke Gw
            </button>
          </div>
        </div>

        {/* Reminders List + Daily Report Status per Division */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Quick Division Daily Report Control (Skip or Request Report per Division) */}
          <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-amber-300">
                  📋 Kontrol Laporan Harian 11 Divisi (Jadwal Sore / Jam 17:00)
                </h3>
                <p className="text-[11px] text-slate-400">
                  Jika ada divisi yang hari ini tidak perlu/belum bisa membuat laporan, klik{' '}
                  <strong>Skip Laporan</strong> agar tidak ditagih sistem.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void handleSkipAllReports()}
                disabled={isSkippingAll}
                className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 text-xs font-extrabold flex items-center gap-1.5 transition disabled:opacity-50"
              >
                <SkipForward className="w-3.5 h-3.5" />
                {isSkippingAll ? 'Melewati Semua...' : 'Skip Semua Laporan Hari Ini'}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {agents.map((ag) => {
                const isSkipped = ag.dailyReportSkippedDate === todayStr;
                const isSubmitted = ag.dailyReportSubmittedDate === todayStr && !isSkipped;
                return (
                  <div
                    key={ag.id}
                    className="px-3 py-2 rounded-xl bg-slate-950/90 border border-slate-800 flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-white truncate">
                        {ag.avatarEmoji} {ag.name}{' '}
                        <span className="text-[10px] font-normal text-slate-400">
                          ({ag.role.replace(' Spesialist', '')})
                        </span>
                      </div>
                      <div className="text-[10px] mt-0.5">
                        {isSubmitted ? (
                          <span className="text-emerald-400 font-semibold">
                            ✅ Sudah Submit Report ({ag.reportDeadlineTime})
                          </span>
                        ) : isSkipped ? (
                          <span className="text-amber-300 font-semibold">
                            ⏭️ Laporan Di-skip Hari Ini
                          </span>
                        ) : (
                          <span className="text-slate-400">
                            ⏳ Batas Report: {ag.reportDeadlineTime} WIB
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {!isSubmitted && !isSkipped && (
                        <button
                          type="button"
                          onClick={() => void handleSkipAgentReport(ag.id)}
                          disabled={busyAgentId === ag.id}
                          title="Skip laporan harian divisi ini untuk hari ini"
                          className="px-2 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/30 border border-amber-500/35 text-amber-300 text-[10px] font-bold flex items-center gap-1 transition"
                        >
                          <SkipForward className="w-3 h-3" />
                          Skip
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => void handleTagihReportNow(ag.id)}
                        disabled={busyAgentId === ag.id}
                        title="Minta divisi ini menyusun laporan sekarang"
                        className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-indigo-600 text-slate-200 hover:text-white text-[10px] font-semibold transition"
                      >
                        {busyAgentId === ag.id ? '...' : 'Tagih'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {reminders.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-xs">
              Belum ada reminder tertunda. Semua laporan agent & arahan Head DM aman terkendali! ✨
            </div>
          ) : (
            reminders.map((rem) => (
              <div
                key={rem.id}
                className={`p-4 rounded-2xl border transition ${
                  rem.acknowledged
                    ? 'bg-slate-900/40 border-slate-800/70 opacity-65'
                    : rem.direction === 'user_missing_report'
                    ? 'bg-rose-950/30 border-rose-500/50'
                    : rem.direction === 'agent_missing_report'
                    ? 'bg-amber-950/30 border-amber-500/50'
                    : 'bg-indigo-950/30 border-indigo-500/50'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle
                      className={`w-4 h-4 mt-0.5 shrink-0 ${
                        rem.direction === 'user_missing_report'
                          ? 'text-rose-400'
                          : rem.direction === 'agent_missing_report'
                          ? 'text-amber-400'
                          : 'text-indigo-400'
                      }`}
                    />
                    <div>
                      <div className="text-xs font-extrabold text-white">{rem.title}</div>
                      <p className="text-xs text-slate-300 mt-1 leading-relaxed">{rem.message}</p>
                      <div className="text-[10px] text-slate-500 mt-1.5">
                        {new Date(rem.createdAt).toLocaleString('id-ID')}
                      </div>
                    </div>
                  </div>

                  {!rem.acknowledged && (
                    <button
                      onClick={async () => {
                        await api.ackReminder(rem.id);
                        onRefreshState();
                      }}
                      className="text-[11px] text-slate-400 hover:text-white shrink-0"
                    >
                      Selesai
                    </button>
                  )}
                </div>

                {/* Contextual Quick Actions */}
                {!rem.acknowledged && (
                  <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex justify-end gap-2">
                    {rem.direction === 'agent_missing_report' && rem.targetAgentId && (
                      <>
                        <button
                          onClick={() => void handleSkipAgentReport(rem.targetAgentId!, rem.id)}
                          disabled={busyAgentId === rem.targetAgentId}
                          className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-amber-500/40 text-amber-300 text-xs font-bold flex items-center gap-1.5"
                        >
                          <SkipForward className="w-3.5 h-3.5" />
                          Skip Laporan Divisi Ini
                        </button>
                        <button
                          onClick={() => void handleTagihReportNow(rem.targetAgentId!, rem.id)}
                          disabled={busyAgentId === rem.targetAgentId}
                          className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold flex items-center gap-1.5"
                        >
                          <Play className="w-3.5 h-3.5" />
                          {busyAgentId === rem.targetAgentId
                            ? 'Agent Sedang Menyusun...'
                            : 'Tagih & Minta Kerjakan Report Sekarang'}
                        </button>
                      </>
                    )}

                    {rem.direction === 'user_pending_approval' && (
                      <button
                        onClick={() => {
                          onClose();
                          onOpenWorkflows();
                        }}
                        className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5"
                      >
                        <Workflow className="w-3.5 h-3.5" />
                        Buka Workflow & Beri Approval
                      </button>
                    )}

                    {rem.direction === 'user_missing_report' && (
                      <button
                        onClick={() => {
                          onClose();
                          onOpenBriefComposer();
                        }}
                        className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-1.5"
                      >
                        <Send className="w-3.5 h-3.5" />
                        Kirim Daily Brief / Arahan Head DM Sekarang
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
