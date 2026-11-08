import React, { useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import {
  Palette,
  Plus,
  RotateCcw,
  Save,
  Trash2,
  Upload,
  UserPlus,
  X,
} from 'lucide-react';
import {
  AccessoryType,
  AgentProfile,
  CharacterAppearance,
  CharacterStyle,
  ExpressionType,
  HairStyle,
  OutfitType,
} from '../../types';
import { api } from '../../utils/api';
import { AvatarMesh } from '../three/Character3D';

interface CharacterCreatorModalProps {
  agents: AgentProfile[];
  initialAgent: AgentProfile | null;
  onClose: () => void;
  onOpenReferenceGuide: () => void;
  onRefreshState: () => void;
}

const DEFAULT_NEW_APPEARANCE: CharacterAppearance = {
  style: 'roblox',
  skinColor: '#f5cfa0',
  hairStyle: 'spiky',
  hairColor: '#1e293b',
  outfitType: 'hoodie',
  primaryColor: '#6366f1',
  secondaryColor: '#f8fafc',
  accessory: 'glasses',
  expression: 'happy',
  customModelUrl: null,
  scale: 1,
};

export const CharacterCreatorModal: React.FC<CharacterCreatorModalProps> = ({
  agents,
  initialAgent,
  onClose,
  onOpenReferenceGuide,
  onRefreshState,
}) => {
  const [mode, setMode] = useState<'edit' | 'create'>(initialAgent ? 'edit' : 'create');
  const [selectedId, setSelectedId] = useState<string>(
    initialAgent?.id || agents[0]?.id || ''
  );

  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [avatarEmoji, setAvatarEmoji] = useState('✨');
  const [department, setDepartment] = useState<AgentProfile['department']>('Custom');
  const [appearance, setAppearance] = useState<CharacterAppearance>(DEFAULT_NEW_APPEARANCE);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (mode === 'edit') {
      const target = agents.find((a) => a.id === selectedId) || agents[0];
      if (target) {
        setName(target.name);
        setRole(target.role);
        setAvatarEmoji(target.avatarEmoji);
        setDepartment(target.department);
        setAppearance({ ...target.appearance });
      }
    } else {
      setName('Zaki');
      setRole('CRM & Retention Spesialist');
      setAvatarEmoji('🚀');
      setDepartment('Custom');
      setAppearance({ ...DEFAULT_NEW_APPEARANCE });
    }
  }, [mode, selectedId]);

  const handleUploadCustomModel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const res = await api.upload3DModel(file);
      setAppearance((prev) => ({ ...prev, customModelUrl: res.url }));
    } catch (err) {
      alert(`Gagal upload file 3D: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim() || !role.trim()) {
      alert('Nama dan Role Spesialis wajib diisi.');
      return;
    }
    setIsSaving(true);
    try {
      if (mode === 'edit') {
        await api.updateAgent(selectedId, {
          name: name.trim(),
          role: role.trim(),
          avatarEmoji,
          department,
          appearance,
        });
      } else {
        await api.createAgent({
          name: name.trim(),
          role: role.trim(),
          avatarEmoji,
          department,
          appearance,
        });
      }
      onRefreshState();
      onClose();
    } catch (err) {
      alert(`Gagal menyimpan karakter: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteCustomAgent = async () => {
    if (agents.length <= 1) return;
    if (!confirm(`Hapus agent "${name}" dari Villa HQ?`)) return;
    await api.deleteAgent(selectedId);
    onRefreshState();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-5xl h-[86vh] bg-slate-950 border border-slate-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 bg-gradient-to-r from-slate-900 to-pink-950/40 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-pink-600 flex items-center justify-center text-white shadow-lg">
              <Palette className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-white">
                3D Character Studio — Roblox, Chibi Anime & Human Office
              </h2>
              <p className="text-xs text-slate-400">
                Kustomisasi wujud ke-11 spesialis, buat karakter baru, atau import model 3D (
                <code>.glb</code> / <code>.vrm</code>)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onOpenReferenceGuide}
              className="px-3 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 text-xs font-bold transition"
            >
              📚 Panduan & Referensi 3D Editor Luar
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
          {/* Left: Live 3D Turntable Preview */}
          <div className="lg:col-span-5 bg-gradient-to-b from-slate-900 via-indigo-950/40 to-slate-950 border-r border-slate-800 flex flex-col relative">
            {/* Mode Switch */}
            <div className="p-4 flex items-center gap-2 z-10">
              <button
                onClick={() => setMode('edit')}
                className={`flex-1 py-2 rounded-xl text-xs font-bold border transition ${
                  mode === 'edit'
                    ? 'bg-indigo-600 border-indigo-400 text-white shadow'
                    : 'bg-slate-900 border-slate-800 text-slate-400'
                }`}
              >
                🎨 Edit Spesialis Existing
              </button>
              <button
                onClick={() => setMode('create')}
                className={`flex-1 py-2 rounded-xl text-xs font-bold border flex items-center justify-center gap-1.5 transition ${
                  mode === 'create'
                    ? 'bg-pink-600 border-pink-400 text-white shadow'
                    : 'bg-slate-900 border-slate-800 text-slate-400'
                }`}
              >
                <UserPlus className="w-3.5 h-3.5" />
                Buat Character Baru
              </button>
            </div>

            {mode === 'edit' && (
              <div className="px-4 pb-2 z-10">
                <select
                  value={selectedId}
                  onChange={(e) => setSelectedId(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-white"
                >
                  {agents.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.avatarEmoji} {a.name} — {a.role}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* 3D Interactive Canvas */}
            <div className="flex-1 relative">
              <Canvas
                dpr={[1, 1.25]}
                gl={{ powerPreference: 'low-power', antialias: true }}
                camera={{ position: [0, 1.45, 3.1], fov: 42 }}
              >
                <ambientLight intensity={0.95} />
                <directionalLight position={[4, 6, 5]} intensity={1.35} />
                <pointLight position={[-3, 2, -2]} intensity={0.6} color="#c084fc" />
                <group position={[0, -0.72, 0]}>
                  {/* Pedestal */}
                  <mesh position={[0, -0.06, 0]}>
                    <cylinderGeometry args={[0.85, 0.95, 0.12, 24]} />
                    <meshStandardMaterial color="#312e81" metalness={0.4} roughness={0.35} />
                  </mesh>
                  <AvatarMesh appearance={appearance} />
                </group>
                <OrbitControls
                  enablePan={false}
                  minDistance={1.8}
                  maxDistance={5}
                  autoRotate
                  autoRotateSpeed={1.5}
                />
              </Canvas>

              <div className="absolute bottom-3 left-0 right-0 text-center pointer-events-none">
                <span className="px-3 py-1 rounded-full bg-slate-950/80 border border-slate-800 text-[11px] text-slate-300">
                  🖱️ Geser untuk memutar preview 3D • Scroll untuk zoom
                </span>
              </div>
            </div>
          </div>

          {/* Right: Customization Controls */}
          <div className="lg:col-span-7 p-6 overflow-y-auto space-y-5">
            {/* Identity */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              <div className="sm:col-span-2">
                <label className="text-[11px] font-bold text-slate-400 block mb-1">Emoji</label>
                <input
                  type="text"
                  value={avatarEmoji}
                  onChange={(e) => setAvatarEmoji(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-center text-base"
                />
              </div>
              <div className="sm:col-span-5">
                <label className="text-[11px] font-bold text-slate-400 block mb-1">
                  Nama Panggilan Character
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-white"
                />
              </div>
              <div className="sm:col-span-5">
                <label className="text-[11px] font-bold text-slate-400 block mb-1">
                  Jabatan Spesialis
                </label>
                <input
                  type="text"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-indigo-300"
                />
              </div>
            </div>

            {/* 3D Base Art Style Selector */}
            <div>
              <label className="text-xs font-extrabold text-white block mb-2">
                1. Pilih Bentuk Dasar 3D Character
              </label>
              <div className="grid grid-cols-3 gap-2.5">
                {(
                  [
                    {
                      id: 'roblox',
                      title: '🧱 Roblox Blocky',
                      desc: 'Kotak ikonik lucu & ekspresif',
                    },
                    {
                      id: 'anime',
                      title: '🌸 Chibi Anime',
                      desc: 'Kepala chibi imut & mata berkilau',
                    },
                    {
                      id: 'human',
                      title: '👔 Human Office',
                      desc: 'Proporsi kantor rapi & lanyard',
                    },
                  ] as Array<{ id: CharacterStyle; title: string; desc: string }>
                ).map((st) => (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() =>
                      setAppearance({
                        ...appearance,
                        style: st.id,
                        customModelUrl: null,
                      })
                    }
                    className={`p-3 rounded-2xl border text-left transition ${
                      appearance.style === st.id && !appearance.customModelUrl
                        ? 'bg-indigo-600/25 border-indigo-400 text-white shadow-lg'
                        : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="text-xs font-extrabold">{st.title}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">{st.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Hair, Outfit, Accessory, Expression */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="text-[11px] font-bold text-slate-400 block mb-1">
                  Gaya Rambut
                </label>
                <select
                  value={appearance.hairStyle}
                  onChange={(e) =>
                    setAppearance({ ...appearance, hairStyle: e.target.value as HairStyle })
                  }
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-2 text-xs text-white"
                >
                  <option value="spiky">Spiky / Lancip</option>
                  <option value="bob">Bob Cut Rapi</option>
                  <option value="twintails">Twin-Tails Lucu</option>
                  <option value="ponytail">Ponytail</option>
                  <option value="curly">Curly / Ikal</option>
                  <option value="bun">Cepol / Bun</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-400 block mb-1">
                  Tipe Pakaian
                </label>
                <select
                  value={appearance.outfitType}
                  onChange={(e) =>
                    setAppearance({ ...appearance, outfitType: e.target.value as OutfitType })
                  }
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-2 text-xs text-white"
                >
                  <option value="blazer">Office Blazer</option>
                  <option value="hoodie">Creative Hoodie</option>
                  <option value="casual">Smart Casual</option>
                  <option value="streetwear">Streetwear</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-400 block mb-1">
                  Aksesoris Kepala
                </label>
                <select
                  value={appearance.accessory}
                  onChange={(e) =>
                    setAppearance({ ...appearance, accessory: e.target.value as AccessoryType })
                  }
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-2 text-xs text-white"
                >
                  <option value="none">Tanpa Aksesoris</option>
                  <option value="glasses">Kacamata Kerja</option>
                  <option value="headset">Headset Marketing</option>
                  <option value="headphones">Studio Headphones</option>
                  <option value="cap">Topi Cap</option>
                  <option value="cat_ears">Cat Ears Lucu</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-400 block mb-1">
                  Ekspresi Wajah
                </label>
                <select
                  value={appearance.expression}
                  onChange={(e) =>
                    setAppearance({
                      ...appearance,
                      expression: e.target.value as ExpressionType,
                    })
                  }
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-2 text-xs text-white"
                >
                  <option value="happy">Happy / Ramah</option>
                  <option value="focused">Focused / Serius</option>
                  <option value="cool">Cool / Santai</option>
                  <option value="excited">Excited / Semangat</option>
                </select>
              </div>
            </div>

            {/* Color Pickers */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-900/70 p-3.5 rounded-2xl border border-slate-800">
              <div>
                <label className="text-[11px] font-bold text-slate-400 block mb-1">
                  Warna Kulit
                </label>
                <input
                  type="color"
                  value={appearance.skinColor}
                  onChange={(e) => setAppearance({ ...appearance, skinColor: e.target.value })}
                  className="w-full h-9 rounded-lg cursor-pointer bg-slate-950 border border-slate-700"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-400 block mb-1">
                  Warna Rambut
                </label>
                <input
                  type="color"
                  value={appearance.hairColor}
                  onChange={(e) => setAppearance({ ...appearance, hairColor: e.target.value })}
                  className="w-full h-9 rounded-lg cursor-pointer bg-slate-950 border border-slate-700"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-400 block mb-1">
                  Warna Outfit Utama
                </label>
                <input
                  type="color"
                  value={appearance.primaryColor}
                  onChange={(e) =>
                    setAppearance({ ...appearance, primaryColor: e.target.value })
                  }
                  className="w-full h-9 rounded-lg cursor-pointer bg-slate-950 border border-slate-700"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-400 block mb-1">
                  Warna Aksen / Kerah
                </label>
                <input
                  type="color"
                  value={appearance.secondaryColor}
                  onChange={(e) =>
                    setAppearance({ ...appearance, secondaryColor: e.target.value })
                  }
                  className="w-full h-9 rounded-lg cursor-pointer bg-slate-950 border border-slate-700"
                />
              </div>
            </div>

            {/* Custom 3D File Upload (.glb / .vrm) */}
            <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-extrabold text-white">
                    Opsional: Import Model 3D Eksternal (<code>.glb</code> / <code>.gltf</code> /{' '}
                    <code>.vrm</code>)
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Punya karakter buatan VRoid Studio, Blockbench, Blender, atau Ready Player Me?
                    Upload langsung di sini!
                  </p>
                </div>
                {appearance.customModelUrl && (
                  <button
                    type="button"
                    onClick={() => setAppearance({ ...appearance, customModelUrl: null })}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-amber-300 flex items-center gap-1"
                  >
                    <RotateCcw className="w-3 h-3" /> Reset ke Preset
                  </button>
                )}
              </div>

              <label className="mt-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-dashed border-indigo-500/50 hover:border-indigo-400 bg-indigo-950/20 text-xs font-bold text-indigo-300 cursor-pointer transition">
                <Upload className="w-4 h-4" />
                <span>
                  {isUploading
                    ? 'Mengupload model 3D...'
                    : appearance.customModelUrl
                    ? `Model Aktif: ${appearance.customModelUrl} (Klik untuk ganti)`
                    : 'Pilih File .GLB / .VRM dari Laptop'}
                </span>
                <input
                  type="file"
                  accept=".glb,.gltf,.vrm"
                  onChange={handleUploadCustomModel}
                  className="hidden"
                />
              </label>
            </div>

            {/* Footer Save / Delete */}
            <div className="flex items-center justify-between pt-2">
              {mode === 'edit' && agents.length > 1 ? (
                <button
                  type="button"
                  onClick={handleDeleteCustomAgent}
                  className="px-3.5 py-2.5 rounded-xl bg-rose-950/60 hover:bg-rose-900 text-rose-300 border border-rose-800/80 text-xs font-bold flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Hapus Agent
                </button>
              ) : (
                <div />
              )}

              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 text-white text-xs font-extrabold flex items-center gap-2 shadow-lg transition"
              >
                {mode === 'create' ? (
                  <>
                    <Plus className="w-4 h-4" /> Tambahkan Agent Baru ke Villa HQ
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" /> Simpan Perubahan 3D Character
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
