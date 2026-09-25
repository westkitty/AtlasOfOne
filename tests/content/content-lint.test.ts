import { describe, expect, it } from 'vitest';
import { IN_WORLD_FORBIDDEN_PATTERNS } from '../../src/adventure/content/templateSchema';
import { CORE_ADVENTURE_TEMPLATES } from '../../src/adventure/content/templates';
import { pureFunTemplateShare } from '../../src/adventure/content/quota';
import { FALLBACK_WITHDRAW_OPTION, renderFallbackAdventure } from '../../src/adventure/fallbackRenderer';
import { ADVENTURE_KINDS, type AdventureSeed } from '../../src/adventure/schema';
import { ADVENTURE_CONTINUATION_BANK } from '../../src/cartographer/fallbacks/adventureContinuation';
import { JOURNAL_ACKNOWLEDGEMENT_BANK } from '../../src/cartographer/fallbacks/journalAcknowledgement';
import { REFLECTION_QUESTION_BANK } from '../../src/cartographer/fallbacks/reflectionWording';
import { ACT_BANK } from '../../src/combat/content/actBank';
import { ENCOUNTER_BANK } from '../../src/combat/content/encounters';
import { JOURNAL_PROMPTS } from '../../src/journal/prompts';

/**
 * CT10 content repetition and hidden-test-language lint (sections 11.3, 19.1,
 * 19.3). Every player-facing string in the authored banks is checked against
 * the in-world forbidden list plus extra assessment/clinical vocabulary.
 */
const EXTRA_FORBIDDEN: readonly RegExp[] = [
  /\bquiz/i, /\bscor(e|es|ed|ing)\b/i, /\bmeasur/i, /\bsymptom/i, /\bpatholog/i, /\bclinical/i,
  /\bpatient\b/i, /\bexperiment/i, /\bsurvey\b/i, /\bquestionnaire/i, /\bdata\b/i, /\btrait/i,
  /\bnormal\b/i, /\bweakness/i, /\bflaw/i
];
const FORBIDDEN = [...IN_WORLD_FORBIDDEN_PATTERNS, ...EXTRA_FORBIDDEN];

const synthSeed = (kind: AdventureSeed['kind']): AdventureSeed => ({
  id: `lint_${kind}`, sourceGapIds: kind === 'pure-fun' ? [] : ['gap_lint'], kind, territoryId: 'interests',
  premise: 'A lantern flickers.', learningTarget: kind === 'pure-fun' ? 'none' : 'reflection-eligible', status: 'available'
});

const BANKS: Record<string, readonly string[]> = {
  'adventure templates': CORE_ADVENTURE_TEMPLATES.flatMap((t) => [t.title, t.funHook, ...t.beats.map((b) => b.intent), ...Object.values(t.failForward)]),
  'ACT bank': ACT_BANK.map((a) => a.label),
  'encounter labels': ENCOUNTER_BANK.flatMap((d) => [
    ...d.combatants.filter((c) => c.side !== 'player').map((c) => c.label),
    ...(d.techniques ?? []).map((t) => t.label),
    ...(d.actOptions ?? []).map((a) => a.label)
  ]),
  'fallback renderer': [
    FALLBACK_WITHDRAW_OPTION.label,
    ...ADVENTURE_KINDS.flatMap((kind) =>
      renderFallbackAdventure(synthSeed(kind)).flatMap((f) => [f.heading, f.prompt, ...f.options.map((o) => o.label)]))
  ],
  'continuation fallback': Object.values(ADVENTURE_CONTINUATION_BANK).flat(),
  'acknowledgement fallback': JOURNAL_ACKNOWLEDGEMENT_BANK,
  'reflection fallback': REFLECTION_QUESTION_BANK,
  'journal prompts': JOURNAL_PROMPTS
};

const tokens = (s: string) => new Set(s.toLowerCase().replace(/\{action\}/g, '').match(/[a-z']+/g) ?? []);
function jaccard(a: string, b: string): number {
  const x = tokens(a);
  const y = tokens(b);
  const inter = [...x].filter((t) => y.has(t)).length;
  return inter / (x.size + y.size - inter || 1);
}
const NEAR_DUPLICATE_THRESHOLD = 0.75;

function nearDuplicates(strings: readonly string[]): Array<[string, string, number]> {
  const unique = [...new Set(strings)];
  const out: Array<[string, string, number]> = [];
  for (let i = 0; i < unique.length; i += 1) {
    for (let j = i + 1; j < unique.length; j += 1) {
      const score = jaccard(unique[i], unique[j]);
      if (score >= NEAR_DUPLICATE_THRESHOLD) out.push([unique[i], unique[j], score]);
    }
  }
  return out;
}

describe('CT10 content lint', () => {
  it.each(Object.entries(BANKS))('%s contains no psychological, diagnostic or test language', (_bank, strings) => {
    expect(strings.length).toBeGreaterThan(0);
    const hits = strings.flatMap((s) => FORBIDDEN.filter((p) => p.test(s)).map((p) => `${p.source} in "${s}"`));
    expect(hits).toEqual([]);
  });

  it.each(Object.entries(BANKS).filter(([bank]) => bank !== 'fallback renderer'))(
    '%s has no near-duplicate lines',
    (_bank, strings) => {
      expect(nearDuplicates(strings)).toEqual([]);
    }
  );

  it('encounter enemy labels are unique across the bank', () => {
    const enemies = ENCOUNTER_BANK.flatMap((d) => d.combatants.filter((c) => c.side === 'enemy').map((c) => c.label));
    expect(new Set(enemies).size).toBe(enemies.length);
  });

  it('adventure templates keep a pure-fun share of at least 20%', () => {
    const share = pureFunTemplateShare(CORE_ADVENTURE_TEMPLATES);
    expect(share.meetsQuota).toBe(true);
    expect(share.share).toBeGreaterThanOrEqual(0.2);
  });

  it('the lint itself catches planted offenders (adversarial)', () => {
    for (const bad of ['Take the personality quiz', 'Your anxiety score', 'A clinical test of nerve', 'Greyson feels it']) {
      expect(FORBIDDEN.some((p) => p.test(bad)), bad).toBe(true);
    }
    expect(nearDuplicates(['The bell rings again at dawn.', 'The bell rings again at dawn!'])).toHaveLength(1);
    expect(nearDuplicates(['A duck is mayor.', 'The tide is rising.'])).toEqual([]);
  });
});
