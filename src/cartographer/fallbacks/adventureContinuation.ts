import { adventureSceneProposalSchema, type AdventureSceneProposal } from '../adventureSceneProposal';
import { fallbackStableIndex } from './stableIndex';

/**
 * Mirrors `AdventureBeat` in src/adventure/beats.ts. Declared locally because
 * src/cartographer is also compiled into the Worker project, which must not
 * pull in app domain modules. A test asserts both lists stay identical.
 */
export const CONTINUATION_BEATS = [
  'hook',
  'approach',
  'complication',
  'encounter',
  'choice-consequence',
  'optional-reflection'
] as const;
export type AdventureBeat = (typeof CONTINUATION_BEATS)[number];

/** Longest action label echoed back into local prose. */
export const ADVENTURE_CONTINUATION_LABEL_MAX = 80;

/**
 * P10 bank: per-beat continuation lines. `{action}` is replaced by the chosen
 * fictional action label. Lines are story-only: no mechanics, rewards, or
 * statements about Greyson.
 */
export const ADVENTURE_CONTINUATION_BANK: Readonly<Record<AdventureBeat, readonly string[]>> = {
  hook: [
    'You chose to {action}. The path ahead stirs, as if it noticed.',
    'You {action}, and something just out of sight shifts in response.'
  ],
  approach: [
    'You chose to {action}. The way forward narrows to a few clear options.',
    'You {action}. Footsteps, wind, and a half-open gate wait ahead.'
  ],
  complication: [
    'You chose to {action}, and the situation twists in an unexpected direction.',
    'You {action}. A new detail changes how the scene looks.'
  ],
  encounter: [
    'You chose to {action}. The moment tightens; something is about to happen.',
    'You {action}, and the air goes still around you.'
  ],
  'choice-consequence': [
    'You chose to {action}. The world settles around what you did.',
    'You {action}, and the story carries that choice forward.'
  ],
  'optional-reflection': [
    'You chose to {action}. The adventure winds down quietly.',
    'You {action}. The road grows calm again.'
  ]
};

const NEXT_CHOICES: Readonly<Record<AdventureBeat, readonly string[]>> = {
  hook: ['Look closer', 'Ask around', 'Step back'],
  approach: ['Go carefully', 'Go boldly', 'Find another way'],
  complication: ['Adapt', 'Ask for help', 'Wait and watch'],
  encounter: ['Talk', 'Think', 'Move'],
  'choice-consequence': ['Carry on', 'Take a moment'],
  'optional-reflection': ['Carry on']
};

function sanitizeLabel(label: string): string {
  const collapsed = label.replace(/\s+/g, ' ').trim();
  if (!collapsed) return 'carry on';
  const clipped = collapsed.length > ADVENTURE_CONTINUATION_LABEL_MAX
    ? `${collapsed.slice(0, ADVENTURE_CONTINUATION_LABEL_MAX)}…`
    : collapsed;
  return clipped.charAt(0).toLowerCase() + clipped.slice(1);
}

/**
 * P10 local adventure template continuation.
 *
 * Deterministic in (seed, beat, actionLabel). `seed` must be a non-content ID
 * (e.g. the run or action ID). The only caller-authored text accepted is the
 * chosen fictional action label; no Journal text parameter exists. No entity,
 * NPC or memory IDs are referenced, so the result validates against any
 * bounded-context allow-list. Output is parsed through the P03 schema.
 */
export function localAdventureContinuation(
  seed: string,
  beat: AdventureBeat,
  actionLabel: string
): AdventureSceneProposal {
  const bank = ADVENTURE_CONTINUATION_BANK[beat];
  if (!bank) throw new Error(`Unknown adventure beat: ${beat}`);
  const line = bank[fallbackStableIndex(`${seed}|${beat}`, bank.length)];
  const sceneProse = line.replace('{action}', sanitizeLabel(actionLabel));
  return adventureSceneProposalSchema.parse({
    kind: 'adventure-scene',
    mode: 'adventure',
    sceneProse,
    choices: NEXT_CHOICES[beat].map((label) => ({ label }))
  });
}
