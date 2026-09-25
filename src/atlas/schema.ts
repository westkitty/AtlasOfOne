import { z } from 'zod';
import { finalAssessmentSchema, type FinalAssessment } from '../cartographer/finalize';

export const atlasSnapshotSchema = z.object({
  id: z.string(),
  createdAt: z.string(),
  evidenceIds: z.array(z.string()),
  /**
   * PROVENANCE, not endorsement. S02 records both supporting insight IDs and
   * rejected-interpretation IDs (rendered as "not reasserted") here. Consumers
   * MUST check each insight's live status before presenting it as supported.
   * Tracked: split into a separate rejectedInsightIds field before S04/S05.
   */
  insightIds: z.array(z.string()),
  contradictionIds: z.array(z.string()),
  synthesis: finalAssessmentSchema,
  previousSnapshotId: z.string().optional()
});

export type AtlasSnapshotSynthesis = FinalAssessment;
export type AtlasSnapshot = z.infer<typeof atlasSnapshotSchema>;
