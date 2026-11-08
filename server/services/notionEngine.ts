import fs from 'node:fs';
import path from 'node:path';
import {
  NotionCalendarState,
  NotionCreatedPageInfo,
  NotionDataSourceOption,
  NotionPropertySchema,
  NotionSampleEntry,
} from '../types.ts';
import { DATA_DIR, HERMES_WORKSPACE_DIR } from './storage.ts';

const NOTION_API_BASE = 'https://api.notion.com/v1';
const NOTION_API_VERSION = '2025-09-03';

const NOTION_SECRET_FILE = path.join(DATA_DIR, 'notion.secret.json');
const NOTION_STATE_FILE = path.join(HERMES_WORKSPACE_DIR, 'notion_calendar_schema.json');
const NADIA_NOTION_MD_FILE = path.join(
  HERMES_WORKSPACE_DIR,
  'agents',
  'social-media',
  'NOTION_CALENDAR_FORMAT.md'
);

interface NotionSecretPayload {
  token: string;
  rawDatabaseInput: string;
  databaseId: string;
  dataSourceId: string;
  filterMode: 'content_only' | 'all_rows';
  allowedAgentIds: string[];
}

export interface NotionCalendarItemDraft {
  properties: Record<string, unknown>;
  bodySections?: Array<{
    heading?: string;
    content: string;
  }>;
}

export interface NotionCalendarItemUpdateDraft {
  pageId: string;
  properties: Record<string, unknown>;
  bodySections?: Array<{
    heading?: string;
    content: string;
  }>;
  replaceBody?: boolean;
}

const WRITABLE_NOTION_TYPES = new Set([
  'title',
  'rich_text',
  'select',
  'multi_select',
  'status',
  'date',
  'people',
  'url',
  'number',
  'checkbox',
  'email',
  'phone_number',
]);

/**
 * Known Notion Workspace Users (IDs from the user's Notion workspace) for `Orang` (people) property.
 */
const KNOWN_NOTION_PEOPLE: Record<string, { id: string; name: string }> = {
  septa: { id: '2dfd872b-594c-81c1-86bd-0002c04bede8', name: 'Septa' },
  'rafly aditya ramadhan': {
    id: '1fad872b-594c-81c5-8bc0-0002dcf717a1',
    name: 'Rafly Aditya Ramadhan',
  },
  rafly: { id: '1fad872b-594c-81c5-8bc0-0002dcf717a1', name: 'Rafly Aditya Ramadhan' },
  'dika agustian': { id: '1f9d872b-594c-8177-9bae-0002b2617d9e', name: 'Dika Agustian' },
  'dika agsutian': { id: '1f9d872b-594c-8177-9bae-0002b2617d9e', name: 'Dika Agustian' },
  dika: { id: '1f9d872b-594c-8177-9bae-0002b2617d9e', name: 'Dika Agustian' },
  'diaz dinda': { id: '1fad872b-594c-81fd-9c8d-0002e01612fa', name: 'diaz dinda' },
  diaz: { id: '1fad872b-594c-81fd-9c8d-0002e01612fa', name: 'diaz dinda' },
  annisa: { id: '2a0d872b-594c-81ad-ac5b-000267d552d2', name: 'Annisa' },
};

const CANONICAL_PEOPLE_OPTIONS = [
  'Septa',
  'Rafly Aditya Ramadhan',
  'Dika Agustian',
  'diaz dinda',
  'Annisa',
];

function resolveNotionPeopleIds(rawInput: unknown): Array<{ object: 'user'; id: string }> {
  const tokens: string[] = Array.isArray(rawInput)
    ? rawInput.map((v) => String(v || '').trim()).filter(Boolean)
    : String(rawInput || '')
        .split(/[,;/+&]|\bdan\b/i)
        .map((s) => s.trim())
        .filter(Boolean);

  const seenIds = new Set<string>();
  const result: Array<{ object: 'user'; id: string }> = [];

  for (const rawToken of tokens) {
    const lower = rawToken.toLowerCase().trim();
    if (!lower) continue;

    // Direct UUID match if caller passed a raw Notion user UUID
    const uuidHex = extractNotionIdFromInput(rawToken);
    if (uuidHex && uuidHex.length === 32) {
      const formatted = formatUuidWithDashes(uuidHex);
      if (!seenIds.has(formatted)) {
        seenIds.add(formatted);
        result.push({ object: 'user', id: formatted });
      }
      continue;
    }

    // Exact or fuzzy match against KNOWN_NOTION_PEOPLE
    const exact = KNOWN_NOTION_PEOPLE[lower];
    if (exact) {
      if (!seenIds.has(exact.id)) {
        seenIds.add(exact.id);
        result.push({ object: 'user', id: exact.id });
      }
      continue;
    }

    const fuzzyEntry = Object.entries(KNOWN_NOTION_PEOPLE).find(
      ([k, v]) =>
        lower.includes(k) ||
        k.includes(lower) ||
        v.name.toLowerCase().includes(lower) ||
        lower.includes(v.name.toLowerCase())
    );
    if (fuzzyEntry && !seenIds.has(fuzzyEntry[1].id)) {
      seenIds.add(fuzzyEntry[1].id);
      result.push({ object: 'user', id: fuzzyEntry[1].id });
    }
  }

  return result;
}

function maskToken(token: string): string {
  const t = (token || '').trim();
  if (!t) return '';
  if (t.length <= 10) return '••••••••';
  return `${t.slice(0, 6)}••••••${t.slice(-4)}`;
}

function readSecret(): NotionSecretPayload {
  try {
    if (fs.existsSync(NOTION_SECRET_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(NOTION_SECRET_FILE, 'utf-8')) as Partial<NotionSecretPayload>;
      return {
        token: (parsed.token || '').trim(),
        rawDatabaseInput: (parsed.rawDatabaseInput || '').trim(),
        databaseId: (parsed.databaseId || '').trim(),
        dataSourceId: (parsed.dataSourceId || '').trim(),
        filterMode: parsed.filterMode === 'all_rows' ? 'all_rows' : 'content_only',
        allowedAgentIds:
          Array.isArray(parsed.allowedAgentIds) && parsed.allowedAgentIds.length > 0
            ? parsed.allowedAgentIds
            : ['social-media'],
      };
    }
  } catch {
    // ignore
  }
  return {
    token: '',
    rawDatabaseInput: '',
    databaseId: '',
    dataSourceId: '',
    filterMode: 'content_only',
    allowedAgentIds: ['social-media'],
  };
}

function writeSecret(payload: NotionSecretPayload): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(NOTION_SECRET_FILE, JSON.stringify(payload, null, 2), 'utf-8');
}

function readCachedSchema(): Omit<
  NotionCalendarState,
  'hasToken' | 'tokenMasked' | 'rawDatabaseInput' | 'allowedAgentIds'
> | null {
  try {
    if (fs.existsSync(NOTION_STATE_FILE)) {
      return JSON.parse(fs.readFileSync(NOTION_STATE_FILE, 'utf-8'));
    }
  } catch {
    // ignore
  }
  return null;
}

/**
 * Extracts a 32-hex Notion ID from any Notion URL or raw ID string (ignoring ?v=... query params).
 */
export function extractNotionIdFromInput(input: string): string | null {
  const withoutQuery = (input || '').trim().split('?')[0].split('#')[0];
  if (!withoutQuery) return null;

  // Match UUID with hyphens
  const uuidMatch = /([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})/.exec(
    withoutQuery
  );
  if (uuidMatch) {
    return uuidMatch[1].replace(/-/g, '').toLowerCase();
  }

  // Match 32-char hex at end of slug or standalone
  const hexMatch = /([0-9a-fA-F]{32})(?:\/)?$/.exec(withoutQuery) || /([0-9a-fA-F]{32})/.exec(withoutQuery);
  if (hexMatch) {
    return hexMatch[1].toLowerCase();
  }

  return null;
}

function formatUuidWithDashes(hex32: string): string {
  const clean = hex32.replace(/-/g, '').toLowerCase();
  if (clean.length !== 32) return hex32;
  return `${clean.slice(0, 8)}-${clean.slice(8, 12)}-${clean.slice(12, 16)}-${clean.slice(
    16,
    20
  )}-${clean.slice(20)}`;
}

async function notionFetch<T = any>(
  token: string,
  endpoint: string,
  options: RequestInit = {}
): Promise<{ ok: boolean; status: number; data: T; errorMessage?: string }> {
  const res = await fetch(`${NOTION_API_BASE}${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Notion-Version': NOTION_API_VERSION,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    signal: AbortSignal.timeout(18000),
  });

  const json = (await res.json().catch(() => ({}))) as any;
  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      data: json as T,
      errorMessage: json?.message || `Notion HTTP ${res.status}`,
    };
  }
  return { ok: true, status: res.status, data: json as T };
}

function extractPlainText(richArray: any[]): string {
  if (!Array.isArray(richArray)) return '';
  return richArray.map((r) => r?.plain_text || r?.text?.content || '').join('');
}

function summarizeNotionPropertyValue(propObj: any): string {
  if (!propObj || typeof propObj !== 'object') return '';
  switch (propObj.type) {
    case 'title':
      return extractPlainText(propObj.title);
    case 'rich_text':
      return extractPlainText(propObj.rich_text);
    case 'select':
      return propObj.select?.name || '';
    case 'multi_select':
      return Array.isArray(propObj.multi_select)
        ? propObj.multi_select.map((o: any) => o.name).join(', ')
        : '';
    case 'status':
      return propObj.status?.name || '';
    case 'date':
      if (!propObj.date?.start) return '';
      return propObj.date.end
        ? `${propObj.date.start} → ${propObj.date.end}`
        : propObj.date.start;
    case 'people':
      return Array.isArray(propObj.people)
        ? propObj.people
            .map((p: any) => p?.name || p?.person?.email || '')
            .filter(Boolean)
            .join(', ')
        : '';
    case 'url':
      return propObj.url || '';
    case 'number':
      return propObj.number !== null && propObj.number !== undefined ? String(propObj.number) : '';
    case 'checkbox':
      return propObj.checkbox ? '☑️ Ya' : '⬜ Tidak';
    case 'email':
      return propObj.email || '';
    case 'phone_number':
      return propObj.phone_number || '';
    default:
      return '';
  }
}

export function getNotionCalendarState(): NotionCalendarState {
  const secret = readSecret();
  const cached = readCachedSchema();
  const entries = Array.isArray((cached as any)?.entries)
    ? (cached as any).entries
    : cached?.sampleEntries || [];

  return {
    connected: Boolean(secret.token && (cached?.connected || secret.databaseId || secret.dataSourceId)),
    hasToken: Boolean(secret.token),
    tokenMasked: maskToken(secret.token),
    rawDatabaseInput: secret.rawDatabaseInput,
    databaseId: cached?.databaseId || secret.databaseId || '',
    databaseTitle: cached?.databaseTitle || '',
    databaseUrl: cached?.databaseUrl || '',
    dataSourceId: cached?.dataSourceId || secret.dataSourceId || '',
    dataSourceName: cached?.dataSourceName || '',
    availableDataSources: cached?.availableDataSources || [],
    workstreamFilter: (cached as any)?.workstreamFilter ?? null,
    filterMode: secret.filterMode || 'content_only',
    totalEntriesCount: (cached as any)?.totalEntriesCount ?? entries.length,
    lastSyncedAt: cached?.lastSyncedAt || null,
    allowedAgentIds: secret.allowedAgentIds,
    properties: cached?.properties || [],
    entries,
    sampleEntries: cached?.sampleEntries || entries.slice(0, 8),
    sampleBodyHeadings: cached?.sampleBodyHeadings || [],
  };
}

function normalizeUuidHex(id: string | undefined | null): string {
  return String(id || '')
    .replace(/-/g, '')
    .trim()
    .toLowerCase();
}

function detectContentCalendarWorkstreamProp(properties: NotionPropertySchema[]): {
  propName: string;
  propType: 'select' | 'status' | 'multi_select';
  optionName: string;
} | null {
  for (const prop of properties) {
    if (
      (prop.type === 'select' || prop.type === 'status' || prop.type === 'multi_select') &&
      /workstream|kalender|calendar|stream|divisi/i.test(prop.name)
    ) {
      const opt = prop.options.find((o) =>
        /content\s*calen(d|de)r|konten\s*kalender/i.test(o)
      );
      if (opt) {
        return {
          propName: prop.name,
          propType: prop.type,
          optionName: opt,
        };
      }
    }
  }
  return null;
}

async function fetchPageBlocksSummary(
  token: string,
  pageId: string
): Promise<{ bodyPreview: string; headings: string[] }> {
  const blocksRes = await notionFetch(token, `/blocks/${pageId}/children?page_size=40`, {
    method: 'GET',
  });
  if (!blocksRes.ok || !Array.isArray(blocksRes.data?.results)) {
    return { bodyPreview: '', headings: [] };
  }

  const headings: string[] = [];
  const lines: string[] = [];

  for (const blk of blocksRes.data.results) {
    const bType = blk?.type;
    if (!bType) continue;

    if (bType === 'heading_1' || bType === 'heading_2' || bType === 'heading_3') {
      const txt = extractPlainText(blk[bType]?.rich_text).trim();
      if (txt) {
        headings.push(txt);
        lines.push(`[${txt}]`);
      }
    } else if (
      bType === 'paragraph' ||
      bType === 'bulleted_list_item' ||
      bType === 'numbered_list_item' ||
      bType === 'quote' ||
      bType === 'callout' ||
      bType === 'toggle'
    ) {
      const txt = extractPlainText(blk[bType]?.rich_text).trim();
      if (txt) {
        lines.push(bType.includes('list_item') ? `- ${txt}` : txt);
      }
    } else if (bType === 'to_do') {
      const txt = extractPlainText(blk.to_do?.rich_text).trim();
      if (txt) {
        lines.push(`${blk.to_do?.checked ? '[x]' : '[ ]'} ${txt}`);
      }
    }
  }

  return {
    bodyPreview: lines.join(' | ').slice(0, 480),
    headings: headings.slice(0, 8),
  };
}

let activeSyncInFlight: Promise<{
  ok: boolean;
  message: string;
  state: NotionCalendarState;
}> | null = null;

/**
 * Ensures Nadia ALWAYS has live, up-to-date Notion Content Calendar rows before answering any chat/task!
 */
export async function ensureFreshNotionCalendarForAgent(
  agentId: string,
  maxAgeMs = 15_000
): Promise<void> {
  const secret = readSecret();
  if (!secret.allowedAgentIds.includes(agentId)) return;
  if (!secret.token || (!secret.databaseId && !secret.dataSourceId)) return;

  const cached = readCachedSchema() as any;
  const lastMs = cached?.lastSyncedAt ? Date.parse(cached.lastSyncedAt) : 0;
  const hasFullEntriesArray = Array.isArray(cached?.entries);

  if (hasFullEntriesArray && lastMs > 0 && Date.now() - lastMs < maxAgeMs) {
    return;
  }

  try {
    if (!activeSyncInFlight) {
      activeSyncInFlight = connectAndSyncNotionCalendar().finally(() => {
        activeSyncInFlight = null;
      });
    }
    await activeSyncInFlight;
  } catch {
    // non-fatal; fallback to existing cached state
  }
}

/**
 * Connects & inspects ONLY the target Content Calendar database / data source in Notion (API 2025-09-03),
 * supporting both single-source and multi-source Notion databases AND pulling ALL Content Calendar rows!
 */
export async function connectAndSyncNotionCalendar(params?: {
  token?: string;
  databaseInput?: string;
  dataSourceId?: string;
  filterMode?: 'content_only' | 'all_rows';
}): Promise<{
  ok: boolean;
  message: string;
  state: NotionCalendarState;
}> {
  const existingSecret = readSecret();
  const token = (params?.token !== undefined ? params.token : existingSecret.token).trim();
  const rawDatabaseInput = (
    params?.databaseInput !== undefined ? params.databaseInput : existingSecret.rawDatabaseInput
  ).trim();
  const filterMode: 'content_only' | 'all_rows' =
    params?.filterMode || existingSecret.filterMode || 'content_only';

  if (!token) {
    return {
      ok: false,
      message:
        'Notion Integration Token belum diisi. Masukkan token integrasi Notion (ntn_... atau secret_...) terlebih dahulu.',
      state: getNotionCalendarState(),
    };
  }

  const candidateHex = extractNotionIdFromInput(rawDatabaseInput || existingSecret.databaseId);
  if (!candidateHex) {
    return {
      ok: false,
      message:
        'Link atau ID Konten Kalender Notion tidak valid. Copy link halaman Konten Kalender langsung dari Notion lalu tempel di kolom link.',
      state: getNotionCalendarState(),
    };
  }

  let targetDbId = formatUuidWithDashes(candidateHex);

  // 1. Try reading as a Notion Database Container (supports multi-source databases in 2025-09-03!)
  let dbRes = await notionFetch(token, `/databases/${targetDbId}`, { method: 'GET' });

  // Persist token + raw link right away if token itself wasn't rejected with 401
  if (dbRes.status !== 401) {
    writeSecret({
      ...existingSecret,
      token,
      rawDatabaseInput: rawDatabaseInput || existingSecret.rawDatabaseInput,
      allowedAgentIds: ['social-media'],
    });
  }

  // 2. Fallback A: If user pasted a Notion Page URL that CONTAINS an inline Content Calendar database!
  if (
    !dbRes.ok &&
    dbRes.status === 400 &&
    (dbRes.errorMessage || '').toLowerCase().includes('page, not a database')
  ) {
    const childrenRes = await notionFetch(
      token,
      `/blocks/${targetDbId}/children?page_size=50`,
      { method: 'GET' }
    );
    if (childrenRes.ok && Array.isArray(childrenRes.data?.results)) {
      const childDbBlock = childrenRes.data.results.find(
        (b: any) => b?.type === 'child_database' && b?.id
      );
      if (childDbBlock) {
        targetDbId = formatUuidWithDashes(String(childDbBlock.id));
        dbRes = await notionFetch(token, `/databases/${targetDbId}`, { method: 'GET' });
      }
    }
  }

  // 3. Fallback B: What if the user pasted a direct data_source_id instead of a database_id?
  let directDataSourceObj: any = null;
  if (!dbRes.ok && dbRes.status !== 401) {
    const tryDsRes = await notionFetch(token, `/data_sources/${targetDbId}`, { method: 'GET' });
    if (tryDsRes.ok && tryDsRes.data?.id) {
      directDataSourceObj = tryDsRes.data;
      const parentDbId = tryDsRes.data?.parent?.database_id;
      if (parentDbId) {
        const parentDbFormatted = formatUuidWithDashes(String(parentDbId));
        const parentDbRes = await notionFetch(token, `/databases/${parentDbFormatted}`, {
          method: 'GET',
        });
        if (parentDbRes.ok) {
          targetDbId = parentDbFormatted;
          dbRes = parentDbRes;
        }
      }
    }
  }

  if (!dbRes.ok && !directDataSourceObj) {
    const hint =
      dbRes.status === 401
        ? 'Token Notion tidak valid atau sudah dicabut.'
        : dbRes.status === 404
        ? 'Halaman Konten Kalender belum dihubungkan ke integrasi! Buka halaman Konten Kalender di Notion → klik ••• di kanan atas → Connections → pilih integrasi Anda.'
        : dbRes.errorMessage || 'Gagal membaca database Notion.';
    return {
      ok: false,
      message: hint,
      state: getNotionCalendarState(),
    };
  }

  const dbData = dbRes.ok ? dbRes.data : null;
  const databaseTitle =
    (dbData && extractPlainText(dbData.title)) ||
    (directDataSourceObj &&
      (extractPlainText(directDataSourceObj.title) || directDataSourceObj.name)) ||
    'Konten Kalender Notion';
  const databaseUrl =
    dbData?.url ||
    directDataSourceObj?.url ||
    `https://www.notion.so/${targetDbId.replace(/-/g, '')}`;

  // 4. Resolve Data Sources list (2025-09-03 Multi-Source Databases support)
  const rawDataSources: any[] = Array.isArray(dbData?.data_sources) ? dbData.data_sources : [];
  const availableDataSources: NotionDataSourceOption[] = rawDataSources
    .filter((ds) => ds && ds.id)
    .map((ds, idx) => ({
      id: formatUuidWithDashes(String(ds.id)),
      name: String(ds.name || extractPlainText(ds.title) || `Data Source #${idx + 1}`).trim(),
    }));

  if (availableDataSources.length === 0 && directDataSourceObj?.id) {
    availableDataSources.push({
      id: formatUuidWithDashes(String(directDataSourceObj.id)),
      name:
        String(
          extractPlainText(directDataSourceObj.title) ||
            directDataSourceObj.name ||
            databaseTitle
        ).trim() || 'Konten Kalender',
    });
  }

  // Pick target Data Source: explicit param -> saved dataSourceId -> name heuristic -> first data source
  const requestedDsHex = normalizeUuidHex(
    params?.dataSourceId ||
      (directDataSourceObj?.id ? String(directDataSourceObj.id) : '') ||
      (normalizeUuidHex(existingSecret.databaseId) === normalizeUuidHex(targetDbId)
        ? existingSecret.dataSourceId
        : '')
  );

  let chosenDsOption =
    availableDataSources.find((ds) => normalizeUuidHex(ds.id) === requestedDsHex) ||
    availableDataSources.find((ds) =>
      /konten|kalender|calendar|content|editorial|sosmed|jadwal|post/i.test(ds.name)
    ) ||
    availableDataSources[0] ||
    null;

  let chosenDataSourceId = chosenDsOption ? chosenDsOption.id : '';
  let chosenDataSourceName = chosenDsOption ? chosenDsOption.name : databaseTitle;

  // 5. Retrieve exact property schemas from /v1/data_sources/{data_source_id}
  let rawProps: Record<string, any> = dbData?.properties || {};
  if (chosenDataSourceId) {
    const dsDetailRes =
      directDataSourceObj && normalizeUuidHex(directDataSourceObj.id) === normalizeUuidHex(chosenDataSourceId)
        ? { ok: true, data: directDataSourceObj }
        : await notionFetch(token, `/data_sources/${chosenDataSourceId}`, { method: 'GET' });

    if (dsDetailRes.ok && dsDetailRes.data) {
      if (dsDetailRes.data.properties && typeof dsDetailRes.data.properties === 'object') {
        rawProps = dsDetailRes.data.properties;
      }
      const fetchedDsName = String(
        extractPlainText(dsDetailRes.data.title) || dsDetailRes.data.name || ''
      ).trim();
      if (fetchedDsName) {
        chosenDataSourceName = fetchedDsName;
        if (chosenDsOption) {
          chosenDsOption.name = fetchedDsName;
        }
      }
    }
  }

  const properties: NotionPropertySchema[] = Object.entries(rawProps).map(
    ([propName, propDef]: [string, any]) => {
      const type = String(propDef?.type || 'unknown');
      let options: string[] = [];
      if (type === 'select' && Array.isArray(propDef.select?.options)) {
        options = propDef.select.options.map((o: any) => o.name).filter(Boolean);
      } else if (type === 'multi_select' && Array.isArray(propDef.multi_select?.options)) {
        options = propDef.multi_select.options.map((o: any) => o.name).filter(Boolean);
      } else if (type === 'status' && Array.isArray(propDef.status?.options)) {
        options = propDef.status.options.map((o: any) => o.name).filter(Boolean);
      } else if (type === 'people') {
        options = [...CANONICAL_PEOPLE_OPTIONS];
      }
      return {
        name: propName,
        type,
        writable: WRITABLE_NOTION_TYPES.has(type),
        options,
      };
    }
  );

  // Put title property first for clarity
  properties.sort((a, b) => (a.type === 'title' ? -1 : b.type === 'title' ? 1 : 0));

  // 6. Query ALL Content Calendar entries (with pagination!) so Nadia has FULL READ visibility!
  const detectedWorkstream = detectContentCalendarWorkstreamProp(properties);
  const workstreamFilter =
    filterMode === 'content_only' && detectedWorkstream
      ? `${detectedWorkstream.propName} = "${detectedWorkstream.optionName}"`
      : null;

  let notionFilterPayload: Record<string, any> | undefined;
  if (filterMode === 'content_only' && detectedWorkstream) {
    if (detectedWorkstream.propType === 'select') {
      notionFilterPayload = {
        property: detectedWorkstream.propName,
        select: { equals: detectedWorkstream.optionName },
      };
    } else if (detectedWorkstream.propType === 'status') {
      notionFilterPayload = {
        property: detectedWorkstream.propName,
        status: { equals: detectedWorkstream.optionName },
      };
    } else if (detectedWorkstream.propType === 'multi_select') {
      notionFilterPayload = {
        property: detectedWorkstream.propName,
        multi_select: { contains: detectedWorkstream.optionName },
      };
    }
  }

  const queryEndpoint = chosenDataSourceId
    ? `/data_sources/${chosenDataSourceId}/query`
    : `/databases/${targetDbId}/query`;

  const allRawRows: any[] = [];
  let startCursor: string | undefined = undefined;
  const MAX_ROWS = 500;

  while (allRawRows.length < MAX_ROWS) {
    const queryBody: Record<string, any> = {
      page_size: 100,
      ...(notionFilterPayload ? { filter: notionFilterPayload } : {}),
      ...(startCursor ? { start_cursor: startCursor } : {}),
    };

    const queryRes = await notionFetch(token, queryEndpoint, {
      method: 'POST',
      body: JSON.stringify(queryBody),
    });

    if (!queryRes.ok || !Array.isArray(queryRes.data?.results)) {
      break;
    }

    allRawRows.push(...queryRes.data.results);

    if (!queryRes.data.has_more || !queryRes.data.next_cursor) {
      break;
    }
    startCursor = String(queryRes.data.next_cursor);
  }

  const titlePropName = properties.find((p) => p.type === 'title')?.name || 'Name';
  const primaryDatePropName =
    properties.find((p) => p.type === 'date' && /publish|tayang|jadwal|date|tanggal/i.test(p.name))
      ?.name ||
    properties.find((p) => p.type === 'date')?.name ||
    '';

  const entries: NotionSampleEntry[] = allRawRows.map((row) => {
    const rowProps = row.properties || {};
    const summary: Record<string, string> = {};
    for (const [k, v] of Object.entries(rowProps)) {
      const strVal = summarizeNotionPropertyValue(v);
      if (strVal) {
        summary[k] = strVal.slice(0, 220);
      }
    }
    const rowTitle =
      summary[titlePropName] ||
      Object.values(summary)[0] ||
      '(Tanpa Judul)';

    return {
      id: row.id,
      url: row.url || `https://www.notion.so/${String(row.id || '').replace(/-/g, '')}`,
      title: rowTitle,
      propertiesSummary: summary,
    };
  });

  // Sort entries: undated/active drafts & newest/upcoming publish dates at the top
  entries.sort((a, b) => {
    const dateA = primaryDatePropName ? a.propertiesSummary[primaryDatePropName] || '' : '';
    const dateB = primaryDatePropName ? b.propertiesSummary[primaryDatePropName] || '' : '';
    if (!dateA && dateB) return -1;
    if (dateA && !dateB) return 1;
    return dateB.localeCompare(dateA);
  });

  // 7. Fetch inside-page body blocks (Hook/Script/Caption/Brief) for active & recent rows in parallel batches
  let sampleBodyHeadings: string[] = [];
  const statusPropName = properties.find((p) => p.type === 'status')?.name || 'Status';
  const priorityForBodyFetch = [
    ...entries.filter((e) => {
      const st = (e.propertiesSummary[statusPropName] || '').toLowerCase();
      return !st.includes('done') && !st.includes('published') && !st.includes('shelved');
    }),
    ...entries.filter((e) => {
      const st = (e.propertiesSummary[statusPropName] || '').toLowerCase();
      return st.includes('done') || st.includes('published');
    }),
  ].slice(0, 22);

  const BATCH_SIZE = 6;
  for (let i = 0; i < priorityForBodyFetch.length; i += BATCH_SIZE) {
    const batch = priorityForBodyFetch.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map(async (entry) => {
        if (!entry.id) return;
        const { bodyPreview, headings } = await fetchPageBlocksSummary(token, entry.id);
        if (bodyPreview) {
          entry.bodyPreview = bodyPreview;
        }
        if (sampleBodyHeadings.length === 0 && headings.length > 0) {
          sampleBodyHeadings = headings;
        }
      })
    );
  }

  const sampleEntries = entries.slice(0, 8);

  // Save credentials & schema strictly scoped to Nadia ('social-media') and this single database + dataSourceId
  writeSecret({
    token,
    rawDatabaseInput: rawDatabaseInput || existingSecret.rawDatabaseInput,
    databaseId: targetDbId,
    dataSourceId: chosenDataSourceId,
    filterMode,
    allowedAgentIds: ['social-media'],
  });

  const nowIso = new Date().toISOString();
  const cachedPayload = {
    connected: true,
    databaseId: targetDbId,
    databaseTitle,
    databaseUrl,
    dataSourceId: chosenDataSourceId,
    dataSourceName: chosenDataSourceName,
    availableDataSources,
    workstreamFilter,
    filterMode,
    totalEntriesCount: entries.length,
    lastSyncedAt: nowIso,
    properties,
    entries,
    sampleEntries,
    sampleBodyHeadings,
  };

  fs.mkdirSync(HERMES_WORKSPACE_DIR, { recursive: true });
  fs.writeFileSync(NOTION_STATE_FILE, JSON.stringify(cachedPayload, null, 2), 'utf-8');

  // Also write full reference + ALL live entries markdown into Nadia's Hermes folder!
  writeNadiaNotionFormatDoc(cachedPayload);

  const multiDsNote =
    availableDataSources.length > 1
      ? ` (Tabel: "${chosenDataSourceName}")`
      : '';
  const filterNote = workstreamFilter ? ` [${workstreamFilter}]` : '';

  return {
    ok: true,
    message: `Berhasil terhubung & membaca penuh ${entries.length} baris Konten Kalender dari "${databaseTitle}"${multiDsNote}${filterNote}! Nadia sekarang punya akses BACA PENUH + INPUT di Konten Kalender ini.`,
    state: getNotionCalendarState(),
  };
}

function writeNadiaNotionFormatDoc(schema: {
  databaseTitle: string;
  databaseId: string;
  databaseUrl: string;
  dataSourceId: string;
  dataSourceName: string;
  workstreamFilter: string | null;
  totalEntriesCount: number;
  lastSyncedAt: string;
  properties: NotionPropertySchema[];
  entries: NotionSampleEntry[];
  sampleEntries: NotionSampleEntry[];
  sampleBodyHeadings: string[];
}): void {
  try {
    fs.mkdirSync(path.dirname(NADIA_NOTION_MD_FILE), { recursive: true });
    const lines: string[] = [
      `# 📅 Data Live & Format Konten Kalender Notion Bos (${schema.databaseTitle})`,
      `- **Status Akses:** ✅ FULL READ & WRITE AKTIF (Bukan Write-Only!)`,
      `- **Database Terkunci:** ${schema.databaseTitle} (\`${schema.databaseId}\`)`,
      `- **Tabel / Data Source Aktif:** ${schema.dataSourceName} (\`${schema.dataSourceId || schema.databaseId}\`)`,
      `- **Filter Konten Kalender:** ${schema.workstreamFilter || 'Semua baris di tabel ini'}`,
      `- **Total Baris Terbaca Live:** **${schema.totalEntriesCount} baris** (Sinkron terakhir: ${schema.lastSyncedAt})`,
      `- **URL:** ${schema.databaseUrl}`,
      ``,
      `## Daftar Kolom (Properties) Wajib Diikuti Persis:`,
      ...schema.properties
        .filter((p) => p.writable)
        .map(
          (p) =>
            `- **${p.name}** (tipe: \`${p.type}\`)${
              p.options.length > 0 ? ` → Pilihan yang tersedia: [${p.options.join(', ')}]` : ''
            }`
        ),
      ``,
      `## Daftar Lengkap Seluruh Baris Konten Kalender (${schema.entries.length} Baris):`,
    ];

    for (let i = 0; i < schema.entries.length; i++) {
      const e = schema.entries[i];
      const kv = Object.entries(e.propertiesSummary)
        .map(([k, v]) => `${k}: ${v}`)
        .join(' | ');
      lines.push(
        `${i + 1}. **${e.title}** [id: \`${e.id}\`] — ${kv}${
          e.bodyPreview ? `\n   - _Isi Halaman:_ ${e.bodyPreview}` : ''
        }`
      );
    }

    fs.writeFileSync(NADIA_NOTION_MD_FILE, lines.join('\n'), 'utf-8');
  } catch {
    // ignore
  }
}

export function disconnectNotionCalendar(): NotionCalendarState {
  writeSecret({
    token: '',
    rawDatabaseInput: '',
    databaseId: '',
    dataSourceId: '',
    filterMode: 'content_only',
    allowedAgentIds: ['social-media'],
  });
  try {
    if (fs.existsSync(NOTION_STATE_FILE)) fs.unlinkSync(NOTION_STATE_FILE);
  } catch {
    // ignore
  }
  return getNotionCalendarState();
}

function matchExistingOption(rawVal: string, options: string[]): string {
  const clean = rawVal.replace(/,/g, ' ').trim();
  if (!clean) return '';
  const exact = options.find((o) => o.toLowerCase() === clean.toLowerCase());
  if (exact) return exact;
  const partial = options.find(
    (o) =>
      o.toLowerCase().includes(clean.toLowerCase()) ||
      clean.toLowerCase().includes(o.toLowerCase())
  );
  return partial || clean;
}

function buildRichTextChunks(text: string): Array<{ type: 'text'; text: { content: string } }> {
  const str = String(text || '').trim();
  if (!str) return [];
  const chunks: Array<{ type: 'text'; text: { content: string } }> = [];
  for (let i = 0; i < str.length; i += 1900) {
    chunks.push({
      type: 'text',
      text: { content: str.slice(i, i + 1900) },
    });
  }
  return chunks.slice(0, 5);
}

function buildRichTextBold(text: string): Array<{
  type: 'text';
  text: { content: string };
  annotations: { bold: true };
}> {
  const str = String(text || '').trim();
  if (!str) return [];
  return [
    {
      type: 'text',
      text: { content: str.slice(0, 1900) },
      annotations: { bold: true },
    },
  ];
}

function buildNotionPropertiesPayload(
  draftProps: Record<string, unknown>,
  schemaProps: NotionPropertySchema[]
): { payload: Record<string, any>; resolvedTitle: string } {
  const payload: Record<string, any> = {};
  const titleSchema = schemaProps.find((p) => p.type === 'title');

  // Case-insensitive lookup map for draftProps
  const draftEntries = Object.entries(draftProps || {});
  const findDraftVal = (colName: string): unknown => {
    const exact = draftProps?.[colName];
    if (exact !== undefined && exact !== null && exact !== '') return exact;
    const found = draftEntries.find(
      ([k]) => k.trim().toLowerCase() === colName.trim().toLowerCase()
    );
    if (found && found[1] !== undefined && found[1] !== null && found[1] !== '') {
      return found[1];
    }
    // Alias fallback for `Orang` (people) column
    if (colName.trim().toLowerCase() === 'orang') {
      const alias = draftEntries.find(([k]) =>
        /^(orang|pic|pic\s*\(orang\)|assignee|penanggung\s*jawab)$/i.test(k.trim())
      );
      if (alias) return alias[1];
    }
    return undefined;
  };

  let resolvedTitle = '';

  for (const col of schemaProps) {
    if (!col.writable) continue;
    const rawVal = findDraftVal(col.name);
    if (rawVal === undefined || rawVal === null || rawVal === '') continue;

    switch (col.type) {
      case 'title': {
        const str = String(rawVal).trim();
        if (str) {
          resolvedTitle = str;
          payload[col.name] = { title: buildRichTextChunks(str) };
        }
        break;
      }
      case 'rich_text': {
        const str = Array.isArray(rawVal) ? rawVal.join(', ') : String(rawVal).trim();
        const chunks = buildRichTextChunks(str);
        if (chunks.length > 0) {
          payload[col.name] = { rich_text: chunks };
        }
        break;
      }
      case 'select': {
        const firstVal = Array.isArray(rawVal) ? String(rawVal[0] || '') : String(rawVal);
        const matched = matchExistingOption(firstVal, col.options);
        if (matched) {
          payload[col.name] = { select: { name: matched.slice(0, 95) } };
        }
        break;
      }
      case 'multi_select': {
        const arr = Array.isArray(rawVal)
          ? rawVal.map(String)
          : String(rawVal)
              .split(/[,;/]/)
              .map((s) => s.trim())
              .filter(Boolean);
        const items = arr
          .map((v) => matchExistingOption(v, col.options))
          .filter(Boolean)
          .slice(0, 8)
          .map((name) => ({ name: name.slice(0, 95) }));
        if (items.length > 0) {
          payload[col.name] = { multi_select: items };
        }
        break;
      }
      case 'status': {
        // Notion API strictly requires status name to already exist in col.options!
        if (col.options.length > 0) {
          const str = String(rawVal).trim();
          const exactOrFuzzy = col.options.find(
            (o) =>
              o.toLowerCase() === str.toLowerCase() ||
              o.toLowerCase().includes(str.toLowerCase()) ||
              str.toLowerCase().includes(o.toLowerCase())
          );
          const safeStatus = exactOrFuzzy || col.options[0];
          if (safeStatus) {
            payload[col.name] = { status: { name: safeStatus } };
          }
        }
        break;
      }
      case 'date': {
        const str = String(rawVal).trim();
        const dateMatches = str.match(/\d{4}-\d{2}-\d{2}/g);
        if (dateMatches && dateMatches[0]) {
          payload[col.name] = {
            date: {
              start: dateMatches[0],
              ...(dateMatches[1] ? { end: dateMatches[1] } : {}),
            },
          };
        }
        break;
      }
      case 'people': {
        const peopleList = resolveNotionPeopleIds(rawVal);
        if (peopleList.length > 0) {
          payload[col.name] = { people: peopleList };
        }
        break;
      }
      case 'url': {
        const str = String(rawVal).trim();
        if (/^https?:\/\//i.test(str)) {
          payload[col.name] = { url: str };
        }
        break;
      }
      case 'number': {
        const num = Number(String(rawVal).replace(/[^0-9.-]/g, ''));
        if (Number.isFinite(num)) {
          payload[col.name] = { number: num };
        }
        break;
      }
      case 'checkbox': {
        const boolVal =
          typeof rawVal === 'boolean'
            ? rawVal
            : ['true', '1', 'ya', 'yes', 'checked'].includes(String(rawVal).trim().toLowerCase());
        payload[col.name] = { checkbox: boolVal };
        break;
      }
      case 'email': {
        const str = String(rawVal).trim();
        if (str.includes('@')) payload[col.name] = { email: str };
        break;
      }
      case 'phone_number': {
        const str = String(rawVal).trim();
        if (str) payload[col.name] = { phone_number: str };
        break;
      }
    }
  }

  // Guarantee title column is always populated!
  if (titleSchema && !payload[titleSchema.name]) {
    const fallbackTitle =
      String(
        draftProps?.title ||
          draftProps?.Judul ||
          draftProps?.Name ||
          draftProps?.Topik ||
          Object.values(draftProps || {})[0] ||
          'Ide Konten Baru'
      ).trim() || 'Ide Konten Baru';
    resolvedTitle = fallbackTitle;
    payload[titleSchema.name] = { title: buildRichTextChunks(fallbackTitle) };
  }

  return { payload, resolvedTitle: resolvedTitle || 'Konten Baru' };
}

function makeDividerBlock(): any {
  return { object: 'block', type: 'divider', divider: {} };
}

function makeParagraphBlock(text: string, bold = false): any {
  const clean = String(text || '').trim();
  return {
    object: 'block',
    type: 'paragraph',
    paragraph: {
      rich_text: clean ? (bold ? buildRichTextBold(clean) : buildRichTextChunks(clean)) : [],
    },
  };
}

function makeBulletedBlock(text: string): any {
  return {
    object: 'block',
    type: 'bulleted_list_item',
    bulleted_list_item: {
      rich_text: buildRichTextChunks(String(text || '').trim()),
    },
  };
}

function makeNumberedBlock(text: string): any {
  return {
    object: 'block',
    type: 'numbered_list_item',
    numbered_list_item: {
      rich_text: buildRichTextChunks(String(text || '').trim()),
    },
  };
}

/**
 * Parses `IDE KONTEN` text (whether pipe-separated on 1 line or multi-line) into the exact scene format:
 * - Bold Scene Header (`HOOK - 0:00-0:03`, `KESALAHAN 1 - 0:05-0:16`, `CEK 1 - 0:10-0:22`, `CTA - 0:55-1:00`, etc.)
 * - `✨ Visual: ...`
 * - `📝 Teks layar: ...`
 * - `🎙️ "..."`
 */
function buildIdeKontenCalloutChildren(rawIdeText: string): any[] {
  const children: any[] = [makeDividerBlock()];
  let text = String(rawIdeText || '').trim();
  if (!text) {
    children.push(makeParagraphBlock(''));
    return children;
  }

  // Put scene headers with timestamps on their own line even if written inline in a paragraph
  const sceneHeaderPattern =
    /(?:^|\s+)(?=(?:HOOK|BUKTI\s+MASALAH|BUKTI\s+DEMO|MASALAH(?:\s+\d+)?|CEK\s*\d+|KESALAHAN\s*\d+|TIPS\s*\d+|POIN\s*\d+|FAKTA\s*\d+|LANGKAH\s*\d+|STEP\s*\d+|SLIDE\s*\d+|DEMO(?:\s+\d+)?|SOLUSI(?:\s+\d+)?|PENUTUP|CLOSING|CTA|SCENE\s*\d+)\s*[-–:]\s*\d+:\d+)/gi;
  text = text.replace(sceneHeaderPattern, '\n');

  //Also split pipe-separated `| Visual:`, `| Teks layar:`, `| VO:` onto separate lines
  text = text.replace(
    /\s*\|\s*(?=(?:✨\s*)?Visual\s*:|(?:📝\s*)?(?:Teks\s*layar|Teks|On-screen\s*text)\s*:|(?:🎙️\s*)?(?:VO|Voice\s*Over|Narasi|Audio|Dialog)\s*:)/gi,
    '\n'
  );

  // Strip redundant metadata preamble before first scene header if scenes exist (e.g., "Judul: ... Jenis: ... Durasi: ... Produk: ... Content Pillar: ... PIC video: ...")
  const firstSceneIdx = text.search(
    /(?:^|\n)\s*(?:HOOK|SLIDE\s*1|SCENE\s*1)\s*[-–:]/i
  );
  if (firstSceneIdx > 0) {
    const preamble = text.slice(0, firstSceneIdx).trim();
    const restScenes = text.slice(firstSceneIdx).trim();
    // If preamble is just repeating properties (Judul/Jenis/Durasi/Produk/Content Pillar/PIC), drop the redundant part
    if (/judul\s*:|jenis\s*:|content\s*pillar\s*:|pic\s*video\s*:/i.test(preamble)) {
      text = restScenes;
    }
  }

  const lines = text
    .split('\n')
    .map((l) => l.replace(/^\s*\|\s*/, '').trim())
    .filter(Boolean);

  const isSceneHeaderLine = (line: string): boolean => {
    if (
      /^(?:HOOK|BUKTI[\s\w]*|MASALAH[\s\w]*|CEK\s*\d*|KESALAHAN\s*\d*|TIPS\s*\d*|POIN\s*\d*|FAKTA\s*\d*|LANGKAH\s*\d*|STEP\s*\d*|SLIDE\s*\d*|DEMO[\s\w]*|SOLUSI[\s\w]*|PENUTUP|CLOSING|CTA|SCENE\s*\d*)\s*[-–:]\s*\d+:\d+/i.test(
        line
      )
    ) {
      return true;
    }
    if (/^(?:SLIDE\s*\d+|SCENE\s*\d+|HOOK|PENUTUP|CTA)\s*(?:[-–:]\s*[\w\s]+)?$/i.test(line) && line.length <= 64) {
      return true;
    }
    return false;
  };

  for (const rawLine of lines) {
    const line = rawLine.replace(/^\*\*(.+)\*\*$/, '$1').trim();
    if (!line) continue;

    if (isSceneHeaderLine(line)) {
      children.push(makeParagraphBlock(line, true));
      continue;
    }

    const visualMatch = /^(?:✨\s*)?Visual\s*:\s*(.+)$/i.exec(line);
    if (visualMatch) {
      children.push(makeParagraphBlock(`✨ Visual: ${visualMatch[1].trim()}`));
      continue;
    }

    const teksLayarMatch = /^(?:📝\s*)?(?:Teks\s*layar|Teks\s*di\s*layar|On-screen\s*text|Teks)\s*:\s*(.+)$/i.exec(
      line
    );
    if (teksLayarMatch) {
      children.push(makeParagraphBlock(`📝 Teks layar: ${teksLayarMatch[1].trim()}`));
      continue;
    }

    const voMatch =
      /^(?:🎙️\s*)?(?:VO|Voice\s*Over|Narasi|Audio|Dialog)\s*:\s*(.+)$/i.exec(line) ||
      /^🎙️\s*(.+)$/i.exec(line);
    if (voMatch) {
      const inner = voMatch[1]
        .trim()
        .replace(/^["“”']+/, '')
        .replace(/["“”']+$/, '')
        .trim();
      children.push(makeParagraphBlock(`🎙️ "${inner}"`));
      continue;
    }

    if (/^[-*•]\s+/.test(line)) {
      children.push(makeBulletedBlock(line.replace(/^[-*•]\s+/, '')));
    } else if (/^\d+\.\s+/.test(line)) {
      children.push(makeNumberedBlock(line.replace(/^\d+\.\s+/, '')));
    } else {
      children.push(makeParagraphBlock(line));
    }
  }

  return children.slice(0, 90);
}

/**
 * Formats `SKRIP / CAPTION :` callout children to match the user's exact reference template:
 * - Divider
 * - Opening caption hook paragraph
 * - Numbered list items (`1. ...`, `2. ...`)
 * - Closing CTA paragraph (`Save video ini...`)
 * - Hashtags line (`#mesinlas ...`)
 * - Keywords line (`Keywords: ...`)
 */
function buildSkripCaptionCalloutChildren(rawCaptionText: string): any[] {
  const children: any[] = [makeDividerBlock()];
  let text = String(rawCaptionText || '')
    .trim()
    .replace(/^Caption\s*:\s*/i, '');

  if (!text) {
    children.push(makeParagraphBlock(''));
    return children;
  }

  // Ensure `| Keywords:` or `Keywords:` is on its own line
  text = text.replace(/\s*\|?\s*(?=Keywords\s*:)/gi, '\n');
  // Ensure hashtag cluster (`#tag1 #tag2`) starts on its own line if preceded by sentence punctuation
  text = text.replace(/([.!?])\s+(?=#[\w]+)/g, '$1\n');
  // Ensure inline numbered items (`1. ... 2. ...`) are on their own lines
  text = text.replace(/\s+(?=\d+\.\s+[A-Z0-9])/g, '\n');

  const lines = text
    .split('\n')
    .map((l) => l.replace(/^\s*\|\s*/, '').trim())
    .filter(Boolean);

  for (const line of lines) {
    if (/^\d+\.\s+/.test(line)) {
      children.push(makeNumberedBlock(line.replace(/^\d+\.\s+/, '').trim()));
    } else if (/^[-*•]\s+/.test(line)) {
      children.push(makeBulletedBlock(line.replace(/^[-*•]\s+/, '').trim()));
    } else {
      children.push(makeParagraphBlock(line));
    }
  }

  return children.slice(0, 90);
}

function buildGenericCalloutChildren(rawText: string): any[] {
  const children: any[] = [makeDividerBlock()];
  const text = String(rawText || '').trim();
  if (!text) {
    children.push(makeParagraphBlock(''));
    return children;
  }

  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  for (const line of lines) {
    if (/^\d+\.\s+/.test(line)) {
      children.push(makeNumberedBlock(line.replace(/^\d+\.\s+/, '').trim()));
    } else if (/^[-*•]\s+/.test(line)) {
      children.push(makeBulletedBlock(line.replace(/^[-*•]\s+/, '').trim()));
    } else {
      children.push(makeParagraphBlock(line));
    }
  }

  return children.slice(0, 90);
}

/**
 * Writes the exact Notion Content Calendar body template used across the user's pages
 * (`5 KESALAHAN PEMULA PAKAI MIG`, `3 TIPS POTONG PLAT BESI TEBAL`, etc.):
 * - Top Block 1: `toggle` bold `"TO DO LIST :"` -> child `callout` (📌, gray_background)
 * - Top Block 2: `divider`
 * - Top Block 3: `toggle` bold `"DASHBOARD KONTEN :"` -> children:
 *    1. `divider`
 *    2. `callout` (📖, gray_background, bold `"REFERENSI :"`)
 *    3. `divider`
 *    4. `callout` (📖, gray_background, bold `"IDE KONTEN :"`)
 *    5. `divider`
 *    6. `callout` (📖, gray_background, bold `"SKRIP / CAPTION :"`)
 *    7. `divider`
 *    8. `callout` (📖, gray_background, bold `"PANDUAN DESIGN :"`)
 *    9. `divider`
 *   10. `callout` (🔗, gray_background, bold `"Link Content :"`)
 */
export async function writeStructuredContentCalendarBody(
  token: string,
  pageId: string,
  sections?: Array<{ heading?: string; content: string }>,
  clearExistingBlocks = false
): Promise<void> {
  if (!Array.isArray(sections) || sections.length === 0) return;

  if (clearExistingBlocks) {
    const existingRes = await notionFetch(token, `/blocks/${pageId}/children?page_size=100`, {
      method: 'GET',
    });
    if (existingRes.ok && Array.isArray(existingRes.data?.results)) {
      for (const blk of existingRes.data.results) {
        if (blk?.id) {
          await notionFetch(token, `/blocks/${blk.id}`, { method: 'DELETE' });
        }
      }
    }
  }

  let todoText = '';
  let referensiText = '';
  let ideKontenText = '';
  let skripCaptionText = '';
  let panduanDesignText = '';
  let linkContentText = '';

  for (const sec of sections) {
    const h = String(sec.heading || '').trim();
    const c = String(sec.content || '').trim();
    if (!c && !h) continue;

    if (/to\s*do|checklist|tugas/i.test(h)) {
      todoText = todoText ? `${todoText}\n${c}` : c;
    } else if (/referensi|reference|acuan/i.test(h)) {
      referensiText = referensiText ? `${referensiText}\n${c}` : c;
    } else if (/skrip|script\s*\/\s*caption|caption|hashtag/i.test(h)) {
      skripCaptionText = skripCaptionText ? `${skripCaptionText}\n${c}` : c;
    } else if (/panduan|produksi|design|desain|shoot/i.test(h)) {
      panduanDesignText = panduanDesignText ? `${panduanDesignText}\n${c}` : c;
    } else if (/link\s*content|link\s*konten|url|arsip/i.test(h)) {
      linkContentText = linkContentText ? `${linkContentText}\n${c}` : c;
    } else {
      // Default to IDE KONTEN (covers `IDE KONTEN`, `Hook & Visual Brief`, `Script & Poin Utama`, etc.)
      ideKontenText = ideKontenText ? `${ideKontenText}\n${c}` : c;
    }
  }

  // Clean up any old apology note about `Create by` in todoText
  const cleanedTodoLines = (todoText || 'Checklist produksi & validasi visual sebelum upload.')
    .split('\n')
    .map((l) =>
      l
        .replace(
          /Creator konten:\s*Dika Agustian,\s*dicatat di isi page karena kolom Create by mengikuti akun pembuat page dan tidak bisa diisi manual\.?\s*/gi,
          ''
        )
        .trim()
    )
    .filter(Boolean);

  const todoCalloutHeader =
    cleanedTodoLines[0] || 'Checklist produksi & validasi visual sebelum upload.';
  const todoExtraLines = cleanedTodoLines.slice(1);

  const topBlocks: any[] = [
    {
      object: 'block',
      type: 'toggle',
      toggle: {
        rich_text: buildRichTextBold('TO DO LIST :'),
        children: [
          {
            object: 'block',
            type: 'callout',
            callout: {
              rich_text: buildRichTextChunks(todoCalloutHeader),
              icon: { type: 'emoji', emoji: '📌' },
              color: 'gray_background',
              ...(todoExtraLines.length > 0
                ? {
                    children: todoExtraLines.map((line) => makeParagraphBlock(line)),
                  }
                : {}),
            },
          },
        ],
      },
    },
    makeDividerBlock(),
    {
      object: 'block',
      type: 'toggle',
      toggle: {
        rich_text: buildRichTextBold('DASHBOARD KONTEN :'),
      },
    },
  ];

  // Step 1: Append Top-Level Toggles (`TO DO LIST :`, `divider`, `DASHBOARD KONTEN :`)
  const topAppendRes = await notionFetch(token, `/blocks/${pageId}/children`, {
    method: 'PATCH',
    body: JSON.stringify({ children: topBlocks }),
  });

  if (!topAppendRes.ok || !Array.isArray(topAppendRes.data?.results)) {
    return;
  }

  const dashboardToggleBlock = topAppendRes.data.results.find(
    (b: any) =>
      b?.type === 'toggle' &&
      extractPlainText(b.toggle?.rich_text).toUpperCase().includes('DASHBOARD KONTEN')
  );
  const targetDashboardBlockId = dashboardToggleBlock?.id || pageId;

  // Step 2: Append the 5 Grey Callout Boxes + Dividers inside `DASHBOARD KONTEN :`
  const dashboardChildren: any[] = [
    makeDividerBlock(),
    {
      object: 'block',
      type: 'callout',
      callout: {
        rich_text: buildRichTextBold('REFERENSI :'),
        icon: { type: 'emoji', emoji: '📖' },
        color: 'gray_background',
        children: buildGenericCalloutChildren(referensiText),
      },
    },
    makeDividerBlock(),
    {
      object: 'block',
      type: 'callout',
      callout: {
        rich_text: buildRichTextBold('IDE KONTEN :'),
        icon: { type: 'emoji', emoji: '📖' },
        color: 'gray_background',
        children: buildIdeKontenCalloutChildren(ideKontenText),
      },
    },
    makeDividerBlock(),
    {
      object: 'block',
      type: 'callout',
      callout: {
        rich_text: buildRichTextBold('SKRIP / CAPTION :'),
        icon: { type: 'emoji', emoji: '📖' },
        color: 'gray_background',
        children: buildSkripCaptionCalloutChildren(skripCaptionText),
      },
    },
    makeDividerBlock(),
    {
      object: 'block',
      type: 'callout',
      callout: {
        rich_text: buildRichTextBold('PANDUAN DESIGN :'),
        icon: { type: 'emoji', emoji: '📖' },
        color: 'gray_background',
        children: buildGenericCalloutChildren(panduanDesignText),
      },
    },
    makeDividerBlock(),
    {
      object: 'block',
      type: 'callout',
      callout: {
        rich_text: buildRichTextBold('Link Content :'),
        icon: { type: 'emoji', emoji: '🔗' },
        color: 'gray_background',
        children: buildGenericCalloutChildren(linkContentText),
      },
    },
  ];

  await notionFetch(token, `/blocks/${targetDashboardBlockId}/children`, {
    method: 'PATCH',
    body: JSON.stringify({ children: dashboardChildren }),
  });
}

/**
 * Inserts one or more content rows strictly into the locked Notion Content Calendar database.
 * Enforces agent access control: ONLY Nadia ('social-media') or explicitly allowed agents can write.
 */
export async function insertItemsIntoNotionCalendar(
  agentId: string,
  items: NotionCalendarItemDraft[]
): Promise<{
  ok: boolean;
  message: string;
  createdPages: NotionCreatedPageInfo[];
  errors: string[];
}> {
  const secret = readSecret();
  if (!secret.allowedAgentIds.includes(agentId)) {
    return {
      ok: false,
      message: `Akses ditolak: Hanya Nadia (Sosial Media Spesialist) yang diizinkan menginput ke Konten Kalender Notion.`,
      createdPages: [],
      errors: ['Unauthorized agent'],
    };
  }

  if (!secret.token || (!secret.databaseId && !secret.dataSourceId)) {
    return {
      ok: false,
      message:
        'Notion Konten Kalender belum dihubungkan. Buka menu "📅 Notion Kalender" untuk menghubungkan token & link kalender Anda.',
      createdPages: [],
      errors: ['Not connected'],
    };
  }

  // Ensure schema & dataSourceId are fresh (2025-09-03)
  let state = getNotionCalendarState();
  if (state.properties.length === 0 || !state.dataSourceId) {
    const syncRes = await connectAndSyncNotionCalendar();
    state = syncRes.state;
  }

  if ((!state.databaseId && !state.dataSourceId) || state.properties.length === 0) {
    return {
      ok: false,
      message: 'Gagal membaca struktur kolom Konten Kalender Notion.',
      createdPages: [],
      errors: ['Empty schema'],
    };
  }

  const parentPayload = state.dataSourceId
    ? { type: 'data_source_id', data_source_id: state.dataSourceId }
    : { database_id: state.databaseId };

  const detectedWorkstream = detectContentCalendarWorkstreamProp(state.properties);
  const createdPages: NotionCreatedPageInfo[] = [];
  const errors: string[] = [];
  const titleProp = state.properties.find((p) => p.type === 'title');

  for (const item of items) {
    const mergedItemProps: Record<string, unknown> = { ...(item.properties || {}) };
    if (detectedWorkstream && mergedItemProps[detectedWorkstream.propName] === undefined) {
      mergedItemProps[detectedWorkstream.propName] = detectedWorkstream.optionName;
    }
    if (mergedItemProps['Source (Inisiatif)'] === undefined) {
      mergedItemProps['Source (Inisiatif)'] = 'Self-Initiated';
    }
    if (mergedItemProps['Status'] === undefined) {
      mergedItemProps['Status'] = 'Planning';
    }
    // Auto-fill `Orang` based on `Type` (Septa for Video, Rafly Aditya Ramadhan for Photo/Design) if not explicitly specified
    if (
      mergedItemProps['Orang'] === undefined &&
      mergedItemProps['PIC'] === undefined &&
      mergedItemProps['Assignee'] === undefined
    ) {
      const contentType = String(mergedItemProps['Type'] || '').toLowerCase();
      mergedItemProps['Orang'] = /photo|carousel|single\s*post|design|desain/i.test(contentType)
        ? 'Rafly Aditya Ramadhan'
        : 'Septa';
    }

    const { payload, resolvedTitle } = buildNotionPropertiesPayload(
      mergedItemProps,
      state.properties
    );

    let createRes = await notionFetch(secret.token, '/pages', {
      method: 'POST',
      body: JSON.stringify({
        parent: parentPayload,
        icon: { type: 'emoji', emoji: '👻' },
        properties: payload,
      }),
    });

    // Safe fallback: if a custom property caused a validation mismatch, retry with title + date + workstream
    if (!createRes.ok && titleProp) {
      const dateProp =
        state.properties.find((p) => p.type === 'date' && /publish|tayang/i.test(p.name)) ||
        state.properties.find((p) => p.type === 'date');
      const fallbackProps: Record<string, any> = {
        [titleProp.name]: payload[titleProp.name],
      };
      if (dateProp && payload[dateProp.name]) {
        fallbackProps[dateProp.name] = payload[dateProp.name];
      }
      if (detectedWorkstream && payload[detectedWorkstream.propName]) {
        fallbackProps[detectedWorkstream.propName] = payload[detectedWorkstream.propName];
      }
      if (payload['Orang']) {
        fallbackProps['Orang'] = payload['Orang'];
      }
      createRes = await notionFetch(secret.token, '/pages', {
        method: 'POST',
        body: JSON.stringify({
          parent: parentPayload,
          icon: { type: 'emoji', emoji: '👻' },
          properties: fallbackProps,
        }),
      });
    }

    if (createRes.ok && createRes.data?.id) {
      if (Array.isArray(item.bodySections) && item.bodySections.length > 0) {
        await writeStructuredContentCalendarBody(
          secret.token,
          createRes.data.id,
          item.bodySections,
          false
        );
      }
      createdPages.push({
        id: createRes.data.id,
        title: resolvedTitle,
        url:
          createRes.data.url ||
          `https://www.notion.so/${String(createRes.data.id).replace(/-/g, '')}`,
      });
    } else {
      errors.push(`${resolvedTitle}: ${createRes.errorMessage || 'Gagal membuat baris'}`);
    }
  }

  // Refresh cached entries immediately after insert so subsequent reads see the new rows
  if (createdPages.length > 0) {
    await connectAndSyncNotionCalendar().catch(() => {});
  }

  return {
    ok: createdPages.length > 0,
    message:
      createdPages.length > 0
        ? `Nadia berhasil menginput ${createdPages.length} konten baru langsung ke Notion "${state.databaseTitle}"!`
        : `Gagal menginput konten ke Notion: ${errors.join('; ')}`,
    createdPages,
    errors,
  };
}

/**
 * Updates existing rows strictly inside the locked Content Calendar (verified against state.entries).
 */
export async function updateItemsInNotionCalendar(
  agentId: string,
  updates: NotionCalendarItemUpdateDraft[]
): Promise<{
  ok: boolean;
  updatedPages: NotionCreatedPageInfo[];
  errors: string[];
}> {
  const secret = readSecret();
  if (!secret.allowedAgentIds.includes(agentId) || !secret.token) {
    return { ok: false, updatedPages: [], errors: ['Unauthorized or disconnected'] };
  }

  let state = getNotionCalendarState();
  if (state.entries.length === 0) {
    const syncRes = await connectAndSyncNotionCalendar();
    state = syncRes.state;
  }

  const allowedPageHexSet = new Set(state.entries.map((e) => normalizeUuidHex(e.id)));
  const titleProp = state.properties.find((p) => p.type === 'title');
  const updatedPages: NotionCreatedPageInfo[] = [];
  const errors: string[] = [];

  for (const upd of updates) {
    const cleanHex = normalizeUuidHex(upd.pageId);
    if (!cleanHex || !allowedPageHexSet.has(cleanHex)) {
      errors.push(`Page ID ${upd.pageId} di luar cakupan Konten Kalender.`);
      continue;
    }

    const existingEntry = state.entries.find((e) => normalizeUuidHex(e.id) === cleanHex);
    const { payload } = buildNotionPropertiesPayload(upd.properties || {}, state.properties);
    // Remove auto-fallback title if user didn't actually intend to rename the post
    if (
      titleProp &&
      upd.properties?.[titleProp.name] === undefined &&
      upd.properties?.title === undefined
    ) {
      delete payload[titleProp.name];
    }

    const hasBodySections = Array.isArray(upd.bodySections) && upd.bodySections.length > 0;
    if (Object.keys(payload).length === 0 && !hasBodySections) continue;

    const formattedPageId = formatUuidWithDashes(cleanHex);
    let patchOk = true;
    let patchedUrl = existingEntry?.url || '';
    let patchErrorMsg = '';

    if (Object.keys(payload).length > 0) {
      const patchRes = await notionFetch(secret.token, `/pages/${formattedPageId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          icon: { type: 'emoji', emoji: '👻' },
          properties: payload,
        }),
      });
      patchOk = patchRes.ok && Boolean(patchRes.data?.id);
      patchedUrl = patchRes.data?.url || patchedUrl;
      patchErrorMsg = patchRes.errorMessage || '';
    }

    if (patchOk && hasBodySections) {
      await writeStructuredContentCalendarBody(
        secret.token,
        formattedPageId,
        upd.bodySections,
        upd.replaceBody !== false
      );
    }

    if (patchOk) {
      updatedPages.push({
        id: formattedPageId,
        title: existingEntry?.title || 'Baris Konten Kalender',
        url: patchedUrl,
      });
    } else {
      errors.push(`${existingEntry?.title || upd.pageId}: ${patchErrorMsg || 'Gagal update'}`);
    }
  }

  if (updatedPages.length > 0) {
    await connectAndSyncNotionCalendar().catch(() => {});
  }

  return {
    ok: updatedPages.length > 0,
    updatedPages,
    errors,
  };
}

function summarizeCounts(entries: NotionSampleEntry[], propName: string): string {
  if (!propName) return '-';
  const counts = new Map<string, number>();
  for (const e of entries) {
    const raw = e.propertiesSummary[propName];
    if (!raw) {
      counts.set('(Kosong)', (counts.get('(Kosong)') || 0) + 1);
      continue;
    }
    for (const part of raw.split(',').map((s) => s.trim()).filter(Boolean)) {
      counts.set(part, (counts.get(part) || 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `${k}: ${v}`)
    .join(' | ');
}

/**
 * System prompt snippet ONLY given to Nadia ('social-media') with FULL LIVE READ of all Content Calendar rows
 * plus auto-insert (`notion-input`) & auto-update (`notion-update`) capabilities!
 */
export function getNotionPromptContextForAgent(agentId: string): string {
  const state = getNotionCalendarState();
  if (!state.allowedAgentIds.includes(agentId)) {
    return '';
  }

  if (!state.connected || state.properties.length === 0) {
    return [
      `=== AKSES NOTION KONTEN KALENDER ===`,
      `Status: Belum terhubung. Jika Bos meminta cek atau input ke Notion, arahkan Bos untuk klik tombol "📅 Notion Kalender" di atas layar untuk menempelkan Notion Integration Token & Link halaman Konten Kalender.`,
    ].join('\n');
  }

  const writableCols = state.properties
    .filter((p) => p.writable)
    .map(
      (p) =>
        `  - "${p.name}" (tipe: ${p.type})${
          p.options.length > 0 ? ` | Pilihan resmi: [${p.options.join(', ')}]` : ''
        }`
    )
    .join('\n');

  const todayIso = new Date().toISOString().slice(0, 10);
  const statusCol = state.properties.find((p) => p.type === 'status')?.name || 'Status';
  const publishDateCol =
    state.properties.find((p) => p.type === 'date' && /publish|tayang/i.test(p.name))?.name ||
    state.properties.find((p) => p.type === 'date')?.name ||
    'PUBLISH DATE';
  const deadlineCol =
    state.properties.find((p) => p.type === 'date' && /deadline/i.test(p.name))?.name ||
    'Content Deadline';
  const pillarCol =
    state.properties.find((p) => /pillar|pilar/i.test(p.name))?.name || 'Content Pillar';
  const platformCol =
    state.properties.find((p) => /platform|channel|kanal/i.test(p.name))?.name || 'Platform';
  const productCol =
    state.properties.find((p) => /product|produk/i.test(p.name))?.name || 'Product';
  const typeCol = state.properties.find((p) => /^type$|format|jenis/i.test(p.name))?.name || 'Type';
  const picCol = state.properties.find((p) => p.type === 'people')?.name || 'Orang';

  const allEntries = state.entries || [];
  const activeOrUpcoming = allEntries.filter((e) => {
    const st = (e.propertiesSummary[statusCol] || '').toLowerCase();
    const pubDate = e.propertiesSummary[publishDateCol] || '';
    const isFinished = st.includes('published') || st.includes('done') || st.includes('shelved');
    return !isFinished || pubDate >= todayIso;
  });

  const completedHistory = allEntries.filter((e) => !activeOrUpcoming.includes(e));

  const formatEntryDetailed = (e: NotionSampleEntry, idx: number): string => {
    const p = e.propertiesSummary;
    const metaParts = [
      `${publishDateCol}: ${p[publishDateCol] || '(Belum diisi)'}`,
      p[deadlineCol] ? `${deadlineCol}: ${p[deadlineCol]}` : '',
      `${statusCol}: ${p[statusCol] || '-'}`,
      p[platformCol] ? `${platformCol}: ${p[platformCol]}` : '',
      p[typeCol] ? `${typeCol}: ${p[typeCol]}` : '',
      p[pillarCol] ? `${pillarCol}: ${p[pillarCol]}` : '',
      p[productCol] ? `${productCol}: ${p[productCol]}` : '',
      p[picCol] ? `PIC (${picCol}): ${p[picCol]}` : '',
      p['Link Referensi'] ? `Ref: ${p['Link Referensi']}` : '',
    ].filter(Boolean);

    return `  ${idx + 1}. [${e.title}] (pageId: ${e.id})\n     • ${metaParts.join(' | ')}${
      e.bodyPreview ? `\n     • Isi Halaman/Brief/Script: ${e.bodyPreview}` : ''
    }`;
  };

  const formatEntryCompactRow = (e: NotionSampleEntry, idx: number): string => {
    const p = e.propertiesSummary;
    return `  ${idx + 1}. ${p[publishDateCol] || '(Tanpa Tanggal)'} | **${e.title}** | Status: ${
      p[statusCol] || '-'
    } | Platform: ${p[platformCol] || '-'} | Type: ${p[typeCol] || '-'} | Pillar: ${
      p[pillarCol] || '-'
    } | Produk: ${p[productCol] || '-'}${e.bodyPreview ? ` | Isi: ${e.bodyPreview.slice(0, 140)}` : ''}`;
  };

  const activeDump =
    activeOrUpcoming.length > 0
      ? activeOrUpcoming.slice(0, 120).map(formatEntryDetailed).join('\n')
      : '  (Tidak ada baris dengan status aktif/upcoming — semua baris yang ada sudah berstatus Published/Done atau belum dibuat)';

  const historyDump =
    completedHistory.length > 0
      ? completedHistory.slice(0, 400).map(formatEntryCompactRow).join('\n')
      : '  (Belum ada riwayat konten selesai)';

  return [
    `=== AKSES PENUH LIVE NOTION KONTEN KALENDER (FULL READ + WRITE AKTIF!) ===`,
    `- STATUS PENTING: ✅ FULL READ & WRITE AKTIF LIVE! Kamu SUDAH BISA MEMBACA SELURUH DATA KONTEN KALENDER NOTION BOS secara langsung di bawah ini (BUKAN write-only!).`,
    `- JANGAN PERNAH bilang kamu "belum bisa baca database Notion" atau "write-only" — seluruh baris existing di Konten Kalender Bos sudah ditarik live dari Notion API ke memorimu di bawah ini!`,
    `- Database Terhubung: "${state.databaseTitle}" • Tabel Aktif: "${state.dataSourceName || state.databaseTitle}"`,
    `- Cakupan Terkunci: ${state.workstreamFilter || 'Seluruh baris Konten Kalender'}`,
    `- Waktu Sinkronisasi Live Terakhir: ${state.lastSyncedAt || 'Baru saja'} | Tanggal Hari Ini (ISO): ${todayIso}`,
    ``,
    `--- REKAP STATISTIK LIVE DARI SELURUH ${allEntries.length} BARIS KONTEN KALENDER BOS ---`,
    `- Total Baris Konten Kalender Terbaca: ${allEntries.length} baris (${activeOrUpcoming.length} Aktif/Upcoming, ${completedHistory.length} Selesai/Published)`,
    `- Distribusi Status (${statusCol}): ${summarizeCounts(allEntries, statusCol)}`,
    `- Distribusi Platform (${platformCol}): ${summarizeCounts(allEntries, platformCol)}`,
    `- Distribusi Content Pillar (${pillarCol}): ${summarizeCounts(allEntries, pillarCol)}`,
    `- Distribusi Produk (${productCol}): ${summarizeCounts(allEntries, productCol)}`,
    ``,
    `--- BAGIAN A: DAFTAR LENGKAP KONTEN AKTIF / UPCOMING / BELUM TAYANG (${activeOrUpcoming.length} BARIS) ---`,
    activeDump,
    ``,
    `--- BAGIAN B: RIWAYAT KONTEN SUDAH TAYANG / SELESAI (${completedHistory.length} BARIS) ---`,
    historyDump,
    ``,
    `--- DAFTAR KOLOM ASLI NOTION BOS (UNTUK INPUT / UPDATE) ---`,
    writableCols,
    ``,
    `--- ATURAN EKSEKUSI WRITE / INPUT & UPDATE KE NOTION (TEMPLATE RESMI BOS) ---`,
    `1. Jika Bos hanya bertanya / meminta cek / audit isi Notion Konten Kalender: jawab langsung berdasarkan DATA LIVE di Bagian A & B di atas (tanpa perlu menulis blok \`notion-input\`).`,
    `2. Kolom "Orang" (tipe: people) SEKARANG SUDAH BISA DIISI OTOMATIS! Isi "Orang": "Septa" jika konten Video ("Video Reels/Short"), atau "Orang": "Rafly Aditya Ramadhan" jika konten Design/Foto ("Photo (Carousel)" / "Photo (Single Post)"). Jika Bos minta menyertakan Dika juga, bisa isi ["Septa", "Dika Agustian"].`,
    `3. Jika Bos meminta kamu MENGINPUT / MENAMBAHKAN jadwal konten baru ke Notion: sistem otomatis membungkus \`bodySections\` ke dalam Template Toggle "TO DO LIST :" & "DASHBOARD KONTEN :" (lengkap dengan kotak Callout abu-abu 📖 REFERENSI, 📖 IDE KONTEN, 📖 SKRIP / CAPTION, 📖 PANDUAN DESIGN, 🔗 Link Content dan ikon 👻). WAJIB sertakan blok \`\`\`notion-input ... \`\`\` di paling akhir jawaban dengan format struktur di bawah ini:`,
    `\`\`\`notion-input`,
    `[`,
    `  {`,
    `    "properties": {`,
    `      "Post": "JUDUL KONTEN HURUF KAPITAL",`,
    `      "PUBLISH DATE": "2026-11-18",`,
    `      "Content Deadline": "2026-11-18",`,
    `      "Status": "Planning",`,
    `      "Platform": ["TikTok", "Instagram Reels"],`,
    `      "Type": "Video Reels/Short",`,
    `      "Content Pillar": ["Edukasi", "Problem-solution"],`,
    `      "Product": ["MESIN LAS"],`,
    `      "Orang": "Septa",`,
    `      "Source (Inisiatif)": "Self-Initiated",`,
    `      "Workstream": "Content Calender"`,
    `    },`,
    `    "bodySections": [`,
    `      { "heading": "TO DO LIST", "content": "Checklist produksi & validasi visual sebelum shoot." },`,
    `      { "heading": "REFERENSI", "content": "..." },`,
    `      { "heading": "IDE KONTEN", "content": "HOOK - 0:00-0:03\\n✨ Visual: ...\\n📝 Teks layar: ...\\n🎙️ \\"...\\"\\n\\nPOIN 1 - 0:03-0:15\\n✨ Visual: ...\\n📝 Teks layar: ...\\n🎙️ \\"...\\"\\n\\nCTA - 0:45-0:52\\n✨ Visual: ...\\n📝 Teks layar: ...\\n🎙️ \\"...\\"" },`,
    `      { "heading": "SKRIP / CAPTION", "content": "Kalimat pembuka caption...\\n1. Poin pertama\\n2. Poin kedua\\nSave video ini biar nggak keulang.\\n#mesinlas #belajarlas\\nKeywords: ..." },`,
    `      { "heading": "PANDUAN DESIGN", "content": "Brief shoot / design untuk PIC..." },`,
    `      { "heading": "Link Content", "content": "" }`,
    `    ]`,
    `  }`,
    `]`,
    `\`\`\``,
    `4. Jika Bos meminta MENGUPDATE baris konten yang sudah ada (baik properti seperti "Orang", "Status", "PUBLISH DATE", maupun merapikan isi body halaman): sertakan blok \`\`\`notion-update ... \`\`\` di paling akhir jawaban berisi JSON Array \`[{ "pageId": "<pageId dari Bagian A/B>", "properties": { "Orang": "Septa", ... }, "bodySections": [ ... ] }]\`.`,
  ].join('\n');
}

/**
 * Detects any ```notion-input ... ``` or ```notion-update ... ``` JSON payload in Nadia's LLM response,
 * executes the Notion API writes automatically, strips raw JSON blocks from chat,
 * and appends a clean clickable Notion confirmation summary!
 */
export async function processNadiaNotionAutoInputInReply(
  agentId: string,
  rawReplyContent: string
): Promise<{
  cleanedContent: string;
  createdPages: NotionCreatedPageInfo[];
}> {
  const inputRegex = /```notion-input\s*([\s\S]*?)```/i;
  const updateRegex = /```notion-update\s*([\s\S]*?)```/i;

  const inputMatch = inputRegex.exec(rawReplyContent);
  const updateMatch = updateRegex.exec(rawReplyContent);

  if (!inputMatch && !updateMatch) {
    return { cleanedContent: rawReplyContent, createdPages: [] };
  }

  let cleanedBase = rawReplyContent
    .replace(inputRegex, '')
    .replace(updateRegex, '')
    .trim();

  const allAffectedPages: NotionCreatedPageInfo[] = [];
  const confirmationNotes: string[] = [];

  if (inputMatch) {
    try {
      const parsed = JSON.parse(inputMatch[1].trim());
      const parsedItems: NotionCalendarItemDraft[] = Array.isArray(parsed) ? parsed : [parsed];
      if (parsedItems.length > 0) {
        const insertRes = await insertItemsIntoNotionCalendar(agentId, parsedItems);
        if (insertRes.ok && insertRes.createdPages.length > 0) {
          allAffectedPages.push(...insertRes.createdPages);
          const state = getNotionCalendarState();
          const linksMd = insertRes.createdPages
            .map((p, idx) => `${idx + 1}. **[${p.title}](${p.url})**`)
            .join('\n');
          confirmationNotes.push(
            `### ✅ Berhasil Diinput ke Notion: ${state.databaseTitle} (${insertRes.createdPages.length} Konten Baru)\n${linksMd}`
          );
        } else {
          confirmationNotes.push(`> ⚠️ **Gagal Input ke Notion:** ${insertRes.message}`);
        }
      }
    } catch {
      confirmationNotes.push(
        `> ⚠️ **Catatan Notion:** Format JSON \`notion-input\` gagal diparsing otomatis.`
      );
    }
  }

  if (updateMatch) {
    try {
      const parsed = JSON.parse(updateMatch[1].trim());
      const parsedUpdates: NotionCalendarItemUpdateDraft[] = Array.isArray(parsed)
        ? parsed
        : [parsed];
      if (parsedUpdates.length > 0) {
        const updRes = await updateItemsInNotionCalendar(agentId, parsedUpdates);
        if (updRes.ok && updRes.updatedPages.length > 0) {
          allAffectedPages.push(...updRes.updatedPages);
          const linksMd = updRes.updatedPages
            .map((p, idx) => `${idx + 1}. **[${p.title}](${p.url})**`)
            .join('\n');
          confirmationNotes.push(
            `### ✅ Berhasil Update Baris Existing di Notion (${updRes.updatedPages.length} Konten)\n${linksMd}`
          );
        } else if (updRes.errors.length > 0) {
          confirmationNotes.push(`> ⚠️ **Gagal Update Notion:** ${updRes.errors.join('; ')}`);
        }
      }
    } catch {
      confirmationNotes.push(
        `> ⚠️ **Catatan Notion:** Format JSON \`notion-update\` gagal diparsing otomatis.`
      );
    }
  }

  const suffix = confirmationNotes.length > 0 ? `\n\n---\n${confirmationNotes.join('\n\n')}` : '';

  return {
    cleanedContent: `${cleanedBase}${suffix}`,
    createdPages: allAffectedPages,
  };
}
