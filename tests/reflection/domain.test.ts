import { describe, expect, it } from 'vitest';
import {
  createReflectionRecord,
  decideReflection,
  reflectionIsStructurallyVisible,
  retractReflection
} from '../../src/reflection/domain';

const base = () => createReflectionRecord({
  id: 'reflection_fixture',
  sourceKind: 'adventure',
  sourceIds: ['observation_fixture'],
  question: 'Does this mean anything to you?',
  interpretation: 'Synthetic interpretation.',
  createdAt: '2026-01-02T03:04:05.000Z'
});

describe('ReflectionRecord state machine (RF00)', () => {
  it('starts pending without pretending Greyson has answered', () => {
    const record = base();
    expect(record).toMatchObject({
      response: '',
      epistemicStatus: 'pending',
      privacy: 'normal',
      recordStatus: 'active'
    });
    expect(record.decision).toBeUndefined();
  });

  it.each([
    ['confirm', 'confirmed'],
    ['partial', 'partial'],
    ['reject', 'rejected'],
    ['uncertain', 'uncertain']
  ] as const)('maps %s to epistemic status %s', (decision, epistemicStatus) => {
    const decided = decideReflection(base(), decision, `Synthetic ${decision} response.`);
    expect(decided.decision).toBe(decision);
    expect(decided.epistemicStatus).toBe(epistemicStatus);
    expect(decided.response).toBe(`Synthetic ${decision} response.`);
  });

  it('keeps PRIVATE orthogonal to epistemic history', () => {
    const confirmed = decideReflection(base(), 'confirm', 'Yes.');
    const privateRecord = decideReflection(confirmed, 'private', 'Keep this private.');

    expect(privateRecord.decision).toBe('private');
    expect(privateRecord.epistemicStatus).toBe('confirmed');
    expect(privateRecord.privacy).toBe('private');
    expect(reflectionIsStructurallyVisible(privateRecord)).toBe(false);
  });

  it('makes REVISE pending until RF05 resolves revision provenance', () => {
    const confirmed = decideReflection(base(), 'confirm', 'Old wording.');
    const revised = decideReflection(confirmed, 'revise', 'Replacement wording.');

    expect(revised.decision).toBe('revise');
    expect(revised.response).toBe('Replacement wording.');
    expect(revised.epistemicStatus).toBe('pending');
    expect(revised.privacy).toBe('normal');
  });

  it('retracts without erasing prior decision/history and is idempotent', () => {
    const rejected = decideReflection(base(), 'reject', 'No.');
    const retracted = retractReflection(rejected);

    expect(retracted).toMatchObject({
      decision: 'reject',
      epistemicStatus: 'rejected',
      response: 'No.',
      recordStatus: 'retracted'
    });
    expect(reflectionIsStructurallyVisible(retracted)).toBe(false);
    expect(retractReflection(retracted)).toEqual(retracted);
  });

  it('refuses new decisions after retraction', () => {
    const retracted = retractReflection(base());
    expect(() => decideReflection(retracted, 'confirm', 'Changed again.'))
      .toThrow('Cannot decide retracted ReflectionRecord: reflection_fixture');
  });
});
