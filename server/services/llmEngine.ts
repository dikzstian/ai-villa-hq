import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { AgentProfile } from '../types.ts';
import { buildLocalFilesContext } from './fileConnector.ts';
import {
  ensureFreshNotionCalendarForAgent,
  getNotionPromptContextForAgent,
} from './notionEngine.ts';
import {
  ensureFreshSocialBrowserSnapshot,
  getSocialBrowserContextSnippet,
  SOCIAL_CDP_PORT,
  SOCIAL_SNAPSHOT_META_FILE,
  SocialSnapshotMeta,
} from './socialBrowserEngine.ts';
import { HERMES_WORKSPACE_DIR, storage } from './storage.ts';

export interface AgentGenerationResult {
  content: string;
  engineUsed: 'live_api' | 'hermes_cli' | 'simulation';
}

function normalizeBaseUrl(rawUrl: string): string {
  const trimmed = (rawUrl || 'https://api.openai.com/v1').trim().replace(/\/+$/, '');
  return trimmed;
}

export const MUSE_AI_MODELS = [
  'muse',
  'muse-spark-1.3',
  'muse-wonder-1.0',
  'muse-spark-1.2',
  'muse-spark-1.1',
];

export async function fetchProviderModels(
  baseUrlInput?: string,
  apiKeyInput?: string
): Promise<{ ok: boolean; models: string[]; message: string }> {
  const snapshot = storage.getSnapshot();
  const baseUrl = normalizeBaseUrl(baseUrlInput || snapshot.config.provider.baseUrl);
  const apiKey = (apiKeyInput ?? snapshot.config.provider.apiKey).trim();
  const isLocalGateway =
    baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1');
  const isMuseDirect = baseUrl.includes('meta.ai') || baseUrl.includes('muse');

  if (!apiKey && !isLocalGateway) {
    return {
      ok: false,
      models: isMuseDirect ? MUSE_AI_MODELS : [],
      message:
        'API Key belum diisi. Silakan masukkan API Key Muse AI / Provider untuk mengambil daftar model.',
    };
  }

  try {
    const headers: Record<string, string> = {
      Accept: 'application/json',
    };
    if (apiKey) {
      headers.Authorization = `Bearer ${apiKey}`;
    }

    const res = await fetch(`${baseUrl}/models`, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      if (isMuseDirect) {
        return {
          ok: true,
          models: MUSE_AI_MODELS,
          message: `Menggunakan daftar model standar Muse AI (${MUSE_AI_MODELS.join(', ')})`,
        };
      }
      const errText = await res.text();
      return {
        ok: false,
        models: [],
        message: `HTTP ${res.status}: ${errText.slice(0, 200)}`,
      };
    }

    const json = (await res.json()) as { data?: Array<{ id?: string }> };
    const fetchedModels = Array.isArray(json.data)
      ? json.data.map((m) => m.id || '').filter(Boolean)
      : [];
    const models =
      fetchedModels.length > 0
        ? fetchedModels
        : isMuseDirect
        ? MUSE_AI_MODELS
        : [];

    return {
      ok: true,
      models,
      message: `Berhasil memuat ${models.length} model dari ${baseUrl}`,
    };
  } catch (err) {
    if (isMuseDirect) {
      return {
        ok: true,
        models: MUSE_AI_MODELS,
        message: `Daftar model Muse AI siap digunakan (${MUSE_AI_MODELS.join(', ')})`,
      };
    }
    const msg = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      models: [],
      message: `Gagal menghubungi ${baseUrl}/models: ${msg}`,
    };
  }
}

const STOP_WORDS = new Set([
  'yang',
  'dari',
  'untuk',
  'dengan',
  'coba',
  'bisa',
  'kamu',
  'saya',
  'kita',
  'sama',
  'udah',
  'sudah',
  'belum',
  'atau',
  'kalau',
  'kalo',
  'gimana',
  'bagaimana',
  'sebelumnya',
  'pernah',
  'bahas',
  'mengenai',
  'tentang',
  'kembali',
  'nama',
  'apa',
  'ini',
  'itu',
]);

function buildConversationHistoryContext(agentId: string, currentUserPrompt = ''): string {
  const snapshot = storage.getSnapshot();
  const cleanMessages = snapshot.messages.filter(
    (m) =>
      !m.id.startsWith('msg-late-') &&
      !m.id.startsWith('msg-user-rem-') &&
      !m.id.startsWith('msg-welcome-')
  );

  if (cleanMessages.length === 0) {
    return 'Belum ada riwayat percakapan sebelumnya.';
  }

  // Extract meaningful search keywords from the user's current prompt
  const keywords = Array.from(
    new Set(
      currentUserPrompt
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length >= 4 && !STOP_WORDS.has(w))
    )
  );

  const selectedIndices = new Set<number>();

  // 1. Keyword-matched historical recall across ALL messages (plus adjacent turn so Q&A pairs stay together!)
  if (keywords.length > 0) {
    for (let i = 0; i < cleanMessages.length; i++) {
      const textLower = cleanMessages[i].content.toLowerCase();
      if (keywords.some((kw) => textLower.includes(kw))) {
        if (i > 0) selectedIndices.add(i - 1);
        selectedIndices.add(i);
        if (i + 1 < cleanMessages.length) selectedIndices.add(i + 1);
      }
    }
  }

  // 2. Always include all user-agent direct discussions where user proposed/changed content ideas
  for (let i = 0; i < cleanMessages.length; i++) {
    const m = cleanMessages[i];
    if (
      m.senderType === 'user' &&
      (m.recipientId === agentId || m.recipientId === 'social-media' || m.channel === 'direct')
    ) {
      selectedIndices.add(i);
      if (i + 1 < cleanMessages.length) selectedIndices.add(i + 1);
    }
  }

  // 3. Include the most recent 16 messages involving this agent or team channel
  const recentAgentIndices: number[] = [];
  for (let i = cleanMessages.length - 1; i >= 0 && recentAgentIndices.length < 16; i--) {
    const m = cleanMessages[i];
    if (
      m.senderId === agentId ||
      m.recipientId === agentId ||
      (Array.isArray(m.relatedAgentIds) && m.relatedAgentIds.includes(agentId)) ||
      m.channel === 'team'
    ) {
      recentAgentIndices.push(i);
    }
  }
  for (const idx of recentAgentIndices) {
    selectedIndices.add(idx);
  }

  const sortedIndices = Array.from(selectedIndices)
    .sort((a, b) => a - b)
    .slice(-28);

  const formatted = sortedIndices.map((idx) => {
    const m = cleanMessages[idx];
    const dt = new Date(m.timestamp).toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
    const sender =
      m.senderType === 'user' ? 'Bos (Head of DM)' : `${m.senderName} (${m.senderRole})`;
    const snippet = m.content.trim().slice(0, 1100);
    return `[${dt}] ${sender} -> ${m.recipientId}:\n${snippet}`;
  });

  return formatted.join('\n\n---\n');
}

function buildSystemPrompt(agent: AgentProfile, currentUserPrompt = ''): string {
  const snapshot = storage.getSnapshot();
  const roster = snapshot.agents
    .map((a) => `- ${a.name} (${a.role}) [id: ${a.id}]`)
    .join('\n');

  const reportsDir = path.join(HERMES_WORKSPACE_DIR, 'agents', agent.id, 'reports');
  const localFilesSnippet = buildLocalFilesContext(agent.connectedPaths, reportsDir);
  const socialBrowserSnippet = getSocialBrowserContextSnippet();
  const notionCalendarSnippet = getNotionPromptContextForAgent(agent.id);
  const conversationHistorySnippet = buildConversationHistoryContext(agent.id, currentUserPrompt);

  const pf = snapshot.config.activeProductFocus;
  const productFocusBlock =
    pf && pf.enabled && pf.productName.trim()
      ? [
          `=== 🎯 FOKUS PRODUK & PROMO AKTIF SAAT INI (WAJIB DIACU OLEH SEMUA DIVISI) ===`,
          `- Nama Produk / Campaign Utama: ${pf.productName}`,
          pf.promoOffer ? `- Penawaran / Harga / Promo Aktif: ${pf.promoOffer}` : '',
          pf.usp ? `- Keunggulan Utama (USP / Value Prop): ${pf.usp}` : '',
          pf.targetAudience ? `- Target Audiens Prioritas: ${pf.targetAudience}` : '',
          pf.ctaLink ? `- CTA & Link Tujuan: ${pf.ctaLink}` : '',
          pf.extraNotes ? `- Catatan Tambahan Head DM: ${pf.extraNotes}` : '',
          `Pastikan seluruh ide konten, riset, copywriting, strategi ads, SEO, desain, maupun laporan mengacu langsung pada Fokus Produk & Promo Aktif di atas!`,
        ]
          .filter(Boolean)
          .join('\n')
      : '';

  return [
    `Kamu berada di ekosistem Digital Marketing Villa HQ (Hermes-compatible Multi-Agent System).`,
    `Waktu Lokal Sekarang: ${new Date().toLocaleString('id-ID')}`,
    ...(productFocusBlock ? [``, productFocusBlock] : []),
    ``,
    `=== SOUL.md ===`,
    agent.docs.soulMd,
    ``,
    `=== USER.md ===`,
    agent.docs.userMd || snapshot.config.globalUserMd,
    ``,
    `=== TOOLS.md ===`,
    agent.docs.toolsMd,
    ``,
    `=== AGENTS.md ===`,
    agent.docs.agentsMd,
    ``,
    `=== DAFTAR REKAN TIM DI VILLA HQ (BISA DI-OPER / DELEGASIKAN OTOMATIS) ===`,
    roster,
    `Catatan Kolaborasi Multi-Agent: Jika Bos memintamu mengarahkan / mendelegasikan / mengoper hasil kerjamu ke satu rekan, beberapa rekan, atau semua rekan tim (dan belum di-tag otomatis), kamu bisa menambahkan blok kode \`\`\`team-handoff ... \`\`\` di bagian PALING AKHIR jawabanmu berisi JSON Array murni: \`[{ "agentId": "<id rekan dari daftar di atas atau 'all'>", "instruction": "<instruksi spesifik untuk rekan tersebut>" }]\`. Sistem Villa HQ akan otomatis memanggil rekan tersebut bekerja di mejanya!`,
    ``,
    `=== 💬 RIWAYAT PERCAKAPAN & DISKUSI KONTEN SEBELUMNYA DENGAN BOS & TIM (WAJIB DIINGAT) ===`,
    conversationHistorySnippet,
    ``,
    `=== KONTEKS FILE LOKAL LAPTOP YANG TERHUBUNG ===`,
    localFilesSnippet,
    ``,
    `=== DATA LIVE BROWSER MEDIA SOSIAL & DASHBOARD (TERMASUK JUDUL VIDEO & KOMENTAR TERBARU) ===`,
    socialBrowserSnippet,
    ...(notionCalendarSnippet ? [``, notionCalendarSnippet] : []),
    ``,
    `=== PANDUAN FORMAT JAWABAN AGAR NYAMAN DIBACA ===`,
    `- Sapa Head of Digital Marketing dengan natural dan sopan sebagai "Bos" (hindari kata kaku seperti "kalian").`,
    `- JANGAN menulis kop surat kaku di awal jawaban (seperti "Dari: ... -> Untuk: ... / Sumber: ... / Waktu: ...") kecuali diminta membuat dokumen resmi. Langsung masuk ke inti bahasan.`,
    `- Jika Bos bertanya singkat/spesifik (misalnya menanyakan judul konten yang pernah dibahas atau komentar terbaru di sosmed), jawab langsung to-the-point mengacu pada RIWAYAT PERCAKAPAN dan DATA LIVE BROWSER MEDIA SOSIAL di atas.`,
    `- Jika menyajikan analisis angka/multi-platform, gunakan Tabel Markdown ringkas (| Platform | Metrik Utama | Catatan |) dan poin pendek (maksimal 2-3 kalimat per poin) agar mata mudah memindai tanpa paragraf panjang yang rapat.`,
    `- Akhiri dengan langkah prioritas yang paling berdampak (maksimal 3 poin aksi konkret).`,
    ``,
    `Berikan jawaban yang terstruktur, tajam, praktis, dan sesuai peranmu sebagai ${agent.name} (${agent.role}).`,
  ].join('\n');
}

function runViaHermesCli(
  cliPath: string,
  agentId: string,
  agentWorkspaceDir: string,
  prompt: string,
  baseUrl: string,
  apiKey: string,
  model: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!cliPath || !fs.existsSync(cliPath)) {
      reject(new Error(`Hermes CLI tidak ditemukan di path: ${cliPath}`));
      return;
    }

    fs.mkdirSync(agentWorkspaceDir, { recursive: true });
    const queryFile = path.join(agentWorkspaceDir, '.hermes_query.txt');
    const notionSnippet = getNotionPromptContextForAgent(agentId);
    const historySnippet = buildConversationHistoryContext(agentId, prompt);
    const enrichedQuery = [
      prompt,
      `\n[Riwayat Percakapan & Diskusi Konten Sebelumnya dengan Bos]:\n${historySnippet}`,
      `\n[Konteks Browser Medsos Live Port ${SOCIAL_CDP_PORT}]:\n${getSocialBrowserContextSnippet()}`,
      notionSnippet ? `\n${notionSnippet}` : '',
    ]
      .filter(Boolean)
      .join('\n');
    fs.writeFileSync(queryFile, enrichedQuery, 'utf-8');

    const env = {
      ...process.env,
      ...(apiKey ? { OPENAI_API_KEY: apiKey, OPENAI_BASE_URL: baseUrl } : {}),
    };

    const args = [
      'chat',
      '--oneshot',
      '-Q',
      '--query-file',
      queryFile,
      '--in',
      agentWorkspaceDir,
      '--accept-hooks',
      '-t',
      'browser,file,terminal',
    ];

    if (apiKey) {
      args.push('--provider', 'custom', '--base-url', baseUrl, '--api-key', apiKey);
      if (model) {
        args.push('-m', model);
      }
    }

    execFile(
      cliPath,
      args,
      {
        cwd: agentWorkspaceDir,
        env,
        timeout: 110000,
        maxBuffer: 4 * 1024 * 1024,
        windowsHide: true,
      },
      (err, stdout, stderr) => {
        if (err) {
          reject(new Error(stderr?.trim() || err.message));
          return;
        }
        const out = stdout.trim();
        if (!out) {
          reject(new Error('Output Hermes CLI kosong.'));
          return;
        }
        resolve(out);
      }
    );
  });
}

function buildLiveSocialDigestForSim(): string {
  try {
    if (!fs.existsSync(SOCIAL_SNAPSHOT_META_FILE)) return '';
    const meta = JSON.parse(
      fs.readFileSync(SOCIAL_SNAPSHOT_META_FILE, 'utf-8')
    ) as SocialSnapshotMeta;
    if (!meta.tabs || meta.tabs.length === 0) return '';

    const items = meta.tabs.map((t) => {
      const sample = (t.extractedText || '')
        .split('\n')
        .slice(0, 6)
        .join(' • ')
        .slice(0, 260);
      return `- **[${t.platform}] ${t.title}** (${t.loginWallDetected ? '⚠️ Belum Login' : '✅ Terbaca Live'})\n  _Cuplikan Layar:_ ${sample}`;
    });

    return `\n#### 🌐 Data Akun Medsos Live yang Terbaca dari Browser (${new Date(
      meta.lastCapturedAt || Date.now()
    ).toLocaleTimeString('id-ID')})\n${items.join('\n')}\n`;
  } catch {
    return '';
  }
}

function buildRoleSimulationResponse(
  agent: AgentProfile,
  userPrompt: string,
  priorContext?: string
): string {
  const topicExtract =
    priorContext?.slice(0, 220).replace(/\n+/g, ' ') ||
    userPrompt.slice(0, 180).replace(/\n+/g, ' ');

  const connectedNote =
    agent.connectedPaths.length > 0
      ? `\n> 📂 _Konteks Lokal Terbaca:_ \`${agent.connectedPaths.join(', ')}\`\n`
      : '';

  const pf = storage.getSnapshot().config.activeProductFocus;
  const focusSimBanner =
    pf && pf.enabled && pf.productName.trim()
      ? `\n> 🎯 **Fokus Produk & Promo Aktif:** **${pf.productName}**${pf.promoOffer ? ` — _${pf.promoOffer}_` : ''}${pf.usp ? ` | USP: ${pf.usp}` : ''}\n`
      : '';

  const simHeader = `> ⚡ **[Mode Simulasi Lokal — API Key \`api.openai.com/v1\` Menyusul]**\n> Output di bawah disusun otomatis sesuai SOP \`SOUL.md\` **${agent.name} (${agent.role})**. Begitu API Key diisi di menu **Settings**, eksekusi otomatis beralih ke Live LLM.\n${focusSimBanner}${connectedNote}${buildLiveSocialDigestForSim()}`;

  switch (agent.id) {
    case 'research':
      return `${simHeader}
### 📊 Laporan Riset Pagi & Market Intelligence
**Oleh:** ${agent.name} (${agent.role}) | **Tujuan:** Head DM & Tim Sosmed

#### 1. Executive Summary (Top 3 Peluang Hari Ini)
1. **Tren Format "POV Problem-First Unfiltered" (Skor Potensi: 9.2/10):** Audiens Indonesia di TikTok & IG Reels sedang jenuh dengan iklan hard-selling; video dengan transisi masalah harian di 2.5 detik pertama menghasilkan **+48% Hold Rate**.
2. **Celah Kompetitor:** Kompetitor utama fokus perang diskon akhir bulan, namun belum mengedukasi *value durability / efisiensi jangka panjang* produk.
3. **Sentimen Audiens & Keyword Naik:** Pencarian terkait *"rekomendasi paling worth it"* dan *"review jujur pemakaian 30 hari"* meningkat signifikan minggu ini.

#### 2. Matriks Ide Topik untuk Dievaluasi Tim Sosmed
| Kandidat Topik | Target Segmen | Potensi Viral | Potensi Konversi |
| :--- | :--- | :---: | :---: |
| **A. Eksperimen Side-by-Side vs Cara Lama** | Cold & Warm Audience | 9.5/10 | 8.8/10 |
| **B. Breakdown "Kenapa Banyak Orang Salah Pilih"** | Problem-Aware | 8.9/10 | 9.0/10 |
| **C. Behind The Scene Quality Check Tim** | Trust-Building | 7.8/10 | 8.4/10 |

#### 3. Konteks Tugas Saat Ini
- Fokus permintaan: _"${topicExtract}"_
- **Rekomendasi Handoff:** Meneruskan hasil riset ini ke **Nadia (Sosial Media Spesialist)** untuk penilaian pillar & format, serta menunggu lampu hijau dari **Head of Digital Marketing**.`;

    case 'social-media':
      return `${simHeader}
### 📱 Evaluasi & Penilaian Tim Sosial Media
**Oleh:** ${agent.name} (${agent.role})

#### 1. Penilaian Hasil Riset
Berdasarkan laporan riset pagi, saya menilai ketiga kandidat dengan parameter algoritma IG Reels & TikTok saat ini:
- **Pemenang Utama:** **Topik A + B Hybrid ("Kesalahan Umum + Side-by-Side Proof")** — **Skor Kelayakan: 9.3/10**.
- **Alasan Algoritmik:** Memicu *Save* (karena edukatif) sekaligus *Comment/Share* (karena relatable dengan pengalaman gagal audiens sebelumnya).

#### 2. Rencana Distribusi & Format
- **Platform Utama:** TikTok (durasi 32–42 detik) & Instagram Reels + 1 Carousel pendamping (7 slide untuk kejar *Saves*).
- **Content Pillar:** *Educate & Prove* (Soft-conversion ke keranjang/link bio).
- **Jam Tayang Optimal:** 12:00 WIB (jam istirahat) atau 19:15 WIB (prime time).

#### 3. Menunggu Keputusan Head DM
- **Status:** Mohon **Approve (OK)** dari **Head of Digital Marketing** agar brief ini langsung saya oper ke **Reza (Designer)** untuk referensi visual, lalu ke **Tiara & Rafi** untuk produksi konten.`;

    case 'designer':
      return `${simHeader}
### 🎨 Referensi Design, Moodboard & Art Direction
**Oleh:** ${agent.name} (${agent.role})

#### 1. Konsep Visual & Moodboard
- **Visual Style:** *Clean Editorial Split-Screen + Bold High-Contrast Callout* (mudah terbaca di layar HP dalam 0.8 detik pertama).
- **Palet Warna Utama:**
  - Deep Navy \`#0F172A\` (Background kontras)
  - Electric Indigo \`#6366F1\` (Highlight data utama)
  - Warm Amber \`#F59E0B\` (Badge perhatian / Hook)
  - Crisp Off-White \`#F8FAFC\` (Tipografi utama)

#### 2. Panduan Tipografi & Layout
- **Headline Hook:** Plus Jakarta Sans ExtraBold (ukuran besar di 1/3 atas safe-zone Reels/TikTok).
- **Visual Hook Frame 00:00:** Split perbandingan kiri (*"❌ Cara Biasa — Boros Waktu"*) vs kanan (*"✅ Cara Baru — 3x Lebih Efisien"*).
- **Carousel Layout (7 Slide):** Slide 1 Big Contrast Hook -> Slide 2 Masalah -> Slide 3-5 Bukti Visual -> Slide 6 Ringkasan Checklist -> Slide 7 Clear CTA.

#### 3. Handoff ke Tim Produksi
- Panduan referensi visual siap dieksekusi oleh **Tiara (Content Creator)** & **Rafi (Videograph & Editor)**.`;

    case 'content-creator':
      return `${simHeader}
### ✍️ Paket Naskah Konten, Hook & Copywriting
**Oleh:** ${agent.name} (${agent.role})

#### 1. Tiga Variasi 3-Second Hook (Untuk A/B Test Organik & Ads)
1. **Hook Kontras:** *"Stop lakuin cara ini kalau nggak mau buang budget percuma tiap bulan!"*
2. **Hook Eksperimen:** *"Kita tes langsung bedanya dalam 15 detik—hasilnya bikin satu kantor kaget."*
3. **Hook Relatable:** *"Pasti pernah kan udah capek-capek pilih, eh hasilnya zonk? Ini biang keroknya."*

#### 2. Tabel Script Siap Syuting (Durasi ~35 Detik)
| Detik | Adegan Visual | Dialog / Voice Over (VO) | Teks Layar (On-Screen) |
| :--- | :--- | :--- | :--- |
| **00-03s** | Close-up ekspresi + split hasil | *"Stop lakuin cara lama ini kalau mau hasil maksimal!"* | **STOP CARA LAMA INI ❌** |
| **04-12s** | Tunjukkan pain-point utama | *"9 dari 10 orang kejebak di langkah awal karena nggak cek detail ini..."* | **Kenapa Sering Gagal?** |
| **13-25s** | Demo solusi & bukti nyata | *"Bandingin pas kita ganti pakai pendekatan ini—jauh lebih rapi & cepat."* | **3x Lebih Efektif ✅** |
| **26-35s** | Hasil akhir + tunjuk CTA | *"Save video ini biar nggak lupa, dan cek detail lengkapnya di link bio sekarang!"* | **Save & Cek Link di Bio 👇** |

#### 3. Caption & Hashtag
> Udah tahu bedanya belum? Jangan sampai salah langkah lagi ya! Tulis di komentar pengalaman kamu sebelumnya 👇 #TipsMarketing #RekomendasiTerbaik #ReviewJujur`;

    case 'videographer':
      return `${simHeader}
### 🎬 Storyboard, Shot List & Video Editing Blueprint
**Oleh:** ${agent.name} (${agent.role})

#### 1. Shot List Produksi (Vertical 9:16, 4K 60fps)
- **Shot 1 (00:00–00:03 | A-Roll Visual Hook):** Handheld slight push-in, focal length 24mm, talent memegang komparasi produk di depan key light 45°.
- **Shot 2 (00:04–00:12 | B-Roll Problem):** Macro close-up detail masalah + whip-pan transition cepat.
- **Shot 3 (00:13–00:25 | B-Roll Hero Demo):** Top-down flatlay & speed-ramp 200% -> 100% tepat saat hasil terlihat jelas.
- **Shot 4 (00:26–00:35 | A-Roll CTA):** Medium close-up eye-level dengan grafis panah mengarah ke tombol keranjang/profil.

#### 2. Panduan Editing & Retention Pacing
- **Pattern Interrupt:** Ganti framing / zoom punch-in tipis setiap **2.2 detik** untuk menjaga Average Watch Time > 45%.
- **Audio & SFX:** Subtle whoosh pada transisi, crisp pop SFX saat badge poin muncul, BGM upbeat lo-fi/funk di \`-18dB\` di bawah VO (\`-6dB\`).
- **Deliverables:** 1 Master Organik + 2 Raw Hook Variations untuk **Kevin (Ads Spesialist)**.`;

    case 'ads':
      return `${simHeader}
### 🎯 Strategi Paid Ads & ROAS Optimization
**Oleh:** ${agent.name} (${agent.role})

1. **Struktur Campaign:**
   - **TOF (Prospecting - 60% Budget):** Broad + Interest Stack di Meta Reels & TikTok Spark Ads menggunakan 3 variasi Hook baru. Target Thumbstop Ratio **>32%**, CTR **>1.8%**.
   - **MOF (Warm Retargeting - 25% Budget):** Video Viewers 50% + IG Engagers 14 hari + Add-to-Cart belum checkout, tampilkan konten Social Proof/Review KOL.
   - **BOF (Conversion/CPAS - 15% Budget):** Dynamic Product Ads & GMV Max mengarah ke Landing Page & Shopee/TikTok Shop. Target **ROAS >= 4.5x**.
2. **Action Item Hari Ini:** Mematikan adset dengan CPA > batas toleransi dan menaikkan budget +20% pada winning creative.`;

    case 'campaign':
      return `${simHeader}
### 🚀 Master Blueprint Campaign 360°
**Oleh:** ${agent.name} (${agent.role})

1. **Big Idea Campaign:** *"Smart Upgrade — Hasil Maksimal Tanpa Ribet"*
2. **Mekanisme Promo:** Tiered Bundling (Beli 2 Hemat 18% + Bonus Eksklusif 100 Pembeli Pertama) untuk mendongkrak Average Order Value (AOV).
3. **Timeline Fase:**
   - **H-3 Teaser:** Konten curiosity di Sosmed & Seeding KOL
   - **D-Day Launch:** Live Shopping marathon + Push Meta/TikTok Ads + Hero Banner Website & Marketplace
   - **H+3 Last Call:** Urgency reminder stok terbatas`;

    case 'marketplace':
      return `${simHeader}
### 🛍️ Optimasi Marketplace (Shopee, TikTok Shop & Tokopedia)
**Oleh:** ${agent.name} (${agent.role})

1. **Katalog & PDP Optimization:** Update frame thumbnail Hero SKU dengan badge value proposition kontras tinggi (estimasi kenaikan CTR katalog +22%).
2. **Promo & Voucher Bertingkat:** Aktifkan Voucher Ikuti Toko + Combo Hemat (Add-on Deal) + Slot Flash Sale jam 12:00 & 20:00 WIB.
3. **Live & GMV Max:** Sinkronisasi pin produk unggulan saat jam trafik puncak sore-malam.`;

    case 'kol':
      return `${simHeader}
### 🌟 Rencana KOL Seeding, Tiering & Affiliate
**Oleh:** ${agent.name} (${agent.role})

1. **Komposisi KOL Bulan Ini:**
   - **25 Nano KOL (Affiliate/Seeding):** Kejar volume UGC jujur & ulasan kolom komentar.
   - **8 Micro KOL Niche Spesifik:** Fokus edukasi mendalam & kode voucher khusus.
   - **2 Mid-Tier Creator:** Anchor credibility + izin whitelisting Spark Ads untuk tim Ads.
2. **Key Talking Point Brief:** Wajib menunjukkan pembuktian pemakaian asli di 3 detik awal tanpa terlihat membaca brosur.`;

    case 'seo':
      return `${simHeader}
### 🔍 Rencana SEO, Keyword Cluster & Topical Authority
**Oleh:** ${agent.name} (${agent.role})

1. **Prioritas Keyword Transactional & Commercial Investigation:**
   - Cluster utama: perbandingan solusi terbaik, panduan memilih untuk pemula, dan review spesifikasi lengkap.
2. **On-Page & Technical Action:** Optimasi struktur H1-H3, penambahan FAQ Schema JSON-LD untuk menangkap *Featured Snippet / AI Overview*, dan penguatan internal link langsung ke Money Page.`;

    case 'ui-ux':
      return `${simHeader}
### 🖥️ Audit UI/UX & Conversion Rate Optimization (CRO)
**Oleh:** ${agent.name} (${agent.role})

1. **Perbaikan Above-the-Fold Mobile:** Headline manfaat utama + rating bintang social proof + tombol CTA kontras langsung terlihat tanpa perlu scroll di layar 390x844px.
2. **Pengurangan Friksi Checkout:** Menambahkan *Sticky Bottom CTA Bar* saat user scroll membaca testimoni, serta memperjelas garansi/keamanan transaksi di dekat tombol beli.`;

    default:
      return `${simHeader}
### 📌 Laporan Eksekusi — ${agent.name} (${agent.role})
Tugas telah dianalisis sesuai instruksi \`SOUL.md\` dan konteks tim:
- **Fokus Permintaan:** _"${topicExtract}"_
- **Rekomendasi Utama:** Menyelaraskan eksekusi dengan KPI Head of Digital Marketing, memastikan kualitas deliverable tervalidasi, dan siap berkolaborasi dengan spesialis terkait di Villa HQ.`;
  }
}

export async function generateAgentResponse(params: {
  agent: AgentProfile;
  userPrompt: string;
  priorContext?: string;
  forceEngine?: 'hybrid_api' | 'hermes_cli';
}): Promise<AgentGenerationResult> {
  const { agent, userPrompt, priorContext, forceEngine } = params;
  const snapshot = storage.getSnapshot();
  const { baseUrl, apiKey, defaultModel, temperature, hermesCliPath } = snapshot.config.provider;

  const enginePref = forceEngine || agent.preferredEngine;
  const fullUserPrompt = priorContext
    ? `Konteks Sebelumnya dari Rekan Tim / Workflow:\n${priorContext}\n\n---\nInstruksi Tugasmu Sekarang:\n${userPrompt}`
    : userPrompt;

  // Ensure every Agent always has freshly-synced Live Social Media tabs (metrics, video titles & comments) + Notion Calendar before answering!
  await Promise.all([
    ensureFreshSocialBrowserSnapshot({ maxAgeMs: 25_000 }),
    ensureFreshNotionCalendarForAgent(agent.id),
  ]);

  // Option 1: Explicit Hermes CLI execution
  if (enginePref === 'hermes_cli') {
    const agentWorkspaceDir = storage.getAgentWorkspaceDir(agent.id);
    storage.syncAgentMarkdownToDisk(agent);
    try {
      const cliModel = (agent.modelOverride || defaultModel || 'gpt-4o-mini').trim();
      const cliOut = await runViaHermesCli(
        hermesCliPath,
        agent.id,
        agentWorkspaceDir,
        fullUserPrompt,
        normalizeBaseUrl(baseUrl),
        apiKey.trim(),
        cliModel
      );
      return {
        content: cliOut,
        engineUsed: 'hermes_cli',
      };
    } catch (cliErr) {
      // If API key exists, fall back to direct API; otherwise simulation with diagnostic note
      if (!apiKey.trim()) {
        return {
          content: buildRoleSimulationResponse(agent, userPrompt, priorContext),
          engineUsed: 'simulation',
        };
      }
      const errMsg = cliErr instanceof Error ? cliErr.message : String(cliErr);
      console.warn(`[Hermes CLI fallback to API] ${errMsg}`);
    }
  }

  // Option 2: Live OpenAI-compatible API (Muse AI https://api.meta.ai/v1, 9Router http://localhost:20128/v1, or api.openai.com/v1)
  const cleanBase = normalizeBaseUrl(baseUrl);
  const isLocalGateway =
    cleanBase.includes('localhost') || cleanBase.includes('127.0.0.1');
  const isMuseDirect =
    cleanBase.includes('meta.ai') || cleanBase.includes('muse') || defaultModel.includes('muse');

  if (apiKey.trim() || isLocalGateway) {
    const effectiveKey = apiKey.trim() || 'local-bridge';
    const smartDefault = cleanBase.includes('8765')
      ? 'muse'
      : isMuseDirect
      ? 'muse-spark-1.3'
      : 'auto';
    const primaryModel = (agent.modelOverride || defaultModel || smartDefault).trim();
    const fallbackModel = (defaultModel || smartDefault).trim();
    const candidateModels = Array.from(
      new Set([primaryModel, fallbackModel, smartDefault].filter(Boolean))
    );
    const systemPrompt = buildSystemPrompt(agent, userPrompt);

    let lastErr: unknown = null;
    for (const model of candidateModels) {
      try {
        const res = await fetch(`${cleanBase}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${effectiveKey}`,
          },
          body: JSON.stringify({
            model,
            temperature: temperature ?? 0.7,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: fullUserPrompt },
            ],
          }),
          signal: AbortSignal.timeout(180000),
        });

        if (!res.ok) {
          const errBody = await res.text();
          throw new Error(`HTTP ${res.status} (${model}) dari ${cleanBase}: ${errBody.slice(0, 220)}`);
        }

        const data = (await res.json()) as {
          choices?: Array<{ message?: { content?: string } }>;
        };
        const reply = data.choices?.[0]?.message?.content?.trim();
        if (reply) {
          return {
            content: reply,
            engineUsed: 'live_api',
          };
        }
        throw new Error(`Response API (${model}) tidak memiliki konten choices[0].message.content`);
      } catch (apiErr) {
        lastErr = apiErr;
        console.warn(
          `[LLM Engine] Model "${model}" gagal untuk agent ${agent.id}, mencoba fallback jika ada:`,
          apiErr instanceof Error ? apiErr.message : String(apiErr)
        );
      }
    }

    const errMsg = lastErr instanceof Error ? lastErr.message : String(lastErr);
    return {
      content: `⚠️ **Gagal memanggil Live API (\`${cleanBase}\`):** ${errMsg}\n\n---\n${buildRoleSimulationResponse(
        agent,
        userPrompt,
        priorContext
      )}`,
      engineUsed: 'simulation',
    };
  }

  // Option 3: Smart Simulation Mode while API Key is "Menyusul"
  // Add a short natural thinking delay (700ms - 1300ms) so 3D animations & handoffs feel alive!
  await new Promise((r) => setTimeout(r, 850));
  return {
    content: buildRoleSimulationResponse(agent, userPrompt, priorContext),
    engineUsed: 'simulation',
  };
}
