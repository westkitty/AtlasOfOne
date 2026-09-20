import Dexie, { type Table } from 'dexie';
import type { CampaignState } from '../game/types';
import { migrateCampaign } from './migrations';
interface CampaignRow { key: 'active'; state: unknown; }
class AtlasDatabase extends Dexie {
  campaigns!: Table<CampaignRow, 'active'>;
  /** The aggregate store and its key are unchanged; row migration needs no new Dexie store or index. */
  constructor() { super('atlas-of-one'); this.version(1).stores({ campaigns: 'key' }); }
}
export const db = new AtlasDatabase();
export async function loadCampaign(): Promise<CampaignState | null> {
  const row = await db.campaigns.get('active');
  if (!row) return null;
  // Parse, validate, and migrate entirely in memory before replacing a v1 row.
  const migrated = migrateCampaign(row.state);
  if (JSON.stringify(row.state) !== JSON.stringify(migrated)) {
    await db.campaigns.put({ key: 'active', state: migrated });
  }
  return migrated;
}
export async function saveCampaign(state: CampaignState): Promise<void> {
  await db.campaigns.put({ key: 'active', state: migrateCampaign(state) });
}
/** Safe import primitive for callers that replace the active aggregate. */
export async function replaceCampaignFromExport(raw: string): Promise<CampaignState> {
  const parsed = JSON.parse(raw) as unknown;
  const migrated = migrateCampaign(parsed);
  await db.campaigns.put({ key: 'active', state: migrated });
  return migrated;
}
export async function deleteCampaign(): Promise<void> { await db.campaigns.delete('active'); }
