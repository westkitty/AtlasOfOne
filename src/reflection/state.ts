import type { EvidenceConversionProvenance, ReflectionOutcome, ReflectionRecord, ReflectionSourceKind } from '../contracts/reflection';
import type { CampaignState } from '../game/types';

export interface ReflectionInput {
  sourceKind: ReflectionSourceKind;
  sourceIds: string[];
  question: string;
  response: string;
  interpretation?: string;
  outcome: ReflectionOutcome;
  revisionTargetId?: string;
}

export interface ReflectionFactoryOptions {
  id?: string;
  createdAt?: string;
  createId?: () => string;
  now?: () => string;
}

/** A later authority crossing can convert this request, but this lane never does. */
export interface ReflectionEvidenceConversionRequest {
  reflectionId: string;
  sourceKind: ReflectionSourceKind;
  sourceIds: string[];
  outcome: 'CONFIRM' | 'PARTIAL' | 'REVISE';
  /** The player's exact, normalized reflection. */
  responseText: string;
  /** Proposal/context only; never silently promoted to the response. */
  candidateInterpretation?: string;
  provenance: EvidenceConversionProvenance;
  /** Present only when the player explicitly revises older durable evidence. */
  revisionTargetId?: string;
}

const defaultId = () => `reflection_${crypto.randomUUID()}`;
const defaultNow = () => new Date().toISOString();
const evidenceEligibleOutcomes = new Set<ReflectionOutcome>(['CONFIRM', 'PARTIAL', 'REVISE']);

function requiredText(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`Reflection ${label} must contain text.`);
  return normalized;
}

function normalizedSourceIds(sourceIds: string[]): string[] {
  const normalized = sourceIds.map((id) => id.trim());
  if (normalized.length === 0 || normalized.some((id) => !id)) {
    throw new Error('Reflection records require at least one nonblank source ID.');
  }
  return [...new Set(normalized)];
}

/** Creates a player-authored historical reflection. It has no game authority. */
export function createReflectionRecord(input: ReflectionInput, options: ReflectionFactoryOptions = {}): ReflectionRecord {
  const sourceIds = normalizedSourceIds(input.sourceIds);
  const question = requiredText(input.question, 'question');
  const response = requiredText(input.response, 'response');
  const interpretation = input.interpretation?.trim() || undefined;
  const id = options.id ?? options.createId?.() ?? defaultId();
  const createdAt = options.createdAt ?? options.now?.() ?? defaultNow();
  const revisionTargetId = input.revisionTargetId?.trim();

  if (input.outcome === 'REVISE' && !revisionTargetId) {
    throw new Error('REVISE reflections require a nonblank revisionTargetId.');
  }

  return {
    id,
    sourceKind: input.sourceKind,
    sourceIds,
    question,
    response,
    ...(interpretation ? { interpretation } : {}),
    createdAt,
    outcome: input.outcome,
    ...(evidenceEligibleOutcomes.has(input.outcome)
      ? { evidenceProvenance: { responseSourceId: id, sourceIds: [...sourceIds] } }
      : {}),
    ...(input.outcome === 'REJECT' && interpretation ? { rejectedInterpretation: interpretation } : {}),
    ...(input.outcome === 'REVISE' ? { revisionTargetId: revisionTargetId! } : {}),
    ...(input.outcome === 'PRIVATE' ? { privacyRetiredSourceIds: [...sourceIds] } : {})
  };
}

/** Appends without altering evidence, source domains, progress, or earlier reflections. */
function appendReflection(state: CampaignState, reflection: ReflectionRecord): CampaignState {
  return {
    ...state,
    reflections: [...state.reflections, reflection],
    updatedAt: reflection.createdAt
  };
}

export function recordReflection(state: CampaignState, input: ReflectionInput, options: ReflectionFactoryOptions = {}): CampaignState {
  return appendReflection(state, createReflectionRecord(input, options));
}

function isEvidenceEligibleReflection(reflection: ReflectionRecord): reflection is ReflectionRecord & { outcome: 'CONFIRM' | 'PARTIAL' | 'REVISE' } {
  return evidenceEligibleOutcomes.has(reflection.outcome);
}

/**
 * Selects only explicit player responses for the future evidence authority.
 * It does not create evidence, infer a claim, or emit a GameEvent.
 */
export function reflectionEvidenceConversionRequest(reflection: ReflectionRecord): ReflectionEvidenceConversionRequest | null {
  if (!isEvidenceEligibleReflection(reflection)) return null;

  const reflectionId = reflection.id.trim();
  const responseText = reflection.response.trim();
  const sourceIds = reflection.sourceIds.map((id) => id.trim());
  if (!reflectionId || reflectionId !== reflection.id || !responseText || sourceIds.length === 0 || sourceIds.some((id) => !id)) return null;
  if (reflection.sourceIds.some((id, index) => id !== sourceIds[index])) return null;
  if (new Set(sourceIds).size !== sourceIds.length) return null;

  const provenance = reflection.evidenceProvenance;
  if (!provenance || provenance.responseSourceId !== reflection.id) return null;
  if (provenance.sourceIds.length !== sourceIds.length) return null;
  if (provenance.sourceIds.some((id, index) => id !== reflection.sourceIds[index])) return null;

  const revisionTargetId = reflection.revisionTargetId?.trim();
  if (reflection.outcome === 'REVISE' && !revisionTargetId) return null;
  const candidateInterpretation = reflection.interpretation?.trim() || undefined;

  return {
    reflectionId,
    sourceKind: reflection.sourceKind,
    sourceIds,
    outcome: reflection.outcome,
    responseText,
    ...(candidateInterpretation ? { candidateInterpretation } : {}),
    provenance: {
      responseSourceId: provenance.responseSourceId,
      sourceIds: [...provenance.sourceIds]
    },
    ...(reflection.outcome === 'REVISE' ? { revisionTargetId } : {})
  };
}
