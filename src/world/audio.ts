/**
 * Atlas of One — Procedural Web Audio Engine
 *
 * Provides retro 16-bit SNES atmosphere using native Web Audio API (AudioContext):
 * - Region-specific pentatonic ambient themes
 * - Surface-sensitive footsteps (trail, stone, grass, water)
 * - Discovery & level-up stingers
 * - Full mute / volume controls and quiet (SERIOUS) mode compliance
 *
 * Zero external audio assets, zero network requests, zero licensing issues.
 */

let audioCtx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let isMuted = false;
let masterVolume = 0.35;
let nextNoteTime = 0;
let lastStepTime = 0;

/** Territory theme pentatonic chord roots in Hz */
export const TERRITORY_THEMES: Record<string, number[]> = {
  identity: [196.0, 246.94, 293.66, 392.0], // G major pentatonic
  values: [220.0, 277.18, 329.63, 440.0], // A major
  politics: [146.83, 174.61, 220.0, 293.66], // D minor noble
  relationships: [261.63, 329.63, 392.0, 523.25], // C major warm
  cognition: [246.94, 311.13, 369.99, 493.88], // B mysterious
  interests: [174.61, 220.0, 261.63, 349.23], // F major vibrant
  fears: [130.81, 155.56, 196.0, 261.63], // C minor solemn
  future: [293.66, 369.99, 440.0, 587.33] // D major beacon
};

function getGain(value: number): GainNode | null {
  if (!audioCtx || !masterGain) return null;
  const g = audioCtx.createGain();
  g.gain.value = value;
  g.connect(masterGain);
  return g;
}

function playTone(
  freq: number,
  when: number,
  duration = 0.5,
  type: OscillatorType = 'sine',
  volume = 0.03
) {
  if (!audioCtx || isMuted || audioCtx.state !== 'running') return;
  try {
    const osc = audioCtx.createOscillator();
    const g = getGain(0);
    if (!g) return;

    osc.type = type;
    osc.frequency.value = freq;

    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(volume, when + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, when + duration);

    osc.connect(g);
    osc.start(when);
    osc.stop(when + duration + 0.03);
  } catch {
    // Gracefully handle browser audio limitations
  }
}

/** Initializes the Web Audio context on user interaction */
export function initAudio(): void {
  if (typeof window === 'undefined') return;
  if (audioCtx) return;

  const AudioCtxClass =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtxClass) return;

  try {
    audioCtx = new AudioCtxClass();
    masterGain = audioCtx.createGain();
    masterGain.gain.value = isMuted ? 0 : masterVolume;
    masterGain.connect(audioCtx.destination);

    if (audioCtx.state === 'suspended') {
      const unlock = () => {
        if (audioCtx && audioCtx.state === 'suspended') {
          void audioCtx.resume();
        }
        window.removeEventListener('pointerdown', unlock);
        window.removeEventListener('keydown', unlock);
      };
      window.addEventListener('pointerdown', unlock);
      window.addEventListener('keydown', unlock);
    }
  } catch {
    // AudioContext not supported or restricted
  }
}

export function setAudioMuted(muted: boolean): void {
  isMuted = muted;
  if (masterGain && audioCtx) {
    masterGain.gain.setTargetAtTime(isMuted ? 0 : masterVolume, audioCtx.currentTime, 0.03);
  }
}

export function getAudioMuted(): boolean {
  return isMuted;
}

export function setMasterVolume(volume: number): void {
  masterVolume = Math.max(0, Math.min(1, volume));
  if (masterGain && !isMuted && audioCtx) {
    masterGain.gain.setTargetAtTime(masterVolume, audioCtx.currentTime, 0.03);
  }
}

/** Plays a light, pleasant footstep sound based on surface */
export function playFootstep(surface: 'trail' | 'grass' | 'stone' | 'water' = 'trail'): void {
  if (!audioCtx || isMuted || audioCtx.state !== 'running') return;
  const now = audioCtx.currentTime;
  if (now - lastStepTime < 0.22) return; // Throttle steps
  lastStepTime = now;

  const bank: Record<string, [number, OscillatorType, number]> = {
    trail: [120, 'triangle', 0.015],
    grass: [140, 'sine', 0.012],
    stone: [180, 'triangle', 0.018],
    water: [95, 'sine', 0.022]
  };

  const [freq, type, vol] = bank[surface] ?? bank.trail;
  playTone(freq, now + 0.005, 0.06, type, vol);
}

/** Plays an interactive 16-bit musical stinger */
export function playStinger(
  kind: 'discover' | 'door' | 'boss' | 'xp' | 'dialogue' | 'boss_clear',
  quiet = false
): void {
  if (!audioCtx || isMuted || audioCtx.state !== 'running' || quiet) return;
  const now = audioCtx.currentTime + 0.01;

  const stingers: Record<string, number[]> = {
    discover: [392.0, 523.25, 659.25, 783.99], // G4, C5, E5, G5
    door: [329.63, 440.0, 554.37, 659.25], // E4, A4, C#5, E5
    boss: [146.83, 174.61, 220.0, 293.66], // Low dramatic flourish
    boss_clear: [293.66, 369.99, 440.0, 587.33, 739.99], // D major triumphant fanfare
    xp: [523.25, 659.25, 783.99], // C5, E5, G5 chime
    dialogue: [440.0, 554.37] // Subtle question ping
  };

  const notes = stingers[kind] ?? stingers.discover;
  notes.forEach((freq, idx) => {
    playTone(freq, now + idx * 0.065, 0.25, 'triangle', 0.028);
  });
}

/** Plays a soft 16-bit menu interaction chime */
export function playMenuSound(kind: 'open' | 'close' = 'open'): void {
  if (!audioCtx || isMuted || audioCtx.state !== 'running') return;
  const now = audioCtx.currentTime + 0.005;
  if (kind === 'open') {
    playTone(392.0, now, 0.08, 'sine', 0.018);
    playTone(587.33, now + 0.04, 0.1, 'triangle', 0.022);
  } else {
    playTone(523.25, now, 0.06, 'sine', 0.015);
    playTone(329.63, now + 0.03, 0.08, 'triangle', 0.015);
  }
}

/** Periodic ambient audio tick for territory theme melody */
export function playAmbientTick(territoryId: string, quiet = false): void {
  if (!audioCtx || isMuted || audioCtx.state !== 'running' || quiet) return;
  const now = audioCtx.currentTime;
  if (now < nextNoteTime) return;

  const notes = TERRITORY_THEMES[territoryId] ?? TERRITORY_THEMES.identity;
  const step = Math.floor((now / 1.6) % notes.length);
  const root = notes[step];

  // Soft atmospheric chime
  playTone(root, now + 0.05, 0.8, 'triangle', 0.014);
  if (step % 2 === 0) {
    playTone(root * 1.5, now + 0.15, 0.6, 'sine', 0.008);
  }

  nextNoteTime = now + 1.6;
}
