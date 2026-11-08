import {
  AgentProfile,
  AppConfig,
  AppStateSnapshot,
  CommsMessage,
  NotionCalendarState,
  NotionCreatedPageInfo,
  PinnedIdeaItem,
  SocialBrowserStatus,
  SocialSnapshotMeta,
  WorkflowDefinition,
  WorkflowRun,
} from '../types';

async function jsonRequest<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error || `HTTP ${res.status}`);
  }
  return data as T;
}

export const api = {
  getState: () => jsonRequest<AppStateSnapshot>('/api/state'),

  updateConfig: (partial: Partial<AppConfig>) =>
    jsonRequest<{ ok: boolean; config: AppConfig }>('/api/config', {
      method: 'PUT',
      body: JSON.stringify(partial),
    }),

  fetchModels: (baseUrl?: string, apiKey?: string) =>
    jsonRequest<{ ok: boolean; models: string[]; message: string }>('/api/provider/models', {
      method: 'POST',
      body: JSON.stringify({ baseUrl, apiKey }),
    }),

  testProvider: (baseUrl: string, apiKey: string, model: string) =>
    jsonRequest<{ ok: boolean; message: string }>('/api/provider/test', {
      method: 'POST',
      body: JSON.stringify({ baseUrl, apiKey, model }),
    }),

  reloadHermesDisk: () =>
    jsonRequest<{ ok: boolean; workspacePath: string; state: AppStateSnapshot }>(
      '/api/hermes/reload',
      { method: 'POST' }
    ),

  createAgent: (agent: Partial<AgentProfile>) =>
    jsonRequest<{ ok: boolean; agent: AgentProfile }>('/api/agents', {
      method: 'POST',
      body: JSON.stringify(agent),
    }),

  updateAgent: (id: string, patch: Partial<AgentProfile>) =>
    jsonRequest<{ ok: boolean; agent: AgentProfile }>(`/api/agents/${id}`, {
      method: 'PUT',
      body: JSON.stringify(patch),
    }),

  deleteAgent: (id: string) =>
    jsonRequest<{ ok: boolean }>(`/api/agents/${id}`, {
      method: 'DELETE',
    }),

  chatWithAgent: (
    id: string,
    message: string,
    opts?: { forceEngine?: 'hybrid_api' | 'hermes_cli'; saveAsReport?: boolean }
  ) =>
    jsonRequest<{ ok: boolean; reply: CommsMessage }>(`/api/agents/${id}/chat`, {
      method: 'POST',
      body: JSON.stringify({ message, ...opts }),
    }),

  triggerAgentReportNow: (id: string) =>
    jsonRequest<{ ok: boolean }>(`/api/agents/${id}/report-now`, {
      method: 'POST',
    }),

  skipAgentReport: (id: string) =>
    jsonRequest<{ ok: boolean }>(`/api/agents/${id}/skip-report`, {
      method: 'POST',
    }),

  skipAllAgentReports: () =>
    jsonRequest<{ ok: boolean; skippedCount: number }>('/api/agents/skip-all-reports', {
      method: 'POST',
    }),

  resetAllAgentModels: (modelOverride = '') =>
    jsonRequest<{ ok: boolean; modelOverride: string }>('/api/agents/reset-models', {
      method: 'POST',
      body: JSON.stringify({ modelOverride }),
    }),

  inspectAgentPaths: (id: string, paths?: string[]) =>
    jsonRequest<{
      ok: boolean;
      agentWorkspaceDir: string;
      summary: Array<{
        inputPath: string;
        exists: boolean;
        type: string;
        fileCount: number;
        sampleFiles: Array<{ name: string; fullPath: string; sizeBytes: number }>;
      }>;
    }>(`/api/agents/${id}/inspect-paths`, {
      method: 'POST',
      body: JSON.stringify({ paths }),
    }),

  pickLocalPath: (mode: 'folder' | 'file') =>
    jsonRequest<{ ok: boolean; path: string | null }>('/api/files/pick', {
      method: 'POST',
      body: JSON.stringify({ mode }),
    }),

  upload3DModel: async (file: File): Promise<{ ok: boolean; url: string; filename: string }> => {
    const form = new FormData();
    form.append('model', file);
    const res = await fetch('/api/upload-model', {
      method: 'POST',
      body: form,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || 'Upload gagal');
    return data;
  },

  saveWorkflow: (wf: WorkflowDefinition, isNew = false) =>
    jsonRequest<{ ok: boolean; workflow: WorkflowDefinition }>(
      isNew ? '/api/workflows' : `/api/workflows/${wf.id}`,
      {
        method: isNew ? 'POST' : 'PUT',
        body: JSON.stringify(wf),
      }
    ),

  deleteWorkflow: (id: string) =>
    jsonRequest<{ ok: boolean }>(`/api/workflows/${id}`, {
      method: 'DELETE',
    }),

  runWorkflow: (id: string, topicContext = '') =>
    jsonRequest<{ ok: boolean; run: WorkflowRun }>(`/api/workflows/${id}/run`, {
      method: 'POST',
      body: JSON.stringify({ topicContext }),
    }),

  decideWorkflowApproval: (runId: string, approved: boolean, feedback?: string) =>
    jsonRequest<{ ok: boolean; run: WorkflowRun }>(`/api/workflow-runs/${runId}/decision`, {
      method: 'POST',
      body: JSON.stringify({ approved, feedback }),
    }),

  retryWorkflowStep: (runId: string, stepIndex?: number) =>
    jsonRequest<{ ok: boolean; run: WorkflowRun }>(`/api/workflow-runs/${runId}/retry-step`, {
      method: 'POST',
      body: JSON.stringify({ stepIndex }),
    }),

  skipWorkflowStep: (runId: string, stepIndex?: number, reason?: string) =>
    jsonRequest<{ ok: boolean; run: WorkflowRun }>(`/api/workflow-runs/${runId}/skip-step`, {
      method: 'POST',
      body: JSON.stringify({ stepIndex, reason }),
    }),

  addPinnedIdea: (payload: Omit<PinnedIdeaItem, 'id' | 'createdAt'>) =>
    jsonRequest<{ ok: boolean; idea: PinnedIdeaItem }>('/api/pinned-ideas', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  deletePinnedIdea: (id: string) =>
    jsonRequest<{ ok: boolean }>(`/api/pinned-ideas/${id}`, {
      method: 'DELETE',
    }),

  ackReminder: (id: string) =>
    jsonRequest<{ ok: boolean }>(`/api/reminders/${id}/ack`, { method: 'POST' }),

  ackAllReminders: () =>
    jsonRequest<{ ok: boolean }>('/api/reminders/ack-all', { method: 'POST' }),

  simulateReminder: (type: 'agent_missing' | 'user_missing', targetAgentId?: string) =>
    jsonRequest<{ ok: boolean }>('/api/reminders/simulate', {
      method: 'POST',
      body: JSON.stringify({ type, targetAgentId }),
    }),

  submitHeadBrief: (content: string) =>
    jsonRequest<{ ok: boolean }>('/api/head-brief', {
      method: 'POST',
      body: JSON.stringify({ content }),
    }),

  getSocialBrowserStatus: () =>
    jsonRequest<{ ok: boolean; status: SocialBrowserStatus }>('/api/social-browser/status'),

  launchSocialBrowser: (url?: string) =>
    jsonRequest<{
      ok: boolean;
      message: string;
      status: SocialBrowserStatus;
      openedTabId?: string;
    }>('/api/social-browser/launch', {
      method: 'POST',
      body: JSON.stringify({ url }),
    }),

  captureSocialBrowser: (tabId?: string, takeScreenshot = true) =>
    jsonRequest<{
      ok: boolean;
      message: string;
      meta: SocialSnapshotMeta | null;
      status: SocialBrowserStatus;
    }>('/api/social-browser/capture', {
      method: 'POST',
      body: JSON.stringify({ tabId, takeScreenshot }),
    }),

  analyzeSocialBrowserWithAgent: (params: {
    agentId?: string;
    tabId?: string;
    customInstruction?: string;
  }) =>
    jsonRequest<{
      ok: boolean;
      message: string;
      reply: CommsMessage;
      status: SocialBrowserStatus;
    }>('/api/social-browser/analyze', {
      method: 'POST',
      body: JSON.stringify(params),
    }),

  autoSyncSocialBrowser: (force = false) =>
    jsonRequest<{
      ok: boolean;
      message: string;
      status: SocialBrowserStatus;
    }>('/api/social-browser/auto-sync', {
      method: 'POST',
      body: JSON.stringify({ force }),
    }),

  getNotionCalendarStatus: () =>
    jsonRequest<{ ok: boolean; state: NotionCalendarState }>('/api/notion-calendar/status'),

  connectNotionCalendar: (params: {
    token?: string;
    databaseInput?: string;
    dataSourceId?: string;
    filterMode?: 'content_only' | 'all_rows';
  }) =>
    jsonRequest<{ ok: boolean; message: string; state: NotionCalendarState }>(
      '/api/notion-calendar/connect',
      {
        method: 'POST',
        body: JSON.stringify(params),
      }
    ),

  syncNotionCalendar: () =>
    jsonRequest<{ ok: boolean; message: string; state: NotionCalendarState }>(
      '/api/notion-calendar/sync',
      {
        method: 'POST',
      }
    ),

  disconnectNotionCalendar: () =>
    jsonRequest<{ ok: boolean; state: NotionCalendarState }>('/api/notion-calendar/disconnect', {
      method: 'POST',
    }),

  generateAndInsertNotionCalendar: (params: {
    brief: string;
    itemCount: number;
    startDate: string;
  }) =>
    jsonRequest<{
      ok: boolean;
      message: string;
      createdPages: NotionCreatedPageInfo[];
      reply: CommsMessage;
      state: NotionCalendarState;
    }>('/api/notion-calendar/generate-and-insert', {
      method: 'POST',
      body: JSON.stringify(params),
    }),
};
