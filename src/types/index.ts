export type CharacterStyle = 'roblox' | 'anime' | 'human';

export type HairStyle = 'spiky' | 'bob' | 'twintails' | 'ponytail' | 'curly' | 'bun';
export type OutfitType = 'blazer' | 'hoodie' | 'casual' | 'streetwear';
export type AccessoryType = 'none' | 'glasses' | 'headset' | 'cap' | 'headphones' | 'cat_ears';
export type ExpressionType = 'happy' | 'focused' | 'cool' | 'excited';

export interface CharacterAppearance {
  style: CharacterStyle;
  skinColor: string;
  hairStyle: HairStyle;
  hairColor: string;
  outfitType: OutfitType;
  primaryColor: string;
  secondaryColor: string;
  accessory: AccessoryType;
  expression: ExpressionType;
  customModelUrl: string | null;
  scale: number;
}

export type VillaRoomId =
  | 'office'
  | 'head_suite'
  | 'meeting_hub'
  | 'game_hub'
  | 'game_room'
  | 'chill_room'
  | 'fun_room'
  | 'rest_room';

export type VillaScenery = 'mountain' | 'ocean';
export type TimeAmbience = 'auto' | 'morning' | 'day' | 'sunset' | 'night';

export interface JobdeskItem {
  id: string;
  time: string; // HH:mm
  title: string;
  description: string;
  room: VillaRoomId;
  requiresReport: boolean;
  completedToday: boolean;
  lastCompletedDate: string | null;
}

export interface HermesMarkdownDocs {
  soulMd: string;
  toolsMd: string;
  userMd: string;
  agentsMd: string;
}

export type AgentStatus =
  | 'working'
  | 'collaborating'
  | 'waiting_user'
  | 'break'
  | 'late_report'
  | 'idle';

export interface AgentProfile {
  id: string;
  name: string;
  role: string;
  department:
    | 'Social & Community'
    | 'Performance & Growth'
    | 'Tech & Search'
    | 'Data & Strategy'
    | 'Creative & Production'
    | 'Custom';
  avatarEmoji: string;
  deskIndex: number;
  currentRoom: VillaRoomId;
  targetAgentId: string | null;
  status: AgentStatus;
  statusText: string;
  speechBubble: string | null;
  speechTimestamp: number | null;
  deskFocusUntil?: number | null;
  appearance: CharacterAppearance;
  jobdesks: JobdeskItem[];
  docs: HermesMarkdownDocs;
  connectedPaths: string[];
  preferredEngine: 'hybrid_api' | 'hermes_cli';
  modelOverride: string;
  lastReportAt: string | null;
  dailyReportSubmittedDate: string | null;
  dailyReportSkippedDate?: string | null;
  reportDeadlineTime: string; // HH:mm
}

export type WorkflowStepType = 'agent_task' | 'peer_review' | 'head_approval';

export interface WorkflowStep {
  id: string;
  order: number;
  title: string;
  type: WorkflowStepType;
  agentIds: string[];
  notifyAgentIds: string[];
  prompt: string;
  slaMinutes: number;
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  description: string;
  scheduleTime: string | null; // HH:mm or null
  autoRunDaily: boolean;
  lastAutoRunDate: string | null;
  steps: WorkflowStep[];
}

export interface StepAgentOutput {
  agentId: string;
  agentName: string;
  role: string;
  content: string;
  timestamp: string;
  savedReportPath?: string;
  engineUsed?: 'live_api' | 'hermes_cli' | 'simulation';
}

export interface WorkflowStepResult {
  stepId: string;
  status:
    | 'pending'
    | 'running'
    | 'waiting_approval'
    | 'approved'
    | 'revision_requested'
    | 'completed'
    | 'failed';
  outputs: StepAgentOutput[];
  headFeedback: string | null;
  waitingSince: string | null;
  lastRemindedAt: string | null;
}

export interface WorkflowRun {
  id: string;
  workflowId: string;
  workflowName: string;
  status: 'running' | 'waiting_approval' | 'completed' | 'paused' | 'failed';
  currentStepIndex: number;
  topicContext: string;
  startedAt: string;
  completedAt: string | null;
  stepResults: WorkflowStepResult[];
}

export type ReminderDirection =
  | 'agent_missing_report'
  | 'user_missing_report'
  | 'user_pending_approval';

export interface ReminderItem {
  id: string;
  direction: ReminderDirection;
  severity: 'info' | 'warning' | 'urgent';
  fromAgentId: string;
  targetAgentId: string | null;
  workflowRunId: string | null;
  title: string;
  message: string;
  createdAt: string;
  acknowledged: boolean;
}

export interface CommsMessage {
  id: string;
  senderType: 'user' | 'agent' | 'system';
  senderId: string;
  senderName: string;
  senderRole: string;
  recipientId: string; // 'all' | 'head-dm' | agentId
  channel: 'team' | 'direct' | 'workflow' | 'report';
  content: string;
  timestamp: string;
  workflowRunId?: string;
  savedFilePath?: string;
  engineUsed?: 'live_api' | 'hermes_cli' | 'simulation';
  relatedAgentIds?: string[];
  handoffFromName?: string;
}

export interface ActiveProductFocus {
  enabled: boolean;
  productName: string;
  promoOffer: string;
  usp: string;
  targetAudience: string;
  ctaLink: string;
  extraNotes: string;
  updatedAt: string | null;
}

export interface PinnedIdeaItem {
  id: string;
  agentId: string;
  agentName: string;
  agentRole: string;
  avatarEmoji: string;
  title: string;
  content: string;
  category: string;
  createdAt: string;
}

export interface AppConfig {
  provider: {
    baseUrl: string;
    apiKey: string;
    defaultModel: string;
    temperature: number;
    hermesCliPath: string;
    syncToGlobalHermesHome: boolean;
  };
  workHours: {
    startHour: number;
    endHour: number;
    forceActiveOutsideHours: boolean;
    autoRunRoutines: boolean;
    userDailyBriefSubmittedDate: string | null;
    userBriefReminderTime: string; // HH:mm
    approvalReminderMinutes: number;
  };
  villa: {
    scenery: VillaScenery;
    ambience: TimeAmbience;
    windowsToastEnabled: boolean;
    soundAlertsEnabled: boolean;
  };
  activeProductFocus?: ActiveProductFocus;
  globalUserMd: string;
}

export interface AppStateSnapshot {
  config: AppConfig;
  agents: AgentProfile[];
  workflows: WorkflowDefinition[];
  workflowRuns: WorkflowRun[];
  reminders: ReminderItem[];
  messages: CommsMessage[];
  pinnedIdeas?: PinnedIdeaItem[];
  isWorkingHoursNow: boolean;
  serverTime: string;
}

export interface SocialBrowserTab {
  id: string;
  title: string;
  url: string;
  platform: string;
}

export interface CapturedTabData {
  tabId: string;
  platform: string;
  title: string;
  url: string;
  loginWallDetected: boolean;
  headings: string[];
  extractedText: string;
  screenshotUrl: string | null;
  capturedAt: string;
}

export interface SocialSnapshotMeta {
  lastCapturedAt: string | null;
  tabCount: number;
  tabs: CapturedTabData[];
}

export interface SocialBrowserStatus {
  running: boolean;
  browserBinary: string | null;
  browserVersion: string | null;
  cdpPort: number;
  profileDir: string;
  mcpConfigPath: string;
  openTabs: SocialBrowserTab[];
  lastSnapshot: SocialSnapshotMeta | null;
}

export interface NotionPropertySchema {
  name: string;
  type: string;
  writable: boolean;
  options: string[];
}

export interface NotionSampleEntry {
  id: string;
  url: string;
  title: string;
  propertiesSummary: Record<string, string>;
  bodyPreview?: string;
}

export interface NotionCreatedPageInfo {
  id: string;
  title: string;
  url: string;
}

export interface NotionDataSourceOption {
  id: string;
  name: string;
}

export interface NotionCalendarState {
  connected: boolean;
  hasToken: boolean;
  tokenMasked: string;
  rawDatabaseInput: string;
  databaseId: string;
  databaseTitle: string;
  databaseUrl: string;
  dataSourceId: string;
  dataSourceName: string;
  availableDataSources: NotionDataSourceOption[];
  workstreamFilter: string | null;
  filterMode: 'content_only' | 'all_rows';
  totalEntriesCount: number;
  lastSyncedAt: string | null;
  allowedAgentIds: string[];
  properties: NotionPropertySchema[];
  entries: NotionSampleEntry[];
  sampleEntries: NotionSampleEntry[];
  sampleBodyHeadings: string[];
}
