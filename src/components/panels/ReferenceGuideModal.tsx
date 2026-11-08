import React from 'react';
import { BookOpen, ExternalLink, Sparkles, X } from 'lucide-react';

interface ReferenceGuideModalProps {
  onClose: () => void;
}

export const ReferenceGuideModal: React.FC<ReferenceGuideModalProps> = ({ onClose }) => {
  const sections = [
    {
      badge: '🧱 Gaya 1: Roblox / Blocky / Voxel Cute',
      color: 'from-amber-500/20 to-orange-500/10 border-amber-500/30',
      tools: [
        {
          name: 'Blockbench (Paling Direkomendasikan — Gratis & Ringan)',
          url: 'https://www.blockbench.net/',
          workflow:
            'Buka Blockbench (bisa langsung di browser atau install Windows) → Pilih format "glTF Model" → Buat karakter blocky bergaya Roblox + lukis tekstur wajah/baju langsung di 3D → File > Export > Export glTF (.glb) → Upload langsung ke Character Studio Villa HQ!',
        },
        {
          name: 'Roblox Studio + Blender (.OBJ ke .GLB)',
          url: 'https://create.roblox.com/',
          workflow:
            'Gunakan plugin "Load Character" di Roblox Studio → Klik kanan karakter di Explorer > Export Selection (.obj) → Buka di Blender → Export sebagai glTF 2.0 (.glb) lalu import ke aplikasi ini.',
        },
      ],
    },
    {
      badge: '🌸 Gaya 2: Anime / Chibi VTuber Cute',
      color: 'from-pink-500/20 to-purple-500/10 border-pink-500/30',
      tools: [
        {
          name: 'VRoid Studio (Gratis di Windows / Steam — Sangat Mudah!)',
          url: 'https://vroid.com/en/studio',
          workflow:
            'Tidak perlu jago modeling 3D! Cukup geser slider mata anime, gambar helai rambut, dan pilih setelan jas/hoodie kantor (ribuan baju gratis ada di Booth.pm) → Klik Export VRM (.vrm) → Langsung upload file .vrm ke Character Studio Villa HQ!',
        },
        {
          name: 'Booth.pm (Marketplace Aset Baju Kantor & Chibi VRoid)',
          url: 'https://booth.pm/en/search/vroid%20suit',
          workflow:
            'Cari keyword "VRoid Office Suit", "VRoid Chibi Body", atau "VRoid Glasses" (banyak yang 0 JPY / gratis) untuk memperkaya variasi 11 spesialis Anda.',
        },
      ],
    },
    {
      badge: '👔 Gaya 3: Stylized Human Office & AI 3D Generator',
      color: 'from-indigo-500/20 to-cyan-500/10 border-indigo-500/30',
      tools: [
        {
          name: 'Ready Player Me / Avaturn (Stylized Human Avatar)',
          url: 'https://readyplayer.me/',
          workflow:
            'Kustomisasi karakter manusia bergaya modern semi-kartun lengkap dengan outfit kerja kasual/formal, lalu unduh file berekstensi .glb.',
        },
        {
          name: 'Meshy AI / Tripo3D (Text-to-3D / Image-to-3D)',
          url: 'https://www.meshy.ai/',
          workflow:
            'Ketik prompt seperti "Cute chibi 3D digital marketing specialist wearing hoodie and headset, stylized toy proportion, T-pose" → Generate & Download .glb → Langsung pakai di Villa HQ!',
        },
        {
          name: 'Adobe Mixamo (Auto-Rig & Ratusan Animasi Kantor Gratis)',
          url: 'https://www.mixamo.com/',
          workflow:
            'Jika ingin menambahkan animasi kustom (Typing, Presenting, Gaming, Dancing di Fun Room) pada karakter .fbx/.glb sebelum di-pack di Blender.',
        },
      ],
    },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-4xl max-h-[86vh] bg-slate-950 border border-slate-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-800 bg-gradient-to-r from-slate-900 to-emerald-950/40 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-lg">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-white">
                Referensi Editing 3D Character & Interior Villa
              </h2>
              <p className="text-xs text-slate-400">
                Rekomendasi software gratis & workflow terbaik untuk membuat karakter Roblox, Anime,
                maupun Human Office
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

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {sections.map((sec) => (
            <div
              key={sec.badge}
              className={`p-5 rounded-2xl bg-gradient-to-br ${sec.color} border space-y-3`}
            >
              <h3 className="text-sm font-extrabold text-white">{sec.badge}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {sec.tools.map((tool) => (
                  <div
                    key={tool.name}
                    className="p-3.5 rounded-xl bg-slate-950/85 border border-slate-800 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs font-bold text-indigo-300">{tool.name}</span>
                      <a
                        href={tool.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-slate-400 hover:text-white shrink-0"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                    <p className="text-[11px] text-slate-300 leading-relaxed">{tool.workflow}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}

          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-extrabold text-emerald-300">
              <Sparkles className="w-4 h-4" />
              Tips Optimal Saat Import ke Digital Marketing Villa HQ
            </div>
            <ul className="text-[11px] text-slate-300 space-y-1 list-disc list-inside leading-relaxed">
              <li>
                Format yang langsung didukung otomatis: <code>.glb</code>, <code>.gltf</code>, dan{' '}
                <code>.vrm</code> (otomatis disesuaikan skala tingginya agar pas dengan meja Villa).
              </li>
              <li>
                Usahakan ukuran per file di bawah <strong>10–15 MB</strong> agar ketika 11+ karakter
                aktif bersamaan di Villa tetap ringan 60 FPS di laptop.
              </li>
              <li>
                Tanpa software luar pun, Anda sudah bisa langsung mengkustomisasi 3 gaya bawaan
                (Roblox, Chibi Anime, Human Office) langsung di menu <strong>3D Character</strong>!
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
