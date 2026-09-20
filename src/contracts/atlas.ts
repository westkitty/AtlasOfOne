/** A dated, revisable synthesis. Eligibility is deterministic; prose is not. */
export interface AtlasSnapshot {
  id: string;
  createdAt: string;
  evidenceIds: string[];
  insightIds: string[];
  contradictionIds: string[];
  synthesis: { summary: string; territorySummaries: Array<{ territoryId: string; summary: string }>; };
  previousSnapshotId?: string;
}
