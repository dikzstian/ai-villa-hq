export type MusicStationId = 'lofi' | 'bossa' | 'acoustic' | 'piano' | 'arcade' | 'zen' | 'custom';

export type NatureSoundId =
  | 'ocean'
  | 'rain'
  | 'forest'
  | 'river'
  | 'night'
  | 'wind_chimes'
  | 'off';

export interface MusicStation {
  id: MusicStationId;
  name: string;
  subtitle: string;
  emoji: string;
  bpm: number;
}

export interface NatureSoundOption {
  id: NatureSoundId;
  name: string;
  subtitle: string;
  emoji: string;
}

export const MUSIC_STATIONS: MusicStation[] = [
  {
    id: 'lofi',
    name: 'Villa Lo-Fi Focus',
    subtitle: 'Warm Rhodes & Chill Beats',
    emoji: '☕',
    bpm: 78,
  },
  {
    id: 'bossa',
    name: 'Tropical Sunset Lounge',
    subtitle: 'Breezy Villa Jazz Chords',
    emoji: '🌴',
    bpm: 96,
  },
  {
    id: 'acoustic',
    name: 'Terrace Acoustic Breeze',
    subtitle: 'Warm Plucked Guitar Harmonies',
    emoji: '🎸',
    bpm: 84,
  },
  {
    id: 'piano',
    name: 'Midnight Focus Piano',
    subtitle: 'Soft Felt Piano & Warm Pad',
    emoji: '🎹',
    bpm: 68,
  },
  {
    id: 'arcade',
    name: 'Game Hub Synthwave',
    subtitle: 'Upbeat Creative Groove',
    emoji: '🕹️',
    bpm: 112,
  },
  {
    id: 'zen',
    name: 'Mountain & Ocean Zen',
    subtitle: 'Ambient Pad & Deep Calm',
    emoji: '🧘',
    bpm: 60,
  },
];

export const NATURE_SOUNDS: NatureSoundOption[] = [
  {
    id: 'ocean',
    name: 'Ombak Pantai & Angin Laut',
    subtitle: 'Deburan ombak pantai & buih air',
    emoji: '🌊',
  },
  {
    id: 'rain',
    name: 'Hujan Tropis & Petir Jauh',
    subtitle: 'Rintik hujan deras & gemuruh lembut',
    emoji: '🌧️',
  },
  {
    id: 'forest',
    name: 'Hutan Pinus & Kicau Burung',
    subtitle: 'Semilir pohon & kicauan burung pagi',
    emoji: '🌲',
  },
  {
    id: 'river',
    name: 'Aliran Sungai Pegunungan',
    subtitle: 'Gemericik air sungai jernih mengalir',
    emoji: '🏞️',
  },
  {
    id: 'night',
    name: 'Malam Villa & Api Unggun',
    subtitle: 'Suara jangkrik malam & kayu bakar',
    emoji: '🔥',
  },
  {
    id: 'wind_chimes',
    name: 'Angin Lembah & Lonceng Bambu',
    subtitle: 'Hembusan angin gunung & nada zen',
    emoji: '🎐',
  },
  {
    id: 'off',
    name: 'Matikan Suara Alam',
    subtitle: 'Hanya putar musik tanpa suara alam',
    emoji: '🔇',
  },
];

// Rich chord progressions (frequencies in Hz)
const PROGRESSIONS: Record<Exclude<MusicStationId, 'custom'>, number[][]> = {
  // Fmaj7 -> Em7 -> Dm9 -> Cmaj9
  lofi: [
    [174.61, 220.0, 261.63, 329.63, 392.0],
    [164.81, 196.0, 246.94, 293.66, 392.0],
    [146.83, 220.0, 261.63, 329.63, 349.23],
    [130.81, 196.0, 246.94, 293.66, 329.63],
  ],
  // Gmaj7 -> A7sus4 -> F#m7 -> Bm7
  bossa: [
    [196.0, 246.94, 293.66, 369.99, 440.0],
    [220.0, 293.66, 329.63, 392.0, 493.88],
    [185.0, 220.0, 277.18, 329.63, 440.0],
    [123.47, 220.0, 246.94, 293.66, 369.99],
  ],
  // Dmaj9 -> Asus4 -> Bm7 -> Gmaj7
  acoustic: [
    [146.83, 220.0, 277.18, 329.63, 440.0],
    [110.0, 220.0, 293.66, 329.63, 440.0],
    [123.47, 185.0, 246.94, 293.66, 369.99],
    [196.0, 246.94, 293.66, 369.99, 392.0],
  ],
  // Ebmaj7 -> Cm9 -> Fm9 -> Bb13
  piano: [
    [155.56, 233.08, 293.66, 349.23, 392.0],
    [130.81, 196.0, 233.08, 293.66, 349.23],
    [174.61, 207.65, 261.63, 311.13, 392.0],
    [116.54, 207.65, 261.63, 293.66, 392.0],
  ],
  // Am7 -> Fmaj7 -> Cmaj7 -> G6
  arcade: [
    [110.0, 220.0, 261.63, 329.63, 392.0],
    [87.31, 174.61, 261.63, 329.63, 440.0],
    [130.81, 196.0, 261.63, 329.63, 493.88],
    [98.0, 196.0, 246.94, 329.63, 440.0],
  ],
  // Ethereal Cmaj9 -> Fmaj9
  zen: [
    [130.81, 196.0, 246.94, 293.66, 392.0],
    [174.61, 220.0, 261.63, 329.63, 440.0],
    [146.83, 220.0, 261.63, 349.23, 440.0],
    [196.0, 246.94, 293.66, 392.0, 493.88],
  ],
};

function normalizeBufferChannel(data: Float32Array, targetPeak = 0.78): void {
  let maxAbs = 0;
  for (let i = 0; i < data.length; i++) {
    const abs = Math.abs(data[i]);
    if (abs > maxAbs) maxAbs = abs;
  }
  if (maxAbs > 0.00001) {
    const scale = targetPeak / maxAbs;
    for (let i = 0; i < data.length; i++) {
      data[i] *= scale;
    }
  }
}

class VillaMusicEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private natureGain: GainNode | null = null;
  private natureSource: AudioBufferSourceNode | null = null;
  private natureAccentTimer: number | null = null;
  private stepTimer: number | null = null;
  private customAudio: HTMLAudioElement | null = null;

  private isPlaying = false;
  private isNaturePlaying = false;
  private station: MusicStationId = 'lofi';
  private natureSound: NatureSoundId = 'ocean';
  private volume = 0.42;
  private natureVolume = 0.55;
  private stepIndex = 0;

  private ensureContext(): AudioContext {
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.volume;
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  /**
   * Builds a rich, normalized 8-second stereo loop buffer for the selected Nature Soundscape,
   * plus scheduled organic accents (bird chirps, distant thunder, water droplets, crickets, or wind chimes).
   */
  private startNatureLayer(): void {
    const ctx = this.ensureContext();
    this.stopNatureLayer();

    if (!this.isNaturePlaying || this.natureSound === 'off' || this.natureVolume <= 0.01) {
      return;
    }

    const durationSec = 8;
    const bufferSize = ctx.sampleRate * durationSec;
    const buffer = ctx.createBuffer(2, bufferSize, ctx.sampleRate);
    const sr = ctx.sampleRate;

    for (let ch = 0; ch < 2; ch++) {
      const data = buffer.getChannelData(ch);
      let b0 = 0,
        b1 = 0,
        b2 = 0,
        b3 = 0;
      const phaseOffset = ch * 0.65;

      for (let i = 0; i < bufferSize; i++) {
        const t = i / sr;
        const white = Math.random() * 2 - 1;
        // Paul Kellet pink/brown noise filter stages
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        const pink = b0 + b1 + b2 + b3 + white * 0.18;
        const brown = b0 * 2.4 + b1 * 1.2;

        switch (this.natureSound) {
          case 'ocean': {
            // Rolling 8s primary wave + 4s secondary wave + surf foam
            const mainWave = Math.pow(
              0.5 + 0.5 * Math.sin(((t / durationSec) * Math.PI * 2) + phaseOffset),
              1.8
            );
            const crestFoam = Math.pow(
              Math.max(0, Math.sin(((t / durationSec) * Math.PI * 2) + phaseOffset - 0.35)),
              3.2
            );
            data[i] = brown * (0.35 + 0.65 * mainWave) + pink * 0.45 * crestFoam;
            break;
          }
          case 'rain': {
            // Steady tropical rain sheet + dense micro-droplet patter
            const gust = 0.78 + 0.22 * Math.sin((t / durationSec) * Math.PI * 4 + phaseOffset);
            const droplet = Math.random() > 0.9965 ? (Math.random() * 2 - 1) * 3.2 : 0;
            data[i] = (pink * 0.75 + white * 0.25) * gust + droplet;
            break;
          }
          case 'forest': {
            // Gentle rustling leaves in mountain breeze
            const breeze =
              0.45 +
              0.35 * Math.sin((t / durationSec) * Math.PI * 2 + phaseOffset) +
              0.2 * Math.sin((t / durationSec) * Math.PI * 6);
            data[i] = (brown * 0.55 + pink * 0.45) * breeze;
            break;
          }
          case 'river': {
            // Babbling brook with rapid ripple modulation
            const ripple =
              0.65 +
              0.2 * Math.sin(t * 14 + phaseOffset) +
              0.15 * Math.sin(t * 23 - phaseOffset);
            data[i] = (pink * 0.65 + brown * 0.45) * ripple;
            break;
          }
          case 'night': {
            // Warm night air + subtle campfire crackle pops
            const nightAir = 0.5 + 0.25 * Math.sin((t / durationSec) * Math.PI * 2 + phaseOffset);
            const crackle = Math.random() > 0.9982 ? (Math.random() * 2 - 1) * 4.5 : 0;
            data[i] = brown * 0.4 * nightAir + crackle;
            break;
          }
          case 'wind_chimes': {
            // Soft valley wind
            const valleyWind =
              0.4 + 0.6 * Math.pow(0.5 + 0.5 * Math.sin((t / durationSec) * Math.PI * 2 + phaseOffset), 1.5);
            data[i] = brown * 0.75 * valleyWind + pink * 0.25 * valleyWind;
            break;
          }
          default:
            data[i] = 0;
        }
      }

      // Normalize buffer so it is ALWAYS clearly audible!
      normalizeBufferChannel(data, 0.72);
    }

    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;

    const filter = ctx.createBiquadFilter();
    if (this.natureSound === 'ocean') {
      filter.type = 'lowpass';
      filter.frequency.value = 1150;
    } else if (this.natureSound === 'rain') {
      filter.type = 'bandpass';
      filter.frequency.value = 1850;
      filter.Q.value = 0.55;
    } else if (this.natureSound === 'river') {
      filter.type = 'bandpass';
      filter.frequency.value = 1350;
      filter.Q.value = 0.7;
    } else if (this.natureSound === 'forest') {
      filter.type = 'lowpass';
      filter.frequency.value = 1400;
    } else {
      filter.type = 'lowpass';
      filter.frequency.value = 1100;
    }

    const gain = ctx.createGain();
    gain.gain.value = this.natureVolume * 0.95;

    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start();

    this.natureSource = src;
    this.natureGain = gain;

    // Schedule organic live nature accents (birds, thunder, river plinks, crickets, chimes)
    this.startNatureAccents();
  }

  private startNatureAccents(): void {
    if (this.natureAccentTimer !== null) {
      window.clearInterval(this.natureAccentTimer);
      this.natureAccentTimer = null;
    }
    if (!this.isNaturePlaying || this.natureSound === 'off') return;

    const triggerAccent = () => {
      if (!this.isNaturePlaying || !this.ctx || !this.natureGain || this.natureVolume <= 0.01) {
        return;
      }
      const now = this.ctx.currentTime;

      switch (this.natureSound) {
        case 'forest': {
          // Chirping songbird (2 to 4 quick melodic notes)
          const notes = 2 + Math.floor(Math.random() * 3);
          const baseFreq = 2100 + Math.random() * 1100;
          for (let n = 0; n < notes; n++) {
            const start = now + n * 0.13;
            const osc = this.ctx.createOscillator();
            const g = this.ctx.createGain();
            osc.type = 'sine';
            const f1 = baseFreq * (1 + (n % 2) * 0.18);
            const f2 = f1 * (1.12 + Math.random() * 0.15);
            osc.frequency.setValueAtTime(f1, start);
            osc.frequency.exponentialRampToValueAtTime(f2, start + 0.07);
            osc.frequency.exponentialRampToValueAtTime(f1 * 0.95, start + 0.11);

            g.gain.setValueAtTime(0.0001, start);
            g.gain.linearRampToValueAtTime(0.14, start + 0.02);
            g.gain.exponentialRampToValueAtTime(0.0005, start + 0.115);

            osc.connect(g);
            g.connect(this.natureGain);
            osc.start(start);
            osc.stop(start + 0.12);
          }
          break;
        }
        case 'rain': {
          // Distant warm thunder rumble (35% chance) + water drop plink
          if (Math.random() < 0.45) {
            const osc = this.ctx.createOscillator();
            const g = this.ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(92, now);
            osc.frequency.exponentialRampToValueAtTime(36, now + 1.8);
            g.gain.setValueAtTime(0.001, now);
            g.gain.linearRampToValueAtTime(0.28, now + 0.25);
            g.gain.exponentialRampToValueAtTime(0.001, now + 1.9);
            osc.connect(g);
            g.connect(this.natureGain);
            osc.start(now);
            osc.stop(now + 1.95);
          }
          break;
        }
        case 'river': {
          // Water bubble / droplet plink
          for (let d = 0; d < 2; d++) {
            const start = now + d * 0.22 + Math.random() * 0.15;
            const osc = this.ctx.createOscillator();
            const g = this.ctx.createGain();
            osc.type = 'sine';
            const fStart = 650 + Math.random() * 550;
            osc.frequency.setValueAtTime(fStart, start);
            osc.frequency.exponentialRampToValueAtTime(fStart * 1.65, start + 0.065);
            g.gain.setValueAtTime(0.001, start);
            g.gain.linearRampToValueAtTime(0.12, start + 0.015);
            g.gain.exponentialRampToValueAtTime(0.0008, start + 0.075);
            osc.connect(g);
            g.connect(this.natureGain);
            osc.start(start);
            osc.stop(start + 0.08);
          }
          break;
        }
        case 'night': {
          // Rhythmic night cricket chirp pulses (3.8 - 4.3 kHz)
          const pulses = 4 + Math.floor(Math.random() * 3);
          const cricketFreq = 3900 + Math.random() * 350;
          for (let p = 0; p < pulses; p++) {
            const start = now + p * 0.055;
            const osc = this.ctx.createOscillator();
            const g = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(cricketFreq, start);
            g.gain.setValueAtTime(0.0005, start);
            g.gain.linearRampToValueAtTime(0.09, start + 0.012);
            g.gain.exponentialRampToValueAtTime(0.0005, start + 0.042);
            osc.connect(g);
            g.connect(this.natureGain);
            osc.start(start);
            osc.stop(start + 0.045);
          }
          break;
        }
        case 'wind_chimes': {
          // Pentatonic bamboo/bell wind chime resonance
          const chimeScale = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5];
          const count = 1 + Math.floor(Math.random() * 3);
          for (let c = 0; c < count; c++) {
            const start = now + c * (0.18 + Math.random() * 0.15);
            const freq = chimeScale[Math.floor(Math.random() * chimeScale.length)];
            const osc = this.ctx.createOscillator();
            const g = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, start);
            g.gain.setValueAtTime(0.0005, start);
            g.gain.linearRampToValueAtTime(0.16, start + 0.02);
            g.gain.exponentialRampToValueAtTime(0.0008, start + 1.4);
            osc.connect(g);
            g.connect(this.natureGain);
            osc.start(start);
            osc.stop(start + 1.45);
          }
          break;
        }
        case 'ocean': {
          // Occasional gentle coastal gull / breeze harmonic
          if (Math.random() < 0.4) {
            const osc = this.ctx.createOscillator();
            const g = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(1450, now);
            osc.frequency.linearRampToValueAtTime(1680, now + 0.12);
            osc.frequency.exponentialRampToValueAtTime(1180, now + 0.42);
            g.gain.setValueAtTime(0.0005, now);
            g.gain.linearRampToValueAtTime(0.06, now + 0.08);
            g.gain.exponentialRampToValueAtTime(0.0005, now + 0.45);
            osc.connect(g);
            g.connect(this.natureGain);
            osc.start(now);
            osc.stop(now + 0.46);
          }
          break;
        }
      }
    };

    triggerAccent();
    this.natureAccentTimer = window.setInterval(triggerAccent, 1800);
  }

  private stopNatureLayer(): void {
    if (this.natureAccentTimer !== null) {
      window.clearInterval(this.natureAccentTimer);
      this.natureAccentTimer = null;
    }
    if (this.natureSource) {
      try {
        this.natureSource.stop();
        this.natureSource.disconnect();
      } catch {
        // ignore
      }
      this.natureSource = null;
    }
    if (this.natureGain) {
      try {
        this.natureGain.disconnect();
      } catch {
        // ignore
      }
      this.natureGain = null;
    }
  }

  private playWarmChord(freqs: number[], durationSec: number, wave: OscillatorType): void {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(this.station === 'arcade' ? 1600 : 1050, now);
    filter.connect(this.masterGain);

    freqs.forEach((f, idx) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const noteGain = this.ctx.createGain();
      osc.type = idx === 0 ? 'sine' : wave;
      const stagger = this.station === 'acoustic' ? idx * 0.045 : idx * 0.025;
      osc.frequency.setValueAtTime(f, now + stagger);

      const peak = idx === 0 ? 0.14 : 0.065;
      noteGain.gain.setValueAtTime(0.0001, now + stagger);
      noteGain.gain.linearRampToValueAtTime(peak, now + stagger + 0.07);
      noteGain.gain.exponentialRampToValueAtTime(0.0008, now + durationSec);

      osc.connect(noteGain);
      noteGain.connect(filter);
      osc.start(now + stagger);
      osc.stop(now + durationSec + 0.05);
    });
  }

  private playMelodyNote(freq: number, durationSec: number): void {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = this.station === 'arcade' || this.station === 'acoustic' ? 'triangle' : 'sine';
    osc.frequency.setValueAtTime(freq * 2, now);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.06, now + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0005, now + durationSec);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + durationSec + 0.03);
  }

  private playSoftPercussion(kind: 'kick' | 'hat'): void {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    if (kind === 'kick') {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(115, now);
      osc.frequency.exponentialRampToValueAtTime(38, now + 0.14);

      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.17);
    } else {
      const len = Math.floor(this.ctx.sampleRate * 0.045);
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const ch = buf.getChannelData(0);
      for (let i = 0; i < len; i++) {
        ch[i] = (Math.random() * 2 - 1) * (1 - i / len);
      }
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const hp = this.ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 5200;
      const gain = this.ctx.createGain();
      gain.gain.value = 0.04;

      src.connect(hp);
      hp.connect(gain);
      gain.connect(this.masterGain);
      src.start(now);
    }
  }

  private scheduleLoop(): void {
    if (this.stepTimer !== null) {
      window.clearInterval(this.stepTimer);
      this.stepTimer = null;
    }
    if (!this.isPlaying || this.station === 'custom') return;

    const meta = MUSIC_STATIONS.find((s) => s.id === this.station) || MUSIC_STATIONS[0];
    const eighthMs = (60 / meta.bpm / 2) * 1000;
    const prog = PROGRESSIONS[this.station];

    const tick = () => {
      if (!this.isPlaying || this.station === 'custom') return;
      const barStep = this.stepIndex % 8;
      const chordIdx = Math.floor(this.stepIndex / 8) % prog.length;
      const chord = prog[chordIdx];

      if (barStep === 0) {
        this.playWarmChord(
          chord,
          (eighthMs * 7.6) / 1000,
          this.station === 'arcade' ? 'sawtooth' : 'triangle'
        );
      } else if ((this.station === 'bossa' || this.station === 'acoustic') && barStep === 3) {
        this.playWarmChord(chord.slice(1), (eighthMs * 2.5) / 1000, 'sine');
      }

      if (barStep === 2 || barStep === 5 || (barStep === 6 && Math.random() > 0.45)) {
        const pick = chord[1 + Math.floor(Math.random() * (chord.length - 1))];
        this.playMelodyNote(pick, (eighthMs * 2.1) / 1000);
      }

      if (this.station !== 'zen' && this.station !== 'piano') {
        if (barStep === 0 || (this.station === 'arcade' && barStep === 4) || barStep === 5) {
          this.playSoftPercussion('kick');
        }
        if (barStep % 2 === 1 || this.station === 'bossa') {
          this.playSoftPercussion('hat');
        }
      }

      this.stepIndex += 1;
    };

    tick();
    this.stepTimer = window.setInterval(tick, eighthMs);
  }

  public play(stationId?: MusicStationId): void {
    if (stationId) this.station = stationId;
    this.isPlaying = true;
    this.ensureContext();

    if (this.natureSound !== 'off' && this.natureVolume > 0.01) {
      this.isNaturePlaying = true;
      this.startNatureLayer();
    }

    if (this.station === 'custom' && this.customAudio) {
      this.customAudio.volume = this.volume;
      void this.customAudio.play();
    } else {
      if (this.customAudio) this.customAudio.pause();
      this.scheduleLoop();
    }
  }

  public pause(): void {
    this.isPlaying = false;
    this.isNaturePlaying = false;
    if (this.stepTimer !== null) {
      window.clearInterval(this.stepTimer);
      this.stepTimer = null;
    }
    if (this.customAudio) {
      this.customAudio.pause();
    }
    this.stopNatureLayer();
  }

  public toggle(): boolean {
    if (this.isPlaying || this.isNaturePlaying) {
      this.pause();
    } else {
      this.play();
    }
    return this.isPlaying;
  }

  public setStation(stationId: MusicStationId): void {
    this.station = stationId;
    this.stepIndex = 0;
    if (this.isPlaying) {
      this.play(stationId);
    }
  }

  /**
   * Selects a Nature Soundscape and IMMEDIATELY plays it (even if music is paused or user only wants nature sound!).
   */
  public setNatureSound(soundId: NatureSoundId): void {
    this.natureSound = soundId;
    if (soundId === 'off') {
      this.isNaturePlaying = false;
      this.stopNatureLayer();
      return;
    }
    this.ensureContext();
    this.isNaturePlaying = true;
    if (this.natureVolume < 0.15) {
      this.natureVolume = 0.55;
    }
    this.startNatureLayer();
  }

  public toggleNatureOnly(): boolean {
    if (this.isNaturePlaying) {
      this.isNaturePlaying = false;
      this.stopNatureLayer();
    } else {
      if (this.natureSound === 'off') {
        this.natureSound = 'ocean';
      }
      this.ensureContext();
      this.isNaturePlaying = true;
      this.startNatureLayer();
    }
    return this.isNaturePlaying;
  }

  public loadCustomFile(file: File): string {
    if (this.customAudio) {
      this.customAudio.pause();
    }
    const url = URL.createObjectURL(file);
    this.customAudio = new Audio(url);
    this.customAudio.loop = true;
    this.customAudio.volume = this.volume;
    this.station = 'custom';
    this.play('custom');
    return file.name;
  }

  public setVolume(vol: number): void {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
    }
    if (this.customAudio) {
      this.customAudio.volume = this.volume;
    }
  }

  public setNatureVolume(vol: number): void {
    this.natureVolume = Math.max(0, Math.min(1, vol));
    this.ensureContext();
    if (this.natureVolume <= 0.01) {
      this.stopNatureLayer();
      return;
    }
    if (this.natureSound === 'off') {
      this.natureSound = 'ocean';
    }
    this.isNaturePlaying = true;
    if (this.natureGain && this.ctx) {
      this.natureGain.gain.setValueAtTime(this.natureVolume * 0.95, this.ctx.currentTime);
    } else {
      this.startNatureLayer();
    }
  }

  public getIsNaturePlaying(): boolean {
    return this.isNaturePlaying;
  }

  public getNatureSound(): NatureSoundId {
    return this.natureSound;
  }

  public getState() {
    return {
      isPlaying: this.isPlaying,
      isNaturePlaying: this.isNaturePlaying,
      station: this.station,
      natureSound: this.natureSound,
      volume: this.volume,
      natureVolume: this.natureVolume,
    };
  }
}

export const villaMusic = new VillaMusicEngine();
