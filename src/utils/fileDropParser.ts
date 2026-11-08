export interface ParsedDroppedFile {
  id: string;
  name: string;
  sizeBytes: number;
  kind: 'csv' | 'text' | 'json' | 'image' | 'other';
  summary: string;
  promptSnippet: string;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export async function parseDroppedFiles(fileList: FileList | File[]): Promise<ParsedDroppedFile[]> {
  const files = Array.from(fileList);
  const results: ParsedDroppedFile[] = [];

  for (const file of files) {
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    const id = `att-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    if (['csv', 'tsv'].includes(ext) || file.type === 'text/csv') {
      const raw = await file.text();
      const lines = raw.replace(/\r\n/g, '\n').split('\n').filter((l) => l.trim().length > 0);
      const header = lines[0] || '';
      const previewRows = lines.slice(0, 65).join('\n').slice(0, 10000);
      results.push({
        id,
        name: file.name,
        sizeBytes: file.size,
        kind: 'csv',
        summary: `CSV (${lines.length} baris • ${formatBytes(file.size)})`,
        promptSnippet: [
          `### 📎 Lampiran Data Tabel / CSV: ${file.name} (Total ${lines.length} baris, Ukuran ${formatBytes(file.size)})`,
          `Kolom Header: ${header}`,
          '```csv',
          previewRows,
          lines.length > 65 ? `... (${lines.length - 65} baris lainnya disingkat agar hemat konteks)` : '',
          '```',
        ]
          .filter(Boolean)
          .join('\n'),
      });
      continue;
    }

    if (
      ['txt', 'md', 'markdown', 'json', 'html', 'xml', 'log', 'yaml', 'yml'].includes(ext) ||
      file.type.startsWith('text/') ||
      file.type === 'application/json'
    ) {
      const raw = await file.text();
      const clipped = raw.slice(0, 12000);
      results.push({
        id,
        name: file.name,
        sizeBytes: file.size,
        kind: ext === 'json' ? 'json' : 'text',
        summary: `Dokumen ${ext.toUpperCase() || 'TEKS'} (${formatBytes(file.size)})`,
        promptSnippet: [
          `### 📎 Lampiran Dokumen / Brief: ${file.name} (${formatBytes(file.size)})`,
          '```',
          clipped,
          raw.length > 12000 ? '\n... [Isi dokumen dipotong otomatis pada 12.000 karakter pertama]' : '',
          '```',
        ].join('\n'),
      });
      continue;
    }

    if (file.type.startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext)) {
      const dims = await new Promise<string>((resolve) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
          const info = `${img.width}x${img.height}px`;
          URL.revokeObjectURL(url);
          resolve(info);
        };
        img.onerror = () => {
          URL.revokeObjectURL(url);
          resolve('Resolusi gambar');
        };
        img.src = url;
      });

      results.push({
        id,
        name: file.name,
        sizeBytes: file.size,
        kind: 'image',
        summary: `Gambar (${dims} • ${formatBytes(file.size)})`,
        promptSnippet: `### 🖼️ Lampiran Referensi Visual / Gambar: "${file.name}" (Resolusi: ${dims}, Tipe: ${file.type || ext}, Ukuran: ${formatBytes(file.size)})\nCatatan untuk Agent: User melampirkan file gambar "${file.name}". Gunakan nama file, dimensi, dan konteks visual ini dalam analisis desain/konten/ads kamu.`,
      });
      continue;
    }

    // Fallback for PDF / DOCX / XLSX metadata if dropped directly
    results.push({
      id,
      name: file.name,
      sizeBytes: file.size,
      kind: 'other',
      summary: `File ${ext.toUpperCase() || 'DATA'} (${formatBytes(file.size)})`,
      promptSnippet: `### 📎 Lampiran File: "${file.name}" (Ukuran: ${formatBytes(file.size)}, Format: ${ext.toUpperCase() || file.type})`,
    });
  }

  return results;
}

export function mergePromptWithAttachments(
  userPrompt: string,
  attachments: ParsedDroppedFile[]
): string {
  if (attachments.length === 0) return userPrompt;
  const blocks = attachments.map((a) => a.promptSnippet).join('\n\n');
  const intro = userPrompt.trim()
    ? userPrompt.trim()
    : `Tolong analisis dan eksekusi berdasarkan file lampiran berikut (${attachments
        .map((a) => a.name)
        .join(', ')}):`;
  return `${intro}\n\n---\n${blocks}`;
}
