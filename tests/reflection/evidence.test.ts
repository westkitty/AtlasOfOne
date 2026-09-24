import { describe, expect, it } from 'vitest';
import { createInitialCampaign } from '../../src/game/engine';
import { createJournalEntry } from '../../src/journal/domain';
import { createReflectionRecord, decideReflection, retractReflection } from '../../src/reflection/domain';
import { buildReflectionEvidenceProposal } from '../../src/reflection/evidence';
import type { CampaignState } from '../../src/game/types';

const baseReflection = () => createReflectionRecord({
  id: 'reflection_evidence_fixture',
  sourceKind: 'adventure',
  sourceIds: ['observation_fixture'],
  question: 'Does this fit you outside the fiction?',
  interpretation: 'I tend to protect other people first.',
  createdAt: '2026-01-02T03:04:05.000Z'
});

function adventureState(reflection = baseReflection()): CampaignState {
  const initial = createInitialCampaign();
  return {
    ...initial,
    adventureSeeds: [{
      id: 'seed_fixture',
      sourceGapIds: [],
      kind: 'pure-fun',
      territoryId: 'identity',
      premise: 'Synthetic premise.',
      learningTarget: 'reflection-eligible',
      status: 'started'
    }],
    adventureRuns: [{
      id: 'run_fixture',
      seedId: 'seed_fixture',
      territoryId: 'identity',
      status: 'active',
      currentBeat: 'encounter',
      characterIds: [],
      memoryIds: [],
      startedAt: '2026-01-02T03:00:00.000Z'
    }],
    adventureActions: [{
      id: 'action_fixture',
      runId: 'run_fixture',
      createdAt: '2026-01-02T03:01:00.000Z',
      kind: 'combat',
      text: 'Synthetic fictional action.'
    }],
    adventureObservations: [{
      id: 'observation_fixture',
      runId: 'run_fixture',
      sourceActionIds: ['action_fixture'],
      observation: 'Greyson guarded the companion.',
      status: 'unreflected'
    }],
    reflections: [reflection]
  };
}

function journalState(reflection: ReturnType<typeof createReflectionRecord>): CampaignState {
  const initial = createInitialCampaign();
  const journal = createJournalEntry({
    id: 'journal_fixture',
    createdAt: '2026-01-02T03:00:00.000Z',
    text: 'Synthetic explicit Journal source.',
    inputMode: 'typed'
  });
  return { ...initial, journalEntries: [journal], reflections: [reflection] };
}

describe('Reflection evidence proposal firewall (RF02/RF03)', () => {
  it('creates no proposal from a pending Reflection sourced by an AdventureObservation', () => {
    const state = adventureState();
    expect(buildReflectionEvidenceProposal(state, 'reflection_evidence_fixture')).toBeNull();
  });

  it('creates a confirmed-interpretation proposal only after an explicit confirming response', () => {
    const decided = decideReflection(baseReflection(), 'confirm', 'Yes, that fits me outside the game.');
    const state = adventureState(decided);

    expect(buildReflectionEvidenceProposal(state, decided.id)).toEqual({
      reflectionId: 'reflection_evidence_fixture',
      sourceKind: 'adventure',
      sourceIds: ['observation_fixture'],
      decision: 'confirm',
      epistemicStatus: 'confirmed',
      claim: 'I tend to protect other people first.',
      claimSource: 'confirmed-interpretation',
      response: 'Yes, that fits me outside the game.',
      createdAt: '2026-01-02T03:04:05.000Z'
    });
  });

  it('uses Greyson\'s own response for PARTIAL instead of laundering the full interpretation', () => {
    const decided = decideReflection(
      baseReflection(),
      'partial',
      'Sometimes, but mostly when I already feel responsible for them.'
    );
    const proposal = buildReflectionEvidenceProposal(adventureState(decided), decided.id);

    expect(proposal?.claimSource).toBe('explicit-response');
    expect(proposal?.claim).toBe(
      'Sometimes, but mostly when I already feel responsible for them.'
    );
    expect(proposal?.claim).not.toBe('I tend to protect other people first.');
  });

  it('falls back to the explicit response when CONFIRM has no interpretation text', () => {
    const pending = createReflectionRecord({
      id: 'reflection_explicit_fixture',
      sourceKind: 'journal',
      sourceIds: ['journal_fixture'],
      question: 'What do you think?',
      createdAt: '2026-01-02T03:04:05.000Z'
    });
    const decided = decideReflection(pending, 'confirm', 'I prefer direct answers.');
    const proposal = buildReflectionEvidenceProposal(journalState(decided), decided.id);

    expect(proposal?.claim).toBe('I prefer direct answers.');
    expect(proposal?.claimSource).toBe('explicit-response');
  });

  it.each(['reject', 'uncertain', 'revise'] as const)(
    'creates no evidence proposal for %s',
    (decision) => {
      const decided = decideReflection(baseReflection(), decision, 'Synthetic response.');
      expect(buildReflectionEvidenceProposal(adventureState(decided), decided.id)).toBeNull();
    }
  );

  it('creates no proposal from PRIVATE or retracted Reflection history', () => {
    const confirmed = decideReflection(baseReflection(), 'confirm', 'Yes.');
    const privateRecord = decideReflection(confirmed, 'private', 'Keep this private.');
    expect(buildReflectionEvidenceProposal(adventureState(privateRecord), privateRecord.id)).toBeNull();

    const retracted = retractReflection(confirmed);
    expect(buildReflectionEvidenceProposal(adventureState(retracted), retracted.id)).toBeNull();
  });

  it('fails closed when a Reflection source becomes private after confirmation', () => {
    const pending = createReflectionRecord({
      id: 'reflection_private_source',
      sourceKind: 'journal',
      sourceIds: ['journal_fixture'],
      question: 'Synthetic question?',
      interpretation: 'Synthetic interpretation.',
      createdAt: '2026-01-02T03:04:05.000Z'
    });
    const decided = decideReflection(pending, 'confirm', 'Yes.');
    const state = journalState(decided);
    const privateSource = {
      ...state,
      journalEntries: state.journalEntries.map((entry) => ({ ...entry, privacy: 'private' as const }))
    };

    expect(buildReflectionEvidenceProposal(privateSource, decided.id)).toBeNull();
  });

  it('fails closed when an AdventureObservation source chain becomes ineligible', () => {
    const decided = decideReflection(baseReflection(), 'confirm', 'Yes.');
    const state = adventureState(decided);
    const discarded = {
      ...state,
      adventureObservations: state.adventureObservations.map((observation) => ({
        ...observation,
        status: 'discarded' as const
      }))
    };

    expect(buildReflectionEvidenceProposal(discarded, decided.id)).toBeNull();
  });

  it('requires a non-empty human response even when an interpretation exists', () => {
    const malformedHumanDecision = {
      ...baseReflection(),
      decision: 'confirm' as const,
      epistemicStatus: 'confirmed' as const,
      response: '   '
    };
    const state = adventureState(malformedHumanDecision);
    expect(buildReflectionEvidenceProposal(state, malformedHumanDecision.id)).toBeNull();
  });

  it('rejects a raw AdventureObservation id at the Reflection conversion boundary', () => {
    const state = adventureState();
    expect(() => buildReflectionEvidenceProposal(state, 'observation_fixture'))
      .toThrow('Unknown ReflectionRecord id: observation_fixture');
  });

  it('returns proposal data only and never an EvidenceRecord/GameEvent-shaped object', () => {
    const decided = decideReflection(baseReflection(), 'confirm', 'Yes.');
    const proposal = buildReflectionEvidenceProposal(adventureState(decided), decided.id)!;

    expect(proposal).not.toHaveProperty('dimension');
    expect(proposal).not.toHaveProperty('territories');
    expect(proposal).not.toHaveProperty('sourceTurnIds');
    expect(proposal).not.toHaveProperty('origin');
    expect(proposal).not.toHaveProperty('strength');
    expect(proposal).not.toHaveProperty('type');
  });
});
