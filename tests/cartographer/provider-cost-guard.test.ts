import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { simpleScriptedPlayer } from '../../src/combat/content/scriptedPlayer';
import { ENCOUNTER_BANK } from '../../src/combat/content/encounters';
import {
  MECHANICS_OPERATIONS,
  NARRATIVE_FALLBACK,
  NARRATIVE_PROVIDER_OPERATIONS,
  consumeProviderQuota,
  providerCallAllowed
} from '../../src/cartographer/modes/providerPolicy';
import { createInitialCampaign } from '../../src/game/engine';
import type { CampaignState } from '../../src/game/types';
import { appendJournalEntry, createJournalEntry } from '../../src/journal/domain';
import { privatizeJournalEntry } from '../../src/journal/privacy';
import { decideReflection } from '../../src/reflection/domain';
import { applyReflectionEvidence, retireReflectionEvidence } from '../../src/slice/evidence';
import {
  exploreJournalEntry,
  makeSliceChoice,
  playSliceCombatRound,
  startSliceAdventure,
  withdrawSliceAdventure
} from '../../src/slice/loop';

const T = (m: number) => `2026-08-01T10:${String(m).padStart(2, '0')}:00.000Z`;

let fetchCalls = 0;
beforeEach(() => {
  fetchCalls = 0;
  vi.stubGlobal('fetch', (...args: unknown[]) => {
    fetchCalls += 1;
    throw new Error(`Mechanics path attempted a network call: ${String(args[0])}`);
  });
});
afterEach(() => vi.unstubAllGlobals());

describe('P12 providerCallAllowed policy', () => {
  it('allows only narrative operations with remaining quota', () => {
    for (const op of NARRATIVE_PROVIDER_OPERATIONS) {
      expect(providerCallAllowed(op, { used: 0, limit: 3 })).toBe(true);
      expect(providerCallAllowed(op, { used: 3, limit: 3 })).toBe(false);
      expect(providerCallAllowed(op, { used: 0, limit: 0 })).toBe(false);
      expect(NARRATIVE_FALLBACK[op]).toBeTruthy();
    }
  });

  it('never allows a mechanics operation, even with unlimited quota', () => {
    for (const op of MECHANICS_OPERATIONS) {
      expect(providerCallAllowed(op, { used: 0, limit: 1_000_000 })).toBe(false);
    }
    expect(providerCallAllowed('unknown-op', { used: 0, limit: 10 })).toBe(false);
  });

  it('fails closed on malformed quota and consume never exceeds limit', () => {
    for (const quota of [{ used: -1, limit: 3 }, { used: 0.5, limit: 3 }, { used: Number.NaN, limit: 3 }, { used: 0, limit: -1 }]) {
      expect(providerCallAllowed('adventure-scene', quota)).toBe(false);
    }
    let quota = { used: 0, limit: 2 };
    quota = consumeProviderQuota(consumeProviderQuota(consumeProviderQuota(quota)));
    expect(quota).toEqual({ used: 2, limit: 2 });
    expect(providerCallAllowed('journal-acknowledgement', quota)).toBe(false);
  });

  it('narrative and mechanics sets are disjoint', () => {
    const narrative = new Set<string>(NARRATIVE_PROVIDER_OPERATIONS);
    expect(MECHANICS_OPERATIONS.filter((op) => narrative.has(op))).toEqual([]);
  });
});

describe('P12 mechanics never require a provider', () => {
  function journalState(): CampaignState {
    const entry = createJournalEntry({ id: 'journal_1', createdAt: T(0), text: 'Synthetic entry.', inputMode: 'typed' });
    return { ...createInitialCampaign(), journalEntries: appendJournalEntry([], entry) };
  }

  it('full slice adventure + combat + Reflection + Evidence runs with fetch forbidden', () => {
    let state = exploreJournalEntry(journalState(), {
      journalEntryId: 'journal_1', territoryId: 'identity', gapId: 'gap_1', seedId: 'seed_1', now: T(1)
    }).state;
    state = startSliceAdventure(state, { seedId: 'seed_1', runId: 'run_1', now: T(2) });
    let sawCombat = false;
    for (let i = 0; i < 40 && state.adventureRuns[0].status === 'active'; i += 1) {
      if (state.activeCombat) {
        sawCombat = true;
        const def = ENCOUNTER_BANK.find((d) => d.id === state.activeCombat!.definitionId)!;
        state = playSliceCombatRound(state, { intent: simpleScriptedPlayer(def, state.activeCombat.state as never), now: T(3), consequenceActionId: `c${i}` });
      } else {
        state = makeSliceChoice(state, { runId: 'run_1', label: 'Go on', now: T(3), actionId: `a${i}`, observationId: `o${i}`, combatId: `k${i}` });
      }
    }
    expect(state.adventureRuns[0].status).toBe('complete');
    expect(sawCombat).toBe(true);
    expect(state.reflections).toHaveLength(1);

    const decided = state.reflections.map((r) => decideReflection(r, 'confirm', 'I like fixing things.'));
    state = applyReflectionEvidence({ ...state, reflections: decided }, { reflectionId: decided[0].id, evidenceId: 'evidence_1' });
    expect(state.evidence.some((e) => e.id === 'evidence_1')).toBe(true);
    state = retireReflectionEvidence(privatizeJournalEntry(state, 'journal_1', T(4)));

    expect(fetchCalls).toBe(0);
  });

  it('withdrawal runs with fetch forbidden', () => {
    let state = exploreJournalEntry(journalState(), {
      journalEntryId: 'journal_1', territoryId: 'identity', gapId: 'gap_1', seedId: 'seed_1', now: T(1)
    }).state;
    state = startSliceAdventure(state, { seedId: 'seed_1', runId: 'run_1', now: T(2) });
    state = withdrawSliceAdventure(state, { runId: 'run_1', now: T(3) });
    expect(state.adventureRuns[0].status).toBe('withdrawn');
    expect(fetchCalls).toBe(0);
  });
});
