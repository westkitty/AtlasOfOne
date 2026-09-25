import { describe, expect, it } from 'vitest';
import { ACT_BANK, actFromBank, actTemplate } from '../../src/combat/content/actBank';
import { ENCOUNTER_BANK } from '../../src/combat/content/encounters';
import { COMBAT_ACT_JOBS } from '../../src/combat/types';

/**
 * CT09 lint: ACT text may describe fictional actions only. These stems name
 * diagnoses, personality verdicts, moral judgments or second-person claims
 * about who the player "is". Matching is case-insensitive on word starts.
 */
const FORBIDDEN_STEMS = [
  'anxi', 'depress', 'trauma', 'disorder', 'diagnos', 'narciss', 'neurotic', 'psycho', 'patholog',
  'bipolar', 'adhd', 'autis', 'ocd', 'ptsd', 'insecur', 'codependen', 'avoidant', 'attachment',
  'coward', 'weak', 'lazy', 'selfish', 'toxic', 'broken', 'damaged', 'failure', 'pathetic', 'shame',
  'guilt', 'brave', 'hero', 'kind-hearted', 'kindhearted', 'compassion', 'empath', 'caring', 'aggress',
  'violent', 'personality', 'trait', 'always', 'never', 'truly', 'deep down', 'you are', "you're",
  'reveals that', 'proves', 'means you', 'kind of person', 'type of person', 'good person', 'bad person'
];

function lint(text: string): string[] {
  const lower = text.toLowerCase().replace(/[_.]/g, ' ');
  return FORBIDDEN_STEMS.filter((stem) => new RegExp(`(^|[^a-z])${stem.replace(/[-']/g, '.')}`).test(lower));
}

describe('CT09 ACT option bank', () => {
  it('lint helper catches verdict language (negative control)', () => {
    expect(lint('Show you are brave')).toEqual(expect.arrayContaining(['brave', 'you are']));
    expect(lint('act.proves_anxious_trait')).toEqual(expect.arrayContaining(['anxi', 'trait', 'proves']));
    expect(lint('Coward retreats')).toContain('coward');
    expect(lint('Offer a heel of bread')).toEqual([]);
  });

  it('contains no diagnostic or judgment language in labels or observation keys', () => {
    for (const act of ACT_BANK) {
      expect({ id: act.templateId, hits: lint(act.label) }).toEqual({ id: act.templateId, hits: [] });
      expect({ id: act.templateId, hits: lint(act.observationKey) }).toEqual({ id: act.templateId, hits: [] });
      expect({ id: act.templateId, hits: lint(act.templateId) }).toEqual({ id: act.templateId, hits: [] });
    }
  });

  it('every ACT used by the encounter bank is also lint-clean', () => {
    for (const d of ENCOUNTER_BANK) {
      for (const act of d.actOptions ?? []) {
        expect(lint(`${act.label} ${act.observationKey ?? ''}`)).toEqual([]);
      }
    }
  });

  it('covers every ACT job with unique templates and fiction-namespaced observation keys', () => {
    expect(new Set(ACT_BANK.map((a) => a.templateId)).size).toBe(ACT_BANK.length);
    for (const job of COMBAT_ACT_JOBS) expect(ACT_BANK.some((a) => a.job === job)).toBe(true);
    for (const a of ACT_BANK) {
      expect(a.observationKey).toMatch(/^act\.[a-z_]+$/);
      expect(a.requiredSteps).toBeGreaterThanOrEqual(0);
      expect(a.requiredSteps).toBeLessThanOrEqual(3);
      expect(a.label.length).toBeLessThanOrEqual(40);
    }
  });

  it('actFromBank instantiates templates and rejects unknown ids', () => {
    const act = actFromBank('offer_bread', 'hound', 'bread_1');
    expect(act).toMatchObject({ id: 'bread_1', targetId: 'hound', job: 'pacify-progress', requiredSteps: 2 });
    expect(actFromBank('wedge_door')).not.toHaveProperty('targetId');
    expect(() => actTemplate('diagnose_player')).toThrow(/Unknown/);
  });
});
