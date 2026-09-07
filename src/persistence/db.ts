import Dexie, { type Table } from 'dexie';
import type { CampaignState } from '../game/types';
import { migrateCampaign } from './migrations';
interface CampaignRow { key: 'active'; state: CampaignState; }
class AtlasDatabase extends Dexie {
  campaigns!: Table<CampaignRow, 'active'>;
  constructor() { super('atlas-of-one'); this.version(1).stores({ campaigns: 'key' }); }
}
export const db = new AtlasDatabase();
export async function loadCampaign(): Promise<CampaignState | null> { const row = await db.campaigns.get('active'); return row ? migrateCampaign(row.state) : null; }
export async function saveCampaign(state: CampaignState): Promise<void> { await db.campaigns.put({ key: 'active', state }); }
export async function deleteCampaign(): Promise<void> { await db.campaigns.delete('active'); }
