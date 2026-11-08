import fs from 'node:fs';
import path from 'node:path';
import { Response } from 'express';
import {
  AgentProfile,
  AppConfig,
  AppStateSnapshot,
  CommsMessage,
  PinnedIdeaItem,
  ReminderItem,
  WorkflowDefinition,
  WorkflowRun,
} from '../types.ts';
import {
  DEFAULT_CONFIG,
  DEFAULT_SPECIALISTS,
  DEFAULT_WORKFLOWS,
} from '../defaults/specialists.ts';

const ROOT_DIR = process.cwd();
export const DATA_DIR = path.join(ROOT_DIR, 'data');
export const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
export const HERMES_WORKSPACE_DIR = path.join(ROOT_DIR, 'hermes_workspace');

const STATE_FILE = path.join(DATA_DIR, 'state.json');
const SECRET_FILE = path.join(DATA_DIR, 'config.secret.json');

interface PersistedState {
  config: AppConfig;
  agents: AgentProfile[];
  workflows: WorkflowDefinition[];
  workflowRuns: WorkflowRun[];
  reminders: ReminderItem[];
  messages: CommsMessage[];
  pinnedIdeas: PinnedIdeaItem[];
}

class StorageManager {
  private state: PersistedState;
  private sseClients = new Set<Response>();
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private broadcastTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    fs.mkdirSync(HERMES_WORKSPACE_DIR, { recursive: true });

    this.state = this.loadInitialState();
    this.syncAllAgentsMarkdownToDisk();

    process.on('exit', () => {
      if (this.saveTimer) {
        clearTimeout(this.saveTimer);
        this.saveTimer = null;
        this.flushSaveToDisk();
      }
    });
  }

  private writeFileIfChanged(filePath: string, content: string): void {
    try {
      if (fs.existsSync(filePath)) {
        const existing = fs.readFileSync(filePath, 'utf-8');
        if (existing === content) return;
      }
      fs.writeFileSync(filePath, content, 'utf-8');
    } catch {
      // ignore write errors
    }
  }

  private loadInitialState(): PersistedState {
    let loaded: Partial<PersistedState> = {};
    if (fs.existsSync(STATE_FILE)) {
      try {
        loaded = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
      } catch {
        loaded = {};
      }
    }

    let apiKey = '';
    if (fs.existsSync(SECRET_FILE)) {
      try {
        const secretJson = JSON.parse(fs.readFileSync(SECRET_FILE, 'utf-8'));
        apiKey = secretJson.apiKey || '';
      } catch {
        apiKey = '';
      }
    }

    const config: AppConfig = {
      ...DEFAULT_CONFIG,
      ...(loaded.config || {}),
      provider: {
        ...DEFAULT_CONFIG.provider,
        ...(loaded.config?.provider || {}),
        apiKey: apiKey || loaded.config?.provider?.apiKey || '',
      },
      workHours: {
        ...DEFAULT_CONFIG.workHours,
        ...(loaded.config?.workHours || {}),
      },
      villa: {
        ...DEFAULT_CONFIG.villa,
        ...(loaded.config?.villa || {}),
      },
      activeProductFocus: {
        ...(DEFAULT_CONFIG.activeProductFocus || {
          enabled: false,
          productName: '',
          promoOffer: '',
          usp: '',
          targetAudience: '',
          ctaLink: '',
          extraNotes: '',
          updatedAt: null,
        }),
        ...(loaded.config?.activeProductFocus || {}),
      },
    };

    const agents =
      loaded.agents && loaded.agents.length > 0
        ? loaded.agents
        : structuredClone(DEFAULT_SPECIALISTS);

    // Hydrate markdown docs from disk if user edited .md files directly in hermes_workspace!
    const globalUserPath = path.join(HERMES_WORKSPACE_DIR, 'USER.md');
    if (fs.existsSync(globalUserPath)) {
      try {
        config.globalUserMd = fs.readFileSync(globalUserPath, 'utf-8');
      } catch {
        // ignore
      }
    }

    for (const agent of agents) {
      const agentDir = path.join(HERMES_WORKSPACE_DIR, 'agents', agent.id);
      const readDocIfPresent = (filename: string, fallback: string) => {
        const p = path.join(agentDir, filename);
        if (fs.existsSync(p)) {
          try {
            return fs.readFileSync(p, 'utf-8');
          } catch {
            return fallback;
          }
        }
        return fallback;
      };
      agent.docs = {
        soulMd: readDocIfPresent('SOUL.md', agent.docs.soulMd),
        toolsMd: readDocIfPresent('TOOLS.md', agent.docs.toolsMd),
        userMd: readDocIfPresent('USER.md', agent.docs.userMd),
        agentsMd: readDocIfPresent('AGENTS.md', agent.docs.agentsMd),
      };
    }

    const workflows =
      loaded.workflows && loaded.workflows.length > 0
        ? loaded.workflows
        : structuredClone(DEFAULT_WORKFLOWS);

    const welcomeMessages: CommsMessage[] = [
      {
        id: 'msg-welcome-1',
        senderType: 'system',
        senderId: 'hq-system',
        senderName: 'Villa HQ System',
        senderRole: 'Coordinator',
        recipientId: 'all',
        channel: 'team',
        content:
          'Selamat datang di Digital Marketing Villa HQ! Ke-11 Spesialis AI Agent siap bekerja sesuai jadwal 09:00 - 17:00 WIB. File SOUL.md, TOOLS.md, USER.md, dan AGENTS.md telah tersinkronisasi di folder hermes_workspace/.',
        timestamp: new Date().toISOString(),
      },
      {
        id: 'msg-welcome-2',
        senderType: 'agent',
        senderId: 'research',
        senderName: 'Arka',
        senderRole: 'Analisis dan Riset Spesialist',
        recipientId: 'head-dm',
        channel: 'team',
        content:
          'Pagi Bos! Kapan pun siap, kita bisa langsung jalankan workflow "Morning Research -> Sosmed Eval -> Approval -> Design & Content" dari panel Workflow Studio.',
        timestamp: new Date().toISOString(),
      },
    ];

    const rawMessages =
      loaded.messages && loaded.messages.length > 0 ? loaded.messages : welcomeMessages;
    // Remove automated late-report reminder spam so real user/agent chat history is never buried
    const cleanedMessages = rawMessages.filter(
      (m) => !m.id.startsWith('msg-late-') && !m.id.startsWith('msg-user-rem-')
    );

    return {
      config,
      agents,
      workflows,
      workflowRuns: loaded.workflowRuns || [],
      reminders: loaded.reminders || [],
      messages: cleanedMessages.length > 0 ? cleanedMessages.slice(-1000) : welcomeMessages,
      pinnedIdeas: loaded.pinnedIdeas || [],
    };
  }

  public isWorkingHoursNow(): boolean {
    const { startHour, endHour, forceActiveOutsideHours } = this.state.config.workHours;
    if (forceActiveOutsideHours) return true;
    const hour = new Date().getHours();
    return hour >= startHour && hour < endHour;
  }

  public getSnapshot(): AppStateSnapshot {
    // Re-check disk markdown edits softly? Keep fast in-memory, provide explicit reload endpoint too
    return {
      config: this.state.config,
      agents: this.state.agents,
      workflows: this.state.workflows,
      workflowRuns: this.state.workflowRuns,
      reminders: this.state.reminders,
      messages: this.state.messages,
      pinnedIdeas: this.state.pinnedIdeas,
      isWorkingHoursNow: this.isWorkingHoursNow(),
      serverTime: new Date().toISOString(),
    };
  }

  private flushSaveToDisk(): void {
    const { apiKey, ...providerWithoutKey } = this.state.config.provider;
    const safeToPersist: PersistedState = {
      ...this.state,
      config: {
        ...this.state.config,
        provider: {
          ...providerWithoutKey,
          apiKey: '', // stored separately in config.secret.json
        },
      },
      messages: this.state.messages.slice(-1000),
      workflowRuns: this.state.workflowRuns.slice(-40),
      reminders: this.state.reminders.slice(-100),
    };

    this.writeFileIfChanged(STATE_FILE, JSON.stringify(safeToPersist, null, 2));
    this.writeFileIfChanged(SECRET_FILE, JSON.stringify({ apiKey }, null, 2));
    this.syncChatHistoryArchiveToDisk();
  }

  public syncChatHistoryArchiveToDisk(): void {
    try {
      const meaningful = this.state.messages.filter(
        (m) =>
          !m.id.startsWith('msg-late-') &&
          !m.id.startsWith('msg-user-rem-') &&
          !m.id.startsWith('msg-welcome-')
      );
      if (meaningful.length === 0) return;

      for (const agent of this.state.agents) {
        const agentMsgs = meaningful
          .filter(
            (m) =>
              m.senderId === agent.id ||
              m.recipientId === agent.id ||
              (Array.isArray(m.relatedAgentIds) && m.relatedAgentIds.includes(agent.id)) ||
              (m.channel === 'team' && m.senderType === 'user')
          )
          .slice(-60);

        if (agentMsgs.length === 0) continue;

        const reportsDir = path.join(HERMES_WORKSPACE_DIR, 'agents', agent.id, 'reports');
        fs.mkdirSync(reportsDir, { recursive: true });
        const archivePath = path.join(reportsDir, 'Riwayat_Diskusi_Chat_Konten.md');

        const lines = [
          `# 💬 Arsip Riwayat Percakapan & Diskusi Konten — ${agent.name} (${agent.role})`,
          `_File ini disinkronkan otomatis dari riwayat chat Bos & Tim agar ${agent.name} selalu mengingat ide konten, judul, dan revisi yang pernah dibahas._\n`,
          ...agentMsgs.map((m) => {
            const dt = new Date(m.timestamp).toLocaleString('id-ID');
            const who = m.senderType === 'user' ? '👔 **Bos (Head of DM)**' : `🤖 **${m.senderName}**`;
            return `### [${dt}] ${who}\n${m.content.trim()}\n`;
          }),
        ];

        this.writeFileIfChanged(archivePath, lines.join('\n---\n'));
      }
    } catch {
      // ignore archive write error
    }
  }

  public save(): void {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      this.flushSaveToDisk();
    }, 250);
  }

  public syncAgentMarkdownToDisk(agent: AgentProfile): string {
    const agentDir = path.join(HERMES_WORKSPACE_DIR, 'agents', agent.id);
    const reportsDir = path.join(agentDir, 'reports');
    fs.mkdirSync(reportsDir, { recursive: true });

    this.writeFileIfChanged(path.join(agentDir, 'SOUL.md'), agent.docs.soulMd);
    this.writeFileIfChanged(path.join(agentDir, 'TOOLS.md'), agent.docs.toolsMd);
    this.writeFileIfChanged(path.join(agentDir, 'USER.md'), agent.docs.userMd);
    this.writeFileIfChanged(path.join(agentDir, 'AGENTS.md'), agent.docs.agentsMd);
    return agentDir;
  }

  public syncAllAgentsMarkdownToDisk(): void {
    fs.mkdirSync(HERMES_WORKSPACE_DIR, { recursive: true });
    this.writeFileIfChanged(
      path.join(HERMES_WORKSPACE_DIR, 'USER.md'),
      this.state.config.globalUserMd
    );
    for (const agent of this.state.agents) {
      this.syncAgentMarkdownToDisk(agent);
    }
    this.syncChatHistoryArchiveToDisk();
  }

  public reloadMarkdownFromDisk(): void {
    const globalUserPath = path.join(HERMES_WORKSPACE_DIR, 'USER.md');
    if (fs.existsSync(globalUserPath)) {
      this.state.config.globalUserMd = fs.readFileSync(globalUserPath, 'utf-8');
    }
    for (const agent of this.state.agents) {
      const agentDir = path.join(HERMES_WORKSPACE_DIR, 'agents', agent.id);
      for (const [file, key] of [
        ['SOUL.md', 'soulMd'],
        ['TOOLS.md', 'toolsMd'],
        ['USER.md', 'userMd'],
        ['AGENTS.md', 'agentsMd'],
      ] as const) {
        const p = path.join(agentDir, file);
        if (fs.existsSync(p)) {
          agent.docs[key] = fs.readFileSync(p, 'utf-8');
        }
      }
    }
    this.save();
    this.broadcast('state_updated', this.getSnapshot());
  }

  public getAgentWorkspaceDir(agentId: string): string {
    return path.join(HERMES_WORKSPACE_DIR, 'agents', agentId);
  }

  // --- Mutators ---

  public updateConfig(partial: Partial<AppConfig>): AppConfig {
    if (partial.provider) {
      this.state.config.provider = { ...this.state.config.provider, ...partial.provider };
    }
    if (partial.workHours) {
      this.state.config.workHours = { ...this.state.config.workHours, ...partial.workHours };
    }
    if (partial.villa) {
      this.state.config.villa = { ...this.state.config.villa, ...partial.villa };
    }
    if (partial.activeProductFocus) {
      this.state.config.activeProductFocus = {
        ...(this.state.config.activeProductFocus || {
          enabled: false,
          productName: '',
          promoOffer: '',
          usp: '',
          targetAudience: '',
          ctaLink: '',
          extraNotes: '',
          updatedAt: null,
        }),
        ...partial.activeProductFocus,
        updatedAt: new Date().toISOString(),
      };
    }
    if (typeof partial.globalUserMd === 'string') {
      this.state.config.globalUserMd = partial.globalUserMd;
      fs.writeFileSync(
        path.join(HERMES_WORKSPACE_DIR, 'USER.md'),
        partial.globalUserMd,
        'utf-8'
      );
    }
    this.save();
    this.broadcast('state_updated', this.getSnapshot());
    return this.state.config;
  }

  public getAgents(): AgentProfile[] {
    return this.state.agents;
  }

  public getAgent(id: string): AgentProfile | undefined {
    return this.state.agents.find((a) => a.id === id);
  }

  public updateAgent(id: string, updater: (agent: AgentProfile) => void, syncDisk = false): AgentProfile | undefined {
    const agent = this.getAgent(id);
    if (!agent) return undefined;
    updater(agent);
    if (syncDisk) {
      this.syncAgentMarkdownToDisk(agent);
    }
    this.save();
    this.broadcast('state_updated', this.getSnapshot());
    return agent;
  }

  public addAgent(agent: AgentProfile): AgentProfile {
    this.state.agents.push(agent);
    this.syncAgentMarkdownToDisk(agent);
    this.save();
    this.broadcast('state_updated', this.getSnapshot());
    return agent;
  }

  public deleteAgent(id: string): boolean {
    const idx = this.state.agents.findIndex((a) => a.id === id);
    if (idx === -1) return false;
    this.state.agents.splice(idx, 1);
    this.save();
    this.broadcast('state_updated', this.getSnapshot());
    return true;
  }

  public addMessage(msg: CommsMessage): CommsMessage {
    this.state.messages.push(msg);
    if (this.state.messages.length > 1000) {
      this.state.messages = this.state.messages.slice(-1000);
    }
    this.save();
    this.broadcast('message_added', msg);
    this.broadcast('state_updated', this.getSnapshot());
    return msg;
  }

  public addReminder(reminder: ReminderItem): ReminderItem {
    this.state.reminders.unshift(reminder);
    if (this.state.reminders.length > 100) {
      this.state.reminders = this.state.reminders.slice(0, 100);
    }
    this.save();
    this.broadcast('reminder_triggered', reminder);
    this.broadcast('state_updated', this.getSnapshot());
    return reminder;
  }

  public acknowledgeReminder(id: string): boolean {
    const r = this.state.reminders.find((item) => item.id === id);
    if (!r) return false;
    r.acknowledged = true;
    this.save();
    this.broadcast('state_updated', this.getSnapshot());
    return true;
  }

  public acknowledgeAllReminders(): void {
    for (const r of this.state.reminders) {
      r.acknowledged = true;
    }
    this.save();
    this.broadcast('state_updated', this.getSnapshot());
  }

  public getPinnedIdeas(): PinnedIdeaItem[] {
    return this.state.pinnedIdeas;
  }

  public addPinnedIdea(idea: PinnedIdeaItem): PinnedIdeaItem {
    this.state.pinnedIdeas.unshift(idea);
    if (this.state.pinnedIdeas.length > 200) {
      this.state.pinnedIdeas = this.state.pinnedIdeas.slice(0, 200);
    }
    this.save();
    this.broadcast('state_updated', this.getSnapshot());
    return idea;
  }

  public deletePinnedIdea(id: string): boolean {
    const idx = this.state.pinnedIdeas.findIndex((p) => p.id === id);
    if (idx === -1) return false;
    this.state.pinnedIdeas.splice(idx, 1);
    this.save();
    this.broadcast('state_updated', this.getSnapshot());
    return true;
  }

  public getWorkflows(): WorkflowDefinition[] {
    return this.state.workflows;
  }

  public upsertWorkflow(wf: WorkflowDefinition): WorkflowDefinition {
    const idx = this.state.workflows.findIndex((w) => w.id === wf.id);
    if (idx >= 0) {
      this.state.workflows[idx] = wf;
    } else {
      this.state.workflows.push(wf);
    }
    this.save();
    this.broadcast('state_updated', this.getSnapshot());
    return wf;
  }

  public deleteWorkflow(id: string): boolean {
    const idx = this.state.workflows.findIndex((w) => w.id === id);
    if (idx === -1) return false;
    this.state.workflows.splice(idx, 1);
    this.save();
    this.broadcast('state_updated', this.getSnapshot());
    return true;
  }

  public getWorkflowRuns(): WorkflowRun[] {
    return this.state.workflowRuns;
  }

  public getWorkflowRun(runId: string): WorkflowRun | undefined {
    return this.state.workflowRuns.find((r) => r.id === runId);
  }

  public upsertWorkflowRun(run: WorkflowRun): WorkflowRun {
    const idx = this.state.workflowRuns.findIndex((r) => r.id === run.id);
    if (idx >= 0) {
      this.state.workflowRuns[idx] = run;
    } else {
      this.state.workflowRuns.unshift(run);
    }
    this.save();
    this.broadcast('state_updated', this.getSnapshot());
    return run;
  }

  // --- SSE Real-time Event Stream ---
  public addSseClient(res: Response): void {
    this.sseClients.add(res);
  }

  public removeSseClient(res: Response): void {
    this.sseClients.delete(res);
  }

  public broadcast(event: string, payload: unknown): void {
    if (this.sseClients.size === 0) return;

    if (event === 'state_updated') {
      if (this.broadcastTimer) return;
      this.broadcastTimer = setTimeout(() => {
        this.broadcastTimer = null;
        if (this.sseClients.size === 0) return;
        const fresh = `event: state_updated\ndata: ${JSON.stringify(this.getSnapshot())}\n\n`;
        for (const client of this.sseClients) {
          try {
            client.write(fresh);
          } catch {
            this.sseClients.delete(client);
          }
        }
      }, 60);
      return;
    }

    const serialized = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
    for (const client of this.sseClients) {
      try {
        client.write(serialized);
      } catch {
        this.sseClients.delete(client);
      }
    }
  }
}

export const storage = new StorageManager();
