import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createInitialCampaign } from '../../src/game/engine';
import type { CampaignState, EvidenceRecord, InsightRecord, ContradictionRecord } from '../../src/game/types';
import {
  createV2ProvenanceVisibility,
  retireIneligibleV2DerivedState
} from '../../src/persistence/retirement';

const canonicalAssessment = JSON.parse(
  readFileSync(new URL('../fixtures/v1/canonical-current-v1.json', import.meta.url), 'utf8')
).finalAssessment;

const evidence = (overrides: Partial<EvidenceRecord> = {}): EvidenceRecord => ({
  id: 'ev_visible',
  dimension: 'identity-self-description',
  claim: 'Synthetic visible claim.',
  sourceTurnIds: ['turn_1'],
  basis: 'explicit',
  strength: 2,
  territories: ['identity'],
  counterEvidenceIds: [],
  status: 'active',
  origin: 'player-stated',
  ...overrides
});

const insight = (overrides: Partial<InsightRecord> = {}): InsightRecord => ({
  id: 'insight_1',
  title: 'Synthetic insight',
  summary: 'Synthetic summary.',
  evidenceIds: ['ev_visible'],
  confidence: 'moderate',
  status: 'confirmed',
  createdAt: '2026-01-01T00:00:00.000Z',
  ...overrides
});

const contradiction = (overrides: Partial<ContradictionRecord> = {}): ContradictionRecord => ({
  id: 'contradiction_1',
  claim: 'Synthetic contradiction.',
  evidenceIds: ['ev_visible'],
  status: 'open',
  ...overrides
});

function baseState(): CampaignState {
  return createInitialCampaign();
}

describe('M06 v2 provenance retirement and withholding', () => {
  it('retires gap -> seed -> memory transitively when their only Journal source becomes PRIVATE', () => {
    const state = baseState();
    state.journalEntries = [{
      id: 'journal_private',
      createdAt: '2026-01-01T00:00:00.000Z',
      text: 'PRIVATE_CANARY_JOURNAL',
      inputMode: 'typed',
      privacy: 'private',
      status: 'active',
      linkedReflectionIds: [],
      linkedAdventureIds: []
    }];
    state.knowledgeGaps = [{
      id: 'gap_private',
      kind: 'curiosity',
      territoryIds: ['identity'],
      dimensionIds: ['self-description'],
      sourceEvidenceIds: [],
      sourceJournalEntryIds: ['journal_private'],
      summary: 'PRIVATE_CANARY_GAP',
      status: 'open',
      priority: 10
    }];
    state.adventureSeeds = [{
      id: 'seed_private',
      sourceGapIds: ['gap_private'],
      kind: 'social-dilemma',
      territoryId: 'identity',
      premise: 'PRIVATE_CANARY_SEED',
      learningTarget: 'reflection-eligible',
      status: 'available'
    }];
    state.adventureMemories = [{
      id: 'memory_private',
      type: 'event',
      summary: 'PRIVATE_CANARY_MEMORY',
      triggerTerms: ['canary'],
      sourceIds: ['seed_private'],
      privacy: 'normal',
      status: 'active'
    }];

    const retired = retireIneligibleV2DerivedState(state);

    expect(retired.knowledgeGaps[0].status).toBe('retired');
    expect(retired.adventureSeeds[0].status).toBe('retired');
    expect(retired.adventureMemories[0].status).toBe('retired');

    // History is preserved; authority is what changed.
    expect(retired.journalEntries[0].text).toBe('PRIVATE_CANARY_JOURNAL');
    expect(retired.knowledgeGaps[0].summary).toBe('PRIVATE_CANARY_GAP');
    expect(retired.adventureSeeds[0].premise).toBe('PRIVATE_CANARY_SEED');
    expect(retired.adventureMemories[0].summary).toBe('PRIVATE_CANARY_MEMORY');
  });

  it('retires exclusively retracted evidence provenance but keeps mixed support as history-bearing', () => {
    const state = baseState();
    state.evidence = [
      evidence({ id: 'ev_visible' }),
      evidence({ id: 'ev_retracted', status: 'retracted', claim: 'RETRACTED_CANARY' })
    ];
    state.knowledgeGaps = [
      {
        id: 'gap_all_retracted',
        kind: 'underexplored',
        territoryIds: ['identity'],
        dimensionIds: ['self-description'],
        sourceEvidenceIds: ['ev_retracted'],
        sourceJournalEntryIds: [],
        summary: 'All retracted',
        status: 'open',
        priority: 4
      },
      {
        id: 'gap_mixed',
        kind: 'underexplored',
        territoryIds: ['identity'],
        dimensionIds: ['self-description'],
        sourceEvidenceIds: ['ev_visible', 'ev_retracted'],
        sourceJournalEntryIds: [],
        summary: 'Mixed',
        status: 'open',
        priority: 5
      }
    ];

    const beforeVisibility = createV2ProvenanceVisibility(state);
    expect(beforeVisibility.knowledgeGapHasEligibleSupport('gap_mixed')).toBe(true);
    expect(beforeVisibility.knowledgeGapIsStructurallyVisible('gap_mixed')).toBe(false);

    const retired = retireIneligibleV2DerivedState(state);
    expect(retired.knowledgeGaps.find((gap) => gap.id === 'gap_all_retracted')?.status).toBe('retired');
    expect(retired.knowledgeGaps.find((gap) => gap.id === 'gap_mixed')?.status).toBe('open');
  });

  it('preserves resolved gap history while withholding it when its provenance closes', () => {
    const state = baseState();
    state.evidence = [evidence({ id: 'ev_retracted', status: 'retracted' })];
    state.knowledgeGaps = [{
      id: 'gap_resolved',
      kind: 'unknown',
      territoryIds: ['identity'],
      dimensionIds: ['self-description'],
      sourceEvidenceIds: ['ev_retracted'],
      sourceJournalEntryIds: [],
      summary: 'Resolved history',
      status: 'resolved',
      priority: 1
    }];

    const retired = retireIneligibleV2DerivedState(state);
    expect(retired.knowledgeGaps[0].status).toBe('resolved');
    expect(createV2ProvenanceVisibility(retired).knowledgeGapIsStructurallyVisible('gap_resolved')).toBe(false);
  });

  it('withholds Reflections when their exact source chain becomes ineligible', () => {
    const state = baseState();
    state.journalEntries = [{
      id: 'journal_1',
      createdAt: '2026-01-01T00:00:00.000Z',
      text: 'Synthetic journal.',
      inputMode: 'typed',
      privacy: 'normal',
      status: 'active',
      linkedReflectionIds: ['reflection_journal'],
      linkedAdventureIds: []
    }];
    state.reflections = [{
      id: 'reflection_journal',
      sourceKind: 'journal',
      sourceIds: ['journal_1'],
      question: 'Synthetic question?',
      response: 'Synthetic answer.',
      epistemicStatus: 'confirmed',
      privacy: 'normal',
      recordStatus: 'active',
      createdAt: '2026-01-01T00:00:01.000Z'
    }];

    expect(createV2ProvenanceVisibility(state).reflectionIsEligible('reflection_journal')).toBe(true);

    state.journalEntries[0] = { ...state.journalEntries[0], privacy: 'private' };
    expect(createV2ProvenanceVisibility(state).reflectionIsEligible('reflection_journal')).toBe(false);
    expect(state.reflections[0].recordStatus).toBe('active');
  });

  it('traces AdventureObservation eligibility through action -> run -> seed -> gap provenance', () => {
    const state = baseState();
    state.journalEntries = [{
      id: 'journal_seed',
      createdAt: '2026-01-01T00:00:00.000Z',
      text: 'Synthetic source.',
      inputMode: 'typed',
      privacy: 'normal',
      status: 'active',
      linkedReflectionIds: [],
      linkedAdventureIds: ['run_1']
    }];
    state.knowledgeGaps = [{
      id: 'gap_1',
      kind: 'curiosity',
      territoryIds: ['identity'],
      dimensionIds: ['self-description'],
      sourceEvidenceIds: [],
      sourceJournalEntryIds: ['journal_seed'],
      summary: 'Synthetic gap',
      status: 'seeded',
      priority: 5
    }];
    state.adventureSeeds = [{
      id: 'seed_1',
      sourceGapIds: ['gap_1'],
      kind: 'exploration-expedition',
      territoryId: 'identity',
      premise: 'Synthetic premise.',
      learningTarget: 'reflection-eligible',
      status: 'started'
    }];
    state.adventureRuns = [{
      id: 'run_1',
      seedId: 'seed_1',
      territoryId: 'identity',
      status: 'active',
      currentBeat: 'approach',
      characterIds: [],
      memoryIds: [],
      startedAt: '2026-01-01T00:00:02.000Z'
    }];
    state.adventureActions = [{
      id: 'action_1',
      runId: 'run_1',
      createdAt: '2026-01-01T00:00:03.000Z',
      kind: 'inspect',
      text: 'Look around.'
    }];
    state.adventureObservations = [{
      id: 'observation_1',
      runId: 'run_1',
      sourceActionIds: ['action_1'],
      observation: 'Synthetic observation.',
      status: 'unreflected'
    }];

    expect(createV2ProvenanceVisibility(state).adventureObservationIsEligible('observation_1')).toBe(true);

    state.journalEntries[0] = { ...state.journalEntries[0], status: 'retracted' };
    expect(createV2ProvenanceVisibility(state).adventureObservationIsEligible('observation_1')).toBe(false);
  });

  it('keeps historical M03 snapshots durable but ineligible when provenance was unknowable', () => {
    const state = baseState();
    state.atlasSnapshots = [{
      id: 'snapshot_legacy_assessment',
      createdAt: '2026-01-01T00:00:00.000Z',
      evidenceIds: [],
      insightIds: [],
      contradictionIds: [],
      synthesis: canonicalAssessment
    }];

    const visibility = createV2ProvenanceVisibility(state);
    expect(visibility.atlasSnapshotIsEligible('snapshot_legacy_assessment')).toBe(false);
    expect(state.atlasSnapshots).toHaveLength(1);
  });

  it('accepts a fully visible Snapshot and rejects it once one supporting evidence item becomes private', () => {
    const state = baseState();
    state.evidence = [evidence()];
    state.insights = [insight()];
    state.contradictions = [contradiction()];
    state.atlasSnapshots = [{
      id: 'snapshot_1',
      createdAt: '2026-01-01T00:00:00.000Z',
      evidenceIds: ['ev_visible'],
      insightIds: ['insight_1'],
      contradictionIds: ['contradiction_1'],
      synthesis: canonicalAssessment
    }];

    expect(createV2ProvenanceVisibility(state).atlasSnapshotIsEligible('snapshot_1')).toBe(true);

    state.privateTopics = ['identity-self-description'];
    expect(createV2ProvenanceVisibility(state).atlasSnapshotIsEligible('snapshot_1')).toBe(false);
  });

  it('fails closed for pattern provenance until RF07 defines its concrete source registry', () => {
    const state = baseState();
    state.evidence = [evidence()];
    state.reflections = [{
      id: 'reflection_pattern',
      sourceKind: 'pattern',
      sourceIds: ['ev_visible'],
      question: 'Synthetic pattern question?',
      response: '',
      epistemicStatus: 'pending',
      privacy: 'normal',
      recordStatus: 'active',
      createdAt: '2026-01-01T00:00:00.000Z'
    }];

    expect(createV2ProvenanceVisibility(state).reflectionIsEligible('reflection_pattern')).toBe(false);
  });

  it('keeps mixed-support memory as history but withholds its stored summary', () => {
    const state = baseState();
    state.journalEntries = [
      {
        id: 'journal_visible',
        createdAt: '2026-01-01T00:00:00.000Z',
        text: 'Visible synthetic source.',
        inputMode: 'typed',
        privacy: 'normal',
        status: 'active',
        linkedReflectionIds: [],
        linkedAdventureIds: []
      },
      {
        id: 'journal_private',
        createdAt: '2026-01-01T00:00:01.000Z',
        text: 'PRIVATE_MIXED_CANARY',
        inputMode: 'typed',
        privacy: 'private',
        status: 'active',
        linkedReflectionIds: [],
        linkedAdventureIds: []
      }
    ];
    state.adventureMemories = [{
      id: 'memory_mixed',
      type: 'event',
      summary: 'Summary may combine visible and private material.',
      triggerTerms: ['synthetic'],
      sourceIds: ['journal_visible', 'journal_private'],
      privacy: 'normal',
      status: 'active'
    }];

    const retired = retireIneligibleV2DerivedState(state);
    expect(retired.adventureMemories[0].status).toBe('active');
    expect(createV2ProvenanceVisibility(retired).adventureMemoryIsEligible('memory_mixed')).toBe(false);
  });

  it('retires an AdventureMemory with missing or ambiguous provenance rather than guessing', () => {
    const state = baseState();
    state.adventureMemories = [{
      id: 'memory_unknown',
      type: 'event',
      summary: 'Synthetic memory.',
      triggerTerms: ['synthetic'],
      sourceIds: ['missing_source'],
      privacy: 'normal',
      status: 'active'
    }];

    expect(retireIneligibleV2DerivedState(state).adventureMemories[0].status).toBe('retired');

    // Colliding IDs are also refused.
    state.journalEntries = [{
      id: 'collision',
      createdAt: '2026-01-01T00:00:00.000Z',
      text: 'Journal collision.',
      inputMode: 'typed',
      privacy: 'normal',
      status: 'active',
      linkedReflectionIds: [],
      linkedAdventureIds: []
    }];
    state.evidence = [evidence({ id: 'collision' })];
    state.adventureMemories[0] = { ...state.adventureMemories[0], id: 'memory_collision', sourceIds: ['collision'], status: 'active' };

    expect(createV2ProvenanceVisibility(state).sourceIdIsEligible('collision')).toBe(false);
    expect(retireIneligibleV2DerivedState(state).adventureMemories[0].status).toBe('retired');
  });
});
