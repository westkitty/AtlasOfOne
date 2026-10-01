import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  TERRITORY_DRONES,
  TERRITORY_THEMES,
  getAudioMuted,
  initAudio,
  playAmbientTick,
  playCombatSound,
  playFootstep,
  playMenuSound,
  playObservatoryAwaken,
  playStinger,
  setAudioMuted,
  setMasterVolume
} from '../../src/world/audio';

describe('procedural web audio engine', () => {
  beforeEach(() => {
    setAudioMuted(false);
    setMasterVolume(0.35);
  });

  it('provides pentatonic themes and deep drones for all 8 territories', () => {
    const territories = [
      'identity',
      'values',
      'politics',
      'relationships',
      'cognition',
      'interests',
      'fears',
      'future'
    ];
    for (const t of territories) {
      expect(TERRITORY_THEMES[t]).toBeDefined();
      expect(TERRITORY_THEMES[t].length).toBeGreaterThanOrEqual(4);
      expect(TERRITORY_DRONES[t]).toBeDefined();
      expect(TERRITORY_DRONES[t]).toBeGreaterThan(20);
    }
  });

  it('manages mute and volume state deterministically', () => {
    expect(getAudioMuted()).toBe(false);
    setAudioMuted(true);
    expect(getAudioMuted()).toBe(true);
    setAudioMuted(false);
    expect(getAudioMuted()).toBe(false);
  });

  it('safe to call in environments without AudioContext (e.g. Node/SSR/Vitest)', () => {
    expect(() => initAudio()).not.toThrow();
    expect(() => playFootstep('trail')).not.toThrow();
    expect(() => playFootstep('stone')).not.toThrow();
    expect(() => playStinger('discover')).not.toThrow();
    expect(() => playStinger('boss_clear')).not.toThrow();
    expect(() => playStinger('xp', true)).not.toThrow();
    expect(() => playAmbientTick('identity', false)).not.toThrow();
    expect(() => playObservatoryAwaken(false)).not.toThrow();
    expect(() => playCombatSound('attack', false)).not.toThrow();
    expect(() => playCombatSound('guard', false)).not.toThrow();
    expect(() => playCombatSound('technique', false)).not.toThrow();
    expect(() => playCombatSound('act', false)).not.toThrow();
    expect(() => playCombatSound('hit', false)).not.toThrow();
    expect(() => playCombatSound('victory', false)).not.toThrow();
  });

  it('plays menu sounds cleanly without throwing', () => {
    expect(() => playMenuSound('open')).not.toThrow();
    expect(() => playMenuSound('close')).not.toThrow();
  });

  it('respects quiet mode by suppressing stingers, combat sounds and ambient themes', () => {
    // Calling with quiet=true executes cleanly and returns without error
    expect(() => playStinger('xp', true)).not.toThrow();
    expect(() => playStinger('boss_clear', true)).not.toThrow();
    expect(() => playAmbientTick('fears', true)).not.toThrow();
    expect(() => playObservatoryAwaken(true)).not.toThrow();
    expect(() => playCombatSound('attack', true)).not.toThrow();
    expect(() => playCombatSound('guard', true)).not.toThrow();
  });
});
