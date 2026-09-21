import { describe, expect, it } from 'vitest';
import { compileContext } from '../../src/cartographer/context';
import { compileFinalizeContext, generateLocalAssessment } from '../../src/cartographer/finalize';
import { reflectionPrivacyMask } from '../../src/reflection/privacy';
import { providerEligibleV2State, retireIneligibleV2State } from '../../src/persistence/retirement';
import { syntheticV2Campaign } from '../fixtures/persistence-v2';

const task = { territoryId: 'identity', dimension: 'synthetic-v2', question: 'Synthetic RF09 question?' };
const privateReflection = (sourceKind: 'journal' | 'adventure-observation' | 'insight' | 'contradiction' | 'snapshot', sourceIds: string[], id = `reflection_private_${sourceKind}`) => ({
  id,
  sourceKind,
  sourceIds,
  privacyRetiredSourceIds: [...sourceIds],
  question: 'Synthetic privacy reflection?',
  response: 'Synthetic private response.',
  createdAt: '2025-02-03T04:05:06.000Z',
  outcome: 'PRIVATE' as const
});

describe('RF09 Reflection PRIVATE structural propagation', () => {
  it('masks a private Journal by ID without deleting raw history, then retires exclusively dependent state', () => {
    const state = syntheticV2Campaign();
    const input = {
      ...state,
      reflections: [privateReflection('journal', ['journal_v2']), { ...state.reflections[0], sourceIds: ['journal_v2'] }],
      knowledgeGaps: [{ ...state.knowledgeGaps[0], sourceEvidenceIds: [], sourceJournalEntryIds: ['journal_v2'] }],
      adventureMemories: [{ ...state.adventureMemories[0], sourceIds: ['reflection_v2'] }]
    };
    const retired = retireIneligibleV2State(input);
    const eligible = providerEligibleV2State(input);

    expect(input.journalEntries[0].status).toBe('active');
    expect(input.journalEntries[0].text).toBe('Synthetic journal text.');
    expect(retired.knowledgeGaps[0].status).toBe('retired');
    expect(retired.adventureSeeds[0].status).toBe('retired');
    expect(retired.adventureMemories[0].status).toBe('retired');
    expect(eligible.journalEntryIds).not.toContain('journal_v2');
    expect(eligible.reflectionIds).not.toContain('reflection_v2');
  });

  it('preserves a mixed-support gap when one independent source remains eligible', () => {
    const state = syntheticV2Campaign();
    const retired = retireIneligibleV2State({
      ...state,
      reflections: [privateReflection('journal', ['journal_v2'])],
      knowledgeGaps: [{ ...state.knowledgeGaps[0], sourceEvidenceIds: ['evidence_v2'], sourceJournalEntryIds: ['journal_v2'] }]
    });
    expect(retired.knowledgeGaps[0].status).toBe('open');
  });

  it('propagates a private Journal transitively through gap -> seed -> run -> action -> observation -> reflection -> memory', () => {
    const state = syntheticV2Campaign();
    const observationReflection = {
      ...state.reflections[0],
      id: 'reflection_from_private_adventure',
      sourceKind: 'adventure-observation' as const,
      sourceIds: ['observation_v2']
    };
    const input = {
      ...state,
      reflections: [privateReflection('journal', ['journal_v2']), observationReflection],
      knowledgeGaps: [{ ...state.knowledgeGaps[0], sourceEvidenceIds: [], sourceJournalEntryIds: ['journal_v2'] }],
      adventureMemories: [
        { ...state.adventureMemories[0], id: 'memory_run', sourceIds: ['run_v2'] },
        { ...state.adventureMemories[0], id: 'memory_action', sourceIds: ['action_v2'] },
        { ...state.adventureMemories[0], id: 'memory_observation', sourceIds: ['observation_v2'] },
        { ...state.adventureMemories[0], id: 'memory_reflection', sourceIds: ['reflection_from_private_adventure'] }
      ]
    };

    const retired = retireIneligibleV2State(input);
    const eligible = providerEligibleV2State(input);

    expect(input.adventureRuns[0].id).toBe('run_v2');
    expect(input.adventureActions[0].id).toBe('action_v2');
    expect(input.adventureObservations[0].id).toBe('observation_v2');
    expect(retired.adventureSeeds[0].status).toBe('retired');
    expect(eligible.adventureObservationIds).not.toContain('observation_v2');
    expect(eligible.reflectionIds).not.toContain('reflection_from_private_adventure');
    expect(retired.adventureMemories.map((memory) => memory.status)).toEqual(['retired', 'retired', 'retired', 'retired']);
  });

  it('fails closed on broken observation provenance and provenance-free memories while preserving a valid unmasked chain', () => {
    const state = syntheticV2Campaign();
    const valid = retireIneligibleV2State(state);
    const validEligible = providerEligibleV2State(state);
    expect(validEligible.adventureObservationIds).toContain('observation_v2');
    expect(valid.adventureMemories[0].status).toBe('active');

    const malformed = {
      ...state,
      adventureObservations: [{ ...state.adventureObservations[0], sourceActionIds: ['missing_action'] }],
      reflections: [{ ...state.reflections[0], id: 'reflection_bad_observation', sourceKind: 'adventure-observation' as const, sourceIds: ['observation_v2'] }],
      adventureMemories: [
        { ...state.adventureMemories[0], id: 'memory_bad_observation', sourceIds: ['reflection_bad_observation'] },
        { ...state.adventureMemories[0], id: 'memory_no_provenance', sourceIds: [] }
      ]
    };
    const retired = retireIneligibleV2State(malformed);
    const eligible = providerEligibleV2State(malformed);
    expect(eligible.adventureObservationIds).not.toContain('observation_v2');
    expect(eligible.reflectionIds).not.toContain('reflection_bad_observation');
    expect(retired.adventureMemories.map((memory) => memory.status)).toEqual(['retired', 'retired']);
  });

  it('withholds a private AdventureObservation and retires its reflection-backed memory without changing raw observation history', () => {
    const state = syntheticV2Campaign();
    const input = {
      ...state,
      reflections: [privateReflection('adventure-observation', ['observation_v2']), { ...state.reflections[0], id: 'reflection_observation', sourceKind: 'adventure-observation' as const, sourceIds: ['observation_v2'] }],
      adventureMemories: [{ ...state.adventureMemories[0], sourceIds: ['reflection_observation'] }]
    };
    const retired = retireIneligibleV2State(input);
    const eligible = providerEligibleV2State(input);
    expect(input.adventureObservations[0].observation).toContain('fictional synthetic');
    expect(eligible.adventureObservationIds).not.toContain('observation_v2');
    expect(eligible.reflectionIds).not.toContain('reflection_observation');
    expect(retired.adventureMemories[0].status).toBe('retired');
  });

  it('withholds a private Insight from provider, turn context, finalize context and local inference while keeping raw history', () => {
    const canary = 'RF09_PRIVATE_INSIGHT_CANARY_4fae';
    const state = syntheticV2Campaign();
    const input = {
      ...state,
      insights: [{ ...state.insights[0], title: canary, summary: canary }],
      reflections: [privateReflection('insight', ['insight_v2'])],
      atlasSnapshots: [{ ...state.atlasSnapshots[0], evidenceIds: [], insightIds: ['insight_v2'], contradictionIds: [] }],
      adventureMemories: [{ ...state.adventureMemories[0], sourceIds: ['snapshot_v2'] }]
    };
    const retired = retireIneligibleV2State(input);
    const eligible = providerEligibleV2State(input);
    expect(input.insights[0].summary).toBe(canary);
    expect(eligible.insightIds).not.toContain('insight_v2');
    expect(retired.atlasSnapshots[0].eligibility).toBe('retired');
    expect(retired.adventureMemories[0].status).toBe('retired');
    for (const output of [compileContext(input, task, 'Synthetic answer.'), compileFinalizeContext(input), generateLocalAssessment(input)]) {
      expect(JSON.stringify(output)).not.toContain(canary);
    }
  });

  it('withholds a private Contradiction from provider, turn context, finalization and local synthesis', () => {
    const canary = 'RF09_PRIVATE_CONTRADICTION_CANARY_b913';
    const state = syntheticV2Campaign();
    const input = {
      ...state,
      contradictions: [{ ...state.contradictions[0], claim: canary }],
      reflections: [privateReflection('contradiction', ['contradiction_v2'])],
      atlasSnapshots: [{ ...state.atlasSnapshots[0], evidenceIds: [], insightIds: [], contradictionIds: ['contradiction_v2'] }],
      adventureMemories: [{ ...state.adventureMemories[0], sourceIds: ['snapshot_v2'] }]
    };
    const retired = retireIneligibleV2State(input);
    const eligible = providerEligibleV2State(input);
    expect(input.contradictions[0].claim).toBe(canary);
    expect(eligible.contradictionIds).not.toContain('contradiction_v2');
    expect(retired.atlasSnapshots[0].eligibility).toBe('retired');
    expect(retired.adventureMemories[0].status).toBe('retired');
    for (const output of [compileContext(input, task, 'Synthetic answer.'), compileFinalizeContext(input), generateLocalAssessment(input)]) {
      expect(JSON.stringify(output)).not.toContain(canary);
    }
  });

  it('retires a PRIVATE snapshot and its dependents, while an unmasked eligible snapshot may support a memory', () => {
    const state = syntheticV2Campaign();
    const privateInput = {
      ...state,
      reflections: [privateReflection('snapshot', ['snapshot_v2']), { ...state.reflections[0], sourceKind: 'snapshot' as const, sourceIds: ['snapshot_v2'] }],
      adventureMemories: [{ ...state.adventureMemories[0], sourceIds: ['reflection_v2'] }]
    };
    const privateRetired = retireIneligibleV2State(privateInput);
    expect(privateInput.atlasSnapshots[0].synthesis.summary).toBe('Synthetic snapshot.');
    expect(privateRetired.atlasSnapshots[0].eligibility).toBe('retired');
    expect(providerEligibleV2State(privateInput).atlasSnapshots).toEqual([]);
    expect(privateRetired.adventureMemories[0].status).toBe('retired');

    const supported = retireIneligibleV2State({ ...state, adventureMemories: [{ ...state.adventureMemories[0], sourceIds: ['snapshot_v2'] }] });
    expect(supported.atlasSnapshots[0].eligibility).toBe('eligible');
    expect(supported.adventureMemories[0].status).toBe('active');
  });

  it('propagates Journal retraction through Reflection eligibility without needing a PRIVATE Reflection', () => {
    const state = syntheticV2Campaign();
    const retired = retireIneligibleV2State({
      ...state,
      journalEntries: [{ ...state.journalEntries[0], status: 'retracted' as const }],
      adventureMemories: [{ ...state.adventureMemories[0], sourceIds: ['reflection_v2'] }]
    });
    expect(retired.adventureMemories[0].status).toBe('retired');
  });

  it('fails closed on mismatched PRIVATE source sets and never treats matching prose as authority', () => {
    const state = syntheticV2Campaign();
    const canary = 'RF09_PROSE_IS_NOT_AUTHORITY_77ab';
    const malformed = privateReflection('journal', ['journal_v2'], 'reflection_private_malformed');
    malformed.privacyRetiredSourceIds = ['journal_other'];
    const input = {
      ...state,
      journalEntries: [
        { ...state.journalEntries[0], id: 'journal_v2', text: canary },
        { ...state.journalEntries[0], id: 'journal_other', text: 'Different synthetic prose.' },
        { ...state.journalEntries[0], id: 'journal_unmasked', text: canary }
      ],
      reflections: [malformed]
    };
    const firstMask = reflectionPrivacyMask(input);
    const secondMask = reflectionPrivacyMask(input);
    firstMask.journalIds.add('mutated_test_value');
    expect(secondMask.journalIds).toEqual(new Set(['journal_v2', 'journal_other']));
    const eligible = providerEligibleV2State(input);
    expect(eligible.journalEntryIds).toContain('journal_unmasked');
    expect(eligible.journalEntryIds).not.toContain('journal_v2');
    expect(eligible.journalEntryIds).not.toContain('journal_other');
  });
});
