import type { CartographerContext } from './context';
import { cartographerTurnSchema, type CartographerTurn } from './schema';

/**
 * Provider response → decode → Zod → semantic validate → accept.
 *
 * Each layer is separate on purpose. Decoding failure is a formatting problem and
 * earns the one permitted repair attempt. Semantic failure means the model
 * overstepped an Atlas rule, and is never repaired — a model that proposed a
 * private dimension does not get asked to try again with the same context.
 */

/**
 * Field names that would represent game authority. `cartographerTurnSchema` is a
 * Zod object schema, so it already strips unknown keys; this list exists so the
 * firewall can *report* an attempt rather than silently discard it.
 */
/**
 * Field names that always represent game authority, wherever they appear.
 * `cartographerTurnSchema` is a Zod object schema, so it already strips unknown
 * keys; this list exists so the firewall can *report* an attempt rather than
 * silently discard it.
 */
export const PROGRESSION_FIELD_NAMES = [
  'xp', 'experience', 'level', 'levelup', 'levels',
  'unlock', 'unlocks', 'unlocked', 'abilities',
  'achievement', 'achievementsunlocked',
  'questcomplete', 'questcompleted',
  'territorycomplete', 'territorystatus', 'charted',
  'mapfragment', 'mapfragments', 'fragments',
  'bosscomplete', 'bossfight', 'bossreward',
  'doorcomplete', 'mysterydoor', 'doorreward',
  'campaigncompleted', 'campaigncomplete', 'rewards', 'score', 'points'
] as const;

/**
 * Names that are legitimate deeper in the contract but are authority claims at
 * the top level. `evidence[].territories` is a real contract field; a top-level
 * `territories` is a model trying to set territory state.
 */
export const TOP_LEVEL_ONLY_FIELD_NAMES = ['territories', 'territory', 'quests', 'quest', 'achievements', 'complete'] as const;

const ALWAYS_KEYS = new Set<string>(PROGRESSION_FIELD_NAMES);
const TOP_LEVEL_KEYS = new Set<string>(TOP_LEVEL_ONLY_FIELD_NAMES);

/**
 * Every progression-looking key in a decoded provider payload. Ambiguous names
 * count only at the top level, so a legitimate nested contract field is not
 * reported as an attack.
 */
export function findAuthorityFields(value: unknown): string[] {
  const seen = new Set<string>();
  const walk = (node: unknown, topLevel: boolean) => {
    if (Array.isArray(node)) {
      node.forEach((item) => walk(item, false));
      return;
    }
    if (!node || typeof node !== 'object') return;
    for (const [key, child] of Object.entries(node)) {
      const lowered = key.toLowerCase();
      if (ALWAYS_KEYS.has(lowered) || (topLevel && TOP_LEVEL_KEYS.has(lowered))) seen.add(key);
      walk(child, false);
    }
  };
  walk(value, true);
  return [...seen];
}

/**
 * Language that would announce progression to the player. A model has no way to
 * award anything, but it must not narrate awards either, because the player would
 * read it as real.
 */
const PROGRESSION_CLAIMS: RegExp[] = [
  /\bxp\b/i,
  /\blevel(?:l)?ed\s*up\b/i,
  /\blevel\s*\d+\b/i,
  /\bachievement\s+unlocked\b/i,
  /\byou(?:'ve|\s+have)?\s+unlocked\b/i,
  /\bquest\s+(?:complete|completed)\b/i,
  /\bterritory\s+(?:charted|complete|completed)\b/i,
  /\bmap\s+fragment\b/i,
  /\bcampaign\s+(?:complete|completed)\b/i,
  /\bboss\s+(?:defeated|complete|completed)\b/i
];

export type DecodeResult = { ok: true; value: unknown } | { ok: false; detail: string };

/**
 * Pull a JSON object out of whatever the model actually returned: a real object,
 * bare JSON, a fenced block, or JSON buried in reasoning prose.
 */
export function decodeModelJson(raw: unknown): DecodeResult {
  if (raw && typeof raw === 'object') return { ok: true, value: raw };
  if (typeof raw !== 'string') return { ok: false, detail: `Unusable response type: ${typeof raw}` };

  const text = raw.trim();
  if (!text) return { ok: false, detail: 'Empty response.' };

  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidates = [fenced?.[1]?.trim(), text, firstBalancedObject(text)].filter((item): item is string => Boolean(item));

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === 'object') return { ok: true, value: parsed };
    } catch {
      // try the next candidate
    }
  }
  return { ok: false, detail: 'No JSON object could be decoded from the response.' };
}

/** Scan for the first brace-balanced object, ignoring braces inside strings. */
function firstBalancedObject(text: string): string | undefined {
  const start = text.indexOf('{');
  if (start < 0) return undefined;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < text.length; index += 1) {
    const char = text[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === '{') depth += 1;
    else if (char === '}') {
      depth -= 1;
      if (depth === 0) return text.slice(start, index + 1);
    }
  }
  return undefined;
}

export type ValidationResult =
  | { ok: true; turn: CartographerTurn; authorityFieldsStripped: string[] }
  | { ok: false; stage: 'decode' | 'schema' | 'semantic'; detail: string };

/**
 * Semantic rules that Zod cannot express. These are Atlas invariants, not taste:
 * a violation means the response is discarded, never repaired.
 */
function semanticProblems(turn: CartographerTurn, context: CartographerContext): string[] {
  const problems: string[] = [];
  const retired = context.retiredDimensions.map((item) => item.toLowerCase());
  const knownTerritories = new Set(context.territories.map((item) => item.id));
  const prose = [turn.reply, turn.nextQuestion, turn.summaryPatch, ...turn.quoteCandidates, ...turn.evidence.map((item) => item.claim)];

  for (const item of turn.evidence) {
    if (retired.includes(item.dimension.toLowerCase())) problems.push(`Evidence proposed on retired dimension "${item.dimension}".`);
    if (!item.claim.trim()) problems.push('Evidence claim was empty.');
    for (const territoryId of item.territories) {
      if (!knownTerritories.has(territoryId)) problems.push(`Evidence referenced unknown territory "${territoryId}".`);
    }
  }

  // A retired dimension must not resurface in prose either, in any casing.
  for (const text of prose) {
    const lowered = text.toLowerCase();
    for (const dimension of retired) {
      if (dimension && lowered.includes(dimension)) problems.push(`Retired dimension "${dimension}" resurfaced in model prose.`);
    }
  }

  for (const text of [turn.reply, turn.nextQuestion, turn.summaryPatch]) {
    for (const pattern of PROGRESSION_CLAIMS) {
      if (pattern.test(text)) problems.push(`Model narrated progression: ${pattern}`);
    }
  }

  // A quote candidate has to be a quote of the player, not invented material.
  for (const quote of turn.quoteCandidates) {
    if (quote.trim() && !context.task.answer.includes(quote.trim())) problems.push('Quote candidate does not appear in the player answer.');
  }

  return [...new Set(problems)];
}

/**
 * Local presentation state wins. A provider may request quiet, but it can never
 * pull Atlas back into celebration while the player has asked for SERIOUS.
 */
function clampPresentation(turn: CartographerTurn, context: CartographerContext): CartographerTurn {
  return context.presentation === 'quiet' ? { ...turn, presentation: 'quiet' } : turn;
}

/** The full boundary. `raw` is whatever the provider handed back. */
export function validateProviderResponse(raw: unknown, context: CartographerContext): ValidationResult {
  const decoded = decodeModelJson(raw);
  if (!decoded.ok) return { ok: false, stage: 'decode', detail: decoded.detail };

  // Recorded before Zod strips them, so an overreach is visible rather than silent.
  const authorityFieldsStripped = findAuthorityFields(decoded.value);

  const parsed = cartographerTurnSchema.safeParse(decoded.value);
  if (!parsed.success) return { ok: false, stage: 'schema', detail: parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ') };

  const problems = semanticProblems(parsed.data, context);
  if (problems.length) return { ok: false, stage: 'semantic', detail: problems.join(' ') };

  return { ok: true, turn: clampPresentation(parsed.data, context), authorityFieldsStripped };
}
