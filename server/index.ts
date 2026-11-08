import cors from 'cors';
import express from 'express';
import multer from 'multer';
import fs from 'node:fs';
import path from 'node:path';
import {
  inspectConnectedPaths,
  openWindowsPathPicker,
  saveAgentReportToDisk,
} from './services/fileConnector.ts';
import { fetchProviderModels, generateAgentResponse } from './services/llmEngine.ts';
import {
  forceAgentSubmitReportNow,
  skipAgentReportToday,
  skipAllAgentsReportToday,
  startSchedulerAndWatchdog,
  triggerAgentMissingReportAlert,
  triggerUserMissingReportAlert,
} from './services/schedulerWatchdog.ts';
import {
  connectAndSyncNotionCalendar,
  disconnectNotionCalendar,
  getNotionCalendarState,
  processNadiaNotionAutoInputInReply,
} from './services/notionEngine.ts';
import {
  captureSocialBrowserSnapshot,
  closeSocialBrowserSession,
  ensureFreshSocialBrowserSnapshot,
  getExtensionSyncSignal,
  getSocialBrowserStatus,
  ingestExternalTabSnapshot,
  launchOrOpenSocialTab,
} from './services/socialBrowserEngine.ts';
import {
  HERMES_WORKSPACE_DIR,
  storage,
  UPLOADS_DIR,
} from './services/storage.ts';
import { executeMultiAgentCommand } from './services/teamRelayEngine.ts';
import {
  handleHeadApprovalDecision,
  retryWorkflowStep,
  skipWorkflowStep,
  startWorkflowRun,
} from './services/workflowEngine.ts';
import { AgentProfile, PinnedIdeaItem, WorkflowDefinition } from './types.ts';

const app = express();
const PORT = Number(process.env.PORT || 3001);

app.use(cors());
app.use(express.json({ limit: '25mb' }));
app.use('/uploads', express.static(UPLOADS_DIR));

// Configure Multer for 3D character models (.glb, .gltf, .vrm)
const uploadStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    cb(null, UPLOADS_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.glb';
    const base = path
      .basename(file.originalname, ext)
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 40);
    cb(null, `${Date.now()}_${base}${ext}`);
  },
});

const upload = multer({
  storage: uploadStorage,
  limits: { fileSize: 50 * 1024 * 1024 }, // up to 50MB .glb/.vrm
});

// --- SSE Real-time Stream ---
app.get('/api/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  res.write(`event: connected\ndata: ${JSON.stringify({ ok: true })}\n\n`);
  storage.addSseClient(res);

  req.on('close', () => {
    storage.removeSseClient(res);
  });
});

// --- Full Snapshot ---
app.get('/api/state', (_req, res) => {
  res.json(storage.getSnapshot());
});

// --- Config & Provider ---
app.put('/api/config', (req, res) => {
  const updated = storage.updateConfig(req.body || {});
  res.json({ ok: true, config: updated });
});

app.post('/api/provider/models', async (req, res) => {
  const { baseUrl, apiKey } = req.body || {};
  const result = await fetchProviderModels(baseUrl, apiKey);
  res.json(result);
});

app.post('/api/provider/test', async (req, res) => {
  const { baseUrl, apiKey, model } = req.body || {};
  const cleanUrl = (baseUrl || storage.getSnapshot().config.provider.baseUrl)
    .trim()
    .replace(/\/+$/, '');
  const key = (apiKey ?? storage.getSnapshot().config.provider.apiKey).trim();
  const isLocalGateway =
    cleanUrl.includes('localhost') || cleanUrl.includes('127.0.0.1');
  const isMuse = cleanUrl.includes('meta.ai') || cleanUrl.includes('muse');
  const targetModel = (
    model ||
    storage.getSnapshot().config.provider.defaultModel ||
    (isMuse ? 'muse-spark-1.3' : 'gpt-4o-mini')
  ).trim();

  if (!key && !isLocalGateway) {
    res.json({
      ok: false,
      message: 'API Key masih kosong. Masukkan API Key Muse AI / Provider terlebih dahulu untuk test koneksi live.',
    });
    return;
  }

  try {
    const response = await fetch(`${cleanUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key || '9router-local'}`,
      },
      body: JSON.stringify({
        model: targetModel,
        messages: [
          {
            role: 'user',
            content: 'Balas singkat 1 kalimat Bahasa Indonesia bahwa koneksi Digital Marketing Villa HQ berhasil.',
          },
        ],
      }),
      signal: AbortSignal.timeout(90000),
    });

    if (!response.ok) {
      const txt = await response.text();
      res.json({ ok: false, message: `HTTP ${response.status}: ${txt.slice(0, 240)}` });
      return;
    }
    const json = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const reply = json.choices?.[0]?.message?.content || 'Terhubung!';
    res.json({ ok: true, message: `Berhasil! Balasan model (${targetModel}): "${reply}"` });
  } catch (err) {
    res.json({
      ok: false,
      message: `Koneksi gagal: ${err instanceof Error ? err.message : String(err)}`,
    });
  }
});

app.post('/api/hermes/reload', (_req, res) => {
  storage.reloadMarkdownFromDisk();
  res.json({
    ok: true,
    workspacePath: HERMES_WORKSPACE_DIR,
    state: storage.getSnapshot(),
  });
});

// --- Agents CRUD & Interaction ---
app.post('/api/agents', (req, res) => {
  const body = req.body as Partial<AgentProfile>;
  const existingCount = storage.getAgents().length;
  const slug =
    (body.name || 'specialist')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') +
    '-' +
    Math.random().toString(36).slice(2, 5);

  const roleTitle = body.role || 'Digital Marketing Specialist';
  const nameTitle = body.name || 'Agent Baru';
  const globalUserMd = storage.getSnapshot().config.globalUserMd;

  const newAgent: AgentProfile = {
    id: slug,
    name: nameTitle,
    role: roleTitle,
    department: body.department || 'Custom',
    avatarEmoji: body.avatarEmoji || '✨',
    deskIndex: existingCount,
    currentRoom: body.currentRoom || 'office',
    targetAgentId: null,
    status: 'working',
    statusText: `Siap menjalankan tugas sebagai ${roleTitle}`,
    speechBubble: `Halo Bos! ${nameTitle} (${roleTitle}) siap bergabung di Villa HQ!`,
    speechTimestamp: Date.now(),
    appearance: body.appearance || {
      style: 'roblox',
      skinColor: '#f5cfa0',
      hairStyle: 'spiky',
      hairColor: '#1e293b',
      outfitType: 'hoodie',
      primaryColor: '#6366f1',
      secondaryColor: '#e2e8f0',
      accessory: 'glasses',
      expression: 'happy',
      customModelUrl: null,
      scale: 1,
    },
    jobdesks: body.jobdesks || [
      {
        id: `jd-${Date.now()}-1`,
        time: '09:00',
        title: `Riset & Perencanaan Harian (${roleTitle})`,
        description: `Menyusun prioritas kerja pagi sesuai KPI ${roleTitle}.`,
        room: 'office',
        requiresReport: false,
        completedToday: false,
        lastCompletedDate: null,
      },
      {
        id: `jd-${Date.now()}-2`,
        time: '13:00',
        title: 'Break Siang di Chill Room',
        description: 'Istirahat siang di area Villa.',
        room: 'chill_room',
        requiresReport: false,
        completedToday: false,
        lastCompletedDate: null,
      },
      {
        id: `jd-${Date.now()}-3`,
        time: '16:00',
        title: `Daily Report ${roleTitle} ke Head DM`,
        description: 'Mengirimkan rangkuman eksekusi harian ke Head of Digital Marketing.',
        room: 'office',
        requiresReport: true,
        completedToday: false,
        lastCompletedDate: null,
      },
    ],
    docs: body.docs || {
      soulMd: `# SOUL.md — ${nameTitle} (${roleTitle})\n\nKamu adalah **${nameTitle}**, **${roleTitle}** yang bekerja langsung di bawah **Head of Digital Marketing**.\nBerikan analisis tajam, kreatif, dan siap dieksekusi.\n`,
      toolsMd: `# TOOLS.md — ${roleTitle}\n\n- Gunakan file lokal yang dihubungkan sebagai referensi utama.\n- Simpan laporan penting ke folder \`reports/\`.\n`,
      userMd: globalUserMd,
      agentsMd: `# AGENTS.md — ${roleTitle}\n\n- Berkolaborasi aktif dengan 11+ spesialis lain di Villa Digital Marketing HQ.\n- Kirim pengingat sopan ke Head DM bila menunggu approval.\n`,
    },
    connectedPaths: body.connectedPaths || [],
    preferredEngine: body.preferredEngine || 'hybrid_api',
    modelOverride: body.modelOverride || '',
    lastReportAt: null,
    dailyReportSubmittedDate: null,
    reportDeadlineTime: body.reportDeadlineTime || '16:15',
  };

  const created = storage.addAgent(newAgent);
  res.json({ ok: true, agent: created });
});

app.put('/api/agents/:id', (req, res) => {
  const { id } = req.params;
  const patch = req.body as Partial<AgentProfile>;
  const shouldSyncMd = Boolean(patch.docs);

  const updated = storage.updateAgent(
    id,
    (agent) => {
      if (patch.name !== undefined) agent.name = patch.name;
      if (patch.role !== undefined) agent.role = patch.role;
      if (patch.department !== undefined) agent.department = patch.department;
      if (patch.avatarEmoji !== undefined) agent.avatarEmoji = patch.avatarEmoji;
      if (patch.currentRoom !== undefined) agent.currentRoom = patch.currentRoom;
      if (patch.status !== undefined) agent.status = patch.status;
      if (patch.statusText !== undefined) agent.statusText = patch.statusText;
      if (patch.appearance !== undefined) {
        agent.appearance = { ...agent.appearance, ...patch.appearance };
      }
      if (patch.jobdesks !== undefined) agent.jobdesks = patch.jobdesks;
      if (patch.docs !== undefined) {
        agent.docs = { ...agent.docs, ...patch.docs };
      }
      if (patch.connectedPaths !== undefined) agent.connectedPaths = patch.connectedPaths;
      if (patch.preferredEngine !== undefined) agent.preferredEngine = patch.preferredEngine;
      if (patch.modelOverride !== undefined) agent.modelOverride = patch.modelOverride;
      if (patch.reportDeadlineTime !== undefined) agent.reportDeadlineTime = patch.reportDeadlineTime;
    },
    shouldSyncMd
  );

  if (!updated) {
    res.status(404).json({ ok: false, error: 'Agent tidak ditemukan.' });
    return;
  }
  res.json({ ok: true, agent: updated });
});

app.delete('/api/agents/:id', (req, res) => {
  const ok = storage.deleteAgent(req.params.id);
  res.json({ ok });
});

app.post('/api/agents/:id/chat', async (req, res) => {
  const agent = storage.getAgent(req.params.id);
  if (!agent) {
    res.status(404).json({ ok: false, error: 'Agent tidak ditemukan.' });
    return;
  }

  const { message, forceEngine, saveAsReport } = req.body || {};
  if (!message || !String(message).trim()) {
    res.status(400).json({ ok: false, error: 'Pesan tidak boleh kosong.' });
    return;
  }

  try {
    const result = await executeMultiAgentCommand({
      userPrompt: String(message),
      originChannel: 'direct',
      defaultLeadAgentId: agent.id,
      forceEngine,
      saveAsReport: Boolean(saveAsReport),
    });

    if (saveAsReport) {
      const d = new Date();
      const todayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
        2,
        '0'
      )}-${String(d.getDate()).padStart(2, '0')}`;
      storage.updateAgent(agent.id, (a) => {
        a.lastReportAt = d.toISOString();
        a.dailyReportSubmittedDate = todayStr;
      });
    }

    res.json({
      ok: true,
      reply: result.leadReply,
      handoffReplies: result.handoffReplies,
      involvedAgentNames: result.involvedAgentNames,
    });
  } catch (err) {
    res.status(500).json({
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
});

app.post('/api/agents/:id/report-now', async (req, res) => {
  try {
    await forceAgentSubmitReportNow(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
});

app.post('/api/agents/:id/skip-report', (req, res) => {
  try {
    skipAgentReportToday(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
});

app.post('/api/agents/skip-all-reports', (_req, res) => {
  try {
    const skippedCount = skipAllAgentsReportToday();
    res.json({ ok: true, skippedCount });
  } catch (err) {
    res.status(500).json({
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
});

app.post('/api/agents/reset-models', (req, res) => {
  const modelOverride = typeof req.body?.modelOverride === 'string' ? req.body.modelOverride.trim() : '';
  for (const ag of storage.getAgents()) {
    storage.updateAgent(ag.id, (a) => {
      a.modelOverride = modelOverride;
    });
  }
  res.json({ ok: true, modelOverride });
});

app.post('/api/agents/:id/inspect-paths', (req, res) => {
  const agent = storage.getAgent(req.params.id);
  const pathsToCheck: string[] = req.body?.paths || agent?.connectedPaths || [];
  const summary = inspectConnectedPaths(pathsToCheck);
  res.json({
    ok: true,
    agentWorkspaceDir: agent ? storage.getAgentWorkspaceDir(agent.id) : HERMES_WORKSPACE_DIR,
    summary,
  });
});

// --- Head DM Multi-Agent Command / Tagging (@arka -> @nadia / @semua) / Daily Brief ---
app.post('/api/head-brief', async (req, res) => {
  const { content } = req.body || {};
  if (!content || !String(content).trim()) {
    res.status(400).json({ ok: false, error: 'Isi arahan/brief tidak boleh kosong.' });
    return;
  }

  const d = new Date();
  const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;

  storage.updateConfig({
    workHours: {
      ...storage.getSnapshot().config.workHours,
      userDailyBriefSubmittedDate: today,
    },
  });

  // Acknowledge user_missing_report reminders
  for (const r of storage.getSnapshot().reminders) {
    if (r.direction === 'user_missing_report' && !r.acknowledged) {
      storage.acknowledgeReminder(r.id);
    }
  }

  try {
    const result = await executeMultiAgentCommand({
      userPrompt: String(content),
      originChannel: 'team',
    });

    res.json({
      ok: true,
      reply: result.leadReply,
      handoffReplies: result.handoffReplies,
      involvedAgentNames: result.involvedAgentNames,
    });
  } catch (err) {
    res.status(500).json({
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
});

// --- Native File/Folder Picker & 3D Model Upload ---
app.post('/api/files/pick', async (req, res) => {
  const mode = req.body?.mode === 'file' ? 'file' : 'folder';
  const selectedPath = await openWindowsPathPicker(mode);
  res.json({ ok: Boolean(selectedPath), path: selectedPath });
});

app.post('/api/upload-model', upload.single('model'), (req, res) => {
  if (!req.file) {
    res.status(400).json({ ok: false, error: 'File 3D tidak ditemukan.' });
    return;
  }
  const modelUrl = `/uploads/${req.file.filename}`;
  res.json({ ok: true, url: modelUrl, filename: req.file.filename });
});

// --- Workflows & Runs ---
app.post('/api/workflows', (req, res) => {
  const wf = req.body as WorkflowDefinition;
  if (!wf.id) {
    wf.id = `wf-custom-${Date.now()}`;
  }
  const saved = storage.upsertWorkflow(wf);
  res.json({ ok: true, workflow: saved });
});

app.put('/api/workflows/:id', (req, res) => {
  const wf = { ...(req.body as WorkflowDefinition), id: req.params.id };
  const saved = storage.upsertWorkflow(wf);
  res.json({ ok: true, workflow: saved });
});

app.delete('/api/workflows/:id', (req, res) => {
  const ok = storage.deleteWorkflow(req.params.id);
  res.json({ ok });
});

app.post('/api/workflows/:id/run', async (req, res) => {
  try {
    const topicContext = String(req.body?.topicContext || '');
    const run = await startWorkflowRun(req.params.id, topicContext);
    res.json({ ok: true, run });
  } catch (err) {
    res.status(400).json({
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
});

app.post('/api/workflow-runs/:runId/decision', async (req, res) => {
  try {
    const { approved, feedback } = req.body || {};
    const run = await handleHeadApprovalDecision({
      runId: req.params.runId,
      approved: Boolean(approved),
      feedback: feedback ? String(feedback) : undefined,
    });
    res.json({ ok: true, run });
  } catch (err) {
    res.status(400).json({
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
});

app.post('/api/workflow-runs/:runId/retry-step', async (req, res) => {
  try {
    const stepIndex =
      typeof req.body?.stepIndex === 'number' ? req.body.stepIndex : undefined;
    const run = await retryWorkflowStep(req.params.runId, stepIndex);
    res.json({ ok: true, run });
  } catch (err) {
    res.status(400).json({
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
});

app.post('/api/workflow-runs/:runId/skip-step', async (req, res) => {
  try {
    const stepIndex =
      typeof req.body?.stepIndex === 'number' ? req.body.stepIndex : undefined;
    const reason = req.body?.reason ? String(req.body.reason) : undefined;
    const run = await skipWorkflowStep(req.params.runId, stepIndex, reason);
    res.json({ ok: true, run });
  } catch (err) {
    res.status(400).json({
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
});

// --- Pinned Ideas ("Papan Ide Terbaik") ---
app.post('/api/pinned-ideas', (req, res) => {
  const { agentId, agentName, agentRole, avatarEmoji, title, content, category } = req.body || {};
  if (!content || !String(content).trim()) {
    res.status(400).json({ ok: false, error: 'Konten ide tidak boleh kosong.' });
    return;
  }
  const idea: PinnedIdeaItem = {
    id: `pin-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    agentId: String(agentId || 'research'),
    agentName: String(agentName || 'Spesialis'),
    agentRole: String(agentRole || 'Digital Marketing'),
    avatarEmoji: String(avatarEmoji || '📌'),
    title: String(title || content).slice(0, 90),
    content: String(content),
    category: String(category || 'Ide & Strategi'),
    createdAt: new Date().toISOString(),
  };
  const saved = storage.addPinnedIdea(idea);
  res.json({ ok: true, idea: saved });
});

app.delete('/api/pinned-ideas/:id', (req, res) => {
  const ok = storage.deletePinnedIdea(req.params.id);
  res.json({ ok });
});

// --- Reminders & Two-Way Simulation ---
app.post('/api/reminders/:id/ack', (req, res) => {
  const ok = storage.acknowledgeReminder(req.params.id);
  res.json({ ok });
});

app.post('/api/reminders/ack-all', (_req, res) => {
  storage.acknowledgeAllReminders();
  res.json({ ok: true });
});

app.post('/api/reminders/simulate', (req, res) => {
  const { type, targetAgentId } = req.body || {};
  if (type === 'agent_missing') {
    const chosenId = targetAgentId || 'ads';
    const rem = triggerAgentMissingReportAlert(chosenId);
    res.json({ ok: true, reminder: rem });
    return;
  }
  const rem = triggerUserMissingReportAlert();
  res.json({ ok: true, reminder: rem });
});

// --- Social Media Chrome Browser Session + Hermes Bridge (Option 3) ---
app.get('/api/social-browser/status', async (_req, res) => {
  const status = await getSocialBrowserStatus();
  res.json({ ok: true, status });
});

app.get('/api/social-browser/sync-signal', (_req, res) => {
  res.json({ ok: true, ...getExtensionSyncSignal() });
});

app.post('/api/social-browser/auto-sync', async (req, res) => {
  const force = Boolean(req.body?.force);
  const meta = await ensureFreshSocialBrowserSnapshot({ maxAgeMs: 25_000, force });
  const status = await getSocialBrowserStatus();
  res.json({
    ok: true,
    message: meta
      ? `Berhasil auto-sync ${meta.tabCount} tab medsos live (${new Date(
          meta.lastCapturedAt || Date.now()
        ).toLocaleTimeString('id-ID')})!`
      : 'Menunggu tab medsos terbuka di Chrome.',
    meta,
    status,
  });
});

app.post('/api/social-browser/launch', async (req, res) => {
  const url = req.body?.url ? String(req.body.url) : undefined;
  const result = await launchOrOpenSocialTab(url);
  res.json(result);
});

app.post('/api/social-browser/close', async (_req, res) => {
  const result = await closeSocialBrowserSession();
  res.json(result);
});

app.post('/api/social-browser/ingest-tab', async (req, res) => {
  const { url, title, headings, extractedText, screenshotDataUrl, loginWallDetected, agentId } =
    req.body || {};
  if (!url) {
    res.status(400).json({ ok: false, error: 'URL tab wajib diisi.' });
    return;
  }

  const meta = ingestExternalTabSnapshot({
    url: String(url),
    title: String(title || url),
    headings: Array.isArray(headings) ? headings.map(String) : [],
    extractedText: String(extractedText || ''),
    screenshotDataUrl: screenshotDataUrl ? String(screenshotDataUrl) : null,
    loginWallDetected: Boolean(loginWallDetected),
  });

  // Optional immediate agent analysis right from the Chrome Extension popup!
  let replyMsg = null;
  if (agentId) {
    const agent = storage.getAgent(String(agentId));
    if (agent) {
      storage.updateAgent(agent.id, (a) => {
        a.currentRoom = 'office';
        a.status = 'working';
        a.deskFocusUntil = Date.now() + 95_000;
        a.statusText = `🔍 Mengecek data tab ${title || url} di meja kerja...`;
        a.speechBubble = 'Data tab dari Chrome Bos sudah masuk, saya cek di meja kerja dulu ya! 💻🔍';
        a.speechTimestamp = Date.now();
      });

      const gen = await generateAgentResponse({
        agent,
        userPrompt: `Analisis data live dari tab browser utama Head DM berikut (${url} - ${title}). Evaluasi metrik utama, kondisi konten/akun, dan berikan 3 rekomendasi konkret hari ini.`,
      });

      const savedPath = saveAgentReportToDisk(
        HERMES_WORKSPACE_DIR,
        agent.id,
        `Live Browser Tab Audit - ${agent.name}`,
        gen.content
      );

      const now = new Date();
      storage.updateAgent(agent.id, (a) => {
        a.currentRoom = 'office';
        a.status = 'working';
        a.deskFocusUntil = Date.now() + 45_000;
        a.statusText = 'Selesai menganalisis Tab Browser Utama';
        a.speechBubble = 'Hasil audit tab medsos Bos sudah siap di Chat & Laporan! 📱✅';
        a.speechTimestamp = Date.now();
        a.lastReportAt = now.toISOString();
      });

      replyMsg = storage.addMessage({
        id: `msg-ext-${Date.now()}`,
        senderType: 'agent',
        senderId: agent.id,
        senderName: agent.name,
        senderRole: agent.role,
        recipientId: 'head-dm',
        channel: 'report',
        content: `🌐 **[Analisis Live Tab Browser Utama: ${title || url}]**\n\n${gen.content}\n\n_Disimpan ke: \`${savedPath}\`_`,
        timestamp: now.toISOString(),
      });
    }
  }

  const status = await getSocialBrowserStatus();
  res.json({
    ok: true,
    message: replyMsg
      ? `Tab berhasil dikirim & langsung dianalisis ke ruang Laporan!`
      : `Tab "${title || url}" berhasil dikirim ke memori Nadia & Tim!`,
    meta,
    reply: replyMsg,
    status,
  });
});

app.post('/api/social-browser/capture', async (req, res) => {
  const tabId = req.body?.tabId ? String(req.body.tabId) : undefined;
  const takeScreenshot = req.body?.takeScreenshot !== false;
  const result = await captureSocialBrowserSnapshot({ tabId, takeScreenshot });
  if (!result.ok) {
    const autoMeta = await ensureFreshSocialBrowserSnapshot({ force: true });
    const status = await getSocialBrowserStatus();
    if (autoMeta && autoMeta.tabs.length > 0) {
      res.json({
        ok: true,
        message: `Berhasil menyegarkan data dari ${autoMeta.tabs.length} tab medsos yang terhubung!`,
        meta: autoMeta,
        status,
      });
      return;
    }
    res.json({ ...result, status });
    return;
  }
  const status = await getSocialBrowserStatus();
  res.json({ ...result, status });
});

app.post('/api/social-browser/analyze', async (req, res) => {
  const targetAgentId = String(req.body?.agentId || 'social-media');
  const tabId = req.body?.tabId ? String(req.body.tabId) : undefined;
  const customInstruction = String(
    req.body?.customInstruction ||
      'Analisis kondisi live akun/dashboard media sosial yang baru saja ditarik dari browser. Berikan evaluasi performa, temuan utama, peluang konten/optimasi hari ini, dan rekomendasi aksi konkret untuk Head of Digital Marketing.'
  );

  const agent = storage.getAgent(targetAgentId);
  if (!agent) {
    res.status(404).json({ ok: false, error: 'Agent tidak ditemukan.' });
    return;
  }

  storage.updateAgent(agent.id, (a) => {
    a.currentRoom = 'office';
    a.status = 'working';
    a.deskFocusUntil = Date.now() + 95_000;
    a.statusText = '🔍 Menuju meja kerja & menganalisis data live Browser Medsos...';
    a.speechBubble = 'Sebentar Bos, saya ke meja kerja dulu buat bedah metrik medsos live-nya! 💻📊';
    a.speechTimestamp = Date.now();
  });

  // 1. Capture live browser snapshot via CDP 9222 OR Extension Auto-Sync
  const captureRes = await captureSocialBrowserSnapshot({ tabId, takeScreenshot: true });
  if (!captureRes.ok) {
    await ensureFreshSocialBrowserSnapshot({ force: true });
  }
  const currentStatus = await getSocialBrowserStatus();
  if (!captureRes.ok && (!currentStatus.lastSnapshot || currentStatus.lastSnapshot.tabs.length === 0)) {
    res.status(400).json({ ok: false, error: captureRes.message });
    return;
  }

  try {
    const gen = await generateAgentResponse({
      agent,
      userPrompt: customInstruction,
    });

    const savedPath = saveAgentReportToDisk(
      HERMES_WORKSPACE_DIR,
      agent.id,
      `Live Social Media Audit - ${agent.name}`,
      gen.content
    );

    const now = new Date();
    storage.updateAgent(agent.id, (a) => {
      a.currentRoom = 'office';
      a.status = 'working';
      a.deskFocusUntil = Date.now() + 45_000;
      a.statusText = 'Selesai menganalisis Browser Medsos Live';
      a.speechBubble = 'Analisis live akun medsos sudah siap di Chat & Laporan! 📱✅';
      a.speechTimestamp = Date.now();
      a.lastReportAt = now.toISOString();
      a.dailyReportSubmittedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
        2,
        '0'
      )}-${String(now.getDate()).padStart(2, '0')}`;
    });

    const replyMsg = storage.addMessage({
      id: `msg-soc-${Date.now()}`,
      senderType: 'agent',
      senderId: agent.id,
      senderName: agent.name,
      senderRole: agent.role,
      recipientId: 'head-dm',
      channel: 'report',
      content: `🌐 **[Analisis Live Browser Medsos]**\n\n${gen.content}\n\n_Disimpan ke: \`${savedPath}\`_`,
      timestamp: now.toISOString(),
    });

    const freshStatus = await getSocialBrowserStatus();
    res.json({
      ok: true,
      message: `${agent.name} selesai menganalisis tab medsos live!`,
      reply: replyMsg,
      status: freshStatus,
    });
  } catch (err) {
    res.status(500).json({
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
});

// --- Nadia's Scoped Notion Content Calendar Bridge ---
app.get('/api/notion-calendar/status', (_req, res) => {
  res.json({ ok: true, state: getNotionCalendarState() });
});

app.post('/api/notion-calendar/connect', async (req, res) => {
  const { token, databaseInput, dataSourceId, filterMode } = req.body || {};
  const result = await connectAndSyncNotionCalendar({
    token: token !== undefined ? String(token) : undefined,
    databaseInput: databaseInput !== undefined ? String(databaseInput) : undefined,
    dataSourceId: dataSourceId !== undefined ? String(dataSourceId) : undefined,
    filterMode: filterMode === 'all_rows' ? 'all_rows' : filterMode === 'content_only' ? 'content_only' : undefined,
  });
  res.json(result);
});

app.post('/api/notion-calendar/sync', async (_req, res) => {
  const result = await connectAndSyncNotionCalendar();
  res.json(result);
});

app.post('/api/notion-calendar/disconnect', (_req, res) => {
  const state = disconnectNotionCalendar();
  res.json({ ok: true, state });
});

app.post('/api/notion-calendar/generate-and-insert', async (req, res) => {
  const nadia = storage.getAgent('social-media');
  if (!nadia) {
    res.status(404).json({ ok: false, error: 'Agent Nadia (social-media) tidak ditemukan.' });
    return;
  }

  const notionState = getNotionCalendarState();
  if (!notionState.connected || notionState.properties.length === 0) {
    res.status(400).json({
      ok: false,
      error:
        'Notion Konten Kalender belum terhubung. Hubungkan Token & Link Konten Kalender terlebih dahulu di Langkah 1.',
    });
    return;
  }

  const brief = String(
    req.body?.brief ||
      'Susun ide konten media sosial berkonversi tinggi sesuai pilar konten & data performa terakhir.'
  ).trim();
  const itemCount = Math.max(1, Math.min(12, Number(req.body?.itemCount || 5)));
  const startDate = String(req.body?.startDate || new Date().toISOString().slice(0, 10)).trim();

  // Send Nadia briskly to her Office Desk to research & populate Notion!
  storage.updateAgent(nadia.id, (a) => {
    a.currentRoom = 'office';
    a.status = 'working';
    a.deskFocusUntil = Date.now() + 95_000;
    a.statusText = `🔍 Menyusun & menginput ${itemCount} konten ke Notion "${notionState.databaseTitle}"...`;
    a.speechBubble = `Siap Bos! Saya ke meja kerja dulu buat nyusun & masukin ${itemCount} konten ke Notion Kalender! 📅💻`;
    a.speechTimestamp = Date.now();
  });

  const writableSchemaSummary = notionState.properties
    .filter((p) => p.writable)
    .map(
      (p) =>
        `- "${p.name}" (tipe: ${p.type})${
          p.options.length > 0 ? ` → Pilihan resmi: [${p.options.join(', ')}]` : ''
        }`
    )
    .join('\n');

  const promptForNadia = [
    `Bos meminta kamu menyusun **${itemCount} rencana konten baru** mulai tanggal **${startDate}** dan LANGSUNG menginputnya ke Notion Konten Kalender **"${notionState.databaseTitle}"**.`,
    ``,
    `Brief / Arahan Bos:`,
    `"${brief}"`,
    ``,
    `Struktur Kolom Asli di Notion Bos yang WAJIB kamu isi persis namanya:`,
    writableSchemaSummary,
    ``,
    `Instruksi Eksekusi:`,
    `1. Buat ringkasan tabel rencana ${itemCount} konten yang rapi & nyaman dibaca untuk Bos.`,
    `2. Di bagian paling akhir, WAJIB tulis blok \`\`\`notion-input ... \`\`\` berisi JSON Array murni sejumlah ${itemCount} item lengkap dengan "properties" (sesuai persis nama kolom Notion Bos di atas; format tanggal YYYY-MM-DD berurutan mulai ${startDate}) serta "bodySections" (Hook, Visual/Script singkat, Caption & Hashtag) di dalam halamannya!`,
  ].join('\n');

  try {
    const gen = await generateAgentResponse({
      agent: nadia,
      userPrompt: promptForNadia,
    });

    const processed = await processNadiaNotionAutoInputInReply(nadia.id, gen.content);
    const savedPath = saveAgentReportToDisk(
      HERMES_WORKSPACE_DIR,
      nadia.id,
      `Notion Content Calendar Input - ${notionState.databaseTitle}`,
      processed.cleanedContent
    );

    const now = new Date();
    storage.updateAgent(nadia.id, (a) => {
      a.currentRoom = 'office';
      a.status = 'working';
      a.deskFocusUntil = Date.now() + 45_000;
      a.statusText =
        processed.createdPages.length > 0
          ? `Berhasil input ${processed.createdPages.length} konten ke Notion "${notionState.databaseTitle}" ✅`
          : 'Selesai menyusun draf Konten Kalender';
      a.speechBubble =
        processed.createdPages.length > 0
          ? `Beres Bos! ${processed.createdPages.length} konten baru sudah masuk ke Notion Konten Kalender! 📅✨`
          : 'Draf konten sudah siap di chat Bos!';
      a.speechTimestamp = Date.now();
      a.lastReportAt = now.toISOString();
    });

    const replyMsg = storage.addMessage({
      id: `msg-notion-${Date.now()}`,
      senderType: 'agent',
      senderId: nadia.id,
      senderName: nadia.name,
      senderRole: nadia.role,
      recipientId: 'head-dm',
      channel: 'direct',
      content: processed.cleanedContent,
      timestamp: now.toISOString(),
      savedFilePath: savedPath,
      engineUsed: gen.engineUsed,
    });

    res.json({
      ok: processed.createdPages.length > 0,
      message:
        processed.createdPages.length > 0
          ? `Berhasil! Nadia telah menginput ${processed.createdPages.length} konten baru ke Notion "${notionState.databaseTitle}" sesuai format kolom Anda!`
          : 'Nadia telah menyusun rencana konten di chat, namun belum ada baris yang masuk ke Notion (pastikan API Key aktif atau cek izin integrasi halaman Notion).',
      createdPages: processed.createdPages,
      reply: replyMsg,
      state: getNotionCalendarState(),
    });
  } catch (err) {
    res.status(500).json({
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
});

// Serve built frontend in production mode
const distDir = path.join(process.cwd(), 'dist');
if (process.env.NODE_ENV === 'production' && fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(distDir, 'index.html'));
  });
}

app.listen(PORT, '127.0.0.1', () => {
  console.log(`\n🏡 Digital Marketing Villa HQ Backend running on http://127.0.0.1:${PORT}`);
  console.log(`📂 Hermes Workspace synced at: ${HERMES_WORKSPACE_DIR}\n`);
  startSchedulerAndWatchdog();
});
