import React, { useState } from 'react';
import {
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  RefreshCw,
  Save,
  Settings,
  Zap,
  X,
} from 'lucide-react';
import { AppConfig } from '../../types';
import { api } from '../../utils/api';

interface SettingsModalProps {
  config: AppConfig;
  onClose: () => void;
  onRefreshState: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  config,
  onClose,
  onRefreshState,
}) => {
  const [tab, setTab] = useState<'provider' | 'schedule' | 'global_user'>('provider');

  // Provider fields
  const [baseUrl, setBaseUrl] = useState(config.provider.baseUrl || 'https://api.openai.com/v1');
  const [apiKey, setApiKey] = useState(config.provider.apiKey || '');
  const [showKey, setShowKey] = useState(false);
  const [defaultModel, setDefaultModel] = useState(config.provider.defaultModel || 'gpt-4o-mini');
  const [hermesCliPath, setHermesCliPath] = useState(config.provider.hermesCliPath);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [statusMsg, setStatusMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busyAction, setBusyAction] = useState(false);

  // Schedule & Reminder SLA fields
  const [startHour, setStartHour] = useState(config.workHours.startHour);
  const [endHour, setEndHour] = useState(config.workHours.endHour);
  const [autoRunRoutines, setAutoRunRoutines] = useState(config.workHours.autoRunRoutines);
  const [userBriefReminderTime, setUserBriefReminderTime] = useState(
    config.workHours.userBriefReminderTime
  );
  const [approvalReminderMinutes, setApprovalReminderMinutes] = useState(
    config.workHours.approvalReminderMinutes
  );
  const [windowsToastEnabled, setWindowsToastEnabled] = useState(
    config.villa.windowsToastEnabled
  );
  const [soundAlertsEnabled, setSoundAlertsEnabled] = useState(config.villa.soundAlertsEnabled);

  // Master Global USER.md
  const [globalUserMd, setGlobalUserMd] = useState(config.globalUserMd);

  const handleFetchModels = async () => {
    setBusyAction(true);
    setStatusMsg(null);
    try {
      const res = await api.fetchModels(baseUrl, apiKey);
      setAvailableModels(res.models);
      if (res.models.length > 0 && !res.models.includes(defaultModel)) {
        setDefaultModel(res.models[0]);
      }
      setStatusMsg({ ok: res.ok, text: res.message });
    } catch (err) {
      setStatusMsg({
        ok: false,
        text: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setBusyAction(false);
    }
  };

  const handleTestConnection = async () => {
    setBusyAction(true);
    setStatusMsg(null);
    try {
      const res = await api.testProvider(baseUrl, apiKey, defaultModel);
      setStatusMsg({ ok: res.ok, text: res.message });
    } catch (err) {
      setStatusMsg({
        ok: false,
        text: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setBusyAction(false);
    }
  };

  const applyProviderPreset = (
    preset: 'muse_bridge_8765' | 'muse_direct' | '9router_muse' | 'bandelbanget'
  ) => {
    if (preset === 'muse_bridge_8765') {
      setBaseUrl('http://127.0.0.1:8765/v1');
      setDefaultModel('muse');
      setAvailableModels(['muse', 'muse-spark-1.3', 'muse-wonder-1.0', 'muse-spark-1.2']);
      setStatusMsg({
        ok: true,
        text: 'Preset Muse Local Bridge (http://127.0.0.1:8765/v1 • model: muse) diterapkan! Pastikan browser Muse & bridge sedang terbuka.',
      });
    } else if (preset === 'muse_direct') {
      setBaseUrl('https://api.meta.ai/v1');
      setDefaultModel('muse-spark-1.3');
      setAvailableModels([
        'muse-spark-1.3',
        'muse-wonder-1.0',
        'muse-spark-1.2',
        'muse-spark-1.1',
      ]);
      setStatusMsg({
        ok: true,
        text: 'Preset Muse AI Direct diterapkan! Masukkan API Key Muse AI (MODEL_API_KEY) Anda untuk memotong langsung dari balance Muse AI.',
      });
    } else if (preset === '9router_muse') {
      setBaseUrl('http://localhost:20128/v1');
      setDefaultModel('muse');
      setAvailableModels([
        'muse',
        'Muse/muse',
        'PECUT',
        'codex-auto',
        'muse-spark-1.3',
        'muse-wonder-1.0',
      ]);
      setStatusMsg({
        ok: true,
        text: 'Preset 9Router Local (Port 20128) diterapkan! Masukkan API Key dari menu Endpoint/API Keys di dashboard 9Router (http://localhost:20128/dashboard), lalu klik Test API.',
      });
    } else {
      setBaseUrl('https://api.openai.com/v1');
      setDefaultModel('auto');
      setAvailableModels([]);
      setStatusMsg({
        ok: true,
        text: 'Preset BandelBanget Router diterapkan!',
      });
    }
  };

  const handleSyncAllAgentsToDefaultModel = async () => {
    setBusyAction(true);
    try {
      await api.resetAllAgentModels('');
      setStatusMsg({
        ok: true,
        text: `Berhasil! Seluruh 11 Agent sekarang mengikuti Default Model provider ini (${defaultModel}).`,
      });
      onRefreshState();
    } catch (err) {
      setStatusMsg({
        ok: false,
        text: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setBusyAction(false);
    }
  };

  const handleSaveAll = async () => {
    setBusyAction(true);
    try {
      await api.updateConfig({
        provider: {
          ...config.provider,
          baseUrl: baseUrl.trim() || 'https://api.openai.com/v1',
          apiKey: apiKey.trim(),
          defaultModel: defaultModel.trim() || 'gpt-4o-mini',
          hermesCliPath: hermesCliPath.trim(),
        },
        workHours: {
          ...config.workHours,
          startHour,
          endHour,
          autoRunRoutines,
          userBriefReminderTime,
          approvalReminderMinutes,
        },
        villa: {
          ...config.villa,
          windowsToastEnabled,
          soundAlertsEnabled,
        },
        globalUserMd,
      });

      // Request Browser Notification permission if user enabled alerts
      if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
        Notification.requestPermission().catch(() => {});
      }

      onRefreshState();
      onClose();
    } finally {
      setBusyAction(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-3xl max-h-[86vh] bg-slate-950 border border-slate-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-800 bg-gradient-to-r from-slate-900 to-indigo-950/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-lg">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-white">
                Pengaturan API Provider, Hermes & Jam Kerja HQ
              </h2>
              <p className="text-xs text-slate-400">
                Konfigurasi <code>https://api.openai.com/v1</code>, jembatan Hermes CLI, dan
                jadwal kerja 09:00–17:00
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Sub-Tabs */}
        <div className="px-6 pt-3 border-b border-slate-800 flex gap-2 text-xs font-bold bg-slate-900/40">
          {[
            { id: 'provider', label: '🔑 Provider API & Hermes CLI' },
            { id: 'schedule', label: '⏰ Jam Kerja (9-5) & Reminder' },
            { id: 'global_user', label: '👑 Master Global USER.md' },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id as typeof tab)}
              className={`px-3.5 py-2 rounded-t-xl border-b-2 transition ${
                tab === t.id
                  ? 'border-indigo-500 text-indigo-300 bg-indigo-500/10'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {tab === 'provider' && (
            <>
              <div className="p-4 rounded-2xl bg-indigo-950/25 border border-indigo-500/30 text-xs text-slate-300 leading-relaxed">
                <strong className="text-indigo-300">Status Saat Ini:</strong>{' '}
                {apiKey.trim() || baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1')
                  ? `Provider Live aktif (${baseUrl}) — seluruh 11 spesialis akan memanggil endpoint ini.`
                  : 'API Key masih kosong ("Menyusul") — aplikasi berjalan mulus dalam Mode Simulasi Cerdas sampai Anda memasukkan API Key.'}
              </div>

              {/* 1-Click Provider Presets: Muse AI Direct, 9Router + Muse AI, or Custom */}
              <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="text-xs font-extrabold text-white">
                    ⚡ Pilih Cepat Provider AI (1-Klik Preset):
                  </span>
                  <button
                    type="button"
                    onClick={() => void handleSyncAllAgentsToDefaultModel()}
                    disabled={busyAction}
                    title="Reset override model per-agent agar ke-11 spesialis langsung memakai Default Model provider yang dipilih di bawah"
                    className="px-2.5 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/35 text-[11px] font-bold text-amber-300 transition"
                  >
                    🔄 Samakan Semua 11 Agent ke Default Model Ini
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => applyProviderPreset('muse_bridge_8765')}
                    className={`p-2.5 rounded-xl border text-left transition ${
                      baseUrl.includes('8765')
                        ? 'bg-emerald-600/25 border-emerald-400 text-white'
                        : 'bg-slate-950 hover:bg-slate-800 border-slate-800 text-slate-300'
                    }`}
                  >
                    <div className="text-xs font-extrabold text-emerald-300">
                      🟢 Muse Bridge (8765)
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5 font-mono-code">
                      http://127.0.0.1:8765/v1
                    </div>
                    <div className="text-[10px] text-slate-300 mt-1">
                      Bridge lokal Muse AI Anda (Model: <code>muse</code>)
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => applyProviderPreset('muse_direct')}
                    className={`p-2.5 rounded-xl border text-left transition ${
                      baseUrl.includes('meta.ai')
                        ? 'bg-purple-600/25 border-purple-400 text-white'
                        : 'bg-slate-950 hover:bg-slate-800 border-slate-800 text-slate-300'
                    }`}
                  >
                    <div className="text-xs font-extrabold text-purple-300">
                      🟣 Muse AI (Direct Balance)
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5 font-mono-code">
                      https://api.meta.ai/v1
                    </div>
                    <div className="text-[10px] text-slate-300 mt-1">
                      Langsung pakai API Key & saldo Muse AI Anda (<code>muse-spark-1.3</code>)
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => applyProviderPreset('9router_muse')}
                    className={`p-2.5 rounded-xl border text-left transition ${
                      baseUrl.includes('20128')
                        ? 'bg-cyan-600/25 border-cyan-400 text-white'
                        : 'bg-slate-950 hover:bg-slate-800 border-slate-800 text-slate-300'
                    }`}
                  >
                    <div className="text-xs font-extrabold text-cyan-300">
                      🔀 9Router Local (Muse AI)
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5 font-mono-code">
                      http://localhost:20128/v1
                    </div>
                    <div className="text-[10px] text-slate-300 mt-1">
                      Lewat 9Router di laptop yang sudah konek akun & balance Muse AI
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => applyProviderPreset('bandelbanget')}
                    className={`p-2.5 rounded-xl border text-left transition ${
                      baseUrl.includes('bandelbanget')
                        ? 'bg-indigo-600/25 border-indigo-400 text-white'
                        : 'bg-slate-950 hover:bg-slate-800 border-slate-800 text-slate-300'
                    }`}
                  >
                    <div className="text-xs font-extrabold text-indigo-300">
                      🌐 BandelBanget Router
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5 font-mono-code">
                      https://api.openai.com/v1
                    </div>
                    <div className="text-[10px] text-slate-300 mt-1">
                      Multi-model gateway (Astra, DeepSeek, Gemini, Auto)
                    </div>
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">
                    OpenAI-Compatible Base URL
                  </label>
                  <input
                    type="text"
                    value={baseUrl}
                    onChange={(e) => setBaseUrl(e.target.value)}
                    placeholder="https://api.openai.com/v1"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-mono-code text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5 mb-1">
                    <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                    API Key Provider (Tersimpan Lokal di <code>data/config.secret.json</code>)
                  </label>
                  <div className="relative flex items-center">
                    <input
                      type={showKey ? 'text' : 'password'}
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder="sk-... (Bisa dikosongkan dulu jika menyusul)"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-3.5 pr-10 py-2.5 text-xs font-mono-code text-white focus:outline-none focus:border-indigo-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowKey(!showKey)}
                      className="absolute right-3 text-slate-400 hover:text-white"
                    >
                      {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                  <div className="sm:col-span-7">
                    <label className="text-xs font-bold text-slate-300 block mb-1">
                      Default Model Name
                    </label>
                    {availableModels.length > 0 ? (
                      <select
                        value={defaultModel}
                        onChange={(e) => setDefaultModel(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-xs font-mono-code text-white"
                      >
                        {availableModels.map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={defaultModel}
                        onChange={(e) => setDefaultModel(e.target.value)}
                        placeholder="Contoh: gpt-4o-mini / claude-3-5-sonnet / gemini-2.5-pro"
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-mono-code text-white"
                      />
                    )}
                  </div>

                  <div className="sm:col-span-5 flex gap-2">
                    <button
                      type="button"
                      onClick={handleFetchModels}
                      disabled={busyAction}
                      className="flex-1 py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-slate-200 flex items-center justify-center gap-1"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Fetch Models
                    </button>
                    <button
                      type="button"
                      onClick={handleTestConnection}
                      disabled={busyAction}
                      className="flex-1 py-2.5 px-3 rounded-xl bg-emerald-600/25 hover:bg-emerald-600/35 border border-emerald-500/40 text-xs font-bold text-emerald-300 flex items-center justify-center gap-1"
                    >
                      <Zap className="w-3.5 h-3.5" />
                      Test API
                    </button>
                  </div>
                </div>

                {statusMsg && (
                  <div
                    className={`p-3 rounded-xl border text-xs ${
                      statusMsg.ok
                        ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
                        : 'bg-rose-950/40 border-rose-500/40 text-rose-200'
                    }`}
                  >
                    {statusMsg.text}
                  </div>
                )}

                <div className="pt-2 border-t border-slate-800">
                  <label className="text-xs font-bold text-slate-300 block mb-1">
                    Path Hermes CLI Lokal di Laptop Anda
                  </label>
                  <input
                    type="text"
                    value={hermesCliPath}
                    onChange={(e) => setHermesCliPath(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs font-mono-code text-slate-200"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Semua file <code>SOUL.md</code>, <code>TOOLS.md</code>, <code>USER.md</code>,
                    dan <code>AGENTS.md</code> disinkronkan real-time di folder{' '}
                    <code>d:\Dika\Ai-Agent\hermes_workspace\</code>.
                  </p>
                </div>
              </div>
            </>
          )}

          {tab === 'schedule' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">
                    Jam Mulai Kerja (WIB)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={23}
                    value={startHour}
                    onChange={(e) => setStartHour(Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">
                    Jam Selesai Kerja (WIB)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={24}
                    value={endHour}
                    onChange={(e) => setEndHour(Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">
                    Jam Pengingat Jika Head DM Belum Kirim Brief Harian
                  </label>
                  <input
                    type="time"
                    value={userBriefReminderTime}
                    onChange={(e) => setUserBriefReminderTime(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono-code text-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">
                    Interval Reminder Approval Tertunda (Menit)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={180}
                    value={approvalReminderMinutes}
                    onChange={(e) => setApprovalReminderMinutes(Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
              </div>

              <div className="space-y-2.5 pt-2">
                <label className="flex items-center gap-2.5 text-xs text-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoRunRoutines}
                    onChange={(e) => setAutoRunRoutines(e.target.checked)}
                  />
                  <span>
                    Gerakkan karakter 3D otomatis antar ruang (Office / Chill / Game / Rest Room)
                    sesuai jadwal 09:00–17:00
                  </span>
                </label>

                <label className="flex items-center gap-2.5 text-xs text-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={windowsToastEnabled}
                    onChange={(e) => setWindowsToastEnabled(e.target.checked)}
                  />
                  <span>
                    Aktifkan <strong>Windows Desktop Notification</strong> (muncul walau browser
                    sedang di-minimize)
                  </span>
                </label>

                <label className="flex items-center gap-2.5 text-xs text-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={soundAlertsEnabled}
                    onChange={(e) => setSoundAlertsEnabled(e.target.checked)}
                  />
                  <span>Aktifkan Suara Chime Notifikasi di Aplikasi</span>
                </label>
              </div>
            </div>
          )}

          {tab === 'global_user' && (
            <div className="space-y-2">
              <div className="text-xs text-slate-400">
                Isi profil utama Anda sebagai <strong>Head of Digital Marketing</strong> (nama
                brand, produk fokus, target market). Tersimpan otomatis di{' '}
                <code>hermes_workspace/USER.md</code>.
              </div>
              <textarea
                rows={14}
                value={globalUserMd}
                onChange={(e) => setGlobalUserMd(e.target.value)}
                spellCheck={false}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3.5 text-xs font-mono-code text-slate-200 leading-relaxed focus:outline-none focus:border-indigo-500"
              />
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-800 bg-slate-900/70 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300"
          >
            Batal
          </button>
          <button
            onClick={handleSaveAll}
            disabled={busyAction}
            className="px-6 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-extrabold flex items-center gap-2 shadow-lg"
          >
            <Save className="w-4 h-4" />
            <CheckCircle2 className="w-3.5 h-3.5 hidden" />
            Simpan Pengaturan
          </button>
        </div>
      </div>
    </div>
  );
};
