import React, { useState } from 'react';
import { Music, Pause, Play, Trees, Upload, Volume2, Wind } from 'lucide-react';
import {
  MUSIC_STATIONS,
  MusicStationId,
  NATURE_SOUNDS,
  NatureSoundId,
  villaMusic,
} from '../../utils/musicEngine';

export const MusicPlayerBar: React.FC = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isNaturePlaying, setIsNaturePlaying] = useState(false);
  const [station, setStation] = useState<MusicStationId>('lofi');
  const [natureSound, setNatureSound] = useState<NatureSoundId>('ocean');
  const [volume, setVolume] = useState(0.45);
  const [natureVolume, setNatureVolume] = useState(0.55);
  const [expanded, setExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<'music' | 'nature'>('nature');
  const [customTrackName, setCustomTrackName] = useState<string | null>(null);

  const handleTogglePlay = () => {
    const next = villaMusic.toggle();
    setIsPlaying(next);
    setIsNaturePlaying(villaMusic.getIsNaturePlaying());
  };

  const handleToggleNatureOnly = () => {
    const next = villaMusic.toggleNatureOnly();
    setIsNaturePlaying(next);
    setNatureSound(villaMusic.getNatureSound());
  };

  const handleChangeStation = (id: MusicStationId) => {
    setStation(id);
    villaMusic.setStation(id);
    if (!isPlaying) {
      villaMusic.play(id);
      setIsPlaying(true);
      setIsNaturePlaying(villaMusic.getIsNaturePlaying());
    }
  };

  const handleChangeNatureSound = (id: NatureSoundId) => {
    setNatureSound(id);
    villaMusic.setNatureSound(id);
    setIsNaturePlaying(id !== 'off' && villaMusic.getIsNaturePlaying());
  };

  const handleCustomFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const name = villaMusic.loadCustomFile(file);
    setCustomTrackName(name);
    setStation('custom');
    setIsPlaying(true);
    setIsNaturePlaying(villaMusic.getIsNaturePlaying());
  };

  const currentMeta =
    station === 'custom'
      ? { emoji: '🎵', name: customTrackName || 'Custom MP3', subtitle: 'Local Track' }
      : MUSIC_STATIONS.find((s) => s.id === station) || MUSIC_STATIONS[0];

  const currentNatureMeta =
    NATURE_SOUNDS.find((n) => n.id === natureSound) || NATURE_SOUNDS[0];

  return (
    <div className="fixed bottom-20 left-3 z-30 flex flex-col items-start gap-2 select-none">
      {expanded && (
        <div className="w-80 p-3.5 rounded-2xl bg-slate-950/95 backdrop-blur-md border border-slate-800 shadow-2xl space-y-3 text-xs">
          {/* Header */}
          <div className="flex items-center justify-between">
            <span className="font-extrabold text-white flex items-center gap-1.5">
              <Music className="w-3.5 h-3.5 text-indigo-400" />
              Villa Sound & Suara Alam
            </span>
            <button
              onClick={() => setExpanded(false)}
              className="text-slate-400 hover:text-white text-[11px] px-1.5 py-0.5 rounded hover:bg-slate-800"
            >
              Tutup
            </button>
          </div>

          {/* Mode Tabs: Musik vs Suara Alam */}
          <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-slate-900 border border-slate-800">
            <button
              onClick={() => setActiveTab('music')}
              className={`py-1.5 px-2 rounded-lg font-bold text-[11px] flex items-center justify-center gap-1.5 transition ${
                activeTab === 'music'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Music className="w-3 h-3" />
              <span>Pilihan Lagu ({MUSIC_STATIONS.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('nature')}
              className={`py-1.5 px-2 rounded-lg font-bold text-[11px] flex items-center justify-center gap-1.5 transition ${
                activeTab === 'nature'
                  ? 'bg-emerald-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Trees className="w-3 h-3" />
              <span>Suara Alam (6)</span>
            </button>
          </div>

          {/* Tab 1: Station List */}
          {activeTab === 'music' && (
            <div className="space-y-1.5 max-h-60 overflow-y-auto pr-0.5">
              {MUSIC_STATIONS.map((st) => (
                <button
                  key={st.id}
                  onClick={() => handleChangeStation(st.id)}
                  className={`w-full px-2.5 py-2 rounded-xl border text-left flex items-center justify-between transition ${
                    station === st.id
                      ? 'bg-indigo-600/25 border-indigo-400 text-white'
                      : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div>
                    <div className="font-bold text-[11px]">
                      {st.emoji} {st.name}
                    </div>
                    <div className="text-[10px] text-slate-400">{st.subtitle}</div>
                  </div>
                  {station === st.id && isPlaying && (
                    <span className="text-[10px] text-emerald-400 font-bold animate-pulse">
                      ● ON
                    </span>
                  )}
                </button>
              ))}

              {/* Custom Local MP3 Picker */}
              <label className="w-full px-2.5 py-2 rounded-xl border border-dashed border-slate-700 hover:border-pink-400 bg-slate-900/70 text-slate-300 hover:text-pink-300 flex items-center justify-center gap-1.5 cursor-pointer font-semibold text-[11px] transition">
                <Upload className="w-3.5 h-3.5" />
                <span>
                  {customTrackName
                    ? `Ganti MP3 (${customTrackName.slice(0, 18)})`
                    : 'Putar File MP3 Laptop Sendiri'}
                </span>
                <input
                  type="file"
                  accept="audio/*"
                  onChange={handleCustomFile}
                  className="hidden"
                />
              </label>
            </div>
          )}

          {/* Tab 2: Nature Soundscapes List */}
          {activeTab === 'nature' && (
            <div className="space-y-1.5 max-h-60 overflow-y-auto pr-0.5">
              {NATURE_SOUNDS.map((ns) => {
                const active =
                  ns.id === 'off'
                    ? !isNaturePlaying || natureSound === 'off'
                    : natureSound === ns.id && isNaturePlaying;
                return (
                  <button
                    key={ns.id}
                    onClick={() => handleChangeNatureSound(ns.id)}
                    className={`w-full px-2.5 py-2 rounded-xl border text-left flex items-center justify-between transition ${
                      active
                        ? ns.id === 'off'
                          ? 'bg-rose-950/40 border-rose-500/60 text-rose-200'
                          : 'bg-emerald-600/25 border-emerald-400 text-white'
                        : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div>
                      <div className="font-bold text-[11px]">
                        {ns.emoji} {ns.name}
                      </div>
                      <div className="text-[10px] text-slate-400">{ns.subtitle}</div>
                    </div>
                    {active && ns.id !== 'off' && (
                      <span className="text-[10px] text-emerald-400 font-bold animate-pulse">
                        ● BUNYI
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Volume Sliders */}
          <div className="space-y-2 pt-2 border-t border-slate-800">
            <div className="flex items-center gap-2">
              <Volume2 className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
              <span className="text-[10px] text-slate-300 w-20 font-medium">
                Musik ({Math.round(volume * 100)}%)
              </span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.02}
                value={volume}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setVolume(v);
                  villaMusic.setVolume(v);
                }}
                className="flex-1 accent-indigo-500 h-1.5 cursor-pointer"
              />
            </div>

            <div className="flex items-center gap-2">
              <Wind className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span className="text-[10px] text-slate-300 w-20 font-medium">
                Alam ({Math.round(natureVolume * 100)}%)
              </span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.02}
                value={natureVolume}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setNatureVolume(v);
                  villaMusic.setNatureVolume(v);
                  setIsNaturePlaying(villaMusic.getIsNaturePlaying());
                  setNatureSound(villaMusic.getNatureSound());
                }}
                className="flex-1 accent-emerald-500 h-1.5 cursor-pointer"
              />
            </div>
          </div>
        </div>
      )}

      {/* Compact Pill Button */}
      <div className="flex items-center gap-1.5 bg-slate-950/92 border border-slate-800 rounded-full pl-2 pr-3 py-1.5 shadow-xl">
        {/* Play/Pause Music */}
        <button
          onClick={handleTogglePlay}
          title={isPlaying ? 'Pause Musik & Alam Villa' : 'Putar Musik & Alam Villa'}
          className={`w-7 h-7 rounded-full flex items-center justify-center text-white transition ${
            isPlaying ? 'bg-indigo-600 hover:bg-indigo-500' : 'bg-slate-800 hover:bg-indigo-600'
          }`}
        >
          {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-0.5" />}
        </button>

        {/* Quick Toggle Nature Soundscape Alone */}
        <button
          onClick={handleToggleNatureOnly}
          title={
            isNaturePlaying
              ? `Matikan Suara Alam (${currentNatureMeta.name})`
              : `Nyalakan Suara Alam (${currentNatureMeta.name})`
          }
          className={`w-7 h-7 rounded-full flex items-center justify-center text-xs transition border ${
            isNaturePlaying
              ? 'bg-emerald-600/30 border-emerald-400 text-emerald-200 shadow-sm shadow-emerald-500/30'
              : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-emerald-500/50'
          }`}
        >
          <span>{currentNatureMeta.emoji === '🔇' ? '🌊' : currentNatureMeta.emoji}</span>
        </button>

        {/* Open Picker Panel */}
        <button
          onClick={() => setExpanded((v) => !v)}
          className="text-left pl-1 flex items-center gap-1.5 hover:opacity-90"
        >
          <div className="leading-tight">
            <div className="text-[11px] font-bold text-white flex items-center gap-1">
              <span>
                {isPlaying ? `${currentMeta.emoji} ${currentMeta.name}` : '🎵 Radio & Alam'}
              </span>
              {isNaturePlaying && (
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-950/90 border border-emerald-500/40 text-emerald-300 font-semibold">
                  {currentNatureMeta.emoji} {currentNatureMeta.name.split(' ')[0]}
                </span>
              )}
              {(isPlaying || isNaturePlaying) && (
                <span className="inline-flex gap-0.5 items-end h-2.5 ml-0.5">
                  <span className="w-0.5 h-2 bg-emerald-400 animate-pulse" />
                  <span className="w-0.5 h-2.5 bg-emerald-400 animate-bounce" />
                  <span className="w-0.5 h-1.5 bg-emerald-400 animate-pulse" />
                </span>
              )}
            </div>
            <div className="text-[9px] text-slate-400">
              Klik pilih 6 Lagu / 6 Suara Alam (Ombak, Hujan, Hutan, Sungai, Api)
            </div>
          </div>
        </button>
      </div>
    </div>
  );
};
