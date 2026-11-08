import { ReminderItem, VillaRoomId } from '../types.ts';
import { saveAgentReportToDisk } from './fileConnector.ts';
import { generateAgentResponse } from './llmEngine.ts';
import { ensureFreshSocialBrowserSnapshot } from './socialBrowserEngine.ts';
import { HERMES_WORKSPACE_DIR, storage } from './storage.ts';
import { sendWindowsDesktopNotification } from './windowsNotifier.ts';
import { startWorkflowRun } from './workflowEngine.ts';

const LEISURE_ROOMS: VillaRoomId[] = [
  'chill_room',
  'game_hub',
  'game_room',
  'fun_room',
  'rest_room',
];

function getTodayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
}

function getCurrentHHMM(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map((n) => parseInt(n, 10) || 0);
  return h * 60 + m;
}

const alertedLateAgentsToday = new Set<string>();
let lastUserBriefAlertDate: string | null = null;

export function startSchedulerAndWatchdog(): void {
  // Initial background social media sync on server startup
  setTimeout(() => {
    void ensureFreshSocialBrowserSnapshot({ maxAgeMs: 60_000 });
  }, 2500);

  // Tick every 30 seconds
  setInterval(() => {
    try {
      tickVillaLifecycle();
      void ensureFreshSocialBrowserSnapshot({ maxAgeMs: 90_000 });
    } catch (err) {
      console.error('[Scheduler Error]', err);
    }
  }, 30000);
}

export function tickVillaLifecycle(): void {
  const snapshot = storage.getSnapshot();
  const isWorking = snapshot.isWorkingHoursNow;
  const nowHHMM = getCurrentHHMM();
  const nowMinutes = timeToMinutes(nowHHMM);
  const today = getTodayStr();

  // If outside 09:00 - 17:00 and not forced active -> agents relax around Villa rooms!
  if (!isWorking) {
    for (let i = 0; i < snapshot.agents.length; i++) {
      const ag = snapshot.agents[i];
      if (ag.status === 'working') {
        const chillTarget = LEISURE_ROOMS[i % LEISURE_ROOMS.length];
        storage.updateAgent(ag.id, (a) => {
          a.currentRoom = chillTarget;
          a.status = 'idle';
          a.statusText = 'Di luar jam kerja (09:00-17:00) — Santai di Villa';
        });
      }
    }
    return;
  }

  // 1. Auto-trigger daily scheduled workflows (if enabled)
  for (const wf of snapshot.workflows) {
    if (wf.autoRunDaily && wf.scheduleTime && wf.lastAutoRunDate !== today) {
      if (nowMinutes >= timeToMinutes(wf.scheduleTime)) {
        wf.lastAutoRunDate = today;
        storage.upsertWorkflow(wf);
        void startWorkflowRun(wf.id, 'Eksekusi terjadwal otomatis pagi hari (09:00-17:00).');
      }
    }
  }

  // 2. Sync agent room positions to their 09:00-17:00 jobdesk slots (unless busy in an approval/collab)
  if (snapshot.config.workHours.autoRunRoutines) {
    for (const ag of snapshot.agents) {
      if (ag.status === 'waiting_user' || ag.status === 'late_report') continue;

      // Find the most recent jobdesk slot for the current time
      const sortedSlots = [...ag.jobdesks].sort(
        (a, b) => timeToMinutes(a.time) - timeToMinutes(b.time)
      );
      let activeSlot = sortedSlots[0];
      for (const slot of sortedSlots) {
        if (nowMinutes >= timeToMinutes(slot.time)) {
          activeSlot = slot;
        }
      }

      if (activeSlot) {
        const isBreakRoom = LEISURE_ROOMS.includes(activeSlot.room);
        const desiredStatus = isBreakRoom ? 'break' : 'working';
        if (ag.currentRoom !== activeSlot.room && ag.status !== 'collaborating') {
          storage.updateAgent(ag.id, (a) => {
            a.currentRoom = activeSlot.room;
            a.status = desiredStatus;
            a.statusText = `${activeSlot.time} — ${activeSlot.title}`;
          });
        }
      }
    }
  }

  // 3. WATCHDOG A: Check if any Agent missed their daily report deadline -> Peer notifies Head DM!
  for (const ag of snapshot.agents) {
    const deadlineMins = timeToMinutes(ag.reportDeadlineTime || '16:15');
    const alertKey = `${today}:${ag.id}`;
    if (
      nowMinutes >= deadlineMins &&
      ag.dailyReportSubmittedDate !== today &&
      ag.dailyReportSkippedDate !== today &&
      !alertedLateAgentsToday.has(alertKey)
    ) {
      alertedLateAgentsToday.add(alertKey);
      triggerAgentMissingReportAlert(ag.id);
    }
  }

  // 4. WATCHDOG B: Check if Head DM hasn't submitted Daily Brief/Report by userBriefReminderTime -> Agent notifies User!
  const briefReminderMins = timeToMinutes(snapshot.config.workHours.userBriefReminderTime || '10:30');
  if (
    nowMinutes >= briefReminderMins &&
    snapshot.config.workHours.userDailyBriefSubmittedDate !== today &&
    lastUserBriefAlertDate !== today
  ) {
    lastUserBriefAlertDate = today;
    triggerUserMissingReportAlert();
  }

  // 5. WATCHDOG C: Follow-up reminder if a Workflow is waiting on Head DM Approval past SLA minutes!
  const defaultSla = snapshot.config.workHours.approvalReminderMinutes || 10;
  for (const run of snapshot.workflowRuns) {
    if (run.status !== 'waiting_approval') continue;
    const wf = snapshot.workflows.find((w) => w.id === run.workflowId);
    const step = wf?.steps[run.currentStepIndex];
    const sr = run.stepResults[run.currentStepIndex];
    if (!step || !sr) continue;

    const slaMins = step.slaMinutes || defaultSla;
    const lastPing = sr.lastRemindedAt ? new Date(sr.lastRemindedAt).getTime() : 0;
    if (Date.now() - lastPing >= slaMins * 60 * 1000) {
      sr.lastRemindedAt = new Date().toISOString();
      storage.upsertWorkflowRun(run);

      const waiterId = step.agentIds[0] || 'social-media';
      const waiter = storage.getAgent(waiterId);

      const rem: ReminderItem = {
        id: `rem-sla-${Date.now()}`,
        direction: 'user_pending_approval',
        severity: 'warning',
        fromAgentId: waiterId,
        targetAgentId: null,
        workflowRunId: run.id,
        title: `Follow-Up Approval: ${step.title}`,
        message: `Halo Bos! ${waiter?.name || 'Tim'} sudah menunggu ${slaMins} menit untuk approval "${wf?.name}". Klik OK atau Revisi supaya tim kreatif bisa jalan.`,
        createdAt: new Date().toISOString(),
        acknowledged: false,
      };
      storage.addReminder(rem);

      if (snapshot.config.villa.windowsToastEnabled) {
        sendWindowsDesktopNotification(rem.title, rem.message);
      }
    }
  }
}

export function triggerAgentMissingReportAlert(targetAgentId: string): ReminderItem | null {
  const target = storage.getAgent(targetAgentId);
  if (!target) return null;

  // Pick a peer agent (e.g. Campaign Specialist Bima or Research Arka) to alert Head DM!
  const watcherId = target.id === 'campaign' ? 'research' : 'campaign';
  const watcher = storage.getAgent(watcherId) || target;

  storage.updateAgent(target.id, (a) => {
    a.status = 'late_report';
    a.statusText = `⚠️ Belum submit laporan harian (jadwal ${a.reportDeadlineTime})`;
    a.speechBubble = 'Waduh, saya belum kirim daily report ke Bos! Segera saya susun!';
    a.speechTimestamp = Date.now();
  });

  storage.updateAgent(watcher.id, (a) => {
    a.speechBubble = `Bos, ${target.name} (${target.role}) belum submit report nih!`;
    a.speechTimestamp = Date.now();
  });

  const reminder: ReminderItem = {
    id: `rem-agent-late-${Date.now()}`,
    direction: 'agent_missing_report',
    severity: 'warning',
    fromAgentId: watcher.id,
    targetAgentId: target.id,
    workflowRunId: null,
    title: `Agent Belum Report: ${target.name} (${target.role})`,
    message: `Laporan dari ${watcher.name}: "${target.name} (${target.role}) belum mengirimkan report sesuai jadwal ${target.reportDeadlineTime}. Klik 'Tagih Report Sekarang' agar langsung dikerjakan!"`,
    createdAt: new Date().toISOString(),
    acknowledged: false,
  };

  storage.addReminder(reminder);

  if (storage.getSnapshot().config.villa.windowsToastEnabled) {
    sendWindowsDesktopNotification(reminder.title, reminder.message);
  }

  return reminder;
}

export function triggerUserMissingReportAlert(): ReminderItem {
  const lead = storage.getAgent('research') || storage.getAgents()[0];

  if (lead) {
    storage.updateAgent(lead.id, (a) => {
      a.currentRoom = 'head_suite';
      a.status = 'waiting_user';
      a.statusText = 'Menunggu Daily Brief / Feedback dari Head DM';
      a.speechBubble = 'Bos! Hari ini belum ada update/brief dari Head DM nih 👋';
      a.speechTimestamp = Date.now();
    });
  }

  const reminder: ReminderItem = {
    id: `rem-user-brief-${Date.now()}`,
    direction: 'user_missing_report',
    severity: 'urgent',
    fromAgentId: lead?.id || 'research',
    targetAgentId: null,
    workflowRunId: null,
    title: 'Tim Menunggu Update / Arahan Head DM Hari Ini!',
    message: `${lead?.name || 'Tim Spesialis'} mengingatkan: Anda belum mengirim Daily Brief / Feedback untuk tim hari ini. Kirim arahan singkat agar ke-11 spesialis selaras!`,
    createdAt: new Date().toISOString(),
    acknowledged: false,
  };

  storage.addReminder(reminder);

  if (storage.getSnapshot().config.villa.windowsToastEnabled) {
    sendWindowsDesktopNotification(reminder.title, reminder.message);
  }

  return reminder;
}

export async function forceAgentSubmitReportNow(agentId: string): Promise<void> {
  const agent = storage.getAgent(agentId);
  if (!agent) throw new Error('Agent tidak ditemukan.');

  storage.updateAgent(agent.id, (a) => {
    a.currentRoom = 'office';
    a.status = 'working';
    a.deskFocusUntil = Date.now() + 95_000;
    a.statusText = '🔍 Berjalan ke meja kerja & menyusun Daily Report...';
    a.speechBubble = 'Sebentar Bos, saya ke meja kerja dulu buat nyusun laporan harian! 💻📊';
    a.speechTimestamp = Date.now();
  });

  const startedAt = Date.now();
  const jobdeskSummary = agent.jobdesks.map((j) => `- [${j.time}] ${j.title}`).join('\n');
  const gen = await generateAgentResponse({
    agent,
    userPrompt: `Susun Daily Progress & KPI Report lengkap hari ini untuk dilaporkan ke Head of Digital Marketing berdasarkan jobdesk harianmu:\n${jobdeskSummary}\nSertakan capaian utama, rekomendasi eksekusi esok hari, dan hal yang membutuhkan keputusan Head DM.`,
  });

  const elapsed = Date.now() - startedAt;
  if (elapsed < 2200) {
    await new Promise((r) => setTimeout(r, 2200 - elapsed));
  }

  const savedPath = saveAgentReportToDisk(
    HERMES_WORKSPACE_DIR,
    agent.id,
    `Daily Report - ${agent.name} (${agent.role})`,
    gen.content
  );

  const today = getTodayStr();
  storage.updateAgent(agent.id, (a) => {
    a.lastReportAt = new Date().toISOString();
    a.dailyReportSubmittedDate = today;
    a.currentRoom = 'office';
    a.status = 'working';
    a.deskFocusUntil = Date.now() + 45_000;
    a.statusText = 'Daily Report hari ini sudah terkirim ✅';
    a.speechBubble = 'Laporan harian sudah terkirim ke Inbox Head DM!';
    a.speechTimestamp = Date.now();
  });

  // Acknowledge missing report reminders for this agent
  for (const r of storage.getSnapshot().reminders) {
    if (r.targetAgentId === agent.id && !r.acknowledged) {
      storage.acknowledgeReminder(r.id);
    }
  }

  storage.addMessage({
    id: `msg-rep-${Date.now()}`,
    senderType: 'agent',
    senderId: agent.id,
    senderName: agent.name,
    senderRole: agent.role,
    recipientId: 'head-dm',
    channel: 'report',
    content: gen.content,
    timestamp: new Date().toISOString(),
    savedFilePath: savedPath,
    engineUsed: gen.engineUsed,
  });
}

export function skipAgentReportToday(agentId: string): void {
  const agent = storage.getAgent(agentId);
  if (!agent) throw new Error('Agent tidak ditemukan.');

  const today = getTodayStr();
  alertedLateAgentsToday.add(`${today}:${agent.id}`);

  storage.updateAgent(agent.id, (a) => {
    a.dailyReportSkippedDate = today;
    a.dailyReportSubmittedDate = today;
    if (a.status === 'late_report') {
      a.status = 'working';
    }
    a.statusText = '⏭️ Laporan harian di-skip hari ini oleh Head DM';
    a.speechBubble = 'Siap Bos! Laporan harian saya hari ini di-skip, lanjut fokus tugas lainnya 👍';
    a.speechTimestamp = Date.now();
  });

  for (const r of storage.getSnapshot().reminders) {
    if (r.targetAgentId === agent.id && !r.acknowledged) {
      storage.acknowledgeReminder(r.id);
    }
  }
}

export function skipAllAgentsReportToday(): number {
  const today = getTodayStr();
  const agents = storage.getAgents();
  let count = 0;

  for (const ag of agents) {
    if (ag.dailyReportSubmittedDate !== today || ag.status === 'late_report') {
      alertedLateAgentsToday.add(`${today}:${ag.id}`);
      storage.updateAgent(ag.id, (a) => {
        a.dailyReportSkippedDate = today;
        a.dailyReportSubmittedDate = today;
        if (a.status === 'late_report') {
          a.status = 'working';
        }
        a.statusText = '⏭️ Laporan harian di-skip hari ini oleh Head DM';
        a.speechBubble = 'Siap Bos, laporan harian hari ini di-skip!';
        a.speechTimestamp = Date.now();
      });
      count += 1;
    }
  }

  for (const r of storage.getSnapshot().reminders) {
    if (r.direction === 'agent_missing_report' && !r.acknowledged) {
      storage.acknowledgeReminder(r.id);
    }
  }

  return count;
}
