/** Human decisions are deliberately explicit and are never model authority. */
export type ReflectionOutcome = 'CONFIRM' | 'PARTIAL' | 'REJECT' | 'UNCERTAIN' | 'REVISE' | 'PRIVATE';
export type ReflectionSourceKind = 'journal' | 'adventure-observation' | 'contradiction' | 'insight' | 'snapshot';

export interface EvidenceConversionProvenance {
  /** The responding player statement, not fictional adventure behavior. */
  responseSourceId: string;
  sourceIds: string[];
}

export interface ReflectionRecord {
  id: string;
  sourceKind: ReflectionSourceKind;
  sourceIds: string[];
  question: string;
  response: string;
  interpretation?: string;
  createdAt: string;
  outcome: ReflectionOutcome;
  evidenceProvenance?: EvidenceConversionProvenance;
  /** Remembered rejection prevents repeated presentation of the same claim. */
  rejectedInterpretation?: string;
  /** Required when the player revises an existing durable claim. */
  revisionTargetId?: string;
  /** PRIVATE retires eligible dependent state by provenance in the later migration. */
  privacyRetiredSourceIds?: string[];
}

export type KnowledgeGapKind = 'unknown' | 'contradiction' | 'change' | 'underexplored' | 'curiosity';
export type KnowledgeGapStatus = 'open' | 'seeded' | 'resolved' | 'retired';

export interface KnowledgeGap {
  id: string;
  kind: KnowledgeGapKind;
  territoryIds: string[];
  dimensionIds: string[];
  sourceEvidenceIds: string[];
  sourceJournalEntryIds: string[];
  summary: string;
  status: KnowledgeGapStatus;
  /** Calculated locally; providers may not set or rank this value. */
  priority: number;
}
