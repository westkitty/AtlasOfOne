import { z } from 'zod'

const entryTypeSchema = z.enum([
  'moment',
  'thread',
  'promise',
  'teaching',
  'shared-world',
  'correction',
  'dexter',
])

const entryStateSchema = z.enum([
  'noticed',
  'explored',
  'mutually-established',
  'changed',
  'remembered',
  'superseded',
])

const entrySchema = z.object({
  id: z.string().min(1).max(160),
  type: entryTypeSchema,
  title: z.string().min(1).max(90),
  summary: z.string().max(1200),
  state: entryStateSchema,
  visibility: z.literal('shared'),
  date: z.string().max(32).optional(),
  related: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  queue: z.enum(['pending', 'done']).optional(),
  supersedes: z.string().optional(),
  supersededBy: z.string().optional(),
}).strict()

export const gaeysunSharedCapsuleSchema = z.object({
  capsuleType: z.literal('gaeysun-shared-capsule'),
  version: z.literal(1),
  exportedAt: z.string().datetime(),
  source: z.object({
    projectId: z.literal('gaeysun-living-map'),
    authority: z.literal('approved-shared-only'),
    stateSchemaVersion: z.number().int().min(2),
  }).strict(),
  policy: z.object({
    writeback: z.literal('candidate-only'),
    containsPrivate: z.literal(false),
    containsSealed: z.literal(false),
    containsVault: z.literal(false),
    containsWalkCandidates: z.literal(false),
  }).strict(),
  entries: z.array(entrySchema),
  integrity: z.object({
    entryCount: z.number().int().min(0),
    entriesSha256: z.string().regex(/^[a-f0-9]{64}$/),
  }).strict(),
}).strict().superRefine((capsule, ctx) => {
  if (capsule.integrity.entryCount !== capsule.entries.length) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['integrity', 'entryCount'],
      message: 'entryCount must equal entries.length',
    })
  }

  const ids = new Set(capsule.entries.map((entry) => entry.id))
  if (ids.size !== capsule.entries.length) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['entries'],
      message: 'entry IDs must be unique',
    })
  }

  capsule.entries.forEach((entry, index) => {
    entry.related.forEach((id) => {
      if (!ids.has(id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['entries', index, 'related'],
          message: `related entry ${id} is not present in the capsule`,
        })
      }
    })
    for (const field of ['supersedes', 'supersededBy'] as const) {
      const id = entry[field]
      if (id && !ids.has(id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['entries', index, field],
          message: `${field} entry ${id} is not present in the capsule`,
        })
      }
    }
  })
})

export type GaeysunSharedCapsule = z.infer<typeof gaeysunSharedCapsuleSchema>
export type GaeysunSharedEntry = GaeysunSharedCapsule['entries'][number]

export type GaeysunCandidate = Readonly<{
  candidateId: string
  source: 'gaeysun-shared-capsule'
  sourceEntryId: string
  kind: GaeysunSharedEntry['type']
  title: string
  summary: string
  sourceState: GaeysunSharedEntry['state']
  tags: readonly string[]
  relatedSourceIds: readonly string[]
  lineage: Readonly<{
    supersedes?: string
    supersededBy?: string
  }>
}>

export function parseGaeysunSharedCapsule(input: unknown): GaeysunSharedCapsule {
  return gaeysunSharedCapsuleSchema.parse(input)
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`)
      .join(',')}}`
  }
  return JSON.stringify(value)
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export async function verifyGaeysunSharedCapsuleIntegrity(capsule: GaeysunSharedCapsule): Promise<boolean> {
  if (capsule.integrity.entryCount !== capsule.entries.length) return false
  return (await sha256Hex(stableJson(capsule.entries))) === capsule.integrity.entriesSha256
}

export function gaeysunCapsuleToCandidates(capsule: GaeysunSharedCapsule): GaeysunCandidate[] {
  return capsule.entries.map((entry) => ({
    candidateId: `gaeysun:${entry.id}`,
    source: 'gaeysun-shared-capsule',
    sourceEntryId: entry.id,
    kind: entry.type,
    title: entry.title,
    summary: entry.summary,
    sourceState: entry.state,
    tags: [...entry.tags],
    relatedSourceIds: [...entry.related],
    lineage: {
      ...(entry.supersedes ? { supersedes: entry.supersedes } : {}),
      ...(entry.supersededBy ? { supersededBy: entry.supersededBy } : {}),
    },
  }))
}
