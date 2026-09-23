import Dexie, { type Table } from 'dexie';
import type { CampaignState } from '../game/types';
import { migrateCampaign } from './migrations';

/**
 * IndexedDB may still contain a schema-v1 campaign from an older release.
 * Treat the stored payload as unknown until the migration boundary validates it.
 * Dexie's own store layout has not changed, so no Dexie database-version bump is
 * required for the campaign-data schema-v2 activation.
 */
interface CampaignRow { key: 'active'; state: unknown; }

class AtlasDatabase extends Dexie {
  campaigns!: Table<CampaignRow, 'active'>;
  constructor() { super('atlas-of-one'); this.version(1).stores({ campaigns: 'key' }); }
}

export const db = new AtlasDatabase();

export async function loadCampaign(): Promise<CampaignState | null> {
  const row = await db.campaigns.get('active');
  return row ? migrateCampaign(row.state) : null;
}

export async function saveCampaign(state: CampaignState): Promise<void> {
  await db.campaigns.put({ key: 'active', state });
}

export async function deleteCampaign(): Promise<void> {
  await db.campaigns.delete('active');
}
