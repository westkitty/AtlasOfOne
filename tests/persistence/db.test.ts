import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { createInitialCampaign } from '../../src/game/engine';
import { deleteCampaign, loadCampaign, saveCampaign } from '../../src/persistence/db';
afterEach(async()=>{await deleteCampaign();});
describe('IndexedDB persistence',()=>{it('saves restores and deletes active campaign',async()=>{const state=createInitialCampaign();await saveCampaign(state);expect(await loadCampaign()).toEqual(state);await deleteCampaign();expect(await loadCampaign()).toBeNull();});});
