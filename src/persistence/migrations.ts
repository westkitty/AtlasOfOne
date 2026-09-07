import type { CampaignState } from '../game/types';
import { campaignStateSchemaV1 } from './schema';

export const CURRENT_SCHEMA_VERSION = 1;

export function migrateCampaign(input: unknown): CampaignState {
  if (!input || typeof input !== 'object') throw new Error('Campaign data is not an object.');
  const version = (input as { schemaVersion?: unknown }).schemaVersion;
  if (version === 1) return campaignStateSchemaV1.parse(input) as CampaignState;
  throw new Error(`Unsupported Atlas schemaVersion: ${String(version)}`);
}
