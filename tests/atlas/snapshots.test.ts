import { describe, expect, it } from 'vitest';
import { currentSnapshotSources, recordAtlasSnapshot, snapshotEligibility, snapshotHistory } from '../../src/atlas/snapshots';
import {
  TERMINAL_IDENTITY_CLAIMS,
  compileFinalizeContext,
  generateLocalAssessment,
  validateFinalAssessment,
  type FinalAssessment
} from '../../src/cartographer/finalize';
import { applyGameEvents } from '../../src/game/engine';
import type { CampaignState } from '../../src/game/types';
import { deserializeCampaign, serializeCampaign } from '../../src/persistence/transfer';
import { answerCurrentPrompt, seededCampaign } from '../fixtures/synthetic';

const DAY1 = '2026-09-20T10:00:00.000Z';
const DAY1_LATER = '2026-09-20T18:00:00.000Z';
const DAY2 = '2026-09-21T10:00:00.000Z';
const ALL = ['identity', 'values', 'politics', 'relationships', 'interests', 'cognition', 'fears', 'future'];

let charted: CampaignState | null = null;
function chartedCampaign(): CampaignState {
  charted ??= seededCampaign({ territories: ALL });
  return structuredClone(charted);
}

const body = (state: CampaignState): FinalAssessment => generateLocalAssessment(state);

describe('Atlas Snapshots replace terminal Final Assessment semantics', () => {
  it('first Snapshot needs the deterministic territory milestone', () => {
    const early = seededCampaign({ territories: ['identity'] });
    expect(snapshotEligibility(early, DAY1)).toEqual({ eligible: false, reason: 'first-milestone-not-reached' });
    expect(recordAtlasSnapshot(early, body(early), DAY1)).toBe(early);
    expect(snapshotEligibility(chartedCampaign(), DAY1)).toEqual({ eligible: true, reason: 'eligible' });
  });

  it('appends immutable dated history instead of overwriting, with what changed since the previous one', () => {
    let state = chartedCampaign();
    state = recordAtlasSnapshot(state, body(state), DAY1);
    expect(state.atlasSnapshots).toHaveLength(1);
    const first = structuredClone(state.atlasSnapshots[0]);
    expect(first).toMatchObject({ provenance: { kind: 'snapshot' }, eligibility: 'eligible', createdAt: DAY1 });
    expect(first.evidenceIds.length).toBeGreaterThan(0);
    expect(state.finalAssessment ?? null).toBeNull();

    expect(snapshotEligibility(state, DAY1_LATER).reason).toBe('already-taken-today');
    expect(snapshotEligibility(state, DAY2).reason).toBe('nothing-new-since-last');

    state = answerCurrentPrompt(state);
    expect(snapshotEligibility(state, DAY2).eligible).toBe(true);
    state = recordAtlasSnapshot(state, body(state), DAY2);
    expect(state.atlasSnapshots).toHaveLength(2);
    expect(state.atlasSnapshots[0]).toEqual(first);
    expect(state.atlasSnapshots[1].previousSnapshotId).toBe(first.id);

    const history = snapshotHistory(state);
    expect(history.map((entry) => entry.snapshot.createdAt)).toEqual([DAY2, DAY1]);
    expect(history[0].changeFromPrevious!.added.evidenceIds.length).toBeGreaterThan(0);
    expect(history[1].changeFromPrevious).toBeUndefined();
  });

  it('a double request for the same moment records exactly one Snapshot', () => {
    const state = chartedCampaign();
    const once = recordAtlasSnapshot(state, body(state), DAY1);
    expect(recordAtlasSnapshot(once, body(state), DAY1)).toBe(once);
  });

  it('refuses a stale body whose sources changed while it was being written (retraction race)', () => {
    const state = chartedCampaign();
    const synthesizedFrom = currentSnapshotSources(state);
    const draft = body(state);
    const victim = state.evidence.find((item) => item.status === 'active')!;
    const retracted = applyGameEvents(state, [{ type: 'ANSWER_RETRACTED', turnId: victim.sourceTurnIds[0] }]);
    expect(recordAtlasSnapshot(retracted, draft, DAY1, synthesizedFrom)).toBe(retracted);
    expect(recordAtlasSnapshot(state, draft, DAY1, synthesizedFrom).atlasSnapshots).toHaveLength(1);
  });

  it('a Snapshot whose support is later retracted is retired live and shows no body', () => {
    let state = chartedCampaign();
    state = recordAtlasSnapshot(state, body(state), DAY1);
    const victim = state.evidence.find((item) => item.id === state.atlasSnapshots[0].evidenceIds[0])!;
    state = applyGameEvents(state, [{ type: 'ANSWER_RETRACTED', turnId: victim.sourceTurnIds[0] }]);
    const [entry] = snapshotHistory(state);
    expect(entry.displayable).toBe(false);
    expect(entry.body).toBeUndefined();
    expect(state.atlasSnapshots).toHaveLength(1);
  });

  it('legacy v1 Final Assessments survive migration as read-only history', () => {
    const legacySource = chartedCampaign();
    const assessment = body(legacySource);
    const v1 = { ...JSON.parse(serializeCampaign({ ...legacySource, finalAssessment: assessment })), schemaVersion: 1 } as Record<string, unknown>;
    for (const key of ['journalEntries', 'knowledgeGaps', 'reflections', 'adventureSeeds', 'adventureRuns', 'adventureActions', 'adventureObservations', 'adventureMemories', 'atlasSnapshots', 'combatDefinitions', 'activeCombat', 'activeCombatRuntime']) delete v1[key];
    const migrated = deserializeCampaign(JSON.stringify(v1));
    const history = snapshotHistory(migrated);
    expect(history).toHaveLength(1);
    expect(history[0].snapshot.provenance).toEqual({ kind: 'legacy-final-assessment', sourceFinalAssessmentId: assessment.id });
    expect(history[0].displayable).toBe(false);
    expect(history[0].body?.id).toBe(assessment.id);
    // A legacy record never counts as the first v2 Snapshot.
    expect(snapshotEligibility(migrated, DAY1).eligible).toBe(true);
  });

  it('round-trips Snapshot history through export/import unchanged', () => {
    let state = chartedCampaign();
    state = recordAtlasSnapshot(state, body(state), DAY1);
    expect(deserializeCampaign(serializeCampaign(state)).atlasSnapshots).toEqual(state.atlasSnapshots);
  });

  it('semantic validation refuses terminal-identity framing; the local synthesis passes', () => {
    const state = chartedCampaign();
    const context = compileFinalizeContext(state);
    expect(validateFinalAssessment(body(state), context)).toEqual({ ok: true });
    for (const phrase of ['This is the final assessment of Greyson.', 'The Atlas is complete.', 'His true self has been revealed.', 'Greyson definitively is a leader.', 'He will never change.']) {
      const forged = { ...body(state), whoIsGreyson: phrase };
      const result = validateFinalAssessment(forged, context);
      expect(result.ok, phrase).toBe(false);
    }
    expect(TERMINAL_IDENTITY_CLAIMS.length).toBeGreaterThan(0);
  });
});
