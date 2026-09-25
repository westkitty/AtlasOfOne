import type { AdventureKind, AdventureSeed } from './schema';

/** A03 section 10.3 beat contract. Hard upper bound: six beats per ordinary adventure. */
export const ADVENTURE_BEATS = [
  'hook',
  'approach',
  'complication',
  'encounter',
  'choice-consequence',
  'optional-reflection'
] as const;
export type AdventureBeat = (typeof ADVENTURE_BEATS)[number];
export const MAX_ADVENTURE_BEATS = ADVENTURE_BEATS.length;

export function isAdventureBeat(value: string): value is AdventureBeat {
  return (ADVENTURE_BEATS as readonly string[]).includes(value);
}

/**
 * Deterministic beat plan for a seed. `learningTarget: 'none'` (including every
 * pure-fun seed) omits the reflection beat entirely: nothing asks for reflection.
 */
export function adventureBeatPlan(seed: Pick<AdventureSeed, 'learningTarget'>): readonly AdventureBeat[] {
  return seed.learningTarget === 'none'
    ? ADVENTURE_BEATS.slice(0, MAX_ADVENTURE_BEATS - 1)
    : ADVENTURE_BEATS;
}

export function nextAdventureBeat(
  seed: Pick<AdventureSeed, 'learningTarget'>,
  current: string
): AdventureBeat | null {
  const plan = adventureBeatPlan(seed);
  const index = plan.indexOf(current as AdventureBeat);
  if (index < 0) throw new Error(`Beat ${current} is not in this adventure's plan.`);
  return plan[index + 1] ?? null;
}

export interface LocalBeatFrame {
  beat: AdventureBeat;
  index: number;
  total: number;
  heading: string;
  prompt: string;
  /** Always true: every beat offers a respectful exit (A05). */
  withdrawalAvailable: true;
}

const BEAT_HEADINGS: Record<AdventureBeat, string> = {
  hook: 'Something stirs',
  approach: 'Choose your approach',
  complication: 'A wrinkle appears',
  encounter: 'Face it',
  'choice-consequence': 'The world answers',
  'optional-reflection': 'If you like, look back'
};

const KIND_FLAVOR: Partial<Record<AdventureKind, string>> = {
  investigation: 'There is something here worth looking into.',
  'social-dilemma': 'Someone nearby needs a decision only you can make.',
  'pure-fun': 'Something delightfully odd is happening.'
};

/**
 * A03 local template renderer. No provider, no network, no journal prose. The
 * seed premise is the only authored text and is passed through unchanged.
 */
export function buildLocalBeatFrame(seed: AdventureSeed, beat: AdventureBeat): LocalBeatFrame {
  const plan = adventureBeatPlan(seed);
  const index = plan.indexOf(beat);
  if (index < 0) throw new Error(`Beat ${beat} is not in this adventure's plan.`);

  const flavor = KIND_FLAVOR[seed.kind] ?? 'The road offers something new.';
  const prompts: Record<AdventureBeat, string> = {
    hook: `${seed.premise} ${flavor}`,
    approach: 'Investigate, ask, avoid, or act. Describe what you do.',
    complication: 'New information changes the picture. What now?',
    encounter: 'The moment arrives. Talk, think, move, or fight.',
    'choice-consequence': 'Your choice leaves a mark the world will remember.',
    'optional-reflection': 'Was there anything in this you would like to think about? Skipping is fine.'
  };

  return {
    beat,
    index,
    total: plan.length,
    heading: BEAT_HEADINGS[beat],
    prompt: prompts[beat],
    withdrawalAvailable: true
  };
}
