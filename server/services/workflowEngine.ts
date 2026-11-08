import {
  ReminderItem,
  StepAgentOutput,
  WorkflowDefinition,
  WorkflowRun,
} from '../types.ts';
import { saveAgentReportToDisk } from './fileConnector.ts';
import { generateAgentResponse } from './llmEngine.ts';
import { HERMES_WORKSPACE_DIR, storage } from './storage.ts';
import { sendWindowsDesktopNotification } from './windowsNotifier.ts';

function todayIsoDate(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function collectAccumulatedContext(run: WorkflowRun, wf: WorkflowDefinition): string {
  const parts: string[] = [];
  if (run.topicContext.trim()) {
    parts.push(`### Arahan Awal / Fokus Topik dari Head DM:\n${run.topicContext.trim()}`);
  }
  for (const sr of run.stepResults) {
    const stepDef = wf.steps.find((s) => s.id === sr.stepId);
    for (const out of sr.outputs) {
      parts.push(
        `### Output Tahap "${stepDef?.title || sr.stepId}" — oleh ${out.agentName} (${out.role}):\n${out.content}`
      );
    }
    if (sr.headFeedback) {
      parts.push(`### Catatan / Feedback Head of Digital Marketing:\n${sr.headFeedback}`);
    }
  }
  return parts.join('\n\n---\n\n');
}

export async function startWorkflowRun(
  workflowId: string,
  topicContext = ''
): Promise<WorkflowRun> {
  const wf = storage.getWorkflows().find((w) => w.id === workflowId);
  if (!wf) {
    throw new Error(`Workflow dengan ID "${workflowId}" tidak ditemukan.`);
  }

  const run: WorkflowRun = {
    id: `run-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    workflowId: wf.id,
    workflowName: wf.name,
    status: 'running',
    currentStepIndex: 0,
    topicContext,
    startedAt: new Date().toISOString(),
    completedAt: null,
    stepResults: wf.steps.map((step) => ({
      stepId: step.id,
      status: 'pending',
      outputs: [],
      headFeedback: null,
      waitingSince: null,
      lastRemindedAt: null,
    })),
  };

  storage.upsertWorkflowRun(run);
  storage.addMessage({
    id: `msg-${Date.now()}`,
    senderType: 'system',
    senderId: 'hq-system',
    senderName: 'Workflow Engine',
    senderRole: 'Orchestrator',
    recipientId: 'all',
    channel: 'workflow',
    content: `▶️ Memulai Workflow **"${wf.name}"**${topicContext ? ` dengan fokus: _"${topicContext}"_` : ''}.`,
    timestamp: new Date().toISOString(),
    workflowRunId: run.id,
  });

  // Execute steps asynchronously so HTTP call returns immediately
  void executeWorkflowLoop(run.id);
  return run;
}

async function executeWorkflowLoop(runId: string): Promise<void> {
  const run = storage.getWorkflowRun(runId);
  if (!run || run.status !== 'running') return;

  const wf = storage.getWorkflows().find((w) => w.id === run.workflowId);
  if (!wf) return;

  while (run.currentStepIndex < wf.steps.length) {
    const step = wf.steps[run.currentStepIndex];
    const stepResult = run.stepResults[run.currentStepIndex];

    // Check if this step is a Head of Digital Marketing Approval Gate
    if (step.type === 'head_approval') {
      stepResult.status = 'waiting_approval';
      stepResult.waitingSince = new Date().toISOString();
      stepResult.lastRemindedAt = new Date().toISOString();
      run.status = 'waiting_approval';
      storage.upsertWorkflowRun(run);

      const spokespersonId = step.agentIds[0] || 'social-media';
      const spokesperson = storage.getAgent(spokespersonId);
      if (spokesperson) {
        storage.updateAgent(spokesperson.id, (a) => {
          a.currentRoom = 'head_suite';
          a.status = 'waiting_user';
          a.statusText = `Menunggu Approval Head DM untuk "${wf.name}"`;
          a.speechBubble = `Bos, mohon cek & klik Approve (OK) di Workflow "${step.title}" ya!`;
          a.speechTimestamp = Date.now();
        });
      }

      const reminder: ReminderItem = {
        id: `rem-${Date.now()}`,
        direction: 'user_pending_approval',
        severity: 'info',
        fromAgentId: spokespersonId,
        targetAgentId: null,
        workflowRunId: run.id,
        title: `Butuh Approval Head DM: ${step.title}`,
        message: `${spokesperson?.name || 'Tim'} menunggu persetujuan (OK / Revisi) Anda pada workflow "${wf.name}" sebelum lanjut ke tahap berikutnya.`,
        createdAt: new Date().toISOString(),
        acknowledged: false,
      };
      storage.addReminder(reminder);

      if (storage.getSnapshot().config.villa.windowsToastEnabled) {
        sendWindowsDesktopNotification(reminder.title, reminder.message);
      }

      storage.addMessage({
        id: `msg-${Date.now()}`,
        senderType: 'agent',
        senderId: spokesperson?.id || 'hq-system',
        senderName: spokesperson?.name || 'Coordinator',
        senderRole: spokesperson?.role || 'Coordinator',
        recipientId: 'head-dm',
        channel: 'workflow',
        content: `⏸️ **Menunggu Approval Head DM (${step.title}):** Silakan review hasil riset/penilaian di atas, lalu klik **Approve & Lanjut** atau **Minta Revisi** di panel Workflow Studio.`,
        timestamp: new Date().toISOString(),
        workflowRunId: run.id,
      });

      return; // Pause loop until Head DM approves or requests revision!
    }

    // Execute agent_task or peer_review step
    stepResult.status = 'running';
    storage.upsertWorkflowRun(run);

    const priorContext = collectAccumulatedContext(run, wf);
    const assignedAgents = step.agentIds
      .map((id) => storage.getAgent(id))
      .filter((a): a is NonNullable<typeof a> => Boolean(a));

    // Set assigned agents into active working / collaborating state in 3D Villa
    for (const ag of assignedAgents) {
      storage.updateAgent(ag.id, (a) => {
        a.currentRoom = step.type === 'peer_review' ? 'meeting_hub' : 'office';
        a.status = step.type === 'peer_review' ? 'collaborating' : 'working';
        a.targetAgentId = step.notifyAgentIds[0] || null;
        a.statusText = `Mengerjakan: ${step.title}`;
        a.speechBubble = `Sedang eksekusi "${step.title}"...`;
        a.speechTimestamp = Date.now();
      });
    }

    try {
      const baseUrlNow = storage.getSnapshot().config.provider.baseUrl || '';
      const isSingleTabBridge = baseUrlNow.includes('8765');

      const runSingleAgentStep = async (ag: NonNullable<(typeof assignedAgents)[number]>): Promise<StepAgentOutput> => {
        const gen = await generateAgentResponse({
          agent: ag,
          userPrompt: step.prompt,
          priorContext,
        });

        const savedPath = saveAgentReportToDisk(
          HERMES_WORKSPACE_DIR,
          ag.id,
          `${wf.name} - ${step.title}`,
          gen.content
        );

        const today = todayIsoDate();
        storage.updateAgent(ag.id, (a) => {
          a.lastReportAt = new Date().toISOString();
          a.dailyReportSubmittedDate = today;
          a.status = step.notifyAgentIds.length > 0 ? 'collaborating' : 'working';
          a.currentRoom = step.notifyAgentIds.length > 0 ? 'meeting_hub' : 'office';
          a.targetAgentId = step.notifyAgentIds[0] || null;
          a.statusText = `Selesai submit: ${step.title}`;
          a.speechBubble =
            step.notifyAgentIds.length > 0
              ? `Sudah kirim hasil ke tim berikutnya & Head DM!`
              : `Tugas "${step.title}" beres!`;
          a.speechTimestamp = Date.now();
        });

        storage.addMessage({
          id: `msg-${Date.now()}-${ag.id}`,
          senderType: 'agent',
          senderId: ag.id,
          senderName: ag.name,
          senderRole: ag.role,
          recipientId: step.notifyAgentIds[0] || 'head-dm',
          channel: 'workflow',
          content: gen.content,
          timestamp: new Date().toISOString(),
          workflowRunId: run.id,
          savedFilePath: savedPath,
          engineUsed: gen.engineUsed,
        });

        return {
          agentId: ag.id,
          agentName: ag.name,
          role: ag.role,
          content: gen.content,
          timestamp: new Date().toISOString(),
          savedReportPath: savedPath,
          engineUsed: gen.engineUsed,
        };
      };

      const outputs: StepAgentOutput[] = [];
      if (isSingleTabBridge) {
        // Sequential execution so single-tab Muse browser bridge (port 8765) doesn't collide
        for (const ag of assignedAgents) {
          outputs.push(await runSingleAgentStep(ag));
        }
      } else {
        const parallelOut = await Promise.all(assignedAgents.map((ag) => runSingleAgentStep(ag)));
        outputs.push(...parallelOut);
      }

      stepResult.outputs = outputs;
      stepResult.status = 'completed';
      run.currentStepIndex += 1;
      storage.upsertWorkflowRun(run);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      stepResult.status = 'failed';
      run.status = 'failed';
      storage.upsertWorkflowRun(run);

      storage.addMessage({
        id: `msg-err-${Date.now()}`,
        senderType: 'system',
        senderId: 'hq-system',
        senderName: 'Workflow Engine',
        senderRole: 'Orchestrator',
        recipientId: 'head-dm',
        channel: 'workflow',
        content: `❌ Gagal pada tahap "${step.title}": ${errMsg}`,
        timestamp: new Date().toISOString(),
        workflowRunId: run.id,
      });
      return;
    }
  }

  // All steps finished!
  run.status = 'completed';
  run.completedAt = new Date().toISOString();
  storage.upsertWorkflowRun(run);

  storage.addMessage({
    id: `msg-done-${Date.now()}`,
    senderType: 'system',
    senderId: 'hq-system',
    senderName: 'Workflow Engine',
    senderRole: 'Orchestrator',
    recipientId: 'all',
    channel: 'workflow',
    content: `✅ Workflow **"${wf.name}"** selesai tuntas! Seluruh laporan & output telah tersimpan di folder \`hermes_workspace/agents/*/reports/\`.`,
    timestamp: new Date().toISOString(),
    workflowRunId: run.id,
  });

  if (storage.getSnapshot().config.villa.windowsToastEnabled) {
    sendWindowsDesktopNotification(
      `Workflow Selesai: ${wf.name}`,
      'Seluruh spesialis telah menuntaskan rangkaian tugas dan menyimpan laporan ke workspace.'
    );
  }
}

export async function handleHeadApprovalDecision(params: {
  runId: string;
  approved: boolean;
  feedback?: string;
}): Promise<WorkflowRun> {
  const { runId, approved, feedback } = params;
  const run = storage.getWorkflowRun(runId);
  if (!run) {
    throw new Error('Workflow run tidak ditemukan.');
  }
  const wf = storage.getWorkflows().find((w) => w.id === run.workflowId);
  if (!wf) {
    throw new Error('Definisi workflow tidak ditemukan.');
  }

  const idx = run.currentStepIndex;
  const step = wf.steps[idx];
  const stepResult = run.stepResults[idx];
  if (!step || !stepResult || step.type !== 'head_approval') {
    throw new Error('Tahap saat ini bukan merupakan tahap Approval Head DM.');
  }

  // Acknowledge open reminders tied to this workflow run
  for (const r of storage.getSnapshot().reminders) {
    if (r.workflowRunId === run.id && !r.acknowledged) {
      storage.acknowledgeReminder(r.id);
    }
  }

  if (approved) {
    stepResult.status = 'approved';
    stepResult.headFeedback = feedback?.trim() || 'Disetujui (OK) oleh Head of Digital Marketing.';
    run.status = 'running';
    run.currentStepIndex = idx + 1;
    storage.upsertWorkflowRun(run);

    for (const agId of step.agentIds) {
      storage.updateAgent(agId, (a) => {
        a.currentRoom = 'office';
        a.status = 'working';
        a.statusText = 'Approval Head DM diterima! Melanjutkan handoff ke tim kreatif';
        a.speechBubble = 'Siap Bos! Langsung lanjut ke Designer & tim konten!';
        a.speechTimestamp = Date.now();
      });
    }

    storage.addMessage({
      id: `msg-app-${Date.now()}`,
      senderType: 'user',
      senderId: 'head-dm',
      senderName: 'Head of Digital Marketing',
      senderRole: 'Head DM',
      recipientId: 'all',
      channel: 'workflow',
      content: `✅ **APPROVED oleh Head DM:** ${stepResult.headFeedback}`,
      timestamp: new Date().toISOString(),
      workflowRunId: run.id,
    });

    void executeWorkflowLoop(run.id);
    return run;
  } else {
    // Revision requested: step back 1 step if possible so previous agent revises with feedback!
    const note = feedback?.trim() || 'Mohon dipertajam kembali analisis dan rekomendasinya.';
    stepResult.status = 'pending';
    stepResult.headFeedback = `Permintaan Revisi Head DM: ${note}`;

    const prevIdx = Math.max(0, idx - 1);
    if (run.stepResults[prevIdx]) {
      run.stepResults[prevIdx].headFeedback = `Instruksi Revisi Head DM: ${note}`;
      run.stepResults[prevIdx].status = 'pending';
    }
    run.currentStepIndex = prevIdx;
    run.status = 'running';
    storage.upsertWorkflowRun(run);

    storage.addMessage({
      id: `msg-rev-${Date.now()}`,
      senderType: 'user',
      senderId: 'head-dm',
      senderName: 'Head of Digital Marketing',
      senderRole: 'Head DM',
      recipientId: 'all',
      channel: 'workflow',
      content: `🔄 **REVISI diminta oleh Head DM:** ${note}`,
      timestamp: new Date().toISOString(),
      workflowRunId: run.id,
    });

    void executeWorkflowLoop(run.id);
    return run;
  }
}

export async function retryWorkflowStep(
  runId: string,
  stepIndex?: number
): Promise<WorkflowRun> {
  const run = storage.getWorkflowRun(runId);
  if (!run) {
    throw new Error('Workflow run tidak ditemukan.');
  }
  const wf = storage.getWorkflows().find((w) => w.id === run.workflowId);
  if (!wf) {
    throw new Error('Definisi workflow tidak ditemukan.');
  }

  const targetIdx =
    typeof stepIndex === 'number' && stepIndex >= 0 && stepIndex < wf.steps.length
      ? stepIndex
      : Math.min(run.currentStepIndex, wf.steps.length - 1);

  const step = wf.steps[targetIdx];
  const sr = run.stepResults[targetIdx];
  if (!step || !sr) {
    throw new Error('Tahap workflow tidak valid.');
  }

  sr.status = 'pending';
  run.currentStepIndex = targetIdx;
  run.status = 'running';
  run.completedAt = null;
  storage.upsertWorkflowRun(run);

  storage.addMessage({
    id: `msg-retry-${Date.now()}`,
    senderType: 'system',
    senderId: 'hq-system',
    senderName: 'Workflow Engine',
    senderRole: 'Orchestrator',
    recipientId: 'all',
    channel: 'workflow',
    content: `🔁 **Retry Tahap:** Mengulangi eksekusi tahap **"${step.title}"** atas instruksi Head DM.`,
    timestamp: new Date().toISOString(),
    workflowRunId: run.id,
  });

  void executeWorkflowLoop(run.id);
  return run;
}

export async function skipWorkflowStep(
  runId: string,
  stepIndex?: number,
  reason?: string
): Promise<WorkflowRun> {
  const run = storage.getWorkflowRun(runId);
  if (!run) {
    throw new Error('Workflow run tidak ditemukan.');
  }
  const wf = storage.getWorkflows().find((w) => w.id === run.workflowId);
  if (!wf) {
    throw new Error('Definisi workflow tidak ditemukan.');
  }

  const targetIdx =
    typeof stepIndex === 'number' && stepIndex >= 0 && stepIndex < wf.steps.length
      ? stepIndex
      : Math.min(run.currentStepIndex, wf.steps.length - 1);

  const step = wf.steps[targetIdx];
  const sr = run.stepResults[targetIdx];
  if (!step || !sr) {
    throw new Error('Tahap workflow tidak valid.');
  }

  // Acknowledge any open reminders for this workflow run
  for (const r of storage.getSnapshot().reminders) {
    if (r.workflowRunId === run.id && !r.acknowledged) {
      storage.acknowledgeReminder(r.id);
    }
  }

  const skipNote = reason?.trim() || 'Tahap ini dilewati (Skipped) oleh Head of Digital Marketing.';
  sr.status = step.type === 'head_approval' ? 'approved' : 'completed';
  sr.headFeedback = `⏭️ Dilewati (Skipped): ${skipNote}`;
  if (sr.outputs.length === 0) {
    sr.outputs.push({
      agentId: step.agentIds[0] || 'hq-system',
      agentName: 'Villa HQ System',
      role: 'Step Skipped',
      content: `_⏭️ Tahap **"${step.title}"** dilewati oleh Head DM (${skipNote}). Melanjutkan ke tahap berikutnya._`,
      timestamp: new Date().toISOString(),
      engineUsed: 'simulation',
    });
  }

  run.currentStepIndex = targetIdx + 1;
  run.status = 'running';
  storage.upsertWorkflowRun(run);

  storage.addMessage({
    id: `msg-skip-${Date.now()}`,
    senderType: 'system',
    senderId: 'hq-system',
    senderName: 'Workflow Engine',
    senderRole: 'Orchestrator',
    recipientId: 'all',
    channel: 'workflow',
    content: `⏭️ **Skip Tahap:** Tahap **"${step.title}"** dilewati oleh Head DM. Lanjut ke tahap berikutnya!`,
    timestamp: new Date().toISOString(),
    workflowRunId: run.id,
  });

  void executeWorkflowLoop(run.id);
  return run;
}
