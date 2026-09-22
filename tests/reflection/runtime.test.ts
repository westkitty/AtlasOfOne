import { describe, expect, it } from 'vitest';
import { createInitialCampaign } from '../../src/game/engine';
import type { CampaignState } from '../../src/game/types';
import { reconcileRevisionCounterEvidence } from '../../src/reflection/runtime';

const oldAt = '2026-09-21T10:00:00.000Z';
const newAt = '2026-09-21T11:00:00.000Z';
type Evidence = CampaignState['evidence'][number];
type Turn = CampaignState['turns'][number];

const turn = (id: string, overrides: Partial<Turn> = {}): Turn => ({ id, createdAt: oldAt, territoryId: 'identity', dimension: 'self-description', question: 'SYNTHETIC_QUESTION_CANARY', answer: 'SYNTHETIC_ANSWER_CANARY', substantive: true, behavioralExample: false, revision: false, retracted: false, ...overrides });
const evidence = (id: string, overrides: Partial<Evidence> = {}): Evidence => ({ id, dimension: 'self-description', claim: `SYNTHETIC_CLAIM_CANARY_${id}`, sourceTurnIds: [`turn-${id}`], basis: 'explicit', strength: 2, territories: ['identity'], counterEvidenceIds: [], status: 'active', origin: 'model-proposed', ...overrides });
const state = (overrides: Partial<CampaignState> = {}): CampaignState => ({ ...createInitialCampaign(), turns: [], evidence: [], contradictions: [], privateTopics: [], ...overrides });

function validPair(overrides: Partial<CampaignState> = {}) {
  const previous = state({ turns: [turn('turn-old')], evidence: [evidence('old')], ...overrides });
  const next = { ...previous, turns: [...previous.turns, turn('turn-new', { createdAt: newAt, revision: true })], evidence: [...previous.evidence, evidence('new', { basis: 'revision' })] };
  return { previous, next };
}

describe('RF06 runtime revision reconciliation', () => {
  it('leaves ordinary and provider-only revision evidence untouched by reference', () => {
    const { previous, next } = validPair();
    const providerOnly = { ...next, turns: next.turns.map((item) => item.id === 'turn-new' ? { ...item, revision: false } : item) };
    expect(reconcileRevisionCounterEvidence(previous, providerOnly)).toBe(providerOnly);
    const ordinary = { ...next, evidence: next.evidence.map((item) => item.id === 'new' ? { ...item, basis: 'explicit' } : item) };
    expect(reconcileRevisionCounterEvidence(previous, ordinary)).toBe(ordinary);
  });

  it('links exactly the RF07-selected older evidence and creates one neutral open contradiction without extra progression', () => {
    const { previous, next } = validPair({ turns: [turn('turn-counter', { createdAt: '2026-09-21T09:00:00.000Z' }), turn('turn-old')], evidence: [evidence('counter', { counterEvidenceIds: ['new'] }), evidence('old')] });
    const beforeNonReflection = { ...next, evidence: undefined, contradictions: undefined, updatedAt: undefined };
    const result = reconcileRevisionCounterEvidence(previous, next, { now: () => newAt });
    expect(result.evidence.find((item) => item.id === 'counter')?.counterEvidenceIds).toEqual(['new']);
    expect(result.evidence.find((item) => item.id === 'new')?.counterEvidenceIds).toEqual(['counter']);
    expect(result.evidence.find((item) => item.id === 'old')?.counterEvidenceIds).toEqual([]);
    expect(result.contradictions).toEqual([expect.objectContaining({ claim: 'Supported evidence is explicitly linked as counter-evidence.', evidenceIds: ['counter', 'new'], status: 'open' })]);
    expect({ ...result, evidence: undefined, contradictions: undefined, updatedAt: undefined }).toEqual(beforeNonReflection);
  });

  it('fails closed for private, retracted, missing provenance, invalid time, and dimension mismatch', () => {
    for (const mutate of [
      (value: CampaignState) => ({ ...value, privateTopics: ['self-description'] }),
      (value: CampaignState) => ({ ...value, turns: value.turns.map((item) => item.id === 'turn-new' ? { ...item, retracted: true } : item) }),
      (value: CampaignState) => ({ ...value, evidence: value.evidence.map((item) => item.id === 'new' ? { ...item, sourceTurnIds: ['missing'] } : item) }),
      (value: CampaignState) => ({ ...value, turns: value.turns.map((item) => item.id === 'turn-new' ? { ...item, createdAt: 'invalid' } : item) }),
      (value: CampaignState) => ({ ...value, turns: value.turns.map((item) => item.id === 'turn-new' ? { ...item, dimension: 'other' } : item) })
    ]) {
      const { previous, next } = validPair();
      const candidate = mutate(next);
      expect(reconcileRevisionCounterEvidence(previous, candidate)).toBe(candidate);
    }
  });

  it('uses one deterministic reconciliation timestamp for links and contradiction refresh', () => {
    const { previous, next } = validPair();
    let calls = 0;
    const result = reconcileRevisionCounterEvidence(previous, next, { now: () => { calls += 1; return newAt; } });
    expect(calls).toBe(1);
    expect(result.updatedAt).toBe(newAt);
    expect(result.contradictions).toHaveLength(1);
  });

  it('preserves unrelated links and evidence fields, sorts/dedupes links, and is idempotent', () => {
    const { previous, next } = validPair({ evidence: [evidence('old', { counterEvidenceIds: ['z', 'z'] }), evidence('z', { sourceTurnIds: ['missing'] })] });
    const prior = { ...previous, turns: [turn('turn-old')], evidence: next.evidence.filter((item) => item.id !== 'new') };
    const result = reconcileRevisionCounterEvidence(prior, next, { now: () => newAt });
    expect(result.evidence.find((item) => item.id === 'old')?.counterEvidenceIds).toEqual(['new', 'z']);
    expect(result.evidence.find((item) => item.id === 'z')?.counterEvidenceIds).toEqual([]);
    expect(result.evidence.find((item) => item.id === 'new')).toMatchObject({ claim: 'SYNTHETIC_CLAIM_CANARY_new', basis: 'revision', sourceTurnIds: ['turn-new'], status: 'active' });
    expect(JSON.stringify(result.contradictions)).not.toContain('SYNTHETIC_CLAIM_CANARY');
    expect(JSON.stringify(result.contradictions)).not.toContain('SYNTHETIC_ANSWER_CANARY');
    expect(reconcileRevisionCounterEvidence(prior, result, { now: () => '2026-09-21T12:00:00.000Z' })).toBe(result);
  });
});
