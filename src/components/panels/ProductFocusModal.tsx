import React, { useState } from 'react';
import { Check, Save, Sparkles, Target, X } from 'lucide-react';
import { ActiveProductFocus, AppConfig } from '../../types';
import { api } from '../../utils/api';

interface ProductFocusModalProps {
  config: AppConfig;
  onClose: () => void;
  onRefreshState: () => void;
}

export const ProductFocusModal: React.FC<ProductFocusModalProps> = ({
  config,
  onClose,
  onRefreshState,
}) => {
  const initialFocus: ActiveProductFocus = config.activeProductFocus || {
    enabled: false,
    productName: '',
    promoOffer: '',
    usp: '',
    targetAudience: '',
    ctaLink: '',
    extraNotes: '',
    updatedAt: null,
  };

  const [focus, setFocus] = useState<ActiveProductFocus>(initialFocus);
  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.updateConfig({
        activeProductFocus: {
          ...focus,
          enabled: Boolean(focus.productName.trim()) ? focus.enabled : false,
          updatedAt: new Date().toISOString(),
        },
      });
      setSavedNotice(true);
      setTimeout(() => setSavedNotice(false), 2500);
      onRefreshState();
    } catch (err) {
      alert(`Gagal menyimpan fokus produk: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl max-h-[88vh] bg-slate-950 border border-slate-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-800 bg-gradient-to-r from-slate-900 via-indigo-950/60 to-amber-950/40 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white shadow-lg">
              <Target className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-white">
                🎯 Fokus Produk & Promo Aktif (1x Isi untuk 11 Agent)
              </h2>
              <p className="text-xs text-slate-400">
                Isi sekali di sini — seluruh 11 spesialis otomatis mengacu ke produk & promo ini tanpa perlu diketik berulang!
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

        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-extrabold text-amber-200 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                Aktifkan Injeksi Konteks Produk ke 11 Agent
              </div>
              <div className="text-[11px] text-slate-300 mt-0.5">
                Saat ON, setiap kali Anda chat atau menjalankan workflow, detail produk ini otomatis menjadi acuan utama tim.
              </div>
            </div>
            <label className="inline-flex items-center gap-2 cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={focus.enabled}
                onChange={(e) => setFocus({ ...focus, enabled: e.target.checked })}
                className="w-4 h-4 rounded accent-amber-500"
              />
              <span className="text-xs font-extrabold text-white">
                {focus.enabled ? 'AKTIF (ON)' : 'NONAKTIF'}
              </span>
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-200">
                Nama Produk / Campaign Utama *
              </label>
              <input
                type="text"
                value={focus.productName}
                onChange={(e) => {
                  const val = e.target.value;
                  setFocus({
                    ...focus,
                    productName: val,
                    enabled: val.trim() ? true : focus.enabled,
                  });
                }}
                placeholder="Contoh: Serum Brightening GlowPro X / Campaign Payday Sale"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-200">
                Harga & Promo / Penawaran Aktif
              </label>
              <input
                type="text"
                value={focus.promoOffer}
                onChange={(e) => setFocus({ ...focus, promoOffer: e.target.value })}
                placeholder="Contoh: Diskon 35% (Rp 99.000) + Gratis Ongkir & Bundling Beli 2 Hemat 20%"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-200">
              Keunggulan Utama (USP / Value Proposition)
            </label>
            <textarea
              rows={2}
              value={focus.usp}
              onChange={(e) => setFocus({ ...focus, usp: e.target.value })}
              placeholder="Contoh: Hasil terlihat dalam 7 hari, sudah BPOM & Halal, tekstur ringan tidak lengket, garansi uang kembali."
              className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-amber-400"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-200">
                Target Audiens Prioritas
              </label>
              <input
                type="text"
                value={focus.targetAudience}
                onChange={(e) => setFocus({ ...focus, targetAudience: e.target.value })}
                placeholder="Contoh: Wanita & Pria 19-34 tahun, pekerja aktif, sering berbelanja di Shopee/TikTok"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-200">
                CTA & Link Tujuan (Shopee / Web / Bio)
              </label>
              <input
                type="text"
                value={focus.ctaLink}
                onChange={(e) => setFocus({ ...focus, ctaLink: e.target.value })}
                placeholder="Contoh: Klik Keranjang Kuning / Cek Link di Bio No. 1"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-200">
              Catatan / Larangan Khusus untuk Tim (Do's & Don'ts)
            </label>
            <textarea
              rows={2}
              value={focus.extraNotes}
              onChange={(e) => setFocus({ ...focus, extraNotes: e.target.value })}
              placeholder="Contoh: Hindari klaim medis berlebihan, tonjolkan bukti review pelanggan asli & perbandingan hematnya."
              className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-amber-400"
            />
          </div>

          <div className="pt-2 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() =>
                setFocus({
                  enabled: false,
                  productName: '',
                  promoOffer: '',
                  usp: '',
                  targetAudience: '',
                  ctaLink: '',
                  extraNotes: '',
                  updatedAt: null,
                })
              }
              className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-semibold text-slate-400 hover:text-white"
            >
              Reset Kosongkan
            </button>

            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 text-xs font-extrabold flex items-center gap-2 shadow-lg transition disabled:opacity-50"
            >
              {savedNotice ? (
                <>
                  <Check className="w-4 h-4" />
                  Tersimpan & Aktif untuk 11 Agent!
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  {saving ? 'Menyimpan...' : 'Simpan Fokus Produk ke Seluruh Tim'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
