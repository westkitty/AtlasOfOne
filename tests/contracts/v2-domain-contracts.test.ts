import { describe, expect, expectTypeOf, it } from 'vitest';
import { COMBAT_COMMAND_KINDS, FORBIDDEN_LANE_MUTATIONS, FORBIDDEN_PROVIDER_PROPOSAL_FIELDS, type AdventureObservation, type AdventureSeed, type AdventureTemplate, type ProviderProposal, type ReflectionOutcome, type ReflectionRecord } from '../../src/contracts';
import { PROVIDER_EVENT_TYPES } from '../../src/cartographer/apply';
import type { EvidenceRecord } from '../../src/game/types';
import { CURRENT_SCHEMA_VERSION } from '../../src/persistence/migrations';

describe('Wave-1 v2 domain interface freeze', () => {
  it('keeps fictional observations structurally distinct from evidence', () => {
    expectTypeOf<AdventureObservation>().not.toMatchTypeOf<EvidenceRecord>();
    const observation: AdventureObservation = {
      id: 'observation_synthetic', runId: 'run_synthetic', sourceActionIds: ['action_synthetic'],
      observation: 'A fictional guard action occurred.', status: 'unreflected'
    };
    expect(observation).toMatchObject({ runId: 'run_synthetic', status: 'unreflected' });
    expect(observation).not.toHaveProperty('sourceTurnIds');
  });

  it('represents every human reflection outcome, including revision and privacy', () => {
    const outcomes: ReflectionOutcome[] = ['CONFIRM', 'PARTIAL', 'REJECT', 'UNCERTAIN', 'REVISE', 'PRIVATE'];
    const records: ReflectionRecord[] = outcomes.map((outcome) => ({
      id: `reflection_${outcome}`, sourceKind: 'journal', sourceIds: ['journal_synthetic'],
      question: 'Synthetic reflection?', response: 'Synthetic response.', createdAt: '2026-01-01T00:00:00.000Z', outcome,
      ...(outcome === 'REVISE' ? { revisionTargetId: 'evidence_synthetic' } : {}),
      ...(outcome === 'PRIVATE' ? { privacyRetiredSourceIds: ['journal_synthetic'] } : {})
    }));
    expect(records.map((record) => record.outcome)).toEqual(outcomes);
  });

  it('supports pure-fun seeds without a learning claim', () => {
    const seed: AdventureSeed = {
      id: 'seed_fun', sourceGapIds: [], kind: 'pure-fun-wildcard', territoryId: 'interests',
      locationId: 'atelier', premise: 'A synthetic absurd errand.', learningTarget: 'none', status: 'available'
    };
    expect(seed.learningTarget).toBe('none');
  });

  it('preserves the frozen AdventureTemplate beat semantics', () => {
    const template: AdventureTemplate = {
      id: 'template_synthetic', kind: 'investigation', validTerritories: ['interests'],
      learningTarget: 'reflection-eligible', requiredInputs: ['premise'],
      beats: [{ id: 'hook', role: 'hook', required: true, allowedEncounterKinds: ['none', 'social'], exits: ['approach'] }],
      withdrawalAllowed: true, memoryOutputs: ['event'], reflectionFormId: 'reflection_synthetic', cooldownClass: 'ordinary'
    };
    expect(template.beats[0]).toMatchObject({ required: true, exits: ['approach'] });
    expect(template.beats[0].allowedEncounterKinds).toEqual(['none', 'social']);
  });

  it('freezes the five permanent combat commands exactly', () => {
    expect(COMBAT_COMMAND_KINDS).toEqual(['ATTACK', 'TECHNIQUE', 'GUARD', 'ACT', 'LEAVE']);
  });

  it('makes provider output proposal-only at compile time and runtime', () => {
    const proposal: ProviderProposal = { mode: 'combat-narration', narration: 'Synthetic battle description.', actWording: 'Offer a truce.' };
    // @ts-expect-error Provider proposals cannot carry authoritative progression.
    const invalidProposal: ProviderProposal = { mode: 'combat-narration', narration: 'No.', xp: 99 };
    const authoritativeVariable = { mode: 'combat-narration' as const, narration: 'No.', xp: 99 };
    // @ts-expect-error Extra authoritative fields remain forbidden even through a variable.
    const invalidVariableProposal: ProviderProposal = authoritativeVariable;
    void invalidProposal;
    void invalidVariableProposal;
    for (const field of FORBIDDEN_PROVIDER_PROPOSAL_FIELDS) expect(proposal).not.toHaveProperty(field);
  });

  it('preserves the existing Cartographer authority crossing and schema version', () => {
    expect(PROVIDER_EVENT_TYPES).toEqual(['ANSWER_ACCEPTED', 'EVIDENCE_ADDED', 'INSIGHT_ADDED']);
    expect(FORBIDDEN_LANE_MUTATIONS).toContain('XP_AWARDED');
    expect(CURRENT_SCHEMA_VERSION).toBe(2);
  });
});
