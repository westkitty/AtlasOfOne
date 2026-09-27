import type { CampaignState, CampaignStateV1, PersistedAtlasSnapshot } from '../game/types';
import { campaignStateSchemaV1, campaignStateSchemaV2 } from './schema';
import { retireIneligibleV2State } from './retirement';

export const CURRENT_SCHEMA_VERSION = 2;

/**
 * Fields added to schema v1 after its first release are additive and carry a Zod
 * `.default()`, so a campaign exported before they existed still parses and is
 * filled in with an empty, inert value. A change that alters or removes existing
 * v1 fields must instead raise CURRENT_SCHEMA_VERSION and add a branch below.
 */

function historicalSnapshotFrom(legacy: CampaignStateV1): PersistedAtlasSnapshot | null {
  const assessment = legacy.finalAssessment;
  if (!assessment) return null;
  const historicalDomainSummaries: Record<string, string> = {
    identity: assessment.temperament.summary,
    values: assessment.valuesAndMorals.summary,
    politics: assessment.politicalAndIdeology.summary,
    relationships: assessment.relationshipsAndSocial.summary,
    cognition: assessment.cognitiveStyle.summary,
    interests: assessment.interestsAndPreferences.summary,
    fears: assessment.fearsAndHopes.summary,
    future: assessment.idealFutureAndAmbition.summary
  };
  return {
    id: `historical-snapshot__${assessment.id}`,
    createdAt: assessment.generatedAt,
    evidenceIds: legacy.evidence.map((evidence) => evidence.id),
    insightIds: legacy.insights.map((insight) => insight.id),
    contradictionIds: legacy.contradictions.map((contradiction) => contradiction.id),
    synthesis: {
      summary: assessment.whoIsGreyson,
      territorySummaries: legacy.territories.map((territory) => ({
        territoryId: territory.id,
        summary: historicalDomainSummaries[territory.id] ?? territory.label
      }))
    },
    provenance: { kind: 'legacy-final-assessment', sourceFinalAssessmentId: assessment.id },
    eligibility: 'historical-ineligible',
    legacyFinalAssessment: assessment
  };
}

/** Deterministic, side-effect-free conversion from a parsed v1 aggregate. */
export function migrateV1ToV2(legacy: CampaignStateV1): CampaignState {
  const historicalSnapshot = historicalSnapshotFrom(legacy);
  const migrated: CampaignState = {
    ...legacy,
    schemaVersion: 2,
    journalEntries: [], knowledgeGaps: [], reflections: [], adventureSeeds: [], adventureRuns: [],
    adventureActions: [], adventureObservations: [], adventureMemories: [],
    atlasSnapshots: historicalSnapshot ? [historicalSnapshot] : [], combatDefinitions: [], activeCombat: null, activeCombatRuntime: null
  };
  return campaignStateSchemaV2.parse(retireIneligibleV2State(migrated)) as CampaignState;
}

export function migrateCampaign(input: unknown): CampaignState {
  if (!input || typeof input !== 'object') throw new Error('Campaign data is not an object.');
  const version = (input as { schemaVersion?: unknown }).schemaVersion;
  if (version === 1) return migrateV1ToV2(campaignStateSchemaV1.parse(input) as CampaignStateV1);
  if (version === 2) return campaignStateSchemaV2.parse(retireIneligibleV2State(campaignStateSchemaV2.parse(input) as CampaignState)) as CampaignState;
  throw new Error(`Unsupported Atlas schemaVersion: ${String(version)}`);
}
