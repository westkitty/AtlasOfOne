import type { CampaignState } from '../game/types';
import { campaignStateSchemaV1 } from './schema';
import { campaignStateSchemaV2 } from './schema-v2';

export const CURRENT_SCHEMA_VERSION = 2;

/**
 * Schema v1 remains frozen historical input authority.
 *
 * Every v1 payload is validated and normalized by the v1 parser first. Migration
 * then changes only the version discriminator and introduces the inert v2
 * collections. M03+ own semantic transformations such as FinalAssessment ->
 * historical Snapshot; M02 deliberately preserves that legacy field unchanged.
 */
export function migrateV1ToV2(input: unknown): CampaignState {
  const v1 = campaignStateSchemaV1.parse(input);
  return campaignStateSchemaV2.parse({
    ...v1,
    schemaVersion: 2
  }) as CampaignState;
}

export function migrateCampaign(input: unknown): CampaignState {
  if (!input || typeof input !== 'object') throw new Error('Campaign data is not an object.');
  const version = (input as { schemaVersion?: unknown }).schemaVersion;
  if (version === 1) return migrateV1ToV2(input);
  if (version === 2) return campaignStateSchemaV2.parse(input) as CampaignState;
  throw new Error(`Unsupported Atlas schemaVersion: ${String(version)}`);
}
