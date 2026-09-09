import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isEnglish, rankVoices, resolveVoice, scoreVoice } from '../../src/voice/voices';

/**
 * Which voice the Cartographer speaks with.
 *
 * The previous build set only `lang = 'en-US'`, so the browser chose. On macOS
 * the browser's own default is **Albert**, a novelty voice, which is why the
 * output quality was rightly called unimproved. These tests pin the selection
 * rules that replaced that.
 *
 * They prove WHICH voice is chosen and that nothing crashes when there is none.
 * They cannot prove a voice sounds good — that is what the Voice Lab is for.
 */

const voice = (name: string, lang = 'en-US', localService = true) => ({
  name, lang, localService, voiceURI: name
});

/** The real macOS English inventory, as reported by Chrome on this machine. */
const MACOS_ENGLISH = [
  voice('Albert'), voice('Bad News'), voice('Bahh'), voice('Bells'), voice('Boing'),
  voice('Bubbles'), voice('Cellos'), voice('Daniel', 'en-GB'), voice('Eddy (English (United States))'),
  voice('Flo (English (United States))'), voice('Fred'), voice('Good News'),
  voice('Grandma (English (United States))'), voice('Jester'), voice('Junior'),
  voice('Karen', 'en-AU'), voice('Kathy'), voice('Moira', 'en-IE'), voice('Organ'),
  voice('Ralph'), voice('Reed (English (United States))'), voice('Rishi', 'en-IN'),
  voice('Rocko (English (United States))'), voice('Samantha'),
  voice('Sandy (English (United States))'), voice('Shelley (English (United States))'),
  voice('Superstar'), voice('Tessa', 'en-ZA'), voice('Trinoids'), voice('Whisper'),
  voice('Wobble'), voice('Zarvox')
];

describe('voice selection', () => {
  it('never picks a novelty voice, including the system default', () => {
    const chosen = resolveVoice(MACOS_ENGLISH, null)!;
    expect(chosen.name).not.toBe('Albert');
    for (const rejected of ['Albert', 'Bad News', 'Zarvox', 'Trinoids', 'Bahh', 'Fred', 'Whisper']) {
      expect(scoreVoice(voice(rejected)), rejected).toBe(Number.NEGATIVE_INFINITY);
      expect(rankVoices(MACOS_ENGLISH).map((item) => item.name)).not.toContain(rejected);
    }
  });

  it('picks the best real narrator available on this device', () => {
    // Samantha is the standard high-quality US macOS voice.
    expect(resolveVoice(MACOS_ENGLISH, null)!.name).toBe('Samantha');
  });

  it('prefers a Premium or Enhanced voice when the device has one installed', () => {
    const withPremium = [...MACOS_ENGLISH, voice('Ava (Premium)')];
    expect(resolveVoice(withPremium, null)!.name).toBe('Ava (Premium)');
  });

  it('ranks character voices below plain narrators without excluding them', () => {
    expect(scoreVoice(voice('Grandpa (English (United States))'))).toBeLessThan(scoreVoice(voice('Samantha')));
    // Still usable if it is genuinely all there is.
    expect(resolveVoice([voice('Grandpa (English (United States))')], null)!.name).toContain('Grandpa');
  });

  it('ignores voices that are not English', () => {
    expect(isEnglish(voice('Anna', 'de-DE'))).toBe(false);
    expect(scoreVoice(voice('Anna', 'de-DE'))).toBe(Number.NEGATIVE_INFINITY);
    expect(resolveVoice([voice('Anna', 'de-DE'), voice('Samantha')], null)!.name).toBe('Samantha');
  });

  it('prefers an offline voice over a network one, all else being equal', () => {
    const local = voice('Samantha', 'en-US', true);
    const remote = voice('Samantha', 'en-US', false);
    expect(scoreVoice(local)).toBeGreaterThan(scoreVoice(remote));
  });

  it('honours an explicit preference over the automatic pick', () => {
    expect(resolveVoice(MACOS_ENGLISH, 'Daniel')!.name).toBe('Daniel');
  });

  it('falls back automatically when the preferred voice is no longer installed', () => {
    const chosen = resolveVoice(MACOS_ENGLISH, 'Ava (Premium)');
    expect(chosen).not.toBeNull();
    expect(chosen!.name).toBe('Samantha');
  });

  it('uses the only voice there is, even a poor one, rather than going silent', () => {
    expect(resolveVoice([voice('Grandma (English (United States))')], null)).not.toBeNull();
  });

  it('returns null rather than throwing when the device reports no voices', () => {
    expect(resolveVoice([], null)).toBeNull();
    expect(resolveVoice([], 'Samantha')).toBeNull();
  });

  it('resolves the same voice every time for the same device', () => {
    const first = resolveVoice(MACOS_ENGLISH, null)!.voiceURI;
    const shuffled = [...MACOS_ENGLISH].reverse();
    expect(resolveVoice(shuffled, null)!.voiceURI).toBe(first);
  });
});

describe('asynchronous voice loading', () => {
  const originalWindow = (globalThis as { window?: unknown }).window;

  afterEach(() => {
    if (originalWindow === undefined) delete (globalThis as { window?: unknown }).window;
    else (globalThis as { window?: unknown }).window = originalWindow;
    vi.resetModules();
  });

  it('resolves immediately when the browser already has voices', async () => {
    (globalThis as any).window = { speechSynthesis: { getVoices: () => [voice('Samantha')] } };
    const { loadVoices } = await import('../../src/voice/voices');
    expect(await loadVoices(50)).toHaveLength(1);
  });

  it('waits for voiceschanged when the first enumeration is empty', async () => {
    let loaded: { name: string }[] = [];
    const synth: Record<string, unknown> = {
      getVoices: () => loaded,
      onvoiceschanged: null
    };
    (globalThis as any).window = {
      speechSynthesis: synth,
      setTimeout: globalThis.setTimeout.bind(globalThis),
      clearTimeout: globalThis.clearTimeout.bind(globalThis)
    };
    const { loadVoices } = await import('../../src/voice/voices');

    const pending = loadVoices(2000);
    loaded = [voice('Samantha'), voice('Daniel', 'en-GB')];
    (synth.onvoiceschanged as () => void)();

    expect(await pending).toHaveLength(2);
  });

  it('gives up gracefully when voiceschanged never fires', async () => {
    (globalThis as any).window = {
      speechSynthesis: { getVoices: () => [], onvoiceschanged: null },
      setTimeout: globalThis.setTimeout.bind(globalThis),
      clearTimeout: globalThis.clearTimeout.bind(globalThis)
    };
    const { loadVoices } = await import('../../src/voice/voices');
    expect(await loadVoices(10)).toEqual([]);
  });

  it('reports no voices at all when synthesis is unsupported', async () => {
    delete (globalThis as { window?: unknown }).window;
    const { availableVoices, currentVoice, loadVoices } = await import('../../src/voice/voices');
    expect(await loadVoices(10)).toEqual([]);
    expect(availableVoices()).toEqual([]);
    expect(currentVoice()).toBeNull();
  });
});

describe('voice preference storage', () => {
  const originalWindow = (globalThis as { window?: unknown }).window;
  beforeEach(() => vi.resetModules());
  afterEach(() => {
    if (originalWindow === undefined) delete (globalThis as { window?: unknown }).window;
    else (globalThis as { window?: unknown }).window = originalWindow;
  });

  it('remembers and clears an explicit choice', async () => {
    const store = new Map<string, string>();
    (globalThis as any).window = {
      speechSynthesis: { getVoices: () => [voice('Samantha'), voice('Daniel', 'en-GB')] },
      localStorage: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => { store.set(key, value); },
        removeItem: (key: string) => { store.delete(key); }
      }
    };
    const { getVoicePreference, setVoicePreference, currentVoice, forgetResolvedVoice } = await import('../../src/voice/voices');

    expect(getVoicePreference()).toBeNull();
    expect(currentVoice()!.name).toBe('Samantha');

    setVoicePreference('Daniel');
    forgetResolvedVoice();
    expect(getVoicePreference()).toBe('Daniel');
    expect(currentVoice()!.name).toBe('Daniel');

    setVoicePreference(null);
    forgetResolvedVoice();
    expect(getVoicePreference()).toBeNull();
    expect(currentVoice()!.name).toBe('Samantha');
  });

  it('survives a storage-restricted context without throwing', async () => {
    (globalThis as any).window = {
      speechSynthesis: { getVoices: () => [voice('Samantha')] },
      get localStorage(): Storage { throw new Error('blocked'); }
    };
    const { getVoicePreference, setVoicePreference } = await import('../../src/voice/voices');
    expect(getVoicePreference()).toBeNull();
    expect(() => setVoicePreference('Daniel')).not.toThrow();
  });
});
