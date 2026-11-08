import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  ExternalLink,
  Lock,
  RefreshCw,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { NotionCalendarState, NotionCreatedPageInfo } from '../../types';
import { api } from '../../utils/api';
import { RichMarkdownMessage } from '../common/RichMarkdownMessage';

interface NotionCalendarModalProps {
  onClose: () => void;
  onRefreshState: () => void;
  onOpenNadiaChat?: () => void;
}

export const NotionCalendarModal: React.FC<NotionCalendarModalProps> = ({
  onClose,
  onRefreshState,
  onOpenNadiaChat,
}) => {
  const [state, setState] = useState<NotionCalendarState | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ ok: boolean; text: string } | null>(null);

  // Connection form
  const [tokenInput, setTokenInput] = useState('');
  const [dbLinkInput, setDbLinkInput] = useState('');

  // Content generation & Notion auto-insert form
  const tomorrowIso = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  const [brief, setBrief] = useState(
    'Susun ide konten harian yang seimbang antara edukasi produk, bukti kualitas/testimoni, dan konversi penjualan sesuai data performa akun kita.'
  );
  const [itemCount, setItemCount] = useState<number>(5);
  const [startDate, setStartDate] = useState<string>(tomorrowIso);

  const [createdPages, setCreatedPages] = useState<NotionCreatedPageInfo[]>([]);
  const [nadiaOutput, setNadiaOutput] = useState<string | null>(null);

  const loadStatus = async () => {
    try {
      const res = await api.getNotionCalendarStatus();
      setState(res.state);
      if (res.state.rawDatabaseInput) {
        setDbLinkInput(res.state.rawDatabaseInput);
      }
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

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy('connect');
    setBanner(null);
    try {
      const res = await api.connectNotionCalendar({
        token: tokenInput.trim() ? tokenInput.trim() : undefined,
        databaseInput: dbLinkInput.trim(),
      });
      setState(res.state);
      if (res.ok) setTokenInput('');
      setBanner({ ok: res.ok, text: res.message });
    } catch (err) {
      setBanner({
        ok: false,
        text: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setBusy(null);
    }
  };

  const handleResync = async () => {
    setBusy('sync');
    setBanner(null);
    try {
      const res = await api.syncNotionCalendar();
      setState(res.state);
      setBanner({ ok: res.ok, text: res.message });
    } catch (err) {
      setBanner({
        ok: false,
        text: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setBusy(null);
    }
  };

  const handleSelectDataSource = async (dsId: string) => {
    if (!dsId || dsId === state?.dataSourceId) return;
    setBusy('switch-ds');
    setBanner(null);
    try {
      const res = await api.connectNotionCalendar({
        dataSourceId: dsId,
      });
      setState(res.state);
      setBanner({ ok: res.ok, text: res.message });
    } catch (err) {
      setBanner({
        ok: false,
        text: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setBusy(null);
    }
  };

  const handleToggleFilterMode = async (mode: 'content_only' | 'all_rows') => {
    if (mode === state?.filterMode) return;
    setBusy('switch-filter');
    setBanner(null);
    try {
      const res = await api.connectNotionCalendar({
        filterMode: mode,
      });
      setState(res.state);
      setBanner({ ok: res.ok, text: res.message });
    } catch (err) {
      setBanner({
        ok: false,
        text: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setBusy(null);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Putuskan koneksi Notion Konten Kalender dari Nadia?')) return;
    setBusy('disconnect');
    try {
      const res = await api.disconnectNotionCalendar();
      setState(res.state);
      setTokenInput('');
      setDbLinkInput('');
      setBanner({ ok: true, text: 'Koneksi Notion berhasil diputuskan.' });
    } finally {
      setBusy(null);
    }
  };

  const handleGenerateAndInsert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!brief.trim()) return;
    setBusy('generate');
    setBanner(null);
    setCreatedPages([]);
    setNadiaOutput(null);

    try {
      const res = await api.generateAndInsertNotionCalendar({
        brief,
        itemCount,
        startDate,
      });
      setState(res.state);
      setCreatedPages(res.createdPages || []);
      setNadiaOutput(res.reply?.content || null);
      setBanner({ ok: res.ok, text: res.message });
      onRefreshState();
    } catch (err) {
      setBanner({
        ok: false,
        text: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-5xl max-h-[92vh] bg-slate-950 border border-slate-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 bg-gradient-to-r from-slate-900 via-indigo-950/60 to-violet-950/50 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-violet-600/25 border border-violet-400/40 flex items-center justify-center text-violet-300 shadow-lg">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-extrabold text-white">
                  Notion Konten Kalender — Khusus Nadia 📱
                </h2>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/35">
                  <Lock className="w-3 h-3" /> Akses Terkunci: Hanya Konten Kalender
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Nadia otomatis mempelajari kolom & format Notion Anda, lalu menginput konten langsung
                sesuai struktur yang sudah Anda buat
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
          >
            <X className="w-4 h-4" />
          </button>
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

          {/* STEP 1: Connect Scoped Notion Integration */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <form
              onSubmit={handleConnect}
              className="lg:col-span-7 p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3"
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <span className="text-[10px] uppercase tracking-wider font-extrabold text-violet-400">
                    Langkah 1 • Koneksi Aman & Terbatas
                  </span>
                  <h3 className="text-sm font-extrabold text-white mt-0.5">
                    Hubungkan Halaman Konten Kalender Notion Anda
                  </h3>
                </div>

                {state?.connected && (
                  <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                    🟢 Terhubung: {state.databaseTitle}
                  </span>
                )}
              </div>

              <div className="space-y-2.5 pt-1">
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">
                    1. Internal Integration Secret Token{' '}
                    {state?.hasToken && (
                      <span className="text-emerald-400 font-normal">
                        (Tersimpan: {state.tokenMasked} — kosongkan jika tidak ingin mengganti)
                      </span>
                    )}
                  </label>
                  <input
                    type="password"
                    value={tokenInput}
                    onChange={(e) => setTokenInput(e.target.value)}
                    placeholder={
                      state?.hasToken
                        ? 'Token sudah tersimpan aman (isi hanya jika ingin ganti token baru)...'
                        : 'Tempel token ntn_... atau secret_... dari Notion Integrations'
                    }
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-violet-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">
                    2. Link Halaman / Database Konten Kalender Notion Anda
                  </label>
                  <input
                    type="text"
                    value={dbLinkInput}
                    onChange={(e) => setDbLinkInput(e.target.value)}
                    placeholder="Contoh: https://www.notion.so/namaworkspace/Konten-Kalender-1a2b3c4d5e6f..."
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-violet-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 pt-1 flex-wrap">
                <div className="flex items-center gap-2">
                  <button
                    type="submit"
                    disabled={busy !== null || loading}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-extrabold shadow-lg transition disabled:opacity-50"
                  >
                    {busy === 'connect'
                      ? 'Membaca Format Notion...'
                      : state?.connected
                      ? '🔗 Simpan & Sinkron Ulang Format'
                      : '🔗 Hubungkan & Baca Format Notion Gw'}
                  </button>

                  {state?.connected && (
                    <button
                      type="button"
                      onClick={() => void handleResync()}
                      disabled={busy !== null}
                      className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-slate-200 flex items-center gap-1.5 transition"
                    >
                      <RefreshCw
                        className={`w-3.5 h-3.5 ${busy === 'sync' ? 'animate-spin' : ''}`}
                      />
                      Refresh Kolom
                    </button>
                  )}
                </div>

                {state?.hasToken && (
                  <button
                    type="button"
                    onClick={() => void handleDisconnect()}
                    disabled={busy !== null}
                    className="p-2 rounded-xl bg-rose-950/40 hover:bg-rose-900/50 border border-rose-500/30 text-rose-300 text-xs transition"
                    title="Putuskan koneksi Notion"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </form>

            {/* Quick 1-Minute Setup Guide */}
            <div className="lg:col-span-5 p-4 rounded-2xl bg-violet-950/25 border border-violet-500/30 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-violet-200">
                  🔒 Cara Mengunci Akses Hanya di Konten Kalender (1 Menit):
                </span>
                <a
                  href="https://www.notion.so/profile/integrations"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-violet-600/30 hover:bg-violet-600/50 text-violet-200 text-[11px] font-bold transition"
                >
                  Buka Notion Token <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              <ol className="text-[11.5px] text-slate-300 space-y-1.5 leading-relaxed list-decimal pl-4">
                <li>
                  Klik tombol <strong>Buka Notion Token</strong> di atas → klik{' '}
                  <strong>New integration</strong> (beri nama misal <em>Nadia Konten</em>) → salin{' '}
                  <strong>Internal Integration Secret</strong>.
                </li>
                <li>
                  Buka <strong>HANYA halaman Konten Kalender</strong> Anda di Notion → klik menu{' '}
                  <strong>•••</strong> di pojok kanan atas → pilih <strong>Connections</strong> →
                  pilih <em>Nadia Konten</em>.
                </li>
                <li>
                  <em>Selesai!</em> Secara sistem Notion, Nadia <strong>100% terkunci</strong> hanya
                  bisa melihat & mengisi halaman Konten Kalender itu saja (dokumen Notion Anda yang
                  lain tetap privat).
                </li>
                <li>
                  Copy link halaman Konten Kalender tersebut, tempel di samping kiri, lalu klik{' '}
                  <strong>Hubungkan</strong>.
                </li>
              </ol>
            </div>
          </div>

          {/* STEP 2: Live Detected Schema & Sample Format from User's Notion */}
          {state?.connected && (
            <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <span className="text-[10px] uppercase tracking-wider font-extrabold text-cyan-400">
                    Langkah 2 • Full Live Read + Write Aktif (Semua Baris Kalender Terbaca!)
                  </span>
                  <h3 className="text-sm font-extrabold text-white mt-0.5">
                    "{state.databaseTitle}"
                    {state.dataSourceName && state.dataSourceName !== state.databaseTitle
                      ? ` • Tabel: ${state.dataSourceName}`
                      : ''}{' '}
                    — <span className="text-emerald-400">{state.totalEntriesCount ?? state.entries?.length ?? 0} Baris Terbaca Penuh</span>
                  </h3>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <div className="inline-flex rounded-xl bg-slate-950 border border-slate-700 p-0.5 text-[11px]">
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() => void handleToggleFilterMode('content_only')}
                      className={`px-2.5 py-1 rounded-lg font-bold transition ${
                        state.filterMode !== 'all_rows'
                          ? 'bg-emerald-600/30 text-emerald-200 border border-emerald-500/40'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      🎯 Khusus Content Calender
                    </button>
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() => void handleToggleFilterMode('all_rows')}
                      className={`px-2.5 py-1 rounded-lg font-bold transition ${
                        state.filterMode === 'all_rows'
                          ? 'bg-violet-600/30 text-violet-200 border border-violet-500/40'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      📋 Semua Baris
                    </button>
                  </div>

                  {state.databaseUrl && (
                    <a
                      href={state.databaseUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-cyan-300 transition"
                    >
                      Buka di Notion <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              </div>

              {state.availableDataSources && state.availableDataSources.length > 1 && (
                <div className="p-3 rounded-xl bg-violet-950/35 border border-violet-500/35 space-y-2">
                  <div className="text-[11px] font-bold text-violet-200">
                    🗂️ Database Notion Anda memiliki {state.availableDataSources.length} Tabel / Data
                    Source — pilih tabel Konten Kalender tujuan input Nadia:
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {state.availableDataSources.map((ds) => {
                      const active = ds.id === state.dataSourceId;
                      return (
                        <button
                          key={ds.id}
                          type="button"
                          disabled={busy !== null}
                          onClick={() => void handleSelectDataSource(ds.id)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition ${
                            active
                              ? 'bg-violet-600 text-white border-violet-400 shadow-md'
                              : 'bg-slate-950/80 text-slate-300 border-slate-700 hover:border-violet-500/60 hover:text-white'
                          }`}
                        >
                          {active ? '✅ ' : '📋 '}
                          {ds.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {state.properties.map((prop) => (
                  <div
                    key={prop.name}
                    className={`p-2.5 rounded-xl border text-xs ${
                      prop.writable
                        ? 'bg-slate-950/80 border-slate-800'
                        : 'bg-slate-950/40 border-slate-800/50 opacity-60'
                    }`}
                  >
                    <div className="font-bold text-white truncate" title={prop.name}>
                      {prop.name}
                    </div>
                    <div className="text-[10px] text-indigo-300 font-mono mt-0.5">
                      {prop.type} {!prop.writable && '(auto)'}
                    </div>
                    {prop.options.length > 0 && (
                      <div className="text-[10px] text-slate-400 mt-1 line-clamp-2">
                        Pilihan: {prop.options.join(', ')}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {(state.entries?.length ?? 0) > 0 && (
                <div className="pt-2 border-t border-slate-800/80 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-bold text-emerald-300">
                      ✅ Isi Konten Kalender Notion yang Sudah Dibaca Penuh oleh Nadia ({state.entries.length} Baris{state.workstreamFilter ? ` • ${state.workstreamFilter}` : ''}):
                    </span>
                    <span className="text-slate-400">Scroll untuk cek semua jadwal</span>
                  </div>
                  <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-800 bg-slate-950/80 divide-y divide-slate-800/70">
                    {state.entries.slice(0, 60).map((entry, idx) => (
                      <div
                        key={entry.id}
                        className="px-3 py-2 text-[11px] text-slate-300 flex items-start justify-between gap-2 hover:bg-slate-900/60"
                      >
                        <div className="min-w-0">
                          <span className="text-slate-500 mr-1.5">{idx + 1}.</span>
                          <strong className="text-white">{entry.title}</strong>
                          <span className="text-slate-400 ml-2">
                            {Object.entries(entry.propertiesSummary)
                              .filter(([k]) => k !== 'Post' && k !== 'Workstream')
                              .slice(0, 5)
                              .map(([k, v]) => `${k}: ${v}`)
                              .join(' • ')}
                          </span>
                          {entry.bodyPreview && (
                            <div className="text-[10.5px] text-cyan-300/85 truncate mt-0.5">
                              📄 Isi halaman: {entry.bodyPreview}
                            </div>
                          )}
                        </div>
                        {entry.url && (
                          <a
                            href={entry.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-cyan-400 hover:text-cyan-300 shrink-0"
                            title="Buka baris di Notion"
                          >
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 3: Ask Nadia to Generate & Auto-Insert into Notion */}
          <form
            onSubmit={handleGenerateAndInsert}
            className="p-4 rounded-2xl bg-slate-900/95 border border-indigo-500/30 space-y-3"
          >
            <div>
              <span className="text-[10px] uppercase tracking-wider font-extrabold text-indigo-400">
                Langkah 3 • Auto-Input Konten ke Notion (Atau Suruh Langsung via Chat Nadia!)
              </span>
              <h3 className="text-sm font-extrabold text-white mt-0.5">
                Minta Nadia Susun & Langsung Masukkan Konten ke Notion Kalender Anda
              </h3>
            </div>

            <textarea
              rows={3}
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              placeholder="Tulis arahan konten untuk Nadia (contoh: Buatkan 5 konten minggu depan untuk IG & TikTok Tokolas.id berdasarkan audit akun tadi, fokus edukasi mesin las MIG & promo garansi 5 tahun)..."
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-[13px] text-white leading-relaxed focus:outline-none focus:border-indigo-500"
            />

            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="flex items-center gap-3 flex-wrap">
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">
                    Jumlah Konten:
                  </label>
                  <select
                    value={itemCount}
                    onChange={(e) => setItemCount(Number(e.target.value))}
                    className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                  >
                    {[1, 2, 3, 5, 7, 10].map((n) => (
                      <option key={n} value={n}>
                        {n} Konten
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">
                    Mulai Tanggal Tayang:
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={!state?.connected || busy !== null}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-xs font-extrabold flex items-center gap-2 shadow-lg transition disabled:opacity-40"
              >
                <Sparkles className="w-4 h-4" />
                {busy === 'generate'
                  ? 'Nadia Sedang Menyusun & Input ke Notion...'
                  : `⚡ Susun & Input ${itemCount} Konten ke Notion`}
              </button>
            </div>

            {!state?.connected && (
              <p className="text-[11px] text-amber-300">
                *Hubungkan Token & Link Konten Kalender di Langkah 1 terlebih dahulu agar tombol
                auto-input aktif. Setelah terhubung, Anda juga bisa langsung menyuruh Nadia lewat
                Chat biasa!
              </p>
            )}
          </form>

          {/* Created Notion Pages Result */}
          {(createdPages.length > 0 || nadiaOutput) && (
            <div className="p-4 rounded-2xl bg-indigo-950/35 border border-indigo-500/40 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-xs font-extrabold text-emerald-300">
                  ✅ Berhasil Masuk ke Notion ({createdPages.length} Baris Konten Baru):
                </span>
                {onOpenNadiaChat && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenNadiaChat();
                    }}
                    className="text-xs font-bold text-cyan-300 hover:underline"
                  >
                    Lihat di Chat Nadia →
                  </button>
                )}
              </div>

              {createdPages.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {createdPages.map((pg) => (
                    <a
                      key={pg.id}
                      href={pg.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/35 text-xs font-bold text-emerald-200 transition"
                    >
                      📅 {pg.title} <ExternalLink className="w-3 h-3" />
                    </a>
                  ))}
                </div>
              )}

              {nadiaOutput && (
                <div className="max-h-80 overflow-y-auto pr-2 pt-2 border-t border-slate-800">
                  <RichMarkdownMessage content={nadiaOutput} />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
