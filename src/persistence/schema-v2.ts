import { z } from 'zod';
import { atlasSnapshotSchema } from '../atlas/schema';
import {
  adventureActionSchema,
  adventureMemorySchema,
  adventureObservationSchema,
  adventureRunSchema,
  adventureSeedSchema
} from '../adventure/schema';
import { journalEntrySchema } from '../journal/schema';
import { knowledgeGapSchema } from '../knowledge/schema';
import { reflectionRecordSchema } from '../reflection/schema';
import { campaignStateSchemaV1 } from './schema';

/**
 * Schema-v2 shape only.
 *
 * M01 deliberately does not activate this schema in migrations, IndexedDB,
 * import/export, or the runtime. M02 owns the first v1 -> v2 migration and the
 * coordinated CURRENT_SCHEMA_VERSION flip.
 */
export const campaignStateSchemaV2 = campaignStateSchemaV1.extend({
  schemaVersion: z.literal(2),
  journalEntries: z.array(journalEntrySchema).default([]),
  knowledgeGaps: z.array(knowledgeGapSchema).default([]),
  adventureSeeds: z.array(adventureSeedSchema).default([]),
  adventureRuns: z.array(adventureRunSchema).default([]),
  adventureActions: z.array(adventureActionSchema).default([]),
  adventureObservations: z.array(adventureObservationSchema).default([]),
  reflections: z.array(reflectionRecordSchema).default([]),
  adventureMemories: z.array(adventureMemorySchema).default([]),
  atlasSnapshots: z.array(atlasSnapshotSchema).default([])
});

export type CampaignStateV2 = z.infer<typeof campaignStateSchemaV2>;
