import { describe, expect, it } from 'vitest';
import { createAdventureMemory } from '../../src/adventure/memory/records';
import type { AdventureAction, AdventureRun, AdventureSeed } from '../../src/adventure/schema';
import { parseAdventureSceneProposalForContext } from '../../src/cartographer/adventureSceneProposal';
import {
  MODE_CONTEXT_BUDGET,
  compileAdventureSceneModeContext,
  compileJournalModeContext,
  compileReflectionModeContext,
  compileSnapshotModeContext,
  serializeModeContext
} from '../../src/cartographer/modes';
import { parseReflectionProposalForContext } from '../../src/cartographer/reflectionProposal';
import { parseSnapshotProposalForContext } from '../../src/cartographer/snapshotProposal';
import { createInitialCampaign } from '../../src/game/engine';
import type { CampaignState, EvidenceRecord, InsightRecord } from '../../src/game/types';
import { createJournalEntry } from '../../src/journal/domain';
import type { KnowledgeGap } from '../../src/knowledge/schema';
import { createReflectionRecord, decideReflection } from '../../src/reflection/domain';

/** Every PRIVATE/retracted/ineligible record carries CANARY in both its ID and its text. */
const CANARY = 'CANARY';
const T = (m: number) => `2026-07-01T10:${String(m).padStart(2, '0')}:00.000Z`;

const journal = (id: string, text: string, m: number, extra: Partial<{ privacy: 'private'; status: 'retracted' }> = {}) =>
  ({ ...createJournalEntry({ id, createdAt: T(m), text, inputMode: 'typed' }), ...extra });

const gap = (id: string, journalId: string, summary: string): KnowledgeGap => ({
  id, kind: 'curiosity', territoryIds: ['identity'], dimensionIds: ['strengths'],
  sourceEvidenceIds: [], sourceJournalEntryIds: [journalId], summary, status: 'open', priority: 1
});

const evidence = (id: string, dimension: string, claim: string, status: EvidenceRecord['status'] = 'active'): EvidenceRecord => ({
  id, dimension, claim, sourceTurnIds: [], basis: 'explicit', strength: 2, territories: ['identity'],
  counterEvidenceIds: [], status, origin: 'player-stated'
});

const insight = (id: string, title: string, evidenceIds: string[], status: InsightRecord['status']): InsightRecord => ({
  id, title, summary: title, evidenceIds, confidence: 'moderate', status, createdAt: T(1)
});

const reflection = (id: string, sourceIds: string[], interpretation: string, decision: 'confirm' | 'reject', m: number) =>
  decideReflection(
    createReflectionRecord({ id, sourceKind: 'journal', sourceIds, question: `Question ${id}?`, interpretation, createdAt: T(m) }),
    decision,
    'Synthetic response.'
  );

const seed = (id: string, gapId: string, premise: string): AdventureSeed => ({
  id, sourceGapIds: [gapId], kind: 'investigation', territoryId: 'identity', premise,
  learningTarget: 'reflection-eligible', status: 'started'
});

const run = (id: string, seedId: string): AdventureRun => ({
  id, seedId, territoryId: 'identity', status: 'active', currentBeat: 'approach',
  characterIds: ['npc_ferry'], memoryIds: [], startedAt: T(2)
});

const action = (id: string, runId: string, text: string, m: number): AdventureAction =>
  ({ id, runId, createdAt: T(m), kind: 'do', text });

function fixture(): CampaignState {
  const base = createInitialCampaign();
  return {
    ...base,
    privateTopics: ['vulnerabilities'],
    journalEntries: [
      journal('j_ok', 'A synthetic public entry about the ferry.', 1),
      journal('j_old', 'An older synthetic entry.', 0),
      journal('j_priv_CANARY', `${CANARY} private journal text`, 2, { privacy: 'private' }),
      journal('j_retr_CANARY', `${CANARY} retracted journal text`, 3, { status: 'retracted' })
    ],
    knowledgeGaps: [
      gap('gap_ok', 'j_ok', 'Something about the ferry worth exploring.'),
      gap('gap_CANARY', 'j_priv_CANARY', `${CANARY} gap summary`)
    ],
    evidence: [
      evidence('ev_ok', 'strengths', 'I enjoy fixing things.'),
      evidence('ev_priv_CANARY', 'vulnerabilities', `${CANARY} private-dimension claim`),
      evidence('ev_retr_CANARY', 'strengths', `${CANARY} retracted claim`, 'retracted')
    ],
    insights: [
      insight('in_ok', 'Fixing things matters.', ['ev_ok'], 'confirmed'),
      insight('in_priv_CANARY', `${CANARY} insight`, ['ev_priv_CANARY'], 'confirmed'),
      insight('in_rej', 'You avoid the sea.', ['ev_ok'], 'rejected'),
      insight('in_rej_CANARY', `${CANARY} rejected insight`, ['ev_priv_CANARY'], 'rejected')
    ],
    contradictions: [
      { id: 'c_ok', claim: 'Likes and dislikes crowds.', evidenceIds: ['ev_ok'], status: 'open' },
      { id: 'c_CANARY', claim: `${CANARY} contradiction`, evidenceIds: ['ev_priv_CANARY'], status: 'open' }
    ],
    reflections: [
      reflection('r_ok', ['j_ok'], 'The ferry feels calming.', 'confirm', 4),
      reflection('r_priv_CANARY', ['j_priv_CANARY'], `${CANARY} confirmed interp`, 'confirm', 5),
      reflection('r_rej', ['j_ok'], 'You dislike travel.', 'reject', 6),
      reflection('r_rej_CANARY', ['j_retr_CANARY'], `${CANARY} rejected interp`, 'reject', 7),
      { ...reflection('r_private_CANARY', ['j_ok'], `${CANARY} private reflection`, 'confirm', 8), privacy: 'private' as const }
    ],
    adventureSeeds: [seed('seed_ok', 'gap_ok', 'A ferry bell rings at dusk.'), seed('seed_CANARY', 'gap_CANARY', `${CANARY} premise`)],
    adventureRuns: [run('run_ok', 'seed_ok'), { ...run('run_CANARY', 'seed_CANARY'), status: 'complete' }],
    adventureActions: [
      action('act_1', 'run_ok', 'Ask the ferry keeper', 10),
      action('act_2', 'run_ok', 'Ring the bell', 11),
      action('act_CANARY', 'run_CANARY', `${CANARY} action`, 12)
    ],
    adventureMemories: [
      createAdventureMemory({ id: 'mem_ok', type: 'place', summary: 'The ferry keeper waved.', triggerTerms: ['ferry'], sourceIds: ['j_ok'] }),
      createAdventureMemory({ id: 'mem_priv_CANARY', type: 'place', summary: `${CANARY} ferry memory`, triggerTerms: ['ferry'], sourceIds: ['j_priv_CANARY'] }),
      createAdventureMemory({ id: 'mem_mixed_CANARY', type: 'place', summary: `${CANARY} mixed ferry`, triggerTerms: ['ferry'], sourceIds: ['j_ok', 'j_priv_CANARY'] }),
      createAdventureMemory({ id: 'mem_private_CANARY', type: 'place', summary: `${CANARY} flagged ferry`, triggerTerms: ['ferry'], sourceIds: ['j_ok'], privacy: 'private' })
    ]
  };
}

function expectNoCanary(context: unknown) {
  expect(serializeModeContext(context)).not.toContain(CANARY);
}

describe('P05 journal mode context', () => {
  it('includes only provider-eligible entries/gaps and never PRIVATE/retracted text or IDs', () => {
    const ctx = compileJournalModeContext(fixture(), { journalEntryId: 'j_ok' });
    expectNoCanary(ctx);
    expect(ctx.allowedIds.journalEntryIds).toEqual(['j_ok', 'j_old']);
    expect(ctx.allowedIds.gapIds).toEqual(['gap_ok']);
    expect(ctx.allowedIds.dimensionIds).not.toContain('vulnerabilities');
  });

  it('refuses to compile for a PRIVATE or retracted current entry', () => {
    expect(() => compileJournalModeContext(fixture(), { journalEntryId: 'j_priv_CANARY' })).toThrow();
    expect(() => compileJournalModeContext(fixture(), { journalEntryId: 'j_retr_CANARY' })).toThrow();
  });

  it('stays within item and character budgets on a large journal', () => {
    const state = fixture();
    const many = Array.from({ length: 200 }, (_, i) => journal(`j_${String(i).padStart(3, '0')}`, 'x'.repeat(5000), i % 60));
    const ctx = compileJournalModeContext({ ...state, journalEntries: [...state.journalEntries, ...many] }, { journalEntryId: 'j_150' });
    const b = MODE_CONTEXT_BUDGET.journal;
    expect(ctx.entry.truncated).toBe(true);
    expect(ctx.entry.text.length).toBeLessThanOrEqual(b.currentEntryChars + 1);
    expect(ctx.recentEntries.length).toBeLessThanOrEqual(b.recentEntries);
    const textChars = ctx.entry.text.length + ctx.recentEntries.reduce((n, e) => n + e.text.length, 0)
      + ctx.openGaps.reduce((n, g) => n + g.summary.length, 0);
    expect(textChars).toBeLessThanOrEqual(b.totalChars);
  });

  it('is deterministic', () => {
    expect(serializeModeContext(compileJournalModeContext(fixture(), { journalEntryId: 'j_ok' })))
      .toBe(serializeModeContext(compileJournalModeContext(fixture(), { journalEntryId: 'j_ok' })));
  });
});

describe('P05 reflection mode context', () => {
  it('drops ineligible requested sources silently and includes RF04 do-not-reassert', () => {
    const ctx = compileReflectionModeContext(fixture(), {
      sourceKind: 'journal', sourceIds: ['j_ok', 'j_priv_CANARY', 'j_retr_CANARY', 'j_missing']
    });
    expectNoCanary(ctx);
    expect(ctx.allowedSourceIds).toEqual(['j_ok']);
    expect(ctx.doNotReassert.map((d) => d.id)).toEqual(['in_rej', 'r_rej']);
    expect(ctx.reflectionHistory.map((r) => r.id)).toEqual(['r_ok']);
    expect(ctx.allowedSourceIds).not.toContain('r_rej');
  });

  it('allow-list feeds parseReflectionProposalForContext: rejects IDs not sent', () => {
    const ctx = compileReflectionModeContext(fixture(), { sourceKind: 'journal', sourceIds: ['j_ok', 'j_priv_CANARY'] });
    const good = { kind: 'reflection', mode: 'reflection', question: 'Q?', interpretationCandidate: 'I', supportingSourceIds: ['j_ok'] };
    expect(parseReflectionProposalForContext(good, ctx.allowedSourceIds).supportingSourceIds).toEqual(['j_ok']);
    expect(() => parseReflectionProposalForContext({ ...good, supportingSourceIds: ['j_priv_CANARY'] }, ctx.allowedSourceIds)).toThrow();
    expect(() => parseReflectionProposalForContext({ ...good, supportingSourceIds: ['r_rej'] }, ctx.allowedSourceIds)).toThrow();
  });

  it('throws when no eligible source remains (caller uses P09 fallback)', () => {
    expect(() => compileReflectionModeContext(fixture(), { sourceKind: 'journal', sourceIds: ['j_priv_CANARY'] })).toThrow();
    expect(() => compileReflectionModeContext(fixture(), { sourceKind: 'insight', sourceIds: ['in_priv_CANARY'] })).toThrow();
  });

  it('bounds sources and total characters', () => {
    const state = fixture();
    const many = Array.from({ length: 50 }, (_, i) => journal(`jx_${i}`, 'y'.repeat(2000), i % 60));
    const ctx = compileReflectionModeContext({ ...state, journalEntries: [...state.journalEntries, ...many] }, {
      sourceKind: 'journal', sourceIds: many.map((e) => e.id)
    });
    const b = MODE_CONTEXT_BUDGET.reflection;
    expect(ctx.sources.length).toBeLessThanOrEqual(b.sources);
    expect(ctx.sources.every((s) => s.text.length <= b.sourceChars + 1)).toBe(true);
    expect(serializeModeContext(ctx).length).toBeLessThan(b.totalChars + 2000);
  });
});

describe('P05 adventure-scene mode context', () => {
  it('uses only N04-gated memories, no journal text, and exposes the allow-list', () => {
    const state = fixture();
    const ctx = compileAdventureSceneModeContext(state, { runId: 'run_ok', queryText: 'ferry' });
    expectNoCanary(ctx);
    expect(ctx.allowedIds.memoryIds).toEqual(['mem_ok']);
    expect(ctx.recentActions.map((a) => a.id)).toEqual(['act_1', 'act_2']);
    for (const entry of state.journalEntries) expect(serializeModeContext(ctx)).not.toContain(entry.text);
  });

  it('allow-list feeds parseAdventureSceneProposalForContext', () => {
    const ctx = compileAdventureSceneModeContext(fixture(), { runId: 'run_ok', queryText: 'ferry' });
    const base = { kind: 'adventure-scene', mode: 'adventure', sceneProse: 'The bell hums.' };
    expect(() => parseAdventureSceneProposalForContext({ ...base, referencedMemoryIds: ['mem_ok'], referencedNpcIds: ['npc_ferry'] }, ctx.allowedIds)).not.toThrow();
    expect(() => parseAdventureSceneProposalForContext({ ...base, referencedMemoryIds: ['mem_mixed_CANARY'] }, ctx.allowedIds)).toThrow();
  });

  it('refuses a run whose seed provenance is PRIVATE', () => {
    expect(() => compileAdventureSceneModeContext(fixture(), { runId: 'run_CANARY' })).toThrow();
  });

  it('bounds actions and memories', () => {
    const state = fixture();
    const actions = Array.from({ length: 40 }, (_, i) => action(`a_${String(i).padStart(2, '0')}`, 'run_ok', `ferry step ${i} ${'z'.repeat(400)}`, i % 60));
    const memories = Array.from({ length: 30 }, (_, i) => createAdventureMemory({
      id: `mem_${String(i).padStart(2, '0')}`, type: 'event', summary: `ferry ${'m'.repeat(150)}`, triggerTerms: ['ferry'], sourceIds: ['j_ok']
    }));
    const ctx = compileAdventureSceneModeContext(
      { ...state, adventureActions: [...state.adventureActions, ...actions], adventureMemories: [...state.adventureMemories, ...memories] },
      { runId: 'run_ok', queryText: 'ferry' }
    );
    const b = MODE_CONTEXT_BUDGET.adventure;
    expect(ctx.recentActions.length).toBeLessThanOrEqual(b.recentAdventureActions);
    expect(ctx.memories.length).toBeLessThanOrEqual(b.relevantAdventureMemories);
    const chars = ctx.adventure.premise.length + ctx.recentActions.reduce((n, a) => n + a.text.length, 0)
      + ctx.memories.reduce((n, m) => n + m.summary.length, 0);
    expect(chars).toBeLessThanOrEqual(b.totalChars);
    expectNoCanary(ctx);
  });
});

describe('P05 snapshot mode context', () => {
  it('includes only provenance-visible confirmed material plus do-not-reassert', () => {
    const ctx = compileSnapshotModeContext(fixture(), { asOfDate: '2026-07-01' });
    expectNoCanary(ctx);
    expect(ctx.evidence.map((e) => e.id)).toEqual(['ev_ok']);
    expect(ctx.confirmedInsights.map((i) => i.id)).toEqual(['in_ok']);
    expect(ctx.contradictions.map((c) => c.id)).toEqual(['c_ok']);
    expect(ctx.doNotReassert.map((d) => d.id)).toEqual(['in_rej', 'r_rej']);
    expect(ctx.allowedProvenanceIds).toEqual(['ev_ok', 'in_ok', 'c_ok', 'r_ok']);
  });

  it('allow-list feeds parseSnapshotProposalForContext; rejected IDs are not citable', () => {
    const ctx = compileSnapshotModeContext(fixture(), { asOfDate: '2026-07-01' });
    const base = {
      kind: 'snapshot', mode: 'snapshot', asOfDate: '2026-07-01', revisable: true, summary: 'For now.',
      uncertainties: ['Much is open.'], claims: [{ text: 'Enjoys fixing.', provenanceIds: ['ev_ok'] }]
    };
    expect(() => parseSnapshotProposalForContext(base, ctx.allowedProvenanceIds)).not.toThrow();
    for (const bad of ['ev_priv_CANARY', 'in_rej', 'r_rej']) {
      expect(() => parseSnapshotProposalForContext({ ...base, claims: [{ text: 'x', provenanceIds: [bad] }] }, ctx.allowedProvenanceIds)).toThrow();
    }
  });

  it('bounds evidence and is deterministic', () => {
    const state = fixture();
    const many = Array.from({ length: 100 }, (_, i) => evidence(`ev_${String(i).padStart(3, '0')}`, 'strengths', 'c'.repeat(1000)));
    const big = { ...state, evidence: [...state.evidence, ...many] };
    const ctx = compileSnapshotModeContext(big, { asOfDate: '2026-07-01' });
    const b = MODE_CONTEXT_BUDGET.snapshot;
    expect(ctx.evidence.length).toBeLessThanOrEqual(b.evidence);
    expect(ctx.evidence.every((e) => e.claim.length <= b.claimChars + 1)).toBe(true);
    expect(serializeModeContext(ctx)).toBe(serializeModeContext(compileSnapshotModeContext(big, { asOfDate: '2026-07-01' })));
    expect(() => compileSnapshotModeContext(state, { asOfDate: 'July 1' })).toThrow();
  });
});
