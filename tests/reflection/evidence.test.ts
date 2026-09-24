import { describe, expect, it } from 'vitest';
import { createReflectionRecord, decideReflection, retractReflection } from '../../src/reflection/domain';
import { buildReflectionEvidenceProposal } from '../../src/reflection/evidence';
import type { AdventureObservation } from '../../src/adventure/schema';

const pending = () => createReflectionRecord({
  id: 'reflection_evidence_fixture',
  sourceKind: 'adventure',
  sourceIds: ['observation_fixture'],
  question: 'Does this fit you outside the fiction?',
  interpretation: 'I tend to protect other people first.',
  createdAt: '2026-01-02T03:04:05.000Z'
});

describe('Reflection evidence proposal firewall (RF02/RF03)', () => {
  it('creates no proposal from a pending Reflection sourced by an AdventureObservation', () => {
    expect(buildReflectionEvidenceProposal(pending())).toBeNull();
  });

  it('creates a confirmed-interpretation proposal only after an explicit confirming response', () => {
    const decided = decideReflection(pending(), 'confirm', 'Yes, that fits me outside the game.');
    expect(buildReflectionEvidenceProposal(decided)).toEqual({
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
      pending(),
      'partial',
      'Sometimes, but mostly when I already feel responsible for them.'
    );
    const proposal = buildReflectionEvidenceProposal(decided);

    expect(proposal?.claimSource).toBe('explicit-response');
    expect(proposal?.claim).toBe(
      'Sometimes, but mostly when I already feel responsible for them.'
    );
    expect(proposal?.claim).not.toBe('I tend to protect other people first.');
  });

  it('falls back to the explicit response when CONFIRM has no interpretation text', () => {
    const noInterpretation = createReflectionRecord({
      id: 'reflection_explicit_fixture',
      sourceKind: 'journal',
      sourceIds: ['journal_fixture'],
      question: 'What do you think?',
      createdAt: '2026-01-02T03:04:05.000Z'
    });
    const decided = decideReflection(noInterpretation, 'confirm', 'I prefer direct answers.');

    expect(buildReflectionEvidenceProposal(decided)?.claim).toBe('I prefer direct answers.');
    expect(buildReflectionEvidenceProposal(decided)?.claimSource).toBe('explicit-response');
  });

  it.each(['reject', 'uncertain', 'revise'] as const)(
    'creates no evidence proposal for %s',
    (decision) => {
      const decided = decideReflection(pending(), decision, 'Synthetic response.');
      expect(buildReflectionEvidenceProposal(decided)).toBeNull();
    }
  );

  it('creates no proposal from PRIVATE or retracted Reflection history', () => {
    const confirmed = decideReflection(pending(), 'confirm', 'Yes.');
    const privateRecord = decideReflection(confirmed, 'private', 'Keep this private.');
    expect(buildReflectionEvidenceProposal(privateRecord)).toBeNull();

    const retracted = retractReflection(confirmed);
    expect(buildReflectionEvidenceProposal(retracted)).toBeNull();
  });

  it('requires a non-empty human response even when an interpretation exists', () => {
    const malformedHumanDecision = {
      ...pending(),
      decision: 'confirm' as const,
      epistemicStatus: 'confirmed' as const,
      response: '   '
    };
    expect(buildReflectionEvidenceProposal(malformedHumanDecision)).toBeNull();
  });

  it('rejects an AdventureObservation object at the Reflection conversion boundary', () => {
    const observation: AdventureObservation = {
      id: 'observation_fixture',
      runId: 'run_fixture',
      sourceActionIds: ['action_fixture'],
      observation: 'Greyson guarded the companion.',
      status: 'unreflected'
    };

    expect(() =>
      buildReflectionEvidenceProposal(observation as unknown as Parameters<
        typeof buildReflectionEvidenceProposal
      >[0])
    ).toThrow();
  });

  it('returns proposal data only and never an EvidenceRecord/GameEvent-shaped object', () => {
    const proposal = buildReflectionEvidenceProposal(
      decideReflection(pending(), 'confirm', 'Yes.')
    )!;

    expect(proposal).not.toHaveProperty('dimension');
    expect(proposal).not.toHaveProperty('territories');
    expect(proposal).not.toHaveProperty('sourceTurnIds');
    expect(proposal).not.toHaveProperty('origin');
    expect(proposal).not.toHaveProperty('strength');
    expect(proposal).not.toHaveProperty('type');
  });
});
