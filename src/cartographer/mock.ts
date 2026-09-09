import type { BossStage, CampaignState, DoorRunState, EvidenceRecord, InsightRecord, TurnRecord } from '../game/types';
import type { CartographerTurn } from './schema';

export interface MockPrompt { id: string; territoryId: string; territoryLabel: string; dimension: string; question: string; }

const QUESTIONS: Record<string, string> = {
  'self-description': 'If you had to describe yourself without job titles or labels, what would you lead with?',
  temperament: 'When nothing is demanding your attention, what kind of emotional weather is most typical for you?',
  strengths: 'What is something you reliably do well when a situation actually matters?',
  vulnerabilities: 'What kind of situation tends to knock you off balance fastest?',
  'moral architecture': 'When two values conflict, what usually decides which one wins?',
  loyalty: 'What does someone have to do before loyalty to them stops being owed?',
  fairness: 'What makes an outcome fair to you: equal treatment, equal power, earned difference, or something else?',
  autonomy: 'Where is the line between helping someone and controlling them?',
  authority: 'What, if anything, makes authority legitimate rather than merely powerful?', legitimacy: 'Can a rule be legitimate when the people affected never consented to it?', state: 'What should a state be allowed to do that an ordinary person should not be allowed to do?', democracy: 'What does democracy need besides voting to deserve the name?', economics: 'What should an economic system optimize for before everything else?', property: 'What kind of ownership claim feels strongest to you, and what kind feels weakest?', labor: 'What does a person owe an employer, and what does an employer owe a worker?', justice: 'When harm happens, what should justice be trying to accomplish?', speech: 'Where, if anywhere, should freedom of speech stop?', institutions: 'What makes an institution worth trusting even when you dislike one of its decisions?', borders: 'What moral weight should borders have over a person’s freedom to move?', 'social liberty': 'What private choices should simply be outside collective control?', equality: 'When equality and liberty pull in different directions, what should decide the tradeoff?', environment: 'What obligations do people alive now have to people who will live later?', technology: 'What kind of technological power should never be accepted just because it is convenient?', change: 'When is gradual reform wiser than rupture, and when does gradualism become an excuse?',
  attachment: 'What makes you feel genuinely close to someone rather than merely familiar with them?', trust: 'What earns trust from you, and what destroys it unusually fast?', conflict: 'During conflict, what matters more: being understood, solving the problem, or protecting the relationship?', 'social world': 'What kind of social environment leaves you more energized rather than depleted?',
  interests: 'What can hold your attention long after the novelty should have worn off?', 'ordinary preferences': 'What small everyday preference says more about you than it probably should?', curiosity: 'What kinds of questions do you chase even when nobody needs an answer?', motivation: 'What makes effort feel worth spending when nobody is watching?',
  'decision style': 'When a choice matters, do you trust analysis, instinct, other people, or some combination?', uncertainty: 'What do you do when you need to act before you feel sure?', contradiction: 'What is a belief or tendency in you that seems to pull against another part of you?', revision: 'What kind of evidence can actually make you change your mind?',
  aversions: 'What do you find yourself avoiding even when you know avoidance has a cost?', fears: 'What possibility has more power over your decisions than you wish it did?', risk: 'What kind of risk feels exciting to you, and what kind feels simply reckless?', boundaries: 'What boundary do you wish people understood without needing it explained twice?',
  hopes: 'What future possibility would make the next few years feel meaningfully different?', dreams: 'If practical constraints disappeared for a while, what would you try to build or become?', 'ideal future': 'What does an ordinary good day in your ideal future actually look like?', ambition: 'What would you regret not attempting, even if attempting it might fail?'
};

function fallbackQuestion(dimension: string) { return `What does “${dimension}” mean in your own life when it stops being an abstract word?`; }
export function getMockPrompt(state: CampaignState): MockPrompt {
  const territory = state.territories.find((item) => item.id === state.activeTerritory) ?? state.territories[0];
  const available = territory.requiredDimensions.filter((dimension) => !state.privateTopics.includes(dimension));
  const uncovered = available.filter((dimension) => !territory.coveredDimensions.includes(dimension));
  const dimension = uncovered[0] ?? available[0] ?? 'self-description';
  return { id: `prompt_${territory.id}_${dimension.replaceAll(' ', '-')}`, territoryId: territory.id, territoryLabel: territory.label, dimension, question: QUESTIONS[dimension] ?? fallbackQuestion(dimension) };
}
/**
 * Wording for the two unlocked game moves.
 *
 * Both are deterministic and local: a move is a way of asking, not a source of
 * progression, so neither needs a provider and neither may award anything. The
 * engine never sees these — only the question text the player actually answered
 * reaches `TurnRecord.question`.
 */
const DEEPER_FRAMES = [
  (dimension: string) => `Stay with ${dimension} a little longer. What part of that do you usually leave out because it complicates the tidy version?`,
  (dimension: string) => `Go one layer down on ${dimension}. What has it actually cost you to be that way?`,
  (dimension: string) => `Push on ${dimension}. Where does that stop being true about you?`
];

const REFRAME_FRAMES = [
  (dimension: string) => `A different angle on ${dimension}: what would someone who knows you well say about it that you would not say yourself?`,
  (dimension: string) => `Make ${dimension} concrete — describe one specific moment where it actually showed up.`,
  (dimension: string) => `Turn ${dimension} over: what does it look like in you on a bad day?`
];

/** Stable per-dimension selection, so the same thread always deepens the same way. */
function stableIndex(seed: string, span: number) {
  let total = 0;
  for (let index = 0; index < seed.length; index += 1) total = (total + seed.charCodeAt(index)) % 9973;
  return total % span;
}

/** GO DEEPER: same territory, same dimension, a harder question. */
export function deeperPrompt(prompt: MockPrompt): MockPrompt {
  const frame = DEEPER_FRAMES[stableIndex(prompt.dimension, DEEPER_FRAMES.length)];
  return { ...prompt, id: `${prompt.id}_deeper`, question: frame(prompt.dimension) };
}

/** REROLL: same coordinate, genuinely different framing. Cycles deterministically. */
export function rerolledPrompt(prompt: MockPrompt, attempt: number): MockPrompt {
  const frame = REFRAME_FRAMES[Math.abs(attempt) % REFRAME_FRAMES.length];
  return { ...prompt, id: `${prompt.id}_reroll_${attempt}`, question: frame(prompt.dimension) };
}

function looksLikeExample(answer: string) { return /\b(for example|for instance|when i|one time|last time|because i|i once)\b/i.test(answer); }
function looksLikeRevision(answer: string) { return /\b(i changed my mind|i used to|not anymore|actually|i was wrong|i revised|i no longer)\b/i.test(answer); }

export function createMockTurn(state: CampaignState, prompt: MockPrompt, answer: string): CartographerTurn {
  const trimmed = answer.trim();
  const quiet = state.presentation === 'quiet';
  return {
    reply: quiet ? 'Understood. I’ll keep this plain and treat the answer as a coordinate, not a performance.' : state.settings.sass === 'risks-understood' ? 'Coordinate logged. The map has, regrettably, learned something.' : 'Coordinate logged. The map has a little more shape now.',
    nextQuestion: getMockPrompt(state).question,
    presentation: quiet ? 'quiet' : 'normal',
    evidence: [{ dimension: prompt.dimension, claim: `Synthetic mock evidence recorded for the ${prompt.dimension} dimension.`, basis: looksLikeRevision(trimmed) ? 'revision' : looksLikeExample(trimmed) ? 'example' : 'explicit', strength: trimmed.length > 120 ? 3 : trimmed.length > 40 ? 2 : 1, territories: [prompt.territoryId] }],
    connections: [], quoteCandidates: [], summaryPatch: `Coverage advanced in ${prompt.territoryLabel}.`, achievementCandidates: []
  };
}

/**
 * Turn a Cartographer proposal into records. Works for any provider, not only the
 * mock: `providerId` records which mind authored the evidence claims, while the
 * player's own words are preserved verbatim in `turnRecord.answer`.
 */
export function recordsFromMockTurn(prompt: MockPrompt, answer: string, turn: CartographerTurn, providerId = 'mock'): { turnRecord: TurnRecord; evidence: EvidenceRecord[]; insight?: InsightRecord } {
  const createdAt = new Date().toISOString();
  const turnId = `turn_${crypto.randomUUID()}`;
  const turnRecord: TurnRecord = { id: turnId, createdAt, territoryId: prompt.territoryId, dimension: prompt.dimension, question: prompt.question, answer: answer.trim(), substantive: answer.trim().length > 0, behavioralExample: looksLikeExample(answer), revision: looksLikeRevision(answer), retracted: false };
  const evidence = turn.evidence.map((proposal) => ({ id: `ev_${crypto.randomUUID()}`, dimension: proposal.dimension, claim: proposal.claim, sourceTurnIds: [turnId], basis: proposal.basis, strength: proposal.strength, territories: proposal.territories, counterEvidenceIds: [], status: 'active' as const, origin: 'model-proposed' as const, providerId }));
  const insight = evidence.length ? { id: `insight_${crypto.randomUUID()}`, title: prompt.dimension.replace(/\b\w/g, (char) => char.toUpperCase()), summary: `Current mock read: this answer adds usable evidence about ${prompt.dimension}.`, evidenceIds: evidence.map((item) => item.id), confidence: evidence[0].strength >= 3 ? 'strong' as const : evidence[0].strength === 2 ? 'moderate' as const : 'low' as const, status: 'pending' as const, createdAt } : undefined;
  return { turnRecord, evidence, insight };
}

// ---------------------------------------------------------------------------
// Encounter wording
//
// These helpers supply language for Boss Fight stages and Mystery Doors. The
// stage plan, the Door pairing, eligibility, progress and every reward are
// decided in src/game/encounters.ts and src/game/engine.ts. Nothing here can
// start, advance, complete or reward an encounter.
// ---------------------------------------------------------------------------

function claimFor(state: CampaignState, evidenceId: string): string | undefined {
  const record = state.evidence.find((item) => item.id === evidenceId);
  return record && record.status === 'active' && !state.privateTopics.includes(record.dimension) ? record.claim : undefined;
}

export interface EncounterWording { title: string; question: string; evidenceClaims: string[]; }

export function describeBossStage(state: CampaignState, stage: BossStage): EncounterWording {
  const [first, second] = stage.dimensions;
  const evidenceClaims = stage.evidenceIds.map((id) => claimFor(state, id)).filter((claim): claim is string => Boolean(claim));
  if (stage.kind === 'priority') {
    return { title: 'Hold the line', question: `You have mapped both “${first}” and “${second}”. When those two collide and only one can win, which one actually wins — and what decides it?`, evidenceClaims };
  }
  if (stage.kind === 'tradeoff') {
    return { title: 'Name the cost', question: `Keeping “${first}” costs something real. Name what you would actually give up to keep it, in concrete terms rather than principle.`, evidenceClaims };
  }
  return { title: 'The tension', question: `Your mapped positions on “${first}” and “${second}” pull against each other under pressure. Which one is closer to true when it is expensive to hold, and why?`, evidenceClaims };
}

export function describeDoor(state: CampaignState, run: DoorRunState, territoryLabels: Record<string, string>): EncounterWording {
  const [left, right] = run.dimensions;
  const evidenceClaims = run.evidenceIds.map((id) => claimFor(state, id)).filter((claim): claim is string => Boolean(claim));
  const leftLabel = territoryLabels[run.territoryIds[0]] ?? run.territoryIds[0];
  const rightLabel = territoryLabels[run.territoryIds[1]] ?? run.territoryIds[1];
  return {
    title: `${leftLabel} × ${rightLabel}`,
    question: `Two mapped regions touch here: “${left}” in ${leftLabel} and “${right}” in ${rightLabel}. What connects them that neither territory would have shown on its own — a shared cause, a hidden cost, or a contradiction?`,
    evidenceClaims
  };
}

export function doorInsightFrom(run: DoorRunState, wording: EncounterWording): InsightRecord {
  return {
    id: `insight_${crypto.randomUUID()}`,
    title: `Crossing: ${wording.title}`,
    summary: `Cross-territory mock read connecting ${run.dimensions.join(' and ')}.`,
    evidenceIds: [...run.evidenceIds],
    confidence: 'moderate',
    status: 'pending',
    createdAt: new Date().toISOString()
  };
}

export function encounterTurnRecord(territoryId: string, dimension: string, question: string, answer: string): TurnRecord {
  const trimmed = answer.trim();
  return { id: `turn_${crypto.randomUUID()}`, createdAt: new Date().toISOString(), territoryId, dimension, question, answer: trimmed, substantive: trimmed.length > 0, behavioralExample: looksLikeExample(trimmed), revision: looksLikeRevision(trimmed), retracted: false };
}
