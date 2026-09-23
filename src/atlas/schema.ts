import { z } from 'zod';
import { finalAssessmentSchema, type FinalAssessment } from '../cartographer/finalize';

export const atlasSnapshotSchema = z.object({
  id: z.string(),
  createdAt: z.string(),
  evidenceIds: z.array(z.string()),
  insightIds: z.array(z.string()),
  contradictionIds: z.array(z.string()),
  synthesis: finalAssessmentSchema,
  previousSnapshotId: z.string().optional()
});

export type AtlasSnapshotSynthesis = FinalAssessment;
export type AtlasSnapshot = z.infer<typeof atlasSnapshotSchema>;
