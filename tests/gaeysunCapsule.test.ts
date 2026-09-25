import { describe, expect, it } from 'vitest'
import {
  gaeysunCapsuleToCandidates,
  parseGaeysunSharedCapsule,
  verifyGaeysunSharedCapsuleIntegrity,
} from '../src/integrations/gaeysunCapsule'

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(',')}}`
  }
  return JSON.stringify(value)
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

async function capsule(overrides: Record<string, unknown> = {}) {
  const entries = [
    {
      id: 'shared-thread',
      type: 'thread',
      title: 'Synthetic thread',
      summary: 'Synthetic shared-only fixture.',
      state: 'changed',
      visibility: 'shared',
      date: '2099-01-01',
      related: ['shared-correction'],
      tags: ['synthetic'],
      supersededBy: 'shared-correction',
    },
    {
      id: 'shared-correction',
      type: 'correction',
      title: 'Synthetic correction',
      summary: 'Synthetic corrected fixture.',
      state: 'noticed',
      visibility: 'shared',
      date: '2099-01-02',
      related: ['shared-thread'],
      tags: ['synthetic', 'correction'],
      supersedes: 'shared-thread',
    },
  ]

  const base = {
    capsuleType: 'gaeysun-shared-capsule',
    version: 1,
    exportedAt: '2099-01-03T00:00:00.000Z',
    source: {
      projectId: 'gaeysun-living-map',
      authority: 'approved-shared-only',
      stateSchemaVersion: 2,
    },
    policy: {
      writeback: 'candidate-only',
      containsPrivate: false,
      containsSealed: false,
      containsVault: false,
      containsWalkCandidates: false,
    },
    entries,
    integrity: {
      entryCount: entries.length,
      entriesSha256: await sha256Hex(stableJson(entries)),
    },
  }

  return { ...base, ...overrides }
}

describe('Gaeysun Shared Capsule boundary', () => {
  it('accepts a synthetic shared-only capsule and verifies its digest', async () => {
    const parsed = parseGaeysunSharedCapsule(await capsule())
    expect(await verifyGaeysunSharedCapsuleIntegrity(parsed)).toBe(true)
  })

  it('rejects private, sealed, surprise, or widened-authority material', async () => {
    const privateCapsule = await capsule()
    ;(privateCapsule.entries[0] as Record<string, unknown>).visibility = 'andrew'
    expect(() => parseGaeysunSharedCapsule(privateCapsule)).toThrow()

    const surpriseCapsule = await capsule()
    ;(surpriseCapsule.entries[0] as Record<string, unknown>).type = 'surprise'
    expect(() => parseGaeysunSharedCapsule(surpriseCapsule)).toThrow()

    const widenedPolicy = await capsule({
      policy: {
        writeback: 'direct',
        containsPrivate: false,
        containsSealed: false,
        containsVault: false,
        containsWalkCandidates: false,
      },
    })
    expect(() => parseGaeysunSharedCapsule(widenedPolicy)).toThrow()
  })

  it('rejects broken counts and dangling relation or lineage references', async () => {
    const badCount = await capsule()
    badCount.integrity.entryCount = 99
    expect(() => parseGaeysunSharedCapsule(badCount)).toThrow()

    const dangling = await capsule()
    dangling.entries[0].related = ['missing-node']
    expect(() => parseGaeysunSharedCapsule(dangling)).toThrow()
  })

  it('returns false when the declared digest does not match the entries', async () => {
    const parsed = parseGaeysunSharedCapsule(await capsule())
    const tampered = {
      ...parsed,
      entries: parsed.entries.map((entry, index) =>
        index === 0 ? { ...entry, summary: 'Tampered after validation.' } : entry,
      ),
    }
    expect(await verifyGaeysunSharedCapsuleIntegrity(tampered)).toBe(false)
  })

  it('converts entries to inert candidate records with no progression authority', async () => {
    const parsed = parseGaeysunSharedCapsule(await capsule())
    const candidates = gaeysunCapsuleToCandidates(parsed)
    expect(candidates).toHaveLength(2)
    expect(candidates[0].source).toBe('gaeysun-shared-capsule')
    expect(candidates[0].candidateId).toBe('gaeysun:shared-thread')

    for (const candidate of candidates) {
      const keys = Object.keys(candidate)
      for (const forbidden of [
        'xp',
        'level',
        'unlock',
        'achievement',
        'quest',
        'territory',
        'campaign',
        'progression',
        'writeback',
      ]) {
        expect(keys).not.toContain(forbidden)
      }
    }
  })
})
