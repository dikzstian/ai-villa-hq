import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { HERMES_WORKSPACE_DIR, UPLOADS_DIR } from './storage.ts';

const execFileAsync = promisify(execFile);

export const SOCIAL_CDP_PORT = 9222;
export const SOCIAL_BROWSER_PROFILE_DIR = path.join(HERMES_WORKSPACE_DIR, 'browser_profile');
export const SOCIAL_SNAPSHOT_FILE = path.join(HERMES_WORKSPACE_DIR, 'social_live_snapshot.md');
export const SOCIAL_SNAPSHOT_META_FILE = path.join(
  HERMES_WORKSPACE_DIR,
  'social_live_snapshot_meta.json'
);
export const SOCIAL_SCREENSHOTS_DIR = path.join(UPLOADS_DIR, 'browser_snapshots');
export const HERMES_MCP_CONFIG_FILE = path.join(HERMES_WORKSPACE_DIR, '.mcp.json');

export interface SocialBrowserTab {
  id: string;
  title: string;
  url: string;
  platform: string;
  webSocketDebuggerUrl?: string;
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

function detectBrowserBinary(): string | null {
  const candidates = [
    path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Google\\Chrome\\Application\\chrome.exe'),
    path.join(
      process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)',
      'Google\\Chrome\\Application\\chrome.exe'
    ),
    path.join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe'),
    path.join(
      process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)',
      'Microsoft\\Edge\\Application\\msedge.exe'
    ),
    path.join(
      process.env.ProgramFiles || 'C:\\Program Files',
      'Microsoft\\Edge\\Application\\msedge.exe'
    ),
  ];

  for (const c of candidates) {
    if (c && fs.existsSync(c)) return c;
  }
  return null;
}

export function detectSocialPlatform(url: string): string {
  const u = (url || '').toLowerCase();
  if (u.includes('instagram.com')) return 'Instagram';
  if (u.includes('tiktok.com')) return 'TikTok / TikTok Studio';
  if (u.includes('adsmanager.facebook.com')) return 'Meta Ads Manager';
  if (u.includes('business.facebook.com')) return 'Meta Business Suite';
  if (u.includes('facebook.com')) return 'Facebook';
  if (u.includes('studio.youtube.com') || u.includes('youtube.com')) return 'YouTube';
  if (u.includes('seller.shopee') || u.includes('shopee.co.id')) return 'Shopee';
  if (u.includes('tokopedia.com')) return 'Tokopedia';
  if (u.includes('x.com') || u.includes('twitter.com')) return 'X (Twitter)';
  if (u.includes('linkedin.com')) return 'LinkedIn';
  if (u.includes('threads.net')) return 'Threads';
  return 'Web / Dashboard';
}

export function ensureHermesBrowserMcpConfig(): void {
  try {
    fs.mkdirSync(HERMES_WORKSPACE_DIR, { recursive: true });
    fs.mkdirSync(SOCIAL_BROWSER_PROFILE_DIR, { recursive: true });
    fs.mkdirSync(SOCIAL_SCREENSHOTS_DIR, { recursive: true });

    const mcpPayload = {
      mcpServers: {
        'villa-social-chrome-cdp': {
          command: 'npx',
          args: ['-y', '@playwright/mcp@latest', '--cdp-endpoint', `http://127.0.0.1:${SOCIAL_CDP_PORT}`],
          description:
            'Dedicated Social Media Chrome Profile (Instagram, TikTok Studio, Meta Business, YouTube Studio) for Hermes Agents',
        },
      },
    };
    fs.writeFileSync(HERMES_MCP_CONFIG_FILE, JSON.stringify(mcpPayload, null, 2), 'utf-8');
  } catch {
    // ignore disk errors
  }
}

function readSavedSnapshotMeta(): SocialSnapshotMeta | null {
  try {
    if (!fs.existsSync(SOCIAL_SNAPSHOT_META_FILE)) return null;
    const raw = fs.readFileSync(SOCIAL_SNAPSHOT_META_FILE, 'utf-8');
    return JSON.parse(raw) as SocialSnapshotMeta;
  } catch {
    return null;
  }
}

export async function getSocialBrowserStatus(): Promise<SocialBrowserStatus> {
  ensureHermesBrowserMcpConfig();
  const browserBinary = detectBrowserBinary();
  const lastSnapshot = readSavedSnapshotMeta();

  try {
    const verRes = await fetch(`http://127.0.0.1:${SOCIAL_CDP_PORT}/json/version`, {
      signal: AbortSignal.timeout(1400),
    });
    if (!verRes.ok) throw new Error('CDP offline');
    const verJson = (await verRes.json()) as { Browser?: string };

    const listRes = await fetch(`http://127.0.0.1:${SOCIAL_CDP_PORT}/json/list`, {
      signal: AbortSignal.timeout(1800),
    });
    const rawTabs = listRes.ok
      ? ((await listRes.json()) as Array<{
          id: string;
          type: string;
          title: string;
          url: string;
          webSocketDebuggerUrl?: string;
        }>)
      : [];

    const openTabs: SocialBrowserTab[] = rawTabs
      .filter(
        (t) =>
          t.type === 'page' &&
          !t.url.startsWith('devtools://') &&
          !t.url.startsWith('chrome-extension://')
      )
      .map((t) => ({
        id: t.id,
        title: t.title || t.url,
        url: t.url,
        platform: detectSocialPlatform(t.url),
        webSocketDebuggerUrl: t.webSocketDebuggerUrl,
      }));

    return {
      running: true,
      browserBinary,
      browserVersion: verJson.Browser || 'Chrome/Edge CDP',
      cdpPort: SOCIAL_CDP_PORT,
      profileDir: SOCIAL_BROWSER_PROFILE_DIR,
      mcpConfigPath: HERMES_MCP_CONFIG_FILE,
      openTabs,
      lastSnapshot,
    };
  } catch {
    return {
      running: false,
      browserBinary,
      browserVersion: null,
      cdpPort: SOCIAL_CDP_PORT,
      profileDir: SOCIAL_BROWSER_PROFILE_DIR,
      mcpConfigPath: HERMES_MCP_CONFIG_FILE,
      openTabs: [],
      lastSnapshot,
    };
  }
}

function normalizeComparableUrl(rawUrl: string): string {
  const trimmed = (rawUrl || '').trim();
  if (!trimmed) return '';
  const withProto = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  return withProto.replace(/\/+$/, '').toLowerCase();
}

function ensureHttpsUrl(rawUrl: string): string {
  const trimmed = (rawUrl || '').trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

/**
 * Checks whether the Chrome/Edge process bound to CDP port 9222 has a visible OS window,
 * and if visible, restores & brings it to the foreground on Windows.
 */
async function focusOrCheckSocialBrowserWindow(): Promise<'VISIBLE' | 'HIDDEN' | 'NOT_FOUND'> {
  if (process.platform !== 'win32') return 'VISIBLE';

  const psScript = `
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class VillaFocusHelper {
  [DllImport("user32.dll")] public static extern bool ShowWindowAsync(IntPtr hWnd, int nCmdShow);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr hWnd);
}
"@
$procs = Get-CimInstance Win32_Process -Filter "Name = 'chrome.exe' OR Name = 'msedge.exe'" | Where-Object { $_.CommandLine -like "*--remote-debugging-port=${SOCIAL_CDP_PORT}*" -and $_.CommandLine -notlike "*--type=*" }
if (-not $procs) { Write-Output "NOT_FOUND"; exit 0 }
$visible = $false
foreach ($cp in $procs) {
  $p = Get-Process -Id $cp.ProcessId -ErrorAction SilentlyContinue
  if ($p -and $p.MainWindowHandle -ne [IntPtr]::Zero) {
    $visible = $true
    if ([VillaFocusHelper]::IsIconic($p.MainWindowHandle)) {
      $null = [VillaFocusHelper]::ShowWindowAsync($p.MainWindowHandle, 9)
    } else {
      $null = [VillaFocusHelper]::ShowWindowAsync($p.MainWindowHandle, 5)
    }
    $null = [VillaFocusHelper]::SetForegroundWindow($p.MainWindowHandle)
    try {
      $wshell = New-Object -ComObject WScript.Shell
      $null = $wshell.AppActivate($p.Id)
    } catch {}
  }
}
if ($visible) { Write-Output "VISIBLE" } else { Write-Output "HIDDEN" }
`;

  try {
    const { stdout } = await execFileAsync(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', psScript],
      { timeout: 6000, windowsHide: true }
    );
    const out = (stdout || '').trim();
    if (out.includes('VISIBLE')) return 'VISIBLE';
    if (out.includes('HIDDEN')) return 'HIDDEN';
    return 'NOT_FOUND';
  } catch {
    return 'VISIBLE';
  }
}

/**
 * Launches Chrome/Edge on Windows using explicit Win32 CreateProcess STARTUPINFO
 * with STARTF_USESHOWWINDOW + SW_SHOWNORMAL (1) so it NEVER inherits SW_HIDE from a background server.
 */
async function spawnVisibleBrowserProcess(binary: string, args: string[]): Promise<void> {
  const cmdLine = [binary, ...args]
    .map((part) => {
      const escaped = part.replace(/"/g, '\\"');
      return /\s/.test(part) || part.includes('&') ? `"${escaped}"` : escaped;
    })
    .join(' ');

  if (process.platform === 'win32') {
    const psLaunch = `
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class VillaWin32Launcher {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  public struct STARTUPINFO {
    public Int32 cb;
    public string lpReserved;
    public string lpDesktop;
    public string lpTitle;
    public Int32 dwX;
    public Int32 dwY;
    public Int32 dwXSize;
    public Int32 dwYSize;
    public Int32 dwXCountChars;
    public Int32 dwYCountChars;
    public Int32 dwFillAttribute;
    public Int32 dwFlags;
    public Int16 wShowWindow;
    public Int16 cbReserved2;
    public IntPtr lpReserved2;
    public IntPtr hStdInput;
    public IntPtr hStdOutput;
    public IntPtr hStdError;
  }
  [StructLayout(LayoutKind.Sequential)]
  public struct PROCESS_INFORMATION {
    public IntPtr hProcess;
    public IntPtr hThread;
    public int dwProcessId;
    public int dwThreadId;
  }
  [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
  public static extern bool CreateProcessW(
    string lpApplicationName,
    string lpCommandLine,
    IntPtr lpProcessAttributes,
    IntPtr lpThreadAttributes,
    bool bInheritHandles,
    uint dwCreationFlags,
    IntPtr lpEnvironment,
    string lpCurrentDirectory,
    ref STARTUPINFO lpStartupInfo,
    out PROCESS_INFORMATION lpProcessInformation
  );
  [DllImport("kernel32.dll")] public static extern bool CloseHandle(IntPtr hObject);
}
"@
$si = New-Object VillaWin32Launcher+STARTUPINFO
$si.cb = [System.Runtime.InteropServices.Marshal]::SizeOf($si)
$si.dwFlags = 1
$si.wShowWindow = 1
$pi = New-Object VillaWin32Launcher+PROCESS_INFORMATION
$cmd = $env:VILLA_LAUNCH_CMD
$ok = [VillaWin32Launcher]::CreateProcessW($null, $cmd, [IntPtr]::Zero, [IntPtr]::Zero, $false, 0, [IntPtr]::Zero, $null, [ref]$si, [ref]$pi)
if ($ok) {
  $null = [VillaWin32Launcher]::CloseHandle($pi.hProcess)
  $null = [VillaWin32Launcher]::CloseHandle($pi.hThread)
  Write-Output "SPAWNED:$($pi.dwProcessId)"
} else {
  Write-Output "ERR:$([System.Runtime.InteropServices.Marshal]::GetLastWin32Error())"
}
`;
    await execFileAsync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', psLaunch], {
      timeout: 7000,
      windowsHide: true,
      env: {
        ...process.env,
        VILLA_LAUNCH_CMD: cmdLine,
      },
    });
  }
}

/**
 * Gracefully closes ONLY the dedicated CDP 9222 browser instance (never touches personal Chrome)
 * when recovering from a hidden window state.
 */
async function closeHiddenSocialBrowserViaCdp(): Promise<void> {
  try {
    const verRes = await fetch(`http://127.0.0.1:${SOCIAL_CDP_PORT}/json/version`, {
      signal: AbortSignal.timeout(1500),
    });
    if (!verRes.ok) return;
    const verJson = (await verRes.json()) as { webSocketDebuggerUrl?: string };
    if (verJson.webSocketDebuggerUrl) {
      await sendCdpCommand(verJson.webSocketDebuggerUrl, 'Browser.close').catch(() => {});
    }
    for (let i = 0; i < 10; i++) {
      await new Promise((r) => setTimeout(r, 250));
      const check = await getSocialBrowserStatus();
      if (!check.running) break;
    }
  } catch {
    // ignore
  }
}

export async function closeSocialBrowserSession(): Promise<{
  ok: boolean;
  message: string;
  status: SocialBrowserStatus;
}> {
  await closeHiddenSocialBrowserViaCdp();
  if (process.platform === 'win32') {
    const psKill9222 = `
$procs = Get-CimInstance Win32_Process -Filter "Name = 'chrome.exe' OR Name = 'msedge.exe'" | Where-Object { $_.CommandLine -like "*--remote-debugging-port=${SOCIAL_CDP_PORT}*" }
foreach ($cp in $procs) {
  Stop-Process -Id $cp.ProcessId -Force -ErrorAction SilentlyContinue
}
`;
    await execFileAsync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', psKill9222], {
      timeout: 5000,
      windowsHide: true,
    }).catch(() => {});
  }
  await new Promise((r) => setTimeout(r, 400));
  return {
    ok: true,
    message:
      'Sesi Chrome Port 9222 telah direset. Sekarang Anda bisa klik 2x file buka-chrome-medsos.bat di folder aplikasi agar jendela Chrome muncul langsung di layar Anda!',
    status: await getSocialBrowserStatus(),
  };
}

export async function launchOrOpenSocialTab(targetUrl?: string): Promise<{
  ok: boolean;
  message: string;
  status: SocialBrowserStatus;
  openedTabId?: string;
}> {
  ensureHermesBrowserMcpConfig();
  const binary = detectBrowserBinary();
  if (!binary) {
    return {
      ok: false,
      message: 'Google Chrome atau Microsoft Edge tidak ditemukan di laptop ini.',
      status: await getSocialBrowserStatus(),
    };
  }

  const current = await getSocialBrowserStatus();
  const cleanUrl = ensureHttpsUrl(targetUrl || '');
  const preservedUrls: string[] = [];

  // Case 1: Chrome Social Session is already running with a visible window! Open or focus requested URL
  if (current.running) {
    let openedTabId: string | undefined;

    if (cleanUrl) {
      const wantedNorm = normalizeComparableUrl(cleanUrl);
      const existing = current.openTabs.find(
        (t) => normalizeComparableUrl(t.url) === wantedNorm
      );

      if (existing) {
        openedTabId = existing.id;
        await fetch(`http://127.0.0.1:${SOCIAL_CDP_PORT}/json/activate/${existing.id}`).catch(
          () => {}
        );
        if (existing.webSocketDebuggerUrl) {
          await sendCdpCommand(existing.webSocketDebuggerUrl, 'Page.bringToFront').catch(() => {});
        }
      } else {
        // Use browser-level CDP Target.createTarget first (cleanest across Chrome 111–156+), fallback to PUT /json/new
        let createdId: string | undefined;
        try {
          const verRes = await fetch(`http://127.0.0.1:${SOCIAL_CDP_PORT}/json/version`, {
            signal: AbortSignal.timeout(1500),
          });
          if (verRes.ok) {
            const verJson = (await verRes.json()) as { webSocketDebuggerUrl?: string };
            if (verJson.webSocketDebuggerUrl) {
              const created = await sendCdpCommand<{ targetId?: string }>(
                verJson.webSocketDebuggerUrl,
                'Target.createTarget',
                { url: cleanUrl }
              );
              createdId = created?.targetId;
            }
          }
        } catch {
          // fallback below
        }

        if (!createdId) {
          const newTabEndpoint = `http://127.0.0.1:${SOCIAL_CDP_PORT}/json/new?${cleanUrl}`;
          const putRes = await fetch(newTabEndpoint, { method: 'PUT' }).catch(() => null);
          if (putRes && putRes.ok) {
            const createdTab = (await putRes.json().catch(() => null)) as { id?: string } | null;
            createdId = createdTab?.id;
          } else {
            await fetch(newTabEndpoint, { method: 'GET' }).catch(() => {});
          }
        }

        if (createdId) {
          openedTabId = createdId;
          await fetch(`http://127.0.0.1:${SOCIAL_CDP_PORT}/json/activate/${createdId}`).catch(
            () => {}
          );
        }
      }
    }

    // Bring Chrome window to the foreground of Windows desktop!
    await focusOrCheckSocialBrowserWindow();

    const updated = await getSocialBrowserStatus();
    if (!openedTabId && cleanUrl) {
      const wantedNorm = normalizeComparableUrl(cleanUrl);
      openedTabId = updated.openTabs.find(
        (t) => normalizeComparableUrl(t.url) === wantedNorm
      )?.id;
    }

    return {
      ok: true,
      message: cleanUrl
        ? `Tab ${detectSocialPlatform(cleanUrl)} (${cleanUrl}) berhasil dibuka & ditampilkan di depan layar!`
        : 'Jendela Chrome Khusus Medsos sudah ditampilkan di depan layar!',
      status: updated,
      openedTabId,
    };
  }

  // Case 2: Spawn dedicated persistent Chrome profile visibly on port 9222
  const baseUrls =
    preservedUrls.length > 0
      ? preservedUrls
      : ['https://www.instagram.com/', 'https://www.tiktok.com/tiktokstudio'];

  const startUrls = cleanUrl
    ? [
        cleanUrl,
        ...baseUrls.filter(
          (u) => normalizeComparableUrl(u) !== normalizeComparableUrl(cleanUrl)
        ),
      ]
    : baseUrls;

  const args = [
    `--user-data-dir=${SOCIAL_BROWSER_PROFILE_DIR}`,
    `--remote-debugging-port=${SOCIAL_CDP_PORT}`,
    '--remote-allow-origins=*',
    '--no-first-run',
    '--no-default-browser-check',
    '--new-window',
    '--window-size=1280,860',
    '--window-position=80,50',
    ...startUrls.slice(0, 5),
  ];

  await spawnVisibleBrowserProcess(binary, args);

  // Poll up to ~6 seconds for CDP port 9222 to come online, then bring window to front
  for (let attempt = 0; attempt < 15; attempt++) {
    await new Promise((r) => setTimeout(r, 400));
    const st = await getSocialBrowserStatus();
    if (st.running) {
      await focusOrCheckSocialBrowserWindow();
      const matchedTabId = cleanUrl
        ? st.openTabs.find(
            (t) => normalizeComparableUrl(t.url) === normalizeComparableUrl(cleanUrl)
          )?.id
        : st.openTabs[0]?.id;

      return {
        ok: true,
        message:
          'Jendela Chrome Khusus Medsos berhasil dibuka di layar Anda! Silakan login ke akun IG / TikTok / Meta Business sekali saja (sesi otomatis tersimpan permanen).',
        status: st,
        openedTabId: matchedTabId,
      };
    }
  }

  return {
    ok: false,
    message:
      'Chrome telah dijalankan namun port debugging 9222 belum merespons. Coba klik Refresh Status sebentar lagi.',
    status: await getSocialBrowserStatus(),
  };
}

async function sendCdpCommand<T = unknown>(
  wsUrl: string,
  method: string,
  params: Record<string, unknown> = {}
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    const timer = setTimeout(() => {
      try {
        ws.close();
      } catch {
        // ignore
      }
      reject(new Error(`CDP timeout on ${method}`));
    }, 8500);

    ws.addEventListener('open', () => {
      ws.send(JSON.stringify({ id: 1, method, params }));
    });

    ws.addEventListener('message', (event) => {
      try {
        const raw = typeof event.data === 'string' ? event.data : String(event.data);
        const parsed = JSON.parse(raw) as {
          id?: number;
          result?: T;
          error?: { message?: string };
        };
        if (parsed.id === 1) {
          clearTimeout(timer);
          ws.close();
          if (parsed.error) {
            reject(new Error(parsed.error.message || 'CDP error'));
          } else {
            resolve(parsed.result as T);
          }
        }
      } catch (err) {
        clearTimeout(timer);
        ws.close();
        reject(err);
      }
    });

    ws.addEventListener('error', () => {
      clearTimeout(timer);
      reject(new Error(`Gagal terhubung ke WebSocket tab browser (${method})`));
    });
  });
}

export async function captureSocialBrowserSnapshot(options?: {
  tabId?: string;
  takeScreenshot?: boolean;
}): Promise<{
  ok: boolean;
  message: string;
  meta: SocialSnapshotMeta | null;
}> {
  const status = await getSocialBrowserStatus();
  if (!status.running) {
    return {
      ok: false,
      message:
        'Chrome Khusus Medsos belum dibuka. Klik tombol "Buka Chrome Khusus Medsos" terlebih dahulu.',
      meta: status.lastSnapshot,
    };
  }

  const candidateTabs = status.openTabs.filter(
    (t) =>
      t.webSocketDebuggerUrl &&
      !t.url.startsWith('chrome://') &&
      !t.url.startsWith('edge://') &&
      !t.url.startsWith('about:')
  );

  const tabsToRead = options?.tabId
    ? candidateTabs.filter((t) => t.id === options.tabId)
    : candidateTabs.slice(0, 8);

  if (tabsToRead.length === 0) {
    return {
      ok: false,
      message:
        'Belum ada tab medsos/website yang terbuka di Chrome Medsos. Buka Instagram / TikTok / Meta Business terlebih dahulu.',
      meta: status.lastSnapshot,
    };
  }

  const capturedTabs: CapturedTabData[] = [];
  const shouldScreenshot = options?.takeScreenshot !== false;

  // Read-only Deep Social Media DOM extraction (extracts Video Titles, Captions, Metrics & Live Comments!)
  const domExtractScript = `(() => {
    const title = document.title || '';
    const url = location.href || '';
    const metaDesc = document.querySelector('meta[name="description"]')?.getAttribute('content') || '';
    const headings = Array.from(document.querySelectorAll('h1, h2, h3'))
      .map(el => (el.textContent || '').trim().replace(/\\s+/g, ' '))
      .filter(Boolean)
      .slice(0, 16);

    // 1. Extract Post / Video Titles, Captions & Views across TikTok, IG, YouTube Studio, FB, Shopee
    const postSnippets = [];
    const postSeen = new Set();
    const addPost = (txt) => {
      const clean = (txt || '').trim().replace(/\\s+/g, ' ');
      if (clean.length > 5 && !postSeen.has(clean) && postSnippets.length < 25) {
        postSeen.add(clean);
        postSnippets.push(clean.slice(0, 260));
      }
    };

    document.querySelectorAll(
      '[data-e2e="user-post-item-desc"], [data-e2e="user-post-item"], [data-e2e="browse-video-desc"], [data-e2e="video-desc"], ytcp-video-row, #video-title, article a[href*="/p/"], article a[href*="/reel/"], [class*="DivItemContainer"]'
    ).forEach(el => {
      const txt = (el.innerText || el.textContent || '').trim();
      const imgAlt = el.querySelector?.('img')?.getAttribute('alt') || '';
      const aria = el.getAttribute?.('aria-label') || el.getAttribute?.('title') || '';
      addPost([txt, imgAlt, aria].filter(Boolean).join(' — '));
    });

    document.querySelectorAll('article img[alt], main img[alt]').forEach(img => {
      const alt = img.getAttribute('alt') || '';
      if (alt.length > 15 && !alt.toLowerCase().includes('profile picture')) {
        addPost('[Visual/Caption]: ' + alt);
      }
    });

    // 2. Extract Live Comments & Replies across TikTok, Instagram, YouTube Studio, Meta Business
    const commentSnippets = [];
    const commentSeen = new Set();
    const addComment = (txt) => {
      const clean = (txt || '').trim().replace(/\\s+/g, ' ');
      if (clean.length > 3 && !commentSeen.has(clean) && commentSnippets.length < 40) {
        commentSeen.add(clean);
        commentSnippets.push(clean.slice(0, 280));
      }
    };

    document.querySelectorAll(
      '[data-e2e="comment-level-1"], [data-e2e="comment-level-2"], [data-e2e*="comment"], [class*="DivCommentItemContainer"], [class*="CommentItem"], [class*="CommentText"], ytcp-comment, ytd-comment-renderer, #content-text, [role="dialog"] ul li, article ul li'
    ).forEach(el => {
      const txt = (el.innerText || el.textContent || '').trim();
      if (txt.length > 3) addComment(txt);
    });

    const rawBody = (document.body?.innerText || '')
      .split('\\n')
      .map(l => l.trim())
      .filter(l => l.length > 1)
      .slice(0, 320)
      .join('\\n')
      .slice(0, 7500);

    const hasPasswordInput = Boolean(document.querySelector('input[type="password"]'));
    const lowerUrl = url.toLowerCase();
    const loginWallDetected =
      hasPasswordInput ||
      lowerUrl.includes('/accounts/login') ||
      lowerUrl.includes('/login');

    const sections = [];
    if (metaDesc) sections.push('[Meta]: ' + metaDesc);
    if (postSnippets.length > 0) {
      sections.push('[📌 DAFTAR KONTEN / JUDUL VIDEO / CAPTION TERBARU]:\\n- ' + postSnippets.join('\\n- '));
    }
    if (commentSnippets.length > 0) {
      sections.push('[💬 KOMENTAR & INTERAKSI AUDIENS TERBARU]:\\n- ' + commentSnippets.join('\\n- '));
    }
    sections.push('[📊 TEKS & METRIK LENGKAP HALAMAN]:\\n' + rawBody);

    return {
      title,
      url,
      metaDesc,
      headings,
      extractedText: sections.join('\\n\\n'),
      loginWallDetected
    };
  })()`;

  for (let i = 0; i < tabsToRead.length; i++) {
    const tab = tabsToRead[i];
    if (!tab.webSocketDebuggerUrl) continue;

    try {
      const evalRes = await sendCdpCommand<{
        result?: {
          value?: {
            title: string;
            url: string;
            headings: string[];
            extractedText: string;
            loginWallDetected: boolean;
          };
        };
      }>(tab.webSocketDebuggerUrl, 'Runtime.evaluate', {
        expression: domExtractScript,
        returnByValue: true,
      });

      const val = evalRes?.result?.value;
      let screenshotUrl: string | null = null;

      // Capture screenshot for primary/selected tab (or first 2 tabs)
      if (shouldScreenshot && i < 2) {
        try {
          const shotRes = await sendCdpCommand<{ data?: string }>(
            tab.webSocketDebuggerUrl,
            'Page.captureScreenshot',
            { format: 'png' }
          );
          if (shotRes?.data) {
            fs.mkdirSync(SOCIAL_SCREENSHOTS_DIR, { recursive: true });
            const filename = `tab_${tab.id.slice(0, 10)}_${Date.now()}.png`;
            const filePath = path.join(SOCIAL_SCREENSHOTS_DIR, filename);
            fs.writeFileSync(filePath, Buffer.from(shotRes.data, 'base64'));
            screenshotUrl = `/uploads/browser_snapshots/${filename}`;
          }
        } catch {
          // Screenshot optional if tab is minimized
        }
      }

      capturedTabs.push({
        tabId: tab.id,
        platform: detectSocialPlatform(val?.url || tab.url),
        title: val?.title || tab.title,
        url: val?.url || tab.url,
        loginWallDetected: Boolean(val?.loginWallDetected),
        headings: val?.headings || [],
        extractedText: val?.extractedText || '(Halaman belum memuat teks)',
        screenshotUrl,
        capturedAt: new Date().toISOString(),
      });
    } catch {
      // Skip tab if closed mid-read
    }
  }

  const nowIso = new Date().toISOString();
  const prev = readSavedSnapshotMeta();
  const capturedUrls = new Set(capturedTabs.map((t) => normalizeComparableUrl(t.url)));
  const mergedCdpTabs = [
    ...capturedTabs,
    ...(prev?.tabs || []).filter((t) => !capturedUrls.has(normalizeComparableUrl(t.url))),
  ].slice(0, 8);

  const meta: SocialSnapshotMeta = {
    lastCapturedAt: nowIso,
    tabCount: mergedCdpTabs.length,
    tabs: mergedCdpTabs,
  };

  writeSnapshotFilesToDisk(meta, 'Diambil otomatis dari Chrome Medsos & Tab Terhubung');

  const loginWarnCount = capturedTabs.filter((t) => t.loginWallDetected).length;
  const msg =
    loginWarnCount > 0
      ? `Berhasil membaca ${capturedTabs.length} tab, namun ${loginWarnCount} tab masih berada di halaman Login. Silakan login dulu di jendela Chrome Medsos lalu klik Tarik Data lagi!`
      : `Berhasil menarik data live dari ${capturedTabs.length} tab medsos ke memori Nadia & Tim!`;

  return {
    ok: true,
    message: msg,
    meta,
  };
}

function writeSnapshotFilesToDisk(meta: SocialSnapshotMeta, sourceLabel: string): void {
  const mdLines: string[] = [
    `# 🌐 Live Social Media & Dashboard Browser Snapshot`,
    `_${sourceLabel} pada: ${new Date(meta.lastCapturedAt || Date.now()).toLocaleString('id-ID')}_`,
    ``,
  ];

  for (const ct of meta.tabs) {
    mdLines.push(`## [${ct.platform}] ${ct.title}`);
    mdLines.push(`- **URL:** ${ct.url}`);
    mdLines.push(`- **Waktu Sinkronisasi Tab:** ${new Date(ct.capturedAt || Date.now()).toLocaleString('id-ID')}`);
    mdLines.push(
      `- **Status Sesi:** ${
        ct.loginWallDetected
          ? '⚠️ Terdeteksi halaman Login'
          : '✅ Halaman Aktif (Sudah Login / Terbaca Live)'
      }`
    );
    if (ct.headings.length > 0) {
      mdLines.push(`- **Heading Utama:** ${ct.headings.join(' | ')}`);
    }
    mdLines.push(`### Isi Metrik / Postingan / Komentar / Teks yang Tampil di Layar:`);
    mdLines.push('```text');
    mdLines.push(ct.extractedText);
    mdLines.push('```');
    mdLines.push('');
  }

  fs.mkdirSync(HERMES_WORKSPACE_DIR, { recursive: true });
  fs.writeFileSync(SOCIAL_SNAPSHOT_FILE, mdLines.join('\n'), 'utf-8');
  fs.writeFileSync(SOCIAL_SNAPSHOT_META_FILE, JSON.stringify(meta, null, 2), 'utf-8');
}

let lastExtensionSyncRequestedAt = 0;
let lastExtensionIngestedAt = 0;

export function requestExtensionAutoSync(): number {
  lastExtensionSyncRequestedAt = Date.now();
  return lastExtensionSyncRequestedAt;
}

export function getExtensionSyncSignal(): {
  syncRequestedAt: number;
  lastIngestedAt: number;
  shouldSyncNow: boolean;
  linkedUrls: string[];
} {
  const meta = readSavedSnapshotMeta();
  const linkedUrls = (meta?.tabs || []).map((t) => t.url).filter(Boolean);
  return {
    syncRequestedAt: lastExtensionSyncRequestedAt,
    lastIngestedAt: lastExtensionIngestedAt,
    shouldSyncNow: lastExtensionSyncRequestedAt > lastExtensionIngestedAt,
    linkedUrls,
  };
}

export function ingestExternalTabSnapshot(payload: {
  url: string;
  title: string;
  headings?: string[];
  extractedText: string;
  screenshotDataUrl?: string | null;
  loginWallDetected?: boolean;
}): SocialSnapshotMeta {
  ensureHermesBrowserMcpConfig();
  lastExtensionIngestedAt = Date.now();
  let screenshotUrl: string | null = null;

  if (payload.screenshotDataUrl && payload.screenshotDataUrl.startsWith('data:image/')) {
    try {
      const base64Part = payload.screenshotDataUrl.split(',')[1];
      if (base64Part) {
        fs.mkdirSync(SOCIAL_SCREENSHOTS_DIR, { recursive: true });
        const filename = `ext_tab_${Date.now()}.png`;
        fs.writeFileSync(path.join(SOCIAL_SCREENSHOTS_DIR, filename), Buffer.from(base64Part, 'base64'));
        screenshotUrl = `/uploads/browser_snapshots/${filename}`;
      }
    } catch {
      // ignore screenshot write error
    }
  }

  const nowIso = new Date().toISOString();
  const prev = readSavedSnapshotMeta();
  const existingMatch = (prev?.tabs || []).find(
    (t) => normalizeComparableUrl(t.url) === normalizeComparableUrl(payload.url)
  );

  const tabItem: CapturedTabData = {
    tabId: existingMatch?.tabId || `ext-${Date.now()}`,
    platform: detectSocialPlatform(payload.url),
    title: payload.title || payload.url,
    url: payload.url,
    loginWallDetected: Boolean(payload.loginWallDetected),
    headings: payload.headings || [],
    extractedText: payload.extractedText || '(Teks kosong)',
    screenshotUrl: screenshotUrl || existingMatch?.screenshotUrl || null,
    capturedAt: nowIso,
  };

  const mergedTabs = [
    tabItem,
    ...(prev?.tabs || []).filter(
      (t) => normalizeComparableUrl(t.url) !== normalizeComparableUrl(payload.url)
    ),
  ].slice(0, 8);

  const meta: SocialSnapshotMeta = {
    lastCapturedAt: nowIso,
    tabCount: mergedTabs.length,
    tabs: mergedTabs,
  };

  writeSnapshotFilesToDisk(meta, 'Dikirim otomatis dari Tab Browser Utama Anda');
  return meta;
}

async function refreshPublicSocialUrlsFallback(meta: SocialSnapshotMeta): Promise<SocialSnapshotMeta> {
  if (!meta.tabs || meta.tabs.length === 0) return meta;
  let updatedAny = false;
  const nowIso = new Date().toISOString();

  for (const tab of meta.tabs) {
    // Do not overwrite private login-only dashboards (like studio.youtube.com or adsmanager) with unauthenticated HTML
    const lower = tab.url.toLowerCase();
    if (
      lower.includes('studio.youtube.com') ||
      lower.includes('adsmanager') ||
      lower.includes('business.facebook.com') ||
      lower.includes('seller.shopee')
    ) {
      continue;
    }

    try {
      const res = await fetch(tab.url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
        },
        signal: AbortSignal.timeout(6500),
      });
      if (!res.ok) continue;
      const html = await res.text();

      const liveNotes: string[] = [];
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      if (titleMatch?.[1]) {
        liveNotes.push(`Title Live: ${titleMatch[1].trim()}`);
      }
      const descMatch =
        html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) ||
        html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i);
      if (descMatch?.[1]) {
        liveNotes.push(`Meta Live: ${descMatch[1].trim()}`);
      }

      // Extract TikTok __UNIVERSAL_DATA_FOR_REHYDRATION__ stats & video descriptions if present
      if (lower.includes('tiktok.com')) {
        const rehydMatch = html.match(
          /<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)<\/script>/i
        );
        if (rehydMatch?.[1]) {
          try {
            const json = JSON.parse(rehydMatch[1]);
            const userDetail =
              json?.__DEFAULT_SCOPE__?.['webapp.user-detail']?.userInfo;
            if (userDetail?.stats) {
              const s = userDetail.stats;
              liveNotes.push(
                `Statistik Live TikTok (@${userDetail?.user?.uniqueId || ''}): Followers=${s.followerCount}, Following=${s.followingCount}, Likes=${s.heartCount}, Total Video=${s.videoCount}`
              );
            }
          } catch {
            // ignore JSON parse
          }
        }
      }

      if (liveNotes.length > 0) {
        const cleanExisting = tab.extractedText.replace(
          /\[🔄 AUTO-CHECK LIVE PUBLIC METADATA[^\]]*\]:[\s\S]*?\n\n/,
          ''
        );
        tab.extractedText = `[🔄 AUTO-CHECK LIVE PUBLIC METADATA (${new Date().toLocaleTimeString('id-ID')})]:\n${liveNotes.join('\n')}\n\n${cleanExisting}`;
        tab.capturedAt = nowIso;
        updatedAny = true;
      }
    } catch {
      // ignore network error on fallback
    }
  }

  if (updatedAny) {
    meta.lastCapturedAt = nowIso;
    writeSnapshotFilesToDisk(meta, 'Auto-Sync Medsos Live');
  }
  return meta;
}

let activeSyncPromise: Promise<SocialSnapshotMeta | null> | null = null;

export async function ensureFreshSocialBrowserSnapshot(options?: {
  maxAgeMs?: number;
  force?: boolean;
}): Promise<SocialSnapshotMeta | null> {
  const maxAgeMs = options?.maxAgeMs ?? 30_000;
  const force = Boolean(options?.force);

  const currentMeta = readSavedSnapshotMeta();
  const lastAge = currentMeta?.lastCapturedAt
    ? Date.now() - new Date(currentMeta.lastCapturedAt).getTime()
    : Number.POSITIVE_INFINITY;

  if (!force && lastAge < maxAgeMs && currentMeta) {
    return currentMeta;
  }

  if (activeSyncPromise) {
    return activeSyncPromise;
  }

  activeSyncPromise = (async () => {
    try {
      // 1. Signal Chrome Extension (if user has Chrome open with Villa HQ Extension) to push all open social tabs immediately
      const reqTime = requestExtensionAutoSync();

      // 2. If Chrome CDP (Port 9222) is running, capture all open tabs directly
      const cdpStatus = await getSocialBrowserStatus();
      if (cdpStatus.running && cdpStatus.openTabs.length > 0) {
        const cdpRes = await captureSocialBrowserSnapshot({ takeScreenshot: false });
        if (cdpRes.ok && cdpRes.meta) {
          return cdpRes.meta;
        }
      }

      // 3. Give Chrome Extension Service Worker up to 1.4s to respond with live authenticated tabs (IG, TikTok, YT Studio)
      const waitStart = Date.now();
      while (Date.now() - waitStart < 1400) {
        if (lastExtensionIngestedAt >= reqTime) {
          return readSavedSnapshotMeta();
        }
        await new Promise((r) => setTimeout(r, 200));
      }

      // 4. Fallback: enrich public metadata on linked URLs so stats & timestamps are refreshed
      const latestMeta = readSavedSnapshotMeta();
      if (latestMeta) {
        return await refreshPublicSocialUrlsFallback(latestMeta);
      }
      return null;
    } catch {
      return readSavedSnapshotMeta();
    } finally {
      activeSyncPromise = null;
    }
  })();

  return activeSyncPromise;
}

export function getSocialBrowserContextSnippet(): string {
  try {
    if (!fs.existsSync(SOCIAL_SNAPSHOT_FILE)) {
      return 'Belum ada snapshot browser medsos live yang ditarik hari ini (Buka menu "🌐 Akses Medsos" untuk menghubungkan tab IG/TikTok/YouTube/Ads).';
    }
    const raw = fs.readFileSync(SOCIAL_SNAPSHOT_FILE, 'utf-8');
    return raw.slice(0, 18000);
  } catch {
    return '';
  }
}
