import React, { useRef, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Edit3,
  Paperclip,
  Pin,
  Play,
  Plus,
  RotateCcw,
  Save,
  SkipForward,
  Trash2,
  Workflow,
  X,
} from 'lucide-react';
import {
  AgentProfile,
  WorkflowDefinition,
  WorkflowRun,
  WorkflowStep,
  WorkflowStepType,
} from '../../types';
import { api } from '../../utils/api';
import {
  mergePromptWithAttachments,
  ParsedDroppedFile,
  parseDroppedFiles,
} from '../../utils/fileDropParser';
import { RichMarkdownMessage } from '../common/RichMarkdownMessage';

interface WorkflowStudioProps {
  workflows: WorkflowDefinition[];
  workflowRuns: WorkflowRun[];
  agents: AgentProfile[];
  onClose: () => void;
  onRefreshState: () => void;
}

export const WorkflowStudio: React.FC<WorkflowStudioProps> = ({
  workflows,
  workflowRuns,
  agents,
  onClose,
  onRefreshState,
}) => {
  const [mode, setMode] = useState<'monitor' | 'builder'>('monitor');
  const [selectedWfId, setSelectedWfId] = useState<string>(
    workflows[0]?.id || 'wf-morning-content-pipeline'
  );
  const [topicContext, setTopicContext] = useState('');
  const [isLaunching, setIsLaunching] = useState(false);
  const [approvalFeedback, setApprovalFeedback] = useState<Record<string, string>>({});
  const [attachedFiles, setAttachedFiles] = useState<ParsedDroppedFile[]>([]);
  const [isDraggingOverWf, setIsDraggingOverWf] = useState(false);
  const [stepActionBusyKey, setStepActionBusyKey] = useState<string | null>(null);
  const [pinnedKey, setPinnedKey] = useState<string | null>(null);
  const wfFileInputRef = useRef<HTMLInputElement>(null);

  // Custom Workflow Builder State
  const [editingWf, setEditingWf] = useState<WorkflowDefinition>(() => ({
    id: `wf-custom-${Date.now()}`,
    name: 'Workflow Marketing Custom Baru',
    description: 'Alur kolaborasi otomatis antar spesialis sesuai kebutuhan Head DM.',
    scheduleTime: '09:30',
    autoRunDaily: false,
    lastAutoRunDate: null,
    steps: [
      {
        id: `step-${Date.now()}-1`,
        order: 1,
        title: '1. Riset & Analisis Awal',
        type: 'agent_task',
        agentIds: ['research'],
        notifyAgentIds: ['social-media'],
        prompt: 'Lakukan analisis peluang kampanye hari ini dan kirimkan ringkasannya.',
        slaMinutes: 15,
      },
      {
        id: `step-${Date.now()}-2`,
        order: 2,
        title: '2. Approval Head of Digital Marketing',
        type: 'head_approval',
        agentIds: ['social-media'],
        notifyAgentIds: ['designer'],
        prompt: 'Menunggu persetujuan Head DM sebelum lanjut produksi.',
        slaMinutes: 10,
      },
    ],
  }));
  const [isNewWf, setIsNewWf] = useState(true);

  const selectedWf = workflows.find((w) => w.id === selectedWfId) || workflows[0];

  const handleStartWorkflow = async () => {
    if (!selectedWf || isLaunching) return;
    setIsLaunching(true);
    try {
      const mergedContext = mergePromptWithAttachments(topicContext, attachedFiles);
      await api.runWorkflow(selectedWf.id, mergedContext);
      setTopicContext('');
      setAttachedFiles([]);
      onRefreshState();
    } catch (err) {
      alert(`Gagal menjalankan workflow: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsLaunching(false);
    }
  };

  const handleWfFilesSelected = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const parsed = await parseDroppedFiles(files);
    setAttachedFiles((prev) => [...prev, ...parsed]);
  };

  const handleRetryStep = async (runId: string, stepIndex: number) => {
    const key = `retry-${runId}-${stepIndex}`;
    setStepActionBusyKey(key);
    try {
      await api.retryWorkflowStep(runId, stepIndex);
      onRefreshState();
    } catch (err) {
      alert(`Gagal mengulang tahap: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setStepActionBusyKey(null);
    }
  };

  const handleSkipStep = async (runId: string, stepIndex: number) => {
    const key = `skip-${runId}-${stepIndex}`;
    setStepActionBusyKey(key);
    try {
      await api.skipWorkflowStep(
        runId,
        stepIndex,
        approvalFeedback[runId]?.trim() || 'Tahap dilewati oleh Head DM'
      );
      onRefreshState();
    } catch (err) {
      alert(`Gagal melewati tahap: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setStepActionBusyKey(null);
    }
  };

  const handlePinStepOutput = async (
    key: string,
    agentId: string,
    agentName: string,
    role: string,
    content: string,
    stepTitle: string
  ) => {
    const ag = agents.find((a) => a.id === agentId);
    await api.addPinnedIdea({
      agentId,
      agentName,
      agentRole: role,
      avatarEmoji: ag?.avatarEmoji || '📌',
      title: `[Workflow] ${stepTitle} — ${agentName}`,
      content,
      category: ag?.department || 'Workflow Output',
    });
    setPinnedKey(key);
    setTimeout(() => setPinnedKey(null), 2000);
    onRefreshState();
  };

  const handleDecision = async (runId: string, approved: boolean) => {
    try {
      await api.decideWorkflowApproval(runId, approved, approvalFeedback[runId] || '');
      setApprovalFeedback((prev) => ({ ...prev, [runId]: '' }));
      onRefreshState();
    } catch (err) {
      alert(`Gagal memproses approval: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleEditExistingWorkflow = (wf: WorkflowDefinition) => {
    setEditingWf(structuredClone(wf));
    setIsNewWf(false);
    setMode('builder');
  };

  const handleCreateNewWorkflowTemplate = () => {
    setEditingWf({
      id: `wf-custom-${Date.now()}`,
      name: 'Workflow Custom Head DM',
      description: 'Alur kolaborasi lintas agent yang dapat diatur sendiri.',
      scheduleTime: '09:15',
      autoRunDaily: false,
      lastAutoRunDate: null,
      steps: [
        {
          id: `st-${Date.now()}-1`,
          order: 1,
          title: 'Tahap 1: Riset / Strategi',
          type: 'agent_task',
          agentIds: ['research'],
          notifyAgentIds: ['social-media'],
          prompt: 'Susun riset awal dan rekomendasi utama.',
          slaMinutes: 15,
        },
      ],
    });
    setIsNewWf(true);
    setMode('builder');
  };

  const handleSaveCustomWorkflow = async () => {
    const normalized: WorkflowDefinition = {
      ...editingWf,
      steps: editingWf.steps.map((s, i) => ({ ...s, order: i + 1 })),
    };
    const res = await api.saveWorkflow(normalized, isNewWf);
    setSelectedWfId(res.workflow.id);
    setMode('monitor');
    onRefreshState();
  };

  const toggleStepAgent = (stepIdx: number, agentId: string) => {
    const copy = [...editingWf.steps];
    const current = new Set(copy[stepIdx].agentIds);
    if (current.has(agentId)) {
      if (current.size > 1) current.delete(agentId);
    } else {
      current.add(agentId);
    }
    copy[stepIdx] = { ...copy[stepIdx], agentIds: Array.from(current) };
    setEditingWf({ ...editingWf, steps: copy });
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-5xl h-[86vh] bg-slate-950 border border-slate-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 bg-gradient-to-r from-slate-900 to-indigo-950/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-lg">
              <Workflow className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-white">
                Multi-Agent Workflow Studio & Approval Center
              </h2>
              <p className="text-xs text-slate-400">
                Orkestrasi kolaborasi otomatis 11 spesialis (Riset → Sosmed → Approval Head DM →
                Designer → Content & Video) + Custom Builder
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="bg-slate-900 p-1 rounded-xl border border-slate-800 flex text-xs font-bold">
              <button
                onClick={() => setMode('monitor')}
                className={`px-3 py-1.5 rounded-lg transition ${
                  mode === 'monitor' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Live Pipeline & Eksekusi
              </button>
              <button
                onClick={() => setMode('builder')}
                className={`px-3 py-1.5 rounded-lg transition ${
                  mode === 'builder' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                + Buat / Edit Workflow Manual
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* MODE 1: MONITOR & LAUNCH */}
        {mode === 'monitor' ? (
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
            {/* Left Column: Workflow Templates & Trigger */}
            <div className="lg:col-span-5 border-r border-slate-800 p-5 overflow-y-auto space-y-4 bg-slate-900/40">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
                  Pilih Alur Workflow ({workflows.length})
                </h3>
                <button
                  onClick={handleCreateNewWorkflowTemplate}
                  className="text-xs font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Buat Baru
                </button>
              </div>

              <div className="space-y-2.5">
                {workflows.map((wf) => {
                  const active = wf.id === selectedWf?.id;
                  return (
                    <div
                      key={wf.id}
                      onClick={() => setSelectedWfId(wf.id)}
                      className={`p-3.5 rounded-2xl border cursor-pointer transition ${
                        active
                          ? 'bg-indigo-950/50 border-indigo-500 shadow-lg'
                          : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="font-bold text-sm text-white">{wf.name}</div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditExistingWorkflow(wf);
                          }}
                          title="Edit alur workflow ini"
                          className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                        {wf.description}
                      </p>
                      <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[10px]">
                        <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-semibold">
                          {wf.steps.length} Tahap
                        </span>
                        {wf.scheduleTime && (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-mono-code">
                            ⏰ Jadwal {wf.scheduleTime} ({wf.autoRunDaily ? 'Auto ON' : 'Manual'})
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {selectedWf && (
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDraggingOverWf(true);
                  }}
                  onDragLeave={() => setIsDraggingOverWf(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDraggingOverWf(false);
                    void handleWfFilesSelected(e.dataTransfer.files);
                  }}
                  className={`p-4 rounded-2xl bg-slate-900 border space-y-3 transition ${
                    isDraggingOverWf
                      ? 'border-cyan-400 bg-indigo-950/50'
                      : 'border-slate-800'
                  }`}
                >
                  <input
                    ref={wfFileInputRef}
                    type="file"
                    multiple
                    accept=".csv,.tsv,.txt,.md,.json,.html,.png,.jpg,.jpeg,.webp"
                    onChange={(e) => {
                      void handleWfFilesSelected(e.target.files);
                      e.target.value = '';
                    }}
                    className="hidden"
                  />

                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs font-bold text-white">
                      Jalankan "{selectedWf.name}"
                    </div>
                    <button
                      type="button"
                      onClick={() => wfFileInputRef.current?.click()}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[10px] font-semibold text-cyan-300 transition"
                    >
                      <Paperclip className="w-3 h-3" />
                      Lampirkan / Drop File (CSV/Brief)
                    </button>
                  </div>

                  {attachedFiles.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {attachedFiles.map((af) => (
                        <span
                          key={af.id}
                          className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-indigo-950/90 border border-indigo-500/50 text-[10px] text-indigo-200"
                        >
                          <span>📎 {af.name}</span>
                          <span className="text-slate-400">({af.summary})</span>
                          <button
                            type="button"
                            onClick={() =>
                              setAttachedFiles((prev) => prev.filter((x) => x.id !== af.id))
                            }
                            className="text-slate-400 hover:text-rose-400"
                          >
                            ✕
                          </button>
                        </span>
                      ))}
                    </div>
                  )}

                  <textarea
                    rows={2}
                    value={topicContext}
                    onChange={(e) => setTopicContext(e.target.value)}
                    placeholder="Opsional: Masukkan fokus produk, promo, atau drag & drop file CSV/Brief langsung ke kotak ini..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    onClick={handleStartWorkflow}
                    disabled={isLaunching}
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-extrabold flex items-center justify-center gap-2 shadow-lg transition disabled:opacity-50"
                  >
                    <Play className="w-4 h-4" />
                    {isLaunching ? 'Memulai Orkestrasi...' : 'Mulai Eksekusi Workflow Sekarang'}
                  </button>

                  {/* Step Blueprint Preview */}
                  <div className="pt-2 space-y-1.5">
                    <div className="text-[11px] font-bold text-slate-400">Urutan Tahapan:</div>
                    {selectedWf.steps.map((st) => (
                      <div
                        key={st.id}
                        className="text-[11px] px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800/80 flex items-center justify-between gap-2"
                      >
                        <span className="text-slate-200 font-medium truncate">{st.title}</span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-semibold shrink-0 ${
                            st.type === 'head_approval'
                              ? 'bg-amber-500/20 text-amber-300'
                              : 'bg-indigo-500/20 text-indigo-300'
                          }`}
                        >
                          {st.type === 'head_approval' ? 'ACC Head DM' : st.agentIds.join(', ')}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right Column: Active & Recent Workflow Runs + Head DM Approval Gate */}
            <div className="lg:col-span-7 p-5 overflow-y-auto space-y-4">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
                Riwayat & Eksekusi Berjalan ({workflowRuns.length})
              </h3>

              {workflowRuns.length === 0 ? (
                <div className="p-10 rounded-2xl border border-dashed border-slate-800 text-center space-y-2">
                  <div className="text-2xl">🚀</div>
                  <div className="text-sm font-bold text-slate-200">
                    Belum Ada Eksekusi Workflow Hari Ini
                  </div>
                  <p className="text-xs text-slate-400 max-w-md mx-auto">
                    Klik tombol <strong>"Mulai Eksekusi Workflow Sekarang"</strong> di sebelah kiri
                    untuk melihat Arka (Riset) → Nadia (Sosmed) → Approval Anda → Reza (Designer) →
                    Tiara & Rafi bekerja berantai!
                  </p>
                </div>
              ) : (
                workflowRuns.map((run) => {
                  const wfDef = workflows.find((w) => w.id === run.workflowId);
                  return (
                    <div
                      key={run.id}
                      className="rounded-2xl bg-slate-900/90 border border-slate-800 overflow-hidden shadow-lg"
                    >
                      <div className="px-4 py-3 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <div className="text-sm font-extrabold text-white">
                            {run.workflowName}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            Mulai:{' '}
                            {new Date(run.startedAt).toLocaleTimeString('id-ID', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                            {run.topicContext && ` • Fokus: "${run.topicContext}"`}
                          </div>
                        </div>

                        <span
                          className={`px-2.5 py-1 rounded-full text-[11px] font-extrabold ${
                            run.status === 'waiting_approval'
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-400/50 animate-pulse'
                              : run.status === 'completed'
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                              : run.status === 'running'
                              ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
                              : 'bg-rose-500/20 text-rose-300'
                          }`}
                        >
                          {run.status === 'waiting_approval'
                            ? '⏸️ Menunggu Approval Head DM'
                            : run.status === 'completed'
                            ? '✅ Selesai Tuntas'
                            : run.status === 'running'
                            ? '⚡ Sedang Dikerjakan Agent...'
                            : '❌ Gagal'}
                        </span>
                      </div>

                      <div className="p-4 space-y-3">
                        {run.stepResults.map((sr, idx) => {
                          const stepMeta = wfDef?.steps.find((s) => s.id === sr.stepId);
                          const isWaitingHere =
                            run.status === 'waiting_approval' &&
                            sr.status === 'waiting_approval';

                          return (
                            <div
                              key={sr.stepId}
                              className={`p-3.5 rounded-xl border ${
                                isWaitingHere
                                  ? 'bg-amber-950/30 border-amber-500/60'
                                  : sr.status === 'completed' || sr.status === 'approved'
                                  ? 'bg-slate-950/80 border-slate-800'
                                  : sr.status === 'running'
                                  ? 'bg-indigo-950/30 border-indigo-500/50'
                                  : 'bg-slate-950/40 border-slate-900 opacity-60'
                              }`}
                            >
                              <div className="flex items-center justify-between flex-wrap gap-2">
                                <span className="text-xs font-bold text-white">
                                  {stepMeta?.title || `Tahap ${idx + 1}`}
                                </span>
                                <div className="flex items-center gap-1.5">
                                  {/* Retry & Skip Step Action Buttons */}
                                  <button
                                    type="button"
                                    onClick={() => void handleRetryStep(run.id, idx)}
                                    disabled={stepActionBusyKey === `retry-${run.id}-${idx}`}
                                    title="Ulangi (Retry) tahap ini saja tanpa mengulang workflow dari awal"
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-800 hover:bg-indigo-600/80 border border-slate-700 text-[10px] font-semibold text-slate-200 hover:text-white transition disabled:opacity-50"
                                  >
                                    <RotateCcw className="w-2.5 h-2.5" />
                                    {stepActionBusyKey === `retry-${run.id}-${idx}`
                                      ? 'Mengulang...'
                                      : 'Retry Tahap'}
                                  </button>
                                  {sr.status !== 'completed' && sr.status !== 'approved' && (
                                    <button
                                      type="button"
                                      onClick={() => void handleSkipStep(run.id, idx)}
                                      disabled={stepActionBusyKey === `skip-${run.id}-${idx}`}
                                      title="Lewati (Skip) tahap ini dan lanjutkan ke spesialis tahap berikutnya"
                                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/15 hover:bg-amber-500/30 border border-amber-500/35 text-[10px] font-semibold text-amber-300 transition disabled:opacity-50"
                                    >
                                      <SkipForward className="w-2.5 h-2.5" />
                                      {stepActionBusyKey === `skip-${run.id}-${idx}`
                                        ? 'Skip...'
                                        : 'Skip Tahap'}
                                    </button>
                                  )}
                                  <span className="text-[10px] font-mono-code uppercase text-slate-400">
                                    {sr.status}
                                  </span>
                                </div>
                              </div>

                              {/* Agent Deliverable Outputs */}
                              {sr.outputs.length > 0 && (
                                <div className="mt-2.5 space-y-2">
                                  {sr.outputs.map((out) => {
                                    const pinId = `${run.id}-${sr.stepId}-${out.agentId}`;
                                    return (
                                      <details
                                        key={out.agentId}
                                        open
                                        className="rounded-lg bg-slate-900/90 border border-slate-800 p-2.5"
                                      >
                                        <summary className="text-xs font-bold text-indigo-300 cursor-pointer flex items-center justify-between gap-2">
                                          <span>
                                            {out.agentName} ({out.role})
                                            {out.engineUsed && (
                                              <span className="ml-2 text-[10px] text-slate-400">
                                                [{out.engineUsed}]
                                              </span>
                                            )}
                                          </span>
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.preventDefault();
                                              e.stopPropagation();
                                              void handlePinStepOutput(
                                                pinId,
                                                out.agentId,
                                                out.agentName,
                                                out.role,
                                                out.content,
                                                stepMeta?.title || `Tahap ${idx + 1}`
                                              );
                                            }}
                                            className="px-2 py-0.5 rounded bg-amber-500/15 hover:bg-amber-500/30 border border-amber-500/30 text-[10px] text-amber-300 font-semibold inline-flex items-center gap-1"
                                          >
                                            <Pin className="w-2.5 h-2.5" />
                                            {pinnedKey === pinId ? 'Tersimpan!' : 'Pin Ide'}
                                          </button>
                                        </summary>
                                        <div className="mt-2 max-h-80 overflow-y-auto pr-2">
                                          <RichMarkdownMessage content={out.content} compact />
                                        </div>
                                      </details>
                                    );
                                  })}
                                </div>
                              )}

                              {sr.headFeedback && (
                                <div className="mt-2 text-[11px] text-emerald-300 bg-emerald-950/40 border border-emerald-800/50 rounded-lg px-2.5 py-1.5">
                                  👑 <strong>Arahan Head DM:</strong> {sr.headFeedback}
                                </div>
                              )}

                              {/* Interactive Approval Gate Controls */}
                              {isWaitingHere && (
                                <div className="mt-3 pt-3 border-t border-amber-500/30 space-y-2.5">
                                  <p className="text-xs text-amber-200 font-medium">
                                    👑 <strong>Keputusan Head of Digital Marketing:</strong> Apakah
                                    hasil riset & penilaian tim di atas sudah oke untuk lanjut ke
                                    Designer, Content Creator & Videographer?
                                  </p>
                                  <input
                                    type="text"
                                    value={approvalFeedback[run.id] || ''}
                                    onChange={(e) =>
                                      setApprovalFeedback({
                                        ...approvalFeedback,
                                        [run.id]: e.target.value,
                                      })
                                    }
                                    placeholder="Catatan tambahan / instruksi revisi untuk tim (opsional)..."
                                    className="w-full bg-slate-950 border border-amber-500/40 rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
                                  />
                                  <div className="flex items-center gap-2">
                                    <button
                                      onClick={() => handleDecision(run.id, true)}
                                      className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold flex items-center justify-center gap-1.5 shadow"
                                    >
                                      <CheckCircle2 className="w-4 h-4" />
                                      Approve (OK) & Lanjut ke Tim Berikutnya
                                    </button>
                                    <button
                                      onClick={() => handleDecision(run.id, false)}
                                      className="px-4 py-2 rounded-xl bg-rose-600/80 hover:bg-rose-600 text-white text-xs font-bold flex items-center gap-1.5"
                                    >
                                      <RotateCcw className="w-3.5 h-3.5" />
                                      Minta Revisi
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        ) : (
          /* MODE 2: MANUAL CUSTOM WORKFLOW BUILDER */
          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-900/70 p-4 rounded-2xl border border-slate-800">
              <div className="md:col-span-2 space-y-2">
                <label className="text-xs font-bold text-slate-300">Nama Workflow</label>
                <input
                  type="text"
                  value={editingWf.name}
                  onChange={(e) => setEditingWf({ ...editingWf, name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm font-bold text-white"
                />
                <label className="text-xs font-bold text-slate-300 block pt-1">Deskripsi</label>
                <input
                  type="text"
                  value={editingWf.description}
                  onChange={(e) => setEditingWf({ ...editingWf, description: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200"
                />
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-bold text-slate-300 flex items-center gap-1 mb-1">
                    <Clock className="w-3.5 h-3.5 text-indigo-400" /> Jam Jadwal Harian (Opsional)
                  </label>
                  <input
                    type="time"
                    value={editingWf.scheduleTime || ''}
                    onChange={(e) =>
                      setEditingWf({ ...editingWf, scheduleTime: e.target.value || null })
                    }
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono-code text-white"
                  />
                </div>
                <label className="flex items-center gap-2 text-xs text-slate-200 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={editingWf.autoRunDaily}
                    onChange={(e) =>
                      setEditingWf({ ...editingWf, autoRunDaily: e.target.checked })
                    }
                  />
                  <span>Jalankan otomatis setiap hari kerja (09:00-17:00)</span>
                </label>
              </div>
            </div>

            {/* Steps Editor */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-extrabold text-white">
                  Susunan Tahapan & Kolaborasi Agent ({editingWf.steps.length} Tahap)
                </h3>
                <button
                  onClick={() =>
                    setEditingWf({
                      ...editingWf,
                      steps: [
                        ...editingWf.steps,
                        {
                          id: `st-${Date.now()}`,
                          order: editingWf.steps.length + 1,
                          title: `${editingWf.steps.length + 1}. Tahap Baru`,
                          type: 'agent_task',
                          agentIds: [agents[0]?.id || 'research'],
                          notifyAgentIds: [],
                          prompt: 'Tuliskan instruksi kerja spesifik untuk tahap ini...',
                          slaMinutes: 15,
                        },
                      ],
                    })
                  }
                  className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Tambah Tahap
                </button>
              </div>

              {editingWf.steps.map((step, sIdx) => (
                <div
                  key={step.id}
                  className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3"
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-extrabold flex items-center justify-center">
                      {sIdx + 1}
                    </span>
                    <input
                      type="text"
                      value={step.title}
                      onChange={(e) => {
                        const copy = [...editingWf.steps];
                        copy[sIdx] = { ...step, title: e.target.value };
                        setEditingWf({ ...editingWf, steps: copy });
                      }}
                      className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs font-bold text-white"
                    />

                    <select
                      value={step.type}
                      onChange={(e) => {
                        const copy = [...editingWf.steps];
                        copy[sIdx] = { ...step, type: e.target.value as WorkflowStepType };
                        setEditingWf({ ...editingWf, steps: copy });
                      }}
                      className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-indigo-300 font-semibold"
                    >
                      <option value="agent_task">Eksekusi Tugas oleh Agent</option>
                      <option value="peer_review">Penilaian / Review oleh Rekan Agent</option>
                      <option value="head_approval">Approval Gate: Head DM (OK / Revisi)</option>
                    </select>

                    <div className="flex items-center gap-1 text-xs text-slate-400">
                      <span>SLA Reminder (mnt):</span>
                      <input
                        type="number"
                        min={1}
                        max={180}
                        value={step.slaMinutes}
                        onChange={(e) => {
                          const copy = [...editingWf.steps];
                          copy[sIdx] = {
                            ...step,
                            slaMinutes: Math.max(1, Number(e.target.value) || 10),
                          };
                          setEditingWf({ ...editingWf, steps: copy });
                        }}
                        className="w-16 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-center text-white"
                      />
                    </div>

                    {editingWf.steps.length > 1 && (
                      <button
                        onClick={() =>
                          setEditingWf({
                            ...editingWf,
                            steps: editingWf.steps.filter((_, i) => i !== sIdx),
                          })
                        }
                        className="p-1.5 text-slate-500 hover:text-rose-400"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* Multi-Agent Picker */}
                  <div>
                    <div className="text-[11px] font-semibold text-slate-400 mb-1.5">
                      {step.type === 'head_approval'
                        ? 'Agent Penanggung Jawab yang Menunggu Approval Head DM:'
                        : 'Pilih Spesialis yang Mengerjakan Tahap Ini (bisa lebih dari 1 secara paralel):'}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {agents.map((ag) => {
                        const picked = step.agentIds.includes(ag.id);
                        return (
                          <button
                            key={ag.id}
                            type="button"
                            onClick={() => toggleStepAgent(sIdx, ag.id)}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition ${
                              picked
                                ? 'bg-indigo-600 border-indigo-400 text-white'
                                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                            }`}
                          >
                            {ag.avatarEmoji} {ag.name} ({ag.role.replace(' Spesialist', '')})
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <textarea
                    rows={2}
                    value={step.prompt}
                    onChange={(e) => {
                      const copy = [...editingWf.steps];
                      copy[sIdx] = { ...step, prompt: e.target.value };
                      setEditingWf({ ...editingWf, steps: copy });
                    }}
                    placeholder="Instruksi detail tugas pada tahap ini..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              ))}
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              {!isNewWf && (
                <button
                  onClick={async () => {
                    if (confirm('Hapus workflow ini?')) {
                      await api.deleteWorkflow(editingWf.id);
                      setMode('monitor');
                      onRefreshState();
                    }
                  }}
                  className="px-4 py-2.5 rounded-xl bg-rose-950/60 hover:bg-rose-900 text-rose-300 border border-rose-800 text-xs font-bold"
                >
                  Hapus Workflow
                </button>
              )}
              <button
                onClick={handleSaveCustomWorkflow}
                className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-extrabold flex items-center gap-2 shadow-lg"
              >
                <Save className="w-4 h-4" />
                Simpan Workflow ke Villa HQ
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
