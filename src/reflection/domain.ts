import {
  reflectionRecordSchema,
  type ReflectionDecision,
  type ReflectionEpistemicStatus,
  type ReflectionRecord
} from './schema';

export interface NewReflectionRecord {
  id: string;
  sourceKind: ReflectionRecord['sourceKind'];
  sourceIds: string[];
  question: string;
  interpretation?: string;
  createdAt: string;
}

/**
 * Creates a pending Reflection proposal without deciding what it means for
 * Greyson. Empty response is deliberate: Greyson has not answered yet.
 */
export function createReflectionRecord(input: NewReflectionRecord): ReflectionRecord {
  return reflectionRecordSchema.parse({
    id: input.id,
    sourceKind: input.sourceKind,
    sourceIds: [...input.sourceIds],
    question: input.question,
    response: '',
    ...(input.interpretation === undefined ? {} : { interpretation: input.interpretation }),
    epistemicStatus: 'pending',
    privacy: 'normal',
    recordStatus: 'active',
    createdAt: input.createdAt
  });
}

const decisionStatus: Partial<Record<ReflectionDecision, ReflectionEpistemicStatus>> = {
  confirm: 'confirmed',
  partial: 'partial',
  reject: 'rejected',
  uncertain: 'uncertain'
};

/**
 * Records Greyson's explicit Reflection decision.
 *
 * REVISE intentionally returns the epistemic axis to pending. RF05 owns the
 * provenance/amendment conversion and must explicitly decide what the revised
 * response supports. PRIVATE is orthogonal: it closes provider eligibility
 * without rewriting an already-known epistemic state.
 */
export function decideReflection(
  record: ReflectionRecord,
  decision: ReflectionDecision,
  response: string
): ReflectionRecord {
  if (record.recordStatus === 'retracted') {
    throw new Error(`Cannot decide retracted ReflectionRecord: ${record.id}`);
  }

  if (decision === 'private') {
    return reflectionRecordSchema.parse({
      ...record,
      decision,
      // Privacy is a visibility action. If Greyson already supplied a substantive
      // Reflection response, preserve it rather than replacing history with the
      // later "keep this private" action text.
      response: record.response || response,
      privacy: 'private'
    });
  }

  if (decision === 'revise') {
    return reflectionRecordSchema.parse({
      ...record,
      decision,
      response,
      epistemicStatus: 'pending'
    });
  }

  return reflectionRecordSchema.parse({
    ...record,
    decision,
    response,
    epistemicStatus: decisionStatus[decision]
  });
}

/**
 * Retraction preserves the record and its prior decision as history while
 * removing active authority. Derived retirement is owned by M06/RF09.
 */
export function retractReflection(record: ReflectionRecord): ReflectionRecord {
  if (record.recordStatus === 'retracted') return record;
  return reflectionRecordSchema.parse({
    ...record,
    recordStatus: 'retracted'
  });
}

export function reflectionIsActive(record: ReflectionRecord): boolean {
  return record.recordStatus === 'active';
}

export function reflectionIsStructurallyVisible(record: ReflectionRecord): boolean {
  return record.recordStatus === 'active' && record.privacy === 'normal';
}
