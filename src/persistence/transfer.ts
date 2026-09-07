import type { CampaignState } from '../game/types';
import { migrateCampaign } from './migrations';
export function serializeCampaign(state: CampaignState): string { return JSON.stringify(state, null, 2); }
export function deserializeCampaign(raw: string): CampaignState { return migrateCampaign(JSON.parse(raw)); }
export function downloadCampaign(state: CampaignState): void {
  const blob = new Blob([serializeCampaign(state)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `atlas-of-one-${new Date().toISOString().slice(0, 10)}.atlas.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}
