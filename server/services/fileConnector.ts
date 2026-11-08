import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';

const READABLE_EXTENSIONS = new Set([
  '.md',
  '.txt',
  '.csv',
  '.tsv',
  '.json',
  '.yaml',
  '.yml',
  '.html',
  '.xml',
  '.js',
  '.ts',
]);

export interface ConnectedPathSummary {
  inputPath: string;
  exists: boolean;
  type: 'directory' | 'file' | 'missing';
  fileCount: number;
  sampleFiles: Array<{ name: string; fullPath: string; sizeBytes: number; modifiedAt: string }>;
}

export function inspectConnectedPaths(pathsList: string[]): ConnectedPathSummary[] {
  return pathsList.map((rawPath) => {
    const cleaned = rawPath.trim();
    try {
      if (!cleaned || !fs.existsSync(cleaned)) {
        return {
          inputPath: cleaned,
          exists: false,
          type: 'missing',
          fileCount: 0,
          sampleFiles: [],
        };
      }
      const stat = fs.statSync(cleaned);
      if (stat.isFile()) {
        return {
          inputPath: cleaned,
          exists: true,
          type: 'file',
          fileCount: 1,
          sampleFiles: [
            {
              name: path.basename(cleaned),
              fullPath: cleaned,
              sizeBytes: stat.size,
              modifiedAt: stat.mtime.toISOString(),
            },
          ],
        };
      }
      if (stat.isDirectory()) {
        const entries = fs.readdirSync(cleaned, { withFileTypes: true });
        const files = entries
          .filter((e) => e.isFile())
          .slice(0, 15)
          .map((e) => {
            const fullPath = path.join(cleaned, e.name);
            const fstat = fs.statSync(fullPath);
            return {
              name: e.name,
              fullPath,
              sizeBytes: fstat.size,
              modifiedAt: fstat.mtime.toISOString(),
            };
          });
        return {
          inputPath: cleaned,
          exists: true,
          type: 'directory',
          fileCount: entries.filter((e) => e.isFile()).length,
          sampleFiles: files,
        };
      }
    } catch {
      // Ignore permission errors
    }
    return {
      inputPath: cleaned,
      exists: false,
      type: 'missing',
      fileCount: 0,
      sampleFiles: [],
    };
  });
}

export function buildLocalFilesContext(pathsList: string[], agentWorkspaceReportsDir: string): string {
  const chunks: string[] = [];
  let totalChars = 0;
  const MAX_TOTAL_CHARS = 10000;

  const tryReadFile = (filePath: string, label: string) => {
    if (totalChars >= MAX_TOTAL_CHARS) return;
    const ext = path.extname(filePath).toLowerCase();
    if (!READABLE_EXTENSIONS.has(ext)) return;
    try {
      const stat = fs.statSync(filePath);
      if (stat.size > 512 * 1024) return; // skip huge files > 512KB
      const raw = fs.readFileSync(filePath, 'utf-8');
      const snippet = raw.slice(0, 2500);
      chunks.push(`### File Lokal: ${label} (${filePath})\n\`\`\`\n${snippet}\n\`\`\``);
      totalChars += snippet.length;
    } catch {
      // ignore unreadable files
    }
  };

  for (const p of pathsList) {
    if (totalChars >= MAX_TOTAL_CHARS) break;
    try {
      if (!fs.existsSync(p)) continue;
      const stat = fs.statSync(p);
      if (stat.isFile()) {
        tryReadFile(p, path.basename(p));
      } else if (stat.isDirectory()) {
        const entries = fs
          .readdirSync(p, { withFileTypes: true })
          .filter((e) => e.isFile() && READABLE_EXTENSIONS.has(path.extname(e.name).toLowerCase()))
          .slice(0, 6);
        for (const e of entries) {
          tryReadFile(path.join(p, e.name), e.name);
        }
      }
    } catch {
      // ignore
    }
  }

  // Also include most recent report in agent's own reports dir if present
  try {
    if (fs.existsSync(agentWorkspaceReportsDir)) {
      const reportFiles = fs
        .readdirSync(agentWorkspaceReportsDir)
        .filter((f) => f.endsWith('.md'))
        .sort()
        .reverse()
        .slice(0, 2);
      for (const rf of reportFiles) {
        tryReadFile(path.join(agentWorkspaceReportsDir, rf), `Recent Report: ${rf}`);
      }
    }
  } catch {
    // ignore
  }

  if (chunks.length === 0) {
    return 'Belum ada file lokal eksternal yang terhubung atau terbaca untuk agent ini.';
  }
  return chunks.join('\n\n');
}

export function saveAgentReportToDisk(
  workspaceRoot: string,
  agentId: string,
  title: string,
  content: string
): string {
  const reportsDir = path.join(workspaceRoot, 'agents', agentId, 'reports');
  fs.mkdirSync(reportsDir, { recursive: true });
  const now = new Date();
  const stamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  const fileName = `${stamp}_${slug || 'report'}.md`;
  const fullPath = path.join(reportsDir, fileName);
  fs.writeFileSync(fullPath, `# ${title}\n_Waktu: ${now.toLocaleString('id-ID')}_\n\n${content}\n`, 'utf-8');
  return fullPath;
}

export function openWindowsPathPicker(mode: 'folder' | 'file'): Promise<string | null> {
  return new Promise((resolve) => {
    if (process.platform !== 'win32') {
      resolve(null);
      return;
    }

    const psScript =
      mode === 'folder'
        ? `
Add-Type -AssemblyName System.Windows.Forms
$dlg = New-Object System.Windows.Forms.FolderBrowserDialog
$dlg.Description = 'Pilih Folder Laptop untuk Dihubungkan ke AI Agent'
$dlg.ShowNewFolderButton = $true
$top = New-Object System.Windows.Forms.Form
$top.TopMost = $true
if ($dlg.ShowDialog($top) -eq [System.Windows.Forms.DialogResult]::OK) {
  Write-Output $dlg.SelectedPath
}
$top.Dispose()
`.trim()
        : `
Add-Type -AssemblyName System.Windows.Forms
$dlg = New-Object System.Windows.Forms.OpenFileDialog
$dlg.Title = 'Pilih File Laptop untuk Dihubungkan ke AI Agent'
$top = New-Object System.Windows.Forms.Form
$top.TopMost = $true
if ($dlg.ShowDialog($top) -eq [System.Windows.Forms.DialogResult]::OK) {
  Write-Output $dlg.FileName
}
$top.Dispose()
`.trim();

    execFile(
      'powershell.exe',
      ['-NoProfile', '-STA', '-Command', psScript],
      { timeout: 60000, windowsHide: true },
      (err, stdout) => {
        if (err) {
          resolve(null);
          return;
        }
        const picked = stdout.trim();
        resolve(picked ? picked : null);
      }
    );
  });
}
