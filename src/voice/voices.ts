/**
 * Choosing what the Cartographer actually sounds like.
 *
 * The previous implementation set `utterance.lang = 'en-US'` and nothing else,
 * so the browser picked its own default. On macOS that default is **Albert** — a
 * novelty voice — which is why "the voices are terrible" was a fair description
 * of a build whose voice *interaction* had been carefully improved.
 *
 * This module never speaks. It only decides, deterministically, which of the
 * voices actually present on this device should be used, and remembers a
 * player's explicit choice. Nothing here reaches campaign state or the model.
 */

export interface VoiceChoice {
  name: string;
  lang: string;
  localService: boolean;
  voiceURI: string;
}

/** Where a preferred voice is remembered. Local to the device, and nothing else. */
const PREFERENCE_KEY = 'atlas_voice_uri';

/**
 * Voices that are jokes, instruments or sound effects rather than someone
 * talking. Several ship on macOS and one of them — Albert — is the system
 * default, so this list is the difference between a Cartographer and a cartoon.
 */
const NOVELTY = new Set([
  'albert', 'bad news', 'bahh', 'bells', 'boing', 'bubbles', 'cellos', 'deranged',
  'fred', 'good news', 'hysterical', 'jester', 'junior', 'kathy', 'organ', 'princess',
  'ralph', 'superstar', 'trinoids', 'whisper', 'wobble', 'zarvox', 'bruce', 'agnes',
  'victoria', 'bahh (english (united states))'
]);

/**
 * macOS "character" voices. They are real speech and perfectly usable as a last
 * resort, but they are performances rather than a narrator, so they rank below
 * the plain ones.
 */
const CHARACTER = ['eddy', 'flo', 'grandma', 'grandpa', 'reed', 'rocko', 'sandy', 'shelley'];

/**
 * Voices known to be good narrators where they exist. This is a *preference*
 * layered over what the device actually reports — never an assumption that any
 * of them is present.
 *
 * - Samantha / Alex / Ava / Allison / Susan: the standard high-quality US macOS voices.
 * - Daniel / Serena / Kate: the equivalent UK set.
 * - Karen, Moira, Tessa, Rishi: regional English voices of the same generation.
 * - Google / Microsoft entries: the good voices on Chrome and Edge respectively.
 */
const PREFERRED = [
  'samantha', 'alex', 'ava', 'allison', 'susan', 'nathan', 'evan', 'joelle', 'zoe',
  'daniel', 'serena', 'kate', 'oliver', 'stephanie',
  'karen', 'moira', 'tessa', 'rishi',
  'google us english', 'google uk english female', 'google uk english male',
  'microsoft aria', 'microsoft guy', 'microsoft jenny', 'microsoft ryan',
  'microsoft sonia', 'microsoft libby', 'microsoft emma', 'microsoft brian'
];

/** The higher-quality tiers Apple, Google and Microsoft ship under their own labels. */
const HIGH_QUALITY = /\b(premium|enhanced|neural|natural|siri)\b/i;

const baseName = (name: string) => name.replace(/\s*\(.*\)\s*$/, '').trim().toLowerCase();

export const isEnglish = (voice: { lang: string }) => voice.lang.toLowerCase().startsWith('en');

/**
 * How suitable a voice is for the Cartographer. Higher is better; a negative
 * score means "only if there is genuinely nothing else".
 *
 * Local voices are preferred deliberately: Atlas is offline-first and private,
 * and a network voice is neither. That preference is a weight rather than a
 * veto, so a clearly better cloud voice can still win on a device that has one.
 */
export function scoreVoice(voice: { name: string; lang: string; localService: boolean }): number {
  if (!isEnglish(voice)) return Number.NEGATIVE_INFINITY;

  const base = baseName(voice.name);
  const full = voice.name.toLowerCase();
  if (NOVELTY.has(base) || NOVELTY.has(full)) return Number.NEGATIVE_INFINITY;

  let score = 0;
  if (HIGH_QUALITY.test(voice.name)) score += 1000;
  if (PREFERRED.some((preferred) => base === preferred || full.startsWith(preferred))) score += 500;
  if (CHARACTER.includes(base)) score -= 400;
  if (voice.localService) score += 120;

  const lang = voice.lang.toLowerCase();
  if (lang === 'en-us') score += 60;
  else if (lang === 'en-gb') score += 50;
  else score += 40;

  return score;
}

/**
 * Rank the voices this device actually has. Ties break on name so the same
 * device always resolves to the same voice, in the app and in the Voice Lab.
 */
export function rankVoices<T extends { name: string; lang: string; localService: boolean }>(voices: T[]): T[] {
  return voices
    .filter((voice) => Number.isFinite(scoreVoice(voice)))
    .sort((a, b) => scoreVoice(b) - scoreVoice(a) || a.name.localeCompare(b.name));
}

/**
 * The voice to speak with: the player's explicit choice when it is still
 * installed, otherwise the best-ranked available one, otherwise nothing at all —
 * in which case the caller speaks with the browser default rather than failing.
 */
export function resolveVoice<T extends { name: string; lang: string; localService: boolean; voiceURI: string }>(
  voices: T[],
  preferredUri?: string | null
): T | null {
  if (!voices.length) return null;
  if (preferredUri) {
    const chosen = voices.find((voice) => voice.voiceURI === preferredUri);
    if (chosen) return chosen;
  }
  return rankVoices(voices)[0] ?? null;
}

// ---------------------------------------------------------------------------
// Browser plumbing
// ---------------------------------------------------------------------------

const supported = () => typeof window !== 'undefined' && typeof window.speechSynthesis !== 'undefined';
/**
 * Some environments expose a partial `speechSynthesis`. Enumeration is optional
 * plumbing — speaking is not — so a missing or throwing `getVoices` degrades to
 * "no voice preference" rather than breaking the Cartographer.
 */
function safeGetVoices(): SpeechSynthesisVoice[] {
  if (!supported() || typeof window.speechSynthesis.getVoices !== 'function') return [];
  try {
    return window.speechSynthesis.getVoices() ?? [];
  } catch {
    return [];
  }
}

/**
 * `getVoices()` is empty on first call in several browsers and fills in later,
 * announced by `voiceschanged`. This waits for that properly instead of racing
 * it, and still resolves — with whatever exists — if the event never arrives.
 */
export function loadVoices(timeoutMs = 3000): Promise<SpeechSynthesisVoice[]> {
  if (!supported()) return Promise.resolve([]);
  const immediate = safeGetVoices();
  if (immediate.length) return Promise.resolve(immediate);
  if (typeof window.speechSynthesis.getVoices !== 'function') return Promise.resolve([]);

  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      window.speechSynthesis.onvoiceschanged = null;
      window.clearTimeout(timer);
      resolve(safeGetVoices());
    };
    const timer = window.setTimeout(finish, timeoutMs);
    window.speechSynthesis.onvoiceschanged = finish;
  });
}

export function getVoicePreference(): string | null {
  try {
    return window.localStorage?.getItem(PREFERENCE_KEY) ?? null;
  } catch {
    // A storage-restricted context simply has no preference.
    return null;
  }
}

export function setVoicePreference(voiceURI: string | null): void {
  try {
    if (voiceURI) window.localStorage?.setItem(PREFERENCE_KEY, voiceURI);
    else window.localStorage?.removeItem(PREFERENCE_KEY);
  } catch {
    // Not being able to remember the choice must never break speaking.
  }
}

/** Cached resolution, so speaking never waits on an enumeration. */
let cached: SpeechSynthesisVoice | null = null;
let cachedFor: string | null = null;

/** Resolve now, from whatever the browser reports synchronously. */
export function currentVoice(): SpeechSynthesisVoice | null {
  if (!supported()) return null;
  const preference = getVoicePreference();
  const voices = safeGetVoices();
  if (cached && cachedFor === preference && voices.includes(cached)) return cached;
  const resolved = resolveVoice(voices, preference);
  cached = resolved;
  cachedFor = preference;
  return resolved;
}

/** Warm the cache at startup so the first spoken line already sounds right. */
export async function primeVoices(): Promise<void> {
  await loadVoices();
  cached = null;
  currentVoice();
}

/** Drop the cache after the player picks a different voice. */
export function forgetResolvedVoice(): void {
  cached = null;
  cachedFor = null;
}

/** English voices, best first — what the settings picker and Voice Lab list. */
export function availableVoices(): VoiceChoice[] {
  if (!supported()) return [];
  return rankVoices(safeGetVoices()).map((voice) => ({
    name: voice.name, lang: voice.lang, localService: voice.localService, voiceURI: voice.voiceURI
  }));
}
