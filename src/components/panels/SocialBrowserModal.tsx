import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  ExternalLink,
  Globe,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import { AgentProfile, SocialBrowserStatus } from '../../types';
import { api } from '../../utils/api';
import { RichMarkdownMessage } from '../common/RichMarkdownMessage';

interface SocialBrowserModalProps {
  agents: AgentProfile[];
  defaultAgentId?: string;
  onClose: () => void;
  onRefreshState: () => void;
  onOpenAgentChat?: (agentId: string) => void;
}

const PLATFORM_PRESETS = [
  {
    label: 'Instagram Profile / Insights',
    emoji: '📸',
    url: 'https://www.instagram.com/',
    badge: 'Nadia & Salsa',
  },
  {
    label: 'TikTok Studio Analytics',
    emoji: '🎵',
    url: 'https://www.tiktok.com/tiktokstudio',
    badge: 'Nadia, Tiara & Rafi',
  },
  {
    label: 'Meta Business Suite (IG + FB)',
    emoji: '📊',
    url: 'https://business.facebook.com/latest/home',
    badge: 'Nadia & Bima',
  },
  {
    label: 'Meta Ads Manager',
    emoji: '🎯',
    url: 'https://adsmanager.facebook.com/',
    badge: 'Kevin (Ads)',
  },
  {
    label: 'YouTube Studio',
    emoji: '▶️',
    url: 'https://studio.youtube.com/',
    badge: 'Rafi & Nadia',
  },
  {
    label: 'Shopee Seller Center',
    emoji: '🛍️',
    url: 'https://seller.shopee.co.id/',
    badge: 'Putri (Marketplace)',
  },
  {
    label: 'Google Trends Indonesia',
    emoji: '📈',
    url: 'https://trends.google.co.id/trending?geo=ID',
    badge: 'Arka & Dimas',
  },
  {
    label: 'TikTok Creative Center',
    emoji: '🔥',
    url: 'https://ads.tiktok.com/business/creativecenter/inspiration/popular/hashtag/pc/id',
    badge: 'Arka & Reza',
  },
];

export const SocialBrowserModal: React.FC<SocialBrowserModalProps> = ({
  agents,
  defaultAgentId = 'social-media',
  onClose,
  onRefreshState,
  onOpenAgentChat,
}) => {
  const [status, setStatus] = useState<SocialBrowserStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ ok: boolean; text: string } | null>(null);

  const [customUrl, setCustomUrl] = useState('');
  const [openVisibleTabInBrowser, setOpenVisibleTabInBrowser] = useState(true);
  const [selectedTabId, setSelectedTabId] = useState<string>('');
  const [selectedAgentId, setSelectedAgentId] = useState<string>(defaultAgentId);
  const [customPrompt, setCustomPrompt] = useState(
    'Analisis halaman/insight medsos yang sedang terbuka ini: evaluasi angka metrik utama, kualitas konten terakhir, dan berikan 3 aksi konkret hari ini untuk Head DM.'
  );
  const [analysisOutput, setAnalysisOutput] = useState<string | null>(null);

  const loadStatus = async () => {
    try {
      const res = await api.getSocialBrowserStatus();
      setStatus(res.status);
    } catch (err) {
      setBanner({
        ok: false,
        text: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadStatus();
  }, []);

  const handleLaunchOrOpenUrl = async (url?: string) => {
    const fallbackUrl = url || 'https://www.instagram.com/';
    if (openVisibleTabInBrowser) {
      window.open(fallbackUrl, '_blank', 'noopener,noreferrer');
    }

    setBusyAction(url || 'launch');
    setBanner(null);
    try {
      const res = await api.launchSocialBrowser(url);
      setStatus(res.status);
      if (res.openedTabId) {
        setSelectedTabId(res.openedTabId);
      }
      setBanner({
        ok: res.ok,
        text: openVisibleTabInBrowser
          ? `Tab baru telah dibuka di browser Anda + tersinkron ke jembatan Medsos!`
          : res.message,
      });
    } catch (err) {
      setBanner({
        ok: false,
        text: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setBusyAction(null);
    }
  };

  const handleOpenCustomUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    let trimmed = customUrl.trim();
    if (!trimmed) return;
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
      trimmed = `https://${trimmed}`;
    }
    await handleLaunchOrOpenUrl(trimmed);
    setCustomUrl('');
  };

  const handleCaptureSnapshot = async () => {
    setBusyAction('capture');
    setBanner(null);
    try {
      const res = await api.captureSocialBrowser(selectedTabId || undefined, true);
      setStatus(res.status);
      setBanner({ ok: res.ok, text: res.message });
    } catch (err) {
      setBanner({
        ok: false,
        text: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setBusyAction(null);
    }
  };

  const handleAnalyzeWithAgent = async () => {
    setBusyAction('analyze');
    setBanner(null);
    setAnalysisOutput(null);
    try {
      const res = await api.analyzeSocialBrowserWithAgent({
        agentId: selectedAgentId,
        tabId: selectedTabId || undefined,
        customInstruction: customPrompt,
      });
      setStatus(res.status);
      setAnalysisOutput(res.reply.content);
      setBanner({ ok: true, text: res.message });
      onRefreshState();
    } catch (err) {
      setBanner({
        ok: false,
        text: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setBusyAction(null);
    }
  };

  const chosenAgent = agents.find((a) => a.id === selectedAgentId) || agents[0];

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-5xl max-h-[88vh] bg-slate-950 border border-slate-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 bg-gradient-to-r from-slate-900 via-indigo-950/60 to-cyan-950/50 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-cyan-500 to-indigo-600 flex items-center justify-center text-white shadow-lg">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-extrabold text-white">
                  Social Media Browser Bridge (Chrome Profile + Hermes)
                </h2>
                <span
                  className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                    status?.running
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40'
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}
                >
                  {status?.running
                    ? `🟢 Chrome Medsos Online (${status.openTabs.length} Tab)`
                    : '⚪ Chrome Medsos Belum Dibuka'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Profil Chrome terisolasi & aman untuk login Instagram, TikTok Studio, Meta Business,
                YouTube & Shopee tanpa mengganggu Chrome pribadi Anda
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => void loadStatus()}
              className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-bold text-slate-200 flex items-center gap-1.5 transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {banner && (
            <div
              className={`p-3.5 rounded-2xl border text-xs font-semibold flex items-start gap-2.5 ${
                banner.ok
                  ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-200'
                  : 'bg-amber-950/60 border-amber-500/40 text-amber-200'
              }`}
            >
              {banner.ok ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              )}
              <span>{banner.text}</span>
            </div>
          )}

          {/* Step 1: Launch Dedicated Chrome Profile + Safety Explanation */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <span className="text-[10px] uppercase tracking-wider font-extrabold text-cyan-400">
                    Langkah 1 • Sesi Login Permanen
                  </span>
                  <h3 className="text-sm font-extrabold text-white mt-0.5">
                    Buka Jendela Chrome Khusus Akun Medsos Brand
                  </h3>
                </div>

                <button
                  onClick={() => void handleLaunchOrOpenUrl()}
                  disabled={busyAction !== null}
                  className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white text-xs font-extrabold shadow-lg flex items-center gap-2 transition disabled:opacity-50"
                >
                  <ExternalLink className="w-4 h-4" />
                  {busyAction === 'launch'
                    ? 'Membuka Chrome Medsos...'
                    : status?.running
                    ? 'Fokuskan Chrome Medsos'
                    : '🚀 Buka Chrome Khusus Medsos'}
                </button>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                Klik tombol di atas atau shortcut di bawah untuk langsung membuka tab medsos di
                layar Anda sekaligus menghubungkannya ke engine pembaca Nadia.
              </p>

              <label className="flex items-center gap-2 text-xs text-cyan-200 font-semibold cursor-pointer select-none bg-cyan-950/35 border border-cyan-500/30 rounded-xl px-3 py-2">
                <input
                  type="checkbox"
                  checked={openVisibleTabInBrowser}
                  onChange={(e) => setOpenVisibleTabInBrowser(e.target.checked)}
                  className="rounded accent-cyan-500"
                />
                <span>
                  Selalu buka tab baru langsung di browser layar saya saat klik tombol/link
                </span>
              </label>

              <div className="p-2.5 rounded-xl bg-indigo-950/40 border border-indigo-500/30 text-[11px] text-slate-200 space-y-1 leading-relaxed">
                <div className="font-extrabold text-indigo-300">
                  💡 2 Cara Membaca Dashboard Privat yang Butuh Login (IG Insights / TikTok Studio / Ads):
                </div>
                <div>
                  1. <strong>Tanpa Login Ulang (Di Browser Ini):</strong> Buka{' '}
                  <code className="text-cyan-300">chrome://extensions</code> → aktifkan{' '}
                  <em>Developer mode</em> → klik <strong>Load unpacked</strong> → pilih folder{' '}
                  <code className="text-amber-300">d:\Dika\Ai-Agent\chrome-extension-medsos</code>.
                  Tinggal klik ikonnya di tab medsos mana pun!
                </div>
                <div>
                  2. <strong>Jendela Chrome Khusus Port 9222:</strong> Klik 2x file{' '}
                  <code className="text-amber-300">d:\Dika\Ai-Agent\buka-chrome-medsos.bat</code>{' '}
                  di Windows Explorer agar jendela Chrome khusus muncul di layar Anda.
                </div>
              </div>

              {/* Custom URL Launcher */}
              <form onSubmit={handleOpenCustomUrl} className="flex gap-2 pt-1">
                <input
                  type="text"
                  value={customUrl}
                  onChange={(e) => setCustomUrl(e.target.value)}
                  placeholder="Atau tempel link profil IG / TikTok / kompetitor (contoh: instagram.com/namabrand)..."
                  className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                />
                <button
                  type="submit"
                  disabled={busyAction !== null}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-xs font-bold text-white transition"
                >
                  Buka Tab
                </button>
              </form>
            </div>

            <div className="p-4 rounded-2xl bg-emerald-950/25 border border-emerald-500/30 space-y-2">
              <div className="flex items-center gap-2 text-emerald-300 font-extrabold text-xs">
                <ShieldCheck className="w-4 h-4" />
                Mode Aman Anti-Banned Aktif
              </div>
              <ul className="text-[11px] text-slate-300 space-y-1.5 leading-relaxed list-disc pl-4">
                <li>
                  Memakai <strong>Google Chrome asli</strong> di laptop Anda (bukan bot headless
                  palsu).
                </li>
                <li>
                  <strong>100% Read-Only & Pasif:</strong> Agent hanya membaca angka/teks layar yang
                  terbuka tanpa spam klik otomatis.
                </li>
                <li>
                  Tidak menutup atau mengganggu tab Chrome pribadi Anda yang lain.
                </li>
                <li>
                  Terintegrasi otomatis ke <strong>Hermes CLI (`-t browser`)</strong> & MCP{' '}
                  <code>port 9222</code>.
                </li>
              </ul>
            </div>
          </div>

          {/* Step 2: 1-Click Platform Shortcuts */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider font-extrabold text-indigo-400">
                Langkah 2 • Pintasan Platform Medsos & Ads (Klik untuk Buka di Chrome Medsos)
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {PLATFORM_PRESETS.map((preset) => (
                <button
                  key={preset.url}
                  onClick={() => void handleLaunchOrOpenUrl(preset.url)}
                  disabled={busyAction !== null}
                  className="p-3 rounded-2xl bg-slate-900/90 hover:bg-slate-800/90 border border-slate-800 hover:border-indigo-500/50 text-left transition group"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-lg">{preset.emoji}</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 group-hover:text-indigo-300">
                      {preset.badge}
                    </span>
                  </div>
                  <div className="text-xs font-bold text-slate-100 group-hover:text-white line-clamp-1">
                    {preset.label}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Step 3: Live Open Tabs + Capture & Direct Specialist Analysis */}
          <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="text-[10px] uppercase tracking-wider font-extrabold text-pink-400">
                  Langkah 3 • Tarik Insight Layar & Minta Analisis Spesialis
                </span>
                <h3 className="text-sm font-extrabold text-white mt-0.5">
                  Tab Aktif di Chrome Medsos ({status?.openTabs.length || 0} Tab Terdeteksi)
                </h3>
              </div>

              <button
                onClick={() => void handleCaptureSnapshot()}
                disabled={!status?.running || busyAction !== null}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-xs font-bold text-cyan-200 flex items-center gap-1.5 transition disabled:opacity-40"
              >
                <Camera className="w-3.5 h-3.5" />
                {busyAction === 'capture'
                  ? 'Membaca Layar...'
                  : '📥 Tarik Data & Screenshot Semua Tab'}
              </button>
            </div>

            {status?.openTabs && status.openTabs.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {status.openTabs.map((t) => {
                  const isSelected = selectedTabId === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setSelectedTabId(isSelected ? '' : t.id)}
                      className={`p-2.5 rounded-xl border text-left transition flex items-center justify-between gap-2 ${
                        isSelected
                          ? 'bg-indigo-950/70 border-indigo-400 text-white'
                          : 'bg-slate-950/80 border-slate-800 text-slate-300 hover:border-slate-600'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300">
                            {t.platform}
                          </span>
                          <span className="text-xs font-bold truncate">{t.title}</span>
                        </div>
                        <div className="text-[10px] text-slate-500 truncate mt-0.5">{t.url}</div>
                      </div>
                      <span className="text-[10px] font-bold shrink-0 text-indigo-300">
                        {isSelected ? '✓ Fokus Tab Ini' : 'Pilih'}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-slate-950/70 border border-dashed border-slate-800 text-center text-xs text-slate-400">
                Belum ada tab medsos aktif. Klik <strong>🚀 Buka Chrome Khusus Medsos</strong> atau
                salah satu pintasan platform di Langkah 2.
              </div>
            )}

            {/* Direct AI Specialist Trigger */}
            <div className="pt-2 border-t border-slate-800 grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">
                  Pilih Spesialis Pemeriksa:
                </label>
                <select
                  value={selectedAgentId}
                  onChange={(e) => setSelectedAgentId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                >
                  {agents.map((ag) => (
                    <option key={ag.id} value={ag.id}>
                      {ag.avatarEmoji} {ag.name} — {ag.role}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2 flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  placeholder="Instruksi analisis untuk agent..."
                />
                <button
                  onClick={() => void handleAnalyzeWithAgent()}
                  disabled={!status?.running || busyAction !== null}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-extrabold flex items-center justify-center gap-1.5 shadow-lg transition disabled:opacity-40 whitespace-nowrap"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  {busyAction === 'analyze'
                    ? `${chosenAgent?.name} Membaca...`
                    : `Minta ${chosenAgent?.name} Analisis`}
                </button>
              </div>
            </div>

            {/* Live Analysis Result Box */}
            {analysisOutput && (
              <div className="p-4 rounded-2xl bg-indigo-950/40 border border-indigo-500/40 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-indigo-300">
                    ✅ Hasil Analisis Live oleh {chosenAgent?.avatarEmoji} {chosenAgent?.name}:
                  </span>
                  {onOpenAgentChat && chosenAgent && (
                    <button
                      onClick={() => {
                        onClose();
                        onOpenAgentChat(chosenAgent.id);
                      }}
                      className="text-[11px] font-bold text-cyan-300 hover:underline"
                    >
                      Buka Chat {chosenAgent.name} →
                    </button>
                  )}
                </div>
                <div className="max-h-96 overflow-y-auto pr-2 pt-1">
                  <RichMarkdownMessage content={analysisOutput} />
                </div>
              </div>
            )}
          </div>

          {/* Latest Captured Screenshots & Extracted Text Preview */}
          {status?.lastSnapshot && status.lastSnapshot.tabs.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-slate-300">
                  📸 Preview Data Layar Terakhir yang Dilihat Agent (
                  {new Date(status.lastSnapshot.lastCapturedAt || '').toLocaleTimeString('id-ID')})
                </span>
                <span className="text-[11px] text-slate-500">
                  Tersimpan di <code>hermes_workspace/social_live_snapshot.md</code>
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {status.lastSnapshot.tabs.map((ct) => (
                  <div
                    key={ct.tabId}
                    className="p-3 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-extrabold text-cyan-300 truncate">
                        [{ct.platform}] {ct.title}
                      </span>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-bold shrink-0 ${
                          ct.loginWallDetected
                            ? 'bg-amber-500/20 text-amber-300'
                            : 'bg-emerald-500/20 text-emerald-300'
                        }`}
                      >
                        {ct.loginWallDetected ? '⚠️ Perlu Login' : '✅ Terbaca'}
                      </span>
                    </div>

                    {ct.screenshotUrl && (
                      <img
                        src={ct.screenshotUrl}
                        alt={ct.title}
                        className="w-full h-36 object-cover object-top rounded-xl border border-slate-800"
                      />
                    )}

                    <pre className="text-[10px] text-slate-300 bg-slate-950 p-2.5 rounded-xl max-h-28 overflow-y-auto whitespace-pre-wrap font-mono">
                      {ct.extractedText.slice(0, 700)}
                    </pre>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
