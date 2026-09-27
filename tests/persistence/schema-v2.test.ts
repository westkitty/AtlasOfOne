import { describe, expect, expectTypeOf, it } from 'vitest';
import { providerEligibleV2State, retireIneligibleV2State } from '../../src/persistence/retirement';
import { CURRENT_SCHEMA_VERSION, migrateCampaign, migrateV1ToV2 } from '../../src/persistence/migrations';
import { campaignStateSchemaV1 } from '../../src/persistence/schema';
import { deserializeCampaign, serializeCampaign } from '../../src/persistence/transfer';
import type { AdventureObservation } from '../../src/contracts/adventure';
import type { EvidenceRecord } from '../../src/game/types';
import { canonicalV1Fixtures, cloneV1Fixture } from '../fixtures/persistence-v1';
import { syntheticV2Campaign } from '../fixtures/persistence-v2';

describe('M00-M06 schema-v2 migration foundation', () => {
  it('validates every canonical synthetic v1 export against the real v1 schema', () => {
    for (const fixture of Object.values(canonicalV1Fixtures)) expect(campaignStateSchemaV1.safeParse(fixture).success).toBe(true);
  });

  it('migrates every canonical v1 fixture to durable v2', () => {
    for (const name of Object.keys(canonicalV1Fixtures) as Array<keyof typeof canonicalV1Fixtures>) {
      const migrated = migrateCampaign(cloneV1Fixture(name));
      expect(migrated.schemaVersion).toBe(2);
      expect(migrated.journalEntries).toEqual([]);
      expect(migrated.combatDefinitions).toEqual([]);
    }
  });

  it('is deterministic and does not mutate its v1 input', () => {
    const source = cloneV1Fixture('withAssessment');
    const before = structuredClone(source);
    expect(migrateV1ToV2(source)).toEqual(migrateV1ToV2(source));
    expect(source).toEqual(before);
  });

  it('preserves protected v1 state semantically', () => {
    const source = cloneV1Fixture('mature');
    const migrated = migrateCampaign(source);
    expect(migrated.turns).toEqual(source.turns);
    expect(migrated.evidence).toEqual(source.evidence);
    expect(migrated.insights).toEqual(source.insights);
    expect(migrated.contradictions).toEqual(source.contradictions);
    expect(migrated.bossRuns).toEqual(source.bossRuns);
    expect(migrated.doorRuns).toEqual(source.doorRuns);
    expect(migrated.worldJourney).toEqual(source.worldJourney);
    expect(migrated.settings).toEqual(source.settings);
    expect(migrated.xp).toBe(source.xp);
    expect(migrated.level).toBe(source.level);
    expect(migrated.campaignCompleted).toBe(source.campaignCompleted);
  });

  it('preserves a legacy FinalAssessment as a historical, ineligible snapshot', () => {
    const source = cloneV1Fixture('withAssessment');
    const migrated = migrateCampaign(source);
    expect(migrated.finalAssessment).toEqual(source.finalAssessment);
    expect(migrated.atlasSnapshots).toHaveLength(1);
    expect(migrated.atlasSnapshots[0]).toMatchObject({
      provenance: { kind: 'legacy-final-assessment', sourceFinalAssessmentId: source.finalAssessment!.id },
      eligibility: 'historical-ineligible', legacyFinalAssessment: source.finalAssessment
    });
    expect(migrated.atlasSnapshots[0].synthesis.summary).toBe(source.finalAssessment!.whoIsGreyson);
    expect(migrated.atlasSnapshots[0].synthesis.territorySummaries.find((item) => item.territoryId === 'values')?.summary)
      .toBe(source.finalAssessment!.valuesAndMorals.summary);
  });

  it('accepts v2 directly, rejects malformed inputs, and rejects future versions', () => {
    const v2 = syntheticV2Campaign();
    expect(migrateCampaign(v2)).toEqual(v2);
    expect(() => migrateCampaign({ ...v2, journalEntries: 'invalid' })).toThrow();
    expect(() => migrateCampaign({ ...v2, schemaVersion: 99 })).toThrow(/Unsupported/);
    expect(() => migrateCampaign({ schemaVersion: 1, xp: 'invalid' })).toThrow();
    expect(CURRENT_SCHEMA_VERSION).toBe(2);
  });

  it('round-trips v2 and v1-through-v2 transfer exports', () => {
    const v2 = syntheticV2Campaign();
    expect(deserializeCampaign(serializeCampaign(v2))).toEqual(v2);
    const fromV1 = deserializeCampaign(JSON.stringify(cloneV1Fixture('mature')));
    const reloaded = deserializeCampaign(serializeCampaign(fromV1));
    expect(reloaded.turns).toEqual(fromV1.turns);
    expect(reloaded.worldJourney).toEqual(fromV1.worldJourney);
    expect(reloaded.schemaVersion).toBe(2);
  });

  it('retires only v2 state supported solely by private provenance', () => {
    const state = syntheticV2Campaign();
    const privateState = {
      ...state,
      journalEntries: [{ ...state.journalEntries[0], id: 'journal_private', text: 'synthetic-private-canary-7d93', privacy: 'private' as const }],
      knowledgeGaps: [{ ...state.knowledgeGaps[0], sourceEvidenceIds: [], sourceJournalEntryIds: ['journal_private'] }],
      adventureSeeds: [{ ...state.adventureSeeds[0], sourceGapIds: ['gap_v2'] }],
      adventureMemories: [{ ...state.adventureMemories[0], sourceIds: ['journal_private'], summary: 'synthetic-private-canary-7d93' }]
    };
    const retired = retireIneligibleV2State(privateState);
    const providerState = providerEligibleV2State(retired);
    expect(retired.knowledgeGaps[0].status).toBe('retired');
    expect(retired.adventureSeeds[0].status).toBe('retired');
    expect(retired.adventureMemories[0].status).toBe('retired');
    expect(JSON.stringify(providerState)).not.toContain('synthetic-private-canary-7d93');
  });

  it('retires retracted-only support but preserves mixed eligible provenance', () => {
    const state = syntheticV2Campaign();
    const retractedOnly = retireIneligibleV2State({
      ...state,
      journalEntries: [{ ...state.journalEntries[0], status: 'retracted' }],
      knowledgeGaps: [{ ...state.knowledgeGaps[0], sourceEvidenceIds: [], sourceJournalEntryIds: ['journal_v2'] }]
    });
    expect(retractedOnly.knowledgeGaps[0].status).toBe('retired');

    const mixed = retireIneligibleV2State({
      ...state,
      journalEntries: [{ ...state.journalEntries[0], status: 'retracted' }, { ...state.journalEntries[0], id: 'journal_eligible', text: 'Synthetic eligible journal.' }],
      knowledgeGaps: [{ ...state.knowledgeGaps[0], sourceEvidenceIds: [], sourceJournalEntryIds: ['journal_v2', 'journal_eligible'] }]
    });
    expect(mixed.knowledgeGaps[0].status).toBe('open');
  });

  it('keeps v2 provider eligibility aligned with conservative evidence provenance', () => {
    const state = syntheticV2Campaign();
    const privateEvidence = {
      ...state.evidence[0],
      id: 'evidence_private_v2',
      dimension: 'synthetic-private-dimension',
      claim: 'synthetic-private-canary-7d93'
    };
    const mixed = {
      ...state,
      privateTopics: ['synthetic-private-dimension'],
      evidence: [state.evidence[0], privateEvidence],
      insights: [{ ...state.insights[0], evidenceIds: ['evidence_v2', 'evidence_private_v2'] }],
      contradictions: [{ ...state.contradictions[0], evidenceIds: ['evidence_v2', 'evidence_private_v2'] }]
    };
    const eligible = providerEligibleV2State(mixed);
    expect(eligible.insightIds).not.toContain('insight_v2');
    expect(eligible.contradictionIds).not.toContain('contradiction_v2');
    expect(JSON.stringify(eligible)).not.toContain('synthetic-private-canary-7d93');
  });

  it('retires a memory when its reflection source becomes private', () => {
    const state = syntheticV2Campaign();
    const privateReflectionState = {
      ...state,
      journalEntries: [{ ...state.journalEntries[0], privacy: 'private' as const }],
      adventureMemories: [{ ...state.adventureMemories[0], sourceIds: ['reflection_v2'] }]
    };
    const retired = retireIneligibleV2State(privateReflectionState);
    expect(retired.adventureMemories[0].status).toBe('retired');
    expect(providerEligibleV2State(retired).adventureMemories).toEqual([]);
  });

  it('keeps fictional observations structurally separate from evidence', () => {
    expectTypeOf<AdventureObservation>().not.toExtend<EvidenceRecord>();
  });
});
