import type { CampaignState } from '../game/types';
import { campaignStateSchemaV1 } from './schema';
import { campaignStateSchemaV2 } from './schema-v2';

export const CURRENT_SCHEMA_VERSION = 2;

/**
 * Schema v1 remains frozen historical input authority.
 *
 * Every v1 payload is validated and normalized by the v1 parser first. Migration
 * then raises the version discriminator, introduces the v2 collections, and
 * preserves any legacy FinalAssessment as an immutable historical Snapshot.
 *
 * v1 never recorded the exact evidence/insight/contradiction IDs that fed an old
 * FinalAssessment. The historical Snapshot therefore carries empty provenance
 * ID arrays rather than fabricating links that cannot be proven.
 */
export function migrateV1ToV2(input: unknown): CampaignState {
  const v1 = campaignStateSchemaV1.parse(input);
  const atlasSnapshots = v1.finalAssessment
    ? [{
        id: `snapshot_legacy_${v1.finalAssessment.id}`,
        createdAt: v1.finalAssessment.generatedAt,
        evidenceIds: [],
        insightIds: [],
        contradictionIds: [],
        synthesis: v1.finalAssessment
      }]
    : [];

  return campaignStateSchemaV2.parse({
    ...v1,
    schemaVersion: 2,
    atlasSnapshots
  }) as CampaignState;
}

export function migrateCampaign(input: unknown): CampaignState {
  if (!input || typeof input !== 'object') throw new Error('Campaign data is not an object.');
  const version = (input as { schemaVersion?: unknown }).schemaVersion;
  if (version === 1) return migrateV1ToV2(input);
  if (version === 2) return campaignStateSchemaV2.parse(input) as CampaignState;
  throw new Error(`Unsupported Atlas schemaVersion: ${String(version)}`);
}
