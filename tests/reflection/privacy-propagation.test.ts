import { describe, expect, it } from 'vitest';
import { createInitialCampaign } from '../../src/game/engine';
import type { CampaignState } from '../../src/game/types';
import { createJournalEntry } from '../../src/journal/domain';
import {
  createV2ProvenanceVisibility,
  retireIneligibleV2DerivedState
} from '../../src/persistence/retirement';
import { detectChangeOverTimeCandidate } from '../../src/reflection/change';
import {
  createReflectionRecord,
  decideReflection,
  retractReflection
} from '../../src/reflection/domain';
import { buildReflectionEvidenceProposal } from '../../src/reflection/evidence';
import { buildReflectionProvenanceDelta } from '../../src/reflection/provenance';

function baseState() {
  const journal = createJournalEntry({
    id: 'journal_rf09',
    createdAt: '2026-01-02T03:00:00.000Z',
    text: 'Synthetic Reflection privacy source.',
    inputMode: 'typed'
  });
  const reflection = createReflectionRecord({
    id: 'reflection_rf09',
    sourceKind: 'journal',
    sourceIds: [journal.id],
    question: 'Synthetic question?',
    interpretation: 'Atlas previously guessed this synthetic interpretation.',
    createdAt: '2026-01-02T03:04:05.000Z'
  });

  const state: CampaignState = {
    ...createInitialCampaign(),
    journalEntries: [journal],
    reflections: [reflection],
    adventureMemories: [{
      id: 'memory_from_reflection',
      type: 'event',
      summary: 'Synthetic memory derived from the Reflection.',
      triggerTerms: ['synthetic'],
      sourceIds: [reflection.id],
      privacy: 'normal',
      status: 'active'
    }]
  };
  return { state, journal, reflection };
}

describe('Reflection privacy/retraction propagation (RF09)', () => {
  it('retires a memory sourced exclusively from a Reflection once that Reflection becomes PRIVATE', () => {
    const { state, journal, reflection } = baseState();
    const confirmed = decideReflection(reflection, 'confirm', 'Yes, synthetically.');
    state.reflections = [confirmed];

    expect(createV2ProvenanceVisibility(state).reflectionIsEligible(confirmed.id)).toBe(true);
    expect(createV2ProvenanceVisibility(state).adventureMemoryIsEligible('memory_from_reflection')).toBe(true);

    const privateReflection = decideReflection(confirmed, 'private', 'Keep this private.');
    const privateState: CampaignState = { ...state, reflections: [privateReflection] };
    const retired = retireIneligibleV2DerivedState(privateState);

    expect(createV2ProvenanceVisibility(privateState).reflectionIsEligible(confirmed.id)).toBe(false);
    expect(retired.adventureMemories[0].status).toBe('retired');

    // Privacy changes downstream authority, not historical or upstream source content.
    expect(retired.reflections[0].privacy).toBe('private');
    expect(retired.reflections[0].response).toBe('Yes, synthetically.');
    expect(retired.journalEntries[0]).toEqual(journal);
  });

  it('retires Reflection-derived memory after retraction while preserving the Reflection history', () => {
    const { state, journal, reflection } = baseState();
    const partial = decideReflection(reflection, 'partial', 'Only the synthetic part.');
    const retracted = retractReflection(partial);
    state.reflections = [retracted];

    const retired = retireIneligibleV2DerivedState(state);

    expect(createV2ProvenanceVisibility(state).reflectionIsEligible(retracted.id)).toBe(false);
    expect(retired.adventureMemories[0].status).toBe('retired');
    expect(retired.reflections[0]).toMatchObject({
      id: 'reflection_rf09',
      decision: 'partial',
      response: 'Only the synthetic part.',
      recordStatus: 'retracted'
    });
    expect(retired.journalEntries[0]).toEqual(journal);
  });

  it('withholds confirmed-evidence proposal authority after PRIVATE or retraction', () => {
    const first = baseState();
    const confirmed = decideReflection(first.reflection, 'confirm', 'Yes.');
    first.state.reflections = [confirmed];
    expect(buildReflectionEvidenceProposal(first.state, confirmed.id)).not.toBeNull();

    first.state.reflections = [decideReflection(confirmed, 'private', 'Private.')];
    expect(buildReflectionEvidenceProposal(first.state, confirmed.id)).toBeNull();

    const second = baseState();
    const confirmedAgain = decideReflection(second.reflection, 'confirm', 'Yes.');
    second.state.reflections = [retractReflection(confirmedAgain)];
    expect(buildReflectionEvidenceProposal(second.state, confirmedAgain.id)).toBeNull();
  });

  it('withholds PARTIAL/REVISE provenance deltas after PRIVATE or retraction', () => {
    const first = baseState();
    const partial = decideReflection(first.reflection, 'partial', 'Some of it.');
    first.state.reflections = [partial];
    expect(buildReflectionProvenanceDelta(first.state, partial.id)?.kind).toBe('partial');

    first.state.reflections = [decideReflection(partial, 'private', 'Private.')];
    expect(buildReflectionProvenanceDelta(first.state, partial.id)).toBeNull();

    const second = baseState();
    const revised = decideReflection(second.reflection, 'revise', 'Replacement wording.');
    second.state.reflections = [revised];
    expect(buildReflectionProvenanceDelta(second.state, revised.id)?.kind).toBe('revision');

    second.state.reflections = [retractReflection(revised)];
    expect(buildReflectionProvenanceDelta(second.state, revised.id)).toBeNull();
  });

  it('withholds RF07 correction-or-change candidates after PRIVATE or retraction', () => {
    const first = baseState();
    const revised = decideReflection(first.reflection, 'revise', 'Different synthetic wording.');
    first.state.reflections = [revised];
    expect(detectChangeOverTimeCandidate(first.state, revised.id)).not.toBeNull();

    first.state.reflections = [decideReflection(revised, 'private', 'Private.')];
    expect(detectChangeOverTimeCandidate(first.state, revised.id)).toBeNull();

    const second = baseState();
    const revisedAgain = decideReflection(second.reflection, 'revise', 'Another different wording.');
    second.state.reflections = [retractReflection(revisedAgain)];
    expect(detectChangeOverTimeCandidate(second.state, revisedAgain.id)).toBeNull();
  });

  it('keeps privacy propagation one-way: Reflection closure never rewrites the source Journal entry', () => {
    const { state, journal, reflection } = baseState();
    state.reflections = [decideReflection(reflection, 'private', 'No analysis here.')];

    const retired = retireIneligibleV2DerivedState(state);
    expect(retired.journalEntries[0]).toEqual(journal);
    expect(retired.journalEntries[0].privacy).toBe('normal');
    expect(retired.journalEntries[0].status).toBe('active');
  });
});
