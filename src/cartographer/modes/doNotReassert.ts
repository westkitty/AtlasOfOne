import type { CampaignState } from '../../game/types';
import { selectRejectedInterpretations } from '../../reflection/antiRepeat';
import { clipText, takeWithinBudget } from './budget';

export interface DoNotReassertItem {
  id: string;
  text: string;
}

/**
 * RF04 rejected interpretations for Reflection/Snapshot contexts. Visibility
 * is already enforced by `selectRejectedInterpretations` (PRIVATE/retracted
 * sources contribute no text, id or count). These IDs are NOT citable
 * provenance: they are returned separately from each context's allow-list.
 */
export function compileDoNotReassert(
  state: CampaignState,
  maxItems: number,
  maxChars: number,
  budget: { remaining: number }
): DoNotReassertItem[] {
  const items = selectRejectedInterpretations(state).map((item) => ({
    id: item.id,
    text: clipText(item.text, maxChars)
  }));
  return takeWithinBudget(items, maxItems, budget, (item) => item.text.length);
}
