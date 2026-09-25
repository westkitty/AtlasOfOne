import { adventureBeatPlan, buildLocalBeatFrame, type AdventureBeat } from './beats';
import { adventureSeedSchema, type AdventureKind, type AdventureSeed } from './schema';

/**
 * A06 local fallback adventure renderer.
 *
 * Used when no provider is configured, the network is down, or a provider
 * proposal failed validation. Pure, synchronous, template-based and
 * deterministic: the same seed and beat always render the same frame. It never
 * reads journal text, never calls a provider, and never mutates state.
 */

export interface FallbackOption {
  id: string;
  label: string;
}

export interface FallbackBeatRender {
  seedId: string;
  beat: AdventureBeat;
  index: number;
  total: number;
  heading: string;
  prompt: string;
  /** Suggested actions only; free input is always accepted as well (section 10.4). */
  options: readonly FallbackOption[];
  /** Every beat ends with this exit. It is never a failure. */
  withdrawOption: FallbackOption;
  freeInputAccepted: true;
  source: 'local-fallback';
}

export const FALLBACK_WITHDRAW_OPTION: FallbackOption = Object.freeze({
  id: 'withdraw',
  label: 'Step away for now (the story will carry on)'
});

const KIND_SCENE: Record<AdventureKind, string> = {
  'social-dilemma': 'Two neighbours are arguing, and both look to you.',
  investigation: 'Fresh tracks lead somewhere they should not.',
  'rescue-support': 'A small voice is calling for help nearby.',
  'exploration-expedition': 'An unmapped path opens past the ridge.',
  negotiation: 'A trader will not budge on the price of a bridge toll.',
  'absurd-comedy': 'A very serious duck has declared itself mayor.',
  'ethical-conflict': 'Helping one traveller means delaying another.',
  'creative-building': 'A broken windmill waits for someone to rebuild it.',
  'memory-echo': 'A familiar landmark looks slightly different today.',
  'relationship-companion': 'Your companion wants to show you something.',
  'mystery-puzzle': 'A locked box hums a tune when you get close.',
  'survival-escape': 'The tide is rising faster than expected.',
  'combat-forward': 'Something bristly blocks the road and will not move.',
  'pure-fun': 'Something delightfully odd is happening.'
};

const BEAT_OPTIONS: Record<AdventureBeat, readonly FallbackOption[]> = {
  hook: [
    { id: 'look-closer', label: 'Look closer' },
    { id: 'ask-around', label: 'Ask someone nearby' }
  ],
  approach: [
    { id: 'investigate', label: 'Investigate' },
    { id: 'talk', label: 'Talk it through' },
    { id: 'act', label: 'Act right away' }
  ],
  complication: [
    { id: 'adapt', label: 'Change the plan' },
    { id: 'press-on', label: 'Press on anyway' }
  ],
  encounter: [
    { id: 'talk', label: 'Talk' },
    { id: 'think', label: 'Think it through' },
    { id: 'move', label: 'Move' },
    { id: 'fight', label: 'Fight' }
  ],
  'choice-consequence': [
    { id: 'decide', label: 'Make your choice' }
  ],
  'optional-reflection': [
    { id: 'reflect', label: 'Think about it for a moment' },
    { id: 'skip-reflection', label: 'Skip, and keep exploring' }
  ]
};

export function renderFallbackBeat(seed: AdventureSeed, beat: AdventureBeat): FallbackBeatRender {
  const valid = adventureSeedSchema.parse(seed);
  const frame = buildLocalBeatFrame(valid, beat);
  const prompt = beat === 'hook'
    ? `${valid.premise} ${KIND_SCENE[valid.kind]}`
    : frame.prompt;
  return {
    seedId: valid.id,
    beat,
    index: frame.index,
    total: frame.total,
    heading: frame.heading,
    prompt,
    options: BEAT_OPTIONS[beat].map((option) => ({ ...option })),
    withdrawOption: { ...FALLBACK_WITHDRAW_OPTION },
    freeInputAccepted: true,
    source: 'local-fallback'
  };
}

/** Render the seed's whole bounded beat plan (pure-fun omits the reflection beat). */
export function renderFallbackAdventure(seed: AdventureSeed): readonly FallbackBeatRender[] {
  return adventureBeatPlan(seed).map((beat) => renderFallbackBeat(seed, beat));
}
