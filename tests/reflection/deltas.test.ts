import { describe, expect, it } from 'vitest';
import { createInitialCampaign } from '../../src/game/engine';
import type { CampaignState } from '../../src/game/types';
import {
  detectChangeOverTimeCandidates,
  detectSupportedContradictionCandidates,
  refreshSupportedContradictions
} from '../../src/reflection/deltas';

const firstTime = '2026-09-21T10:00:00.000Z';
const secondTime = '2026-09-21T11:00:00.000Z';
const thirdTime = '2026-09-21T12:00:00.000Z';

type Evidence = CampaignState['evidence'][number];
type Turn = CampaignState['turns'][number];

function turn(id: string, overrides: Partial<Turn> = {}): Turn {
  return {
    id,
    createdAt: firstTime,
    territoryId: 'territory-synthetic',
    dimension: 'dimension-synthetic',
    question: 'Synthetic question.',
    answer: 'Synthetic answer.',
    substantive: true,
    behavioralExample: false,
    revision: false,
    retracted: false,
    ...overrides
  };
}

function evidence(id: string, overrides: Partial<Evidence> = {}): Evidence {
  return {
    id,
    dimension: 'dimension-synthetic',
    claim: `Synthetic claim ${id}.`,
    sourceTurnIds: [`turn-${id}`],
    basis: 'explicit',
    strength: 2,
    territories: ['territory-synthetic'],
    counterEvidenceIds: [],
    status: 'active',
    origin: 'player-stated',
    ...overrides
  };
}

function stateFor(overrides: Partial<CampaignState> = {}): CampaignState {
  const base = createInitialCampaign();
  return { ...base, turns: [], evidence: [], contradictions: [], privateTopics: [], ...overrides };
}

function expectedId(kind: string, ids: string[]): string {
  return `${kind}:${encodeURIComponent(JSON.stringify(ids))}`;
}

describe('RF06 supported contradiction candidates', () => {
  it('creates one deterministic candidate from a one-way eligible counter link', () => {
    const state = stateFor({
      turns: [turn('turn-a'), turn('turn-b')],
      evidence: [evidence('a', { sourceTurnIds: ['turn-a'], counterEvidenceIds: ['b'], territories: ['zeta', 'alpha'] }), evidence('b', { sourceTurnIds: ['turn-b'], territories: ['beta', 'alpha'] })]
    });

    expect(detectSupportedContradictionCandidates(state)).toEqual([{
      id: expectedId('supported-contradiction', ['a', 'b']),
      evidenceIds: ['a', 'b'],
      dimensionIds: ['dimension-synthetic'],
      territoryIds: ['alpha', 'beta', 'zeta'],
      relation: 'counter-evidence'
    }]);
  });

  it('dedupes mutual, reversed, and duplicate counter links into one order-independent pair', () => {
    const forward = stateFor({
      turns: [turn('turn-a'), turn('turn-b')],
      evidence: [evidence('b', { sourceTurnIds: ['turn-b'], counterEvidenceIds: ['a', 'a'] }), evidence('a', { sourceTurnIds: ['turn-a'], counterEvidenceIds: ['b'] })]
    });
    const reverse = stateFor({
      turns: [turn('turn-a'), turn('turn-b')],
      evidence: [evidence('a', { sourceTurnIds: ['turn-a'], counterEvidenceIds: ['b', 'b'] }), evidence('b', { sourceTurnIds: ['turn-b'], counterEvidenceIds: [] })]
    });

    expect(detectSupportedContradictionCandidates(forward)).toEqual(detectSupportedContradictionCandidates(reverse));
    expect(detectSupportedContradictionCandidates(forward)).toHaveLength(1);
    expect(detectSupportedContradictionCandidates(forward)[0]?.evidenceIds).toEqual(['a', 'b']);
  });

  it('ignores unrelated links and every fail-closed ineligible counter pair', () => {
    const state = stateFor({
      privateTopics: ['private-dimension'],
      turns: [
        turn('turn-self'), turn('turn-missing'), turn('turn-retracted', { retracted: true }),
        turn('turn-private-source', { dimension: 'private-dimension' }), turn('turn-private-evidence'), turn('turn-inactive')
      ],
      evidence: [
        evidence('self', { sourceTurnIds: ['turn-self'], counterEvidenceIds: ['self'] }),
        evidence('missing', { sourceTurnIds: ['turn-missing'], counterEvidenceIds: ['absent'] }),
        evidence('retracted', { sourceTurnIds: ['turn-retracted'], counterEvidenceIds: ['other-retracted'] }), evidence('other-retracted', { sourceTurnIds: ['turn-self'] }),
        evidence('private-source', { sourceTurnIds: ['turn-private-source'], counterEvidenceIds: ['other-private-source'] }), evidence('other-private-source', { sourceTurnIds: ['turn-self'] }),
        evidence('private-evidence', { sourceTurnIds: ['turn-private-evidence'], dimension: 'private-dimension', counterEvidenceIds: ['other-private-evidence'] }), evidence('other-private-evidence', { sourceTurnIds: ['turn-self'] }),
        evidence('missing-source', { sourceTurnIds: ['not-a-turn'], counterEvidenceIds: ['other-missing-source'] }), evidence('other-missing-source', { sourceTurnIds: ['turn-self'] }),
        evidence('inactive', { sourceTurnIds: ['turn-inactive'], status: 'retracted', counterEvidenceIds: ['other-inactive'] }), evidence('other-inactive', { sourceTurnIds: ['turn-self'] })
      ]
    });

    expect(detectSupportedContradictionCandidates(state)).toEqual([]);
  });

  it('never returns evidence claim prose in a candidate', () => {
    const claimCanary = 'RF06_CLAIM_CANARY_5c1e';
    const state = stateFor({
      turns: [turn('turn-a'), turn('turn-b')],
      evidence: [evidence('a', { sourceTurnIds: ['turn-a'], claim: claimCanary, counterEvidenceIds: ['b'] }), evidence('b', { sourceTurnIds: ['turn-b'], claim: claimCanary })]
    });
    const candidate = detectSupportedContradictionCandidates(state)[0];

    expect(candidate).not.toHaveProperty('claim');
    expect(JSON.stringify(candidate)).not.toContain(claimCanary);
  });

  it('refreshes one neutral open record only, changes only contradictions and updatedAt, and is idempotent', () => {
    const base = stateFor({
      updatedAt: firstTime,
      turns: [turn('turn-a'), turn('turn-b')],
      evidence: [evidence('a', { sourceTurnIds: ['turn-a'], counterEvidenceIds: ['b'] }), evidence('b', { sourceTurnIds: ['turn-b'] })]
    });
    const next = refreshSupportedContradictions(base, { now: () => secondTime });
    const again = refreshSupportedContradictions(next, { now: () => thirdTime });

    expect(next.contradictions).toEqual([{
      id: expectedId('supported-contradiction', ['a', 'b']),
      claim: 'Supported evidence is explicitly linked as counter-evidence.',
      evidenceIds: ['a', 'b'],
      status: 'open'
    }]);
    expect(next.updatedAt).toBe(secondTime);
    expect({ ...next, contradictions: base.contradictions, updatedAt: base.updatedAt }).toEqual(base);
    expect(again).toBe(next);
  });

  it('does not duplicate a pair already present under another ID, order, or status', () => {
    const state = stateFor({
      contradictions: [{ id: 'existing-record', claim: 'Existing neutral history.', evidenceIds: ['b', 'a'], status: 'resolved' }],
      turns: [turn('turn-a'), turn('turn-b')],
      evidence: [evidence('a', { sourceTurnIds: ['turn-a'], counterEvidenceIds: ['b'] }), evidence('b', { sourceTurnIds: ['turn-b'] })]
    });

    expect(refreshSupportedContradictions(state, { now: () => secondTime })).toBe(state);
  });

  it('preserves existing contradiction history when later source state becomes ineligible', () => {
    const existing = { id: 'existing-record', claim: 'Existing neutral history.', evidenceIds: ['a', 'b'], status: 'open' as const };
    const state = stateFor({
      contradictions: [existing],
      turns: [turn('turn-a', { retracted: true }), turn('turn-b')],
      evidence: [evidence('a', { sourceTurnIds: ['turn-a'], counterEvidenceIds: ['b'] }), evidence('b', { sourceTurnIds: ['turn-b'] })]
    });
    const next = refreshSupportedContradictions(state, { now: () => secondTime });

    expect(next).toBe(state);
    expect(next.contradictions[0]).toBe(existing);
  });
});

describe('RF07 change-over-time candidates', () => {
  it('finds a revision-basis record with a player-authored revision Turn and older same-dimension evidence', () => {
    const state = stateFor({
      turns: [turn('turn-old', { createdAt: firstTime, dimension: 'values' }), turn('turn-new', { createdAt: secondTime, dimension: 'values', revision: true })],
      evidence: [
        evidence('old', { sourceTurnIds: ['turn-old'], dimension: 'values' }),
        evidence('new', { sourceTurnIds: ['turn-new'], dimension: 'values', basis: 'revision' })
      ]
    });

    expect(detectChangeOverTimeCandidates(state)).toEqual([{
      id: expectedId('change-over-time', ['old', 'new']),
      dimensionId: 'values',
      olderEvidenceId: 'old',
      newerEvidenceId: 'new',
      olderSourceTurnIds: ['turn-old'],
      newerSourceTurnIds: ['turn-new'],
      relation: 'same-dimension-revision'
    }]);
  });

  it('requires both revision basis and an actual revision Turn', () => {
    const commonTurns = [turn('turn-old', { createdAt: firstTime, dimension: 'values' }), turn('turn-new', { createdAt: secondTime, dimension: 'values', revision: false })];
    const modelOnly = stateFor({
      turns: commonTurns,
      evidence: [evidence('old', { sourceTurnIds: ['turn-old'], dimension: 'values' }), evidence('new', { sourceTurnIds: ['turn-new'], dimension: 'values', basis: 'revision' })]
    });
    const turnOnly = stateFor({
      turns: [...commonTurns.slice(0, 1), turn('turn-new', { createdAt: secondTime, dimension: 'values', revision: true })],
      evidence: [evidence('old', { sourceTurnIds: ['turn-old'], dimension: 'values' }), evidence('new', { sourceTurnIds: ['turn-new'], dimension: 'values', basis: 'explicit' })]
    });

    expect(detectChangeOverTimeCandidates(modelOnly)).toEqual([]);
    expect(detectChangeOverTimeCandidates(turnOnly)).toEqual([]);
  });

  it('prefers a counter-linked older record over a closer unlinked record and otherwise chooses the closest prior record', () => {
    const state = stateFor({
      turns: [
        turn('turn-counter', { createdAt: firstTime, dimension: 'values' }), turn('turn-close', { createdAt: secondTime, dimension: 'values' }),
        turn('turn-new-a', { createdAt: thirdTime, dimension: 'values', revision: true }), turn('turn-new-b', { createdAt: thirdTime, dimension: 'values', revision: true })
      ],
      evidence: [
        evidence('counter', { sourceTurnIds: ['turn-counter'], dimension: 'values', counterEvidenceIds: ['new-a'] }),
        evidence('close', { sourceTurnIds: ['turn-close'], dimension: 'values' }),
        evidence('new-a', { sourceTurnIds: ['turn-new-a'], dimension: 'values', basis: 'revision' }),
        evidence('new-b', { sourceTurnIds: ['turn-new-b'], dimension: 'values', basis: 'revision' })
      ]
    });
    const candidates = detectChangeOverTimeCandidates(state);

    expect(candidates.find((candidate) => candidate.newerEvidenceId === 'new-a')?.olderEvidenceId).toBe('counter');
    expect(candidates.find((candidate) => candidate.newerEvidenceId === 'new-b')?.olderEvidenceId).toBe('close');
  });

  it('fails closed when provider evidence dimension disagrees with its source Turn dimension', () => {
    const state = stateFor({
      turns: [
        turn('turn-old', { createdAt: firstTime, dimension: 'values' }),
        turn('turn-new', { createdAt: secondTime, dimension: 'relationships', revision: true })
      ],
      evidence: [
        evidence('old', { sourceTurnIds: ['turn-old'], dimension: 'values' }),
        evidence('new', { sourceTurnIds: ['turn-new'], dimension: 'values', basis: 'revision' })
      ]
    });

    expect(detectChangeOverTimeCandidates(state)).toEqual([]);
  });

  it('excludes equal or later times, invalid time/provenance, private/retracted material, and ordinary newer evidence', () => {
    const state = stateFor({
      privateTopics: ['private-dimension'],
      turns: [
        turn('turn-old-equal', { createdAt: secondTime, dimension: 'values' }), turn('turn-old-later', { createdAt: thirdTime, dimension: 'values' }), turn('turn-new', { createdAt: secondTime, dimension: 'values', revision: true }),
        turn('turn-invalid', { createdAt: 'not-a-time', dimension: 'values' }), turn('turn-private', { createdAt: firstTime, dimension: 'private-dimension' }), turn('turn-retracted', { createdAt: firstTime, dimension: 'values', retracted: true }),
        turn('turn-ordinary', { createdAt: secondTime, dimension: 'values', revision: false })
      ],
      evidence: [
        evidence('old-equal', { sourceTurnIds: ['turn-old-equal'], dimension: 'values' }), evidence('old-later', { sourceTurnIds: ['turn-old-later'], dimension: 'values' }),
        evidence('new', { sourceTurnIds: ['turn-new'], dimension: 'values', basis: 'revision' }), evidence('invalid', { sourceTurnIds: ['turn-invalid'], dimension: 'values' }),
        evidence('missing-source', { sourceTurnIds: ['missing-turn'], dimension: 'values' }), evidence('private', { sourceTurnIds: ['turn-private'], dimension: 'private-dimension' }),
        evidence('retracted', { sourceTurnIds: ['turn-retracted'], dimension: 'values' }), evidence('ordinary-newer', { sourceTurnIds: ['turn-ordinary'], dimension: 'values', basis: 'explicit' })
      ]
    });

    expect(detectChangeOverTimeCandidates(state)).toEqual([]);
  });

  it('does not mutate source history and returns structural provenance only', () => {
    const claimCanary = 'RF07_CLAIM_CANARY_98d2';
    const answerCanary = 'RF07_ANSWER_CANARY_2ac1';
    const state = stateFor({
      turns: [turn('turn-old', { createdAt: firstTime, dimension: 'values', answer: answerCanary }), turn('turn-new', { createdAt: secondTime, dimension: 'values', revision: true, answer: answerCanary })],
      evidence: [evidence('old', { sourceTurnIds: ['turn-old'], claim: claimCanary, dimension: 'values' }), evidence('new', { sourceTurnIds: ['turn-new'], claim: claimCanary, dimension: 'values', basis: 'revision' })]
    });
    const snapshot = structuredClone(state);
    const candidate = detectChangeOverTimeCandidates(state)[0];

    expect(state).toEqual(snapshot);
    expect(candidate).not.toHaveProperty('claim');
    expect(candidate).not.toHaveProperty('answer');
    expect(JSON.stringify(candidate)).not.toContain(claimCanary);
    expect(JSON.stringify(candidate)).not.toContain(answerCanary);
  });

  it('treats structural fixtures named trauma and bananas identically', () => {
    const fixture = (dimension: string) => stateFor({
      turns: [turn(`turn-${dimension}-old`, { createdAt: firstTime, dimension }), turn(`turn-${dimension}-new`, { createdAt: secondTime, dimension, revision: true })],
      evidence: [evidence(`${dimension}-old`, { sourceTurnIds: [`turn-${dimension}-old`], dimension }), evidence(`${dimension}-new`, { sourceTurnIds: [`turn-${dimension}-new`], dimension, basis: 'revision' })]
    });
    const normalize = (state: CampaignState) => detectChangeOverTimeCandidates(state).map(({ dimensionId, olderEvidenceId, newerEvidenceId, olderSourceTurnIds, newerSourceTurnIds, id, ...shape }) => shape);

    expect(normalize(fixture('trauma'))).toEqual(normalize(fixture('bananas')));
  });

  it('has stable IDs and deterministic order across repeated calls', () => {
    const state = stateFor({
      turns: [turn('turn-old-a', { createdAt: firstTime, dimension: 'a' }), turn('turn-new-z', { createdAt: thirdTime, dimension: 'a', revision: true }), turn('turn-old-b', { createdAt: firstTime, dimension: 'b' }), turn('turn-new-a', { createdAt: secondTime, dimension: 'b', revision: true })],
      evidence: [
        evidence('old-a', { sourceTurnIds: ['turn-old-a'], dimension: 'a' }), evidence('new-z', { sourceTurnIds: ['turn-new-z'], dimension: 'a', basis: 'revision' }),
        evidence('old-b', { sourceTurnIds: ['turn-old-b'], dimension: 'b' }), evidence('new-a', { sourceTurnIds: ['turn-new-a'], dimension: 'b', basis: 'revision' })
      ]
    });
    const first = detectChangeOverTimeCandidates(state);
    const second = detectChangeOverTimeCandidates(state);

    expect(second).toEqual(first);
    expect(first.map((candidate) => candidate.newerEvidenceId)).toEqual(['new-a', 'new-z']);
    expect(first.map((candidate) => candidate.id)).toEqual([expectedId('change-over-time', ['old-b', 'new-a']), expectedId('change-over-time', ['old-a', 'new-z'])]);
  });
});
