import type { CampaignState } from '../game/types';
import { campaignStateSchemaV1 } from './schema';

export const CURRENT_SCHEMA_VERSION = 1;

/**
 * Fields added to schema v1 after its first release are additive and carry a Zod
 * `.default()`, so a campaign exported before they existed still parses and is
 * filled in with an empty, inert value. A change that alters or removes existing
 * v1 fields must instead raise CURRENT_SCHEMA_VERSION and add a branch below.
 */

export function migrateCampaign(input: unknown): CampaignState {
  if (!input || typeof input !== 'object') throw new Error('Campaign data is not an object.');
  const version = (input as { schemaVersion?: unknown }).schemaVersion;
  if (version === 1) return campaignStateSchemaV1.parse(input) as CampaignState;
  throw new Error(`Unsupported Atlas schemaVersion: ${String(version)}`);
}
