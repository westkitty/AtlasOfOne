import { describe, expect, it } from 'vitest';
import type { AdventureRun, AdventureSeed, KnowledgeGap } from '../../src/contracts';
import { createInitialCampaign } from '../../src/game/engine';
import type { CampaignState, EvidenceRecord, TurnRecord } from '../../src/game/types';
import {
  buildGapSeedRequest,
  K07_MAX_EVIDENCE_CLAIM_CHARS,
  K07_MAX_EVIDENCE_CLAIMS,
  K07_MAX_GAPS
} from '../../src/knowledge/seed-request';

const AT = '2026-09-21T12:00:00.000Z';

function state(overrides: Partial<CampaignState> = {}): CampaignState {
  const base = createInitialCampaign();
  return {
    ...base,
    player: { id: 'synthetic-player', displayName: 'Synthetic Player', pronouns: 'they/them' },
    activeTerritory: 'atlas',
    territories: [{ id: 'atlas', label: 'Synthetic Atlas', status: 'exploring', requiredDimensions: ['bananas', 'kiwi'], coveredDimensions: [], evidenceIds: [] }],
    turns: [], evidence: [], journalEntries: [], knowledgeGaps: [], adventureSeeds: [], adventureRuns: [], privateTopics: [],
    updatedAt: AT,
    ...overrides
  };
}

function gap(id: string, kind: KnowledgeGap['kind'], priority: number, options: Partial<KnowledgeGap> = {}): KnowledgeGap {
  return {
    id, kind, territoryIds: ['atlas'], dimensionIds: ['bananas'], sourceEvidenceIds: [], sourceJournalEntryIds: [],
    summary: 'Synthetic gap summary.', status: 'open', priority, ...options
  };
}

function turn(id: string, dimension = 'bananas', retracted = false): TurnRecord {
  return {
    id, createdAt: AT, territoryId: 'atlas', dimension, question: 'Synthetic question?', answer: 'Synthetic answer.',
    substantive: true, behavioralExample: false, revision: false, retracted
  };
}

function evidence(id: string, sourceTurnIds: string[], options: Partial<EvidenceRecord> = {}): EvidenceRecord {
  return {
    id, dimension: 'bananas', claim: `Synthetic eligible claim ${id}.`, sourceTurnIds, basis: 'explicit', strength: 2,
    territories: ['atlas'], counterEvidenceIds: [], status: 'active', origin: 'player-stated', ...options
  };
}

function seed(id: string, sourceGapIds: string[]): AdventureSeed {
  return {
    id, sourceGapIds, kind: 'exploration-expedition', territoryId: 'atlas', locationId: 'synthetic-location',
    premise: 'Synthetic prior premise.', learningTarget: 'reflection-eligible', status: 'available'
  };
}

function run(id: string, seedId: string): AdventureRun {
  return {
    id, seedId, territoryId: 'atlas', locationId: 'synthetic-location', status: 'complete', currentBeatId: 'consequence',
    recurringCharacterIds: [], memoryIds: [], startedAt: '2026-09-20T10:00:00.000Z', completedAt: '2026-09-20T11:00:00.000Z'
  };
}

describe('K07 deterministic gap -> seed request boundary', () => {
  it('matches the bounded §9.4 request shape exactly for one eligible contradiction gap', () => {
    const campaign = state({
      privateTopics: ['secret-dimension'],
      turns: [turn('turn-ok')],
      evidence: [evidence('evidence-ok', ['turn-ok'], { claim: 'Synthetic bounded eligible claim.' })],
      knowledgeGaps: [gap('gap-contradiction', 'contradiction', 85, { sourceEvidenceIds: ['evidence-ok'] })]
    });

    expect(buildGapSeedRequest(campaign)).toEqual({
      gapIds: ['gap-contradiction'],
      territoryId: 'atlas',
      adventureKind: 'mystery-puzzle',
      permittedThemes: ['bananas'],
      forbiddenDimensions: ['secret-dimension'],
      evidenceClaims: ['Synthetic bounded eligible claim.'],
      learningTarget: 'reflection-eligible'
    });
  });

  it('uses K04 selector eligibility/cooldown and never mutates stored priorities', () => {
    const top = gap('gap-top', 'underexplored', 90);
    const next = gap('gap-next', 'unknown', 80, { dimensionIds: ['kiwi'] });
    const campaign = state({
      knowledgeGaps: [top, next],
      adventureSeeds: [seed('seed-recent', [top.id])],
      adventureRuns: [run('run-recent', 'seed-recent')]
    });
    const before = structuredClone(campaign);
    const request = buildGapSeedRequest(campaign);

    expect(request).toMatchObject({ gapIds: ['gap-next'], adventureKind: 'exploration-expedition', permittedThemes: ['kiwi'] });
    expect(campaign).toEqual(before);
    expect(campaign.knowledgeGaps.map(({ id, priority }) => [id, priority])).toEqual([['gap-top', 90], ['gap-next', 80]]);
  });

  it('excludes retired/private gaps and represents private dimensions only as forbidden IDs', () => {
    const campaign = state({
      privateTopics: ['private-bananas'],
      knowledgeGaps: [
        gap('gap-retired', 'curiosity', 100, { status: 'retired' }),
        gap('gap-private', 'contradiction', 99, { dimensionIds: ['private-bananas'] }),
        gap('gap-safe', 'underexplored', 50, { dimensionIds: ['kiwi'] })
      ],
      journalEntries: [
        { id: 'journal-normal', createdAt: AT, text: 'NORMAL_JOURNAL_PROSE_CANARY', inputMode: 'typed', privacy: 'normal', status: 'active', reflectionIds: [], adventureIds: [] },
        { id: 'journal-private', createdAt: AT, text: 'PRIVATE_JOURNAL_PROSE_CANARY', inputMode: 'typed', privacy: 'private', status: 'active', reflectionIds: [], adventureIds: [] }
      ]
    });

    const request = buildGapSeedRequest(campaign);
    expect(request).toMatchObject({ gapIds: ['gap-safe'], permittedThemes: ['kiwi'], forbiddenDimensions: ['private-bananas'] });
    expect(JSON.stringify(request)).not.toContain('NORMAL_JOURNAL_PROSE_CANARY');
    expect(JSON.stringify(request)).not.toContain('PRIVATE_JOURNAL_PROSE_CANARY');
  });

  it('filters every referenced evidence claim independently and enforces count/character bounds', () => {
    const longClaim = 'L'.repeat(K07_MAX_EVIDENCE_CLAIM_CHARS + 50);
    const sourceIds = ['eligible-a', 'eligible-b', 'private', 'retracted', 'inactive', 'missing-turn', 'other-territory'];
    const campaign = state({
      privateTopics: ['secret'],
      turns: [turn('turn-a'), turn('turn-b'), turn('turn-private', 'secret'), turn('turn-retracted', 'bananas', true), turn('turn-other')],
      evidence: [
        evidence('eligible-a', ['turn-a'], { claim: longClaim }),
        evidence('eligible-b', ['turn-b'], { claim: 'Synthetic second eligible claim.' }),
        evidence('private', ['turn-private'], { dimension: 'secret', claim: 'PRIVATE_EVIDENCE_CLAIM_CANARY' }),
        evidence('retracted', ['turn-retracted'], { claim: 'RETRACTED_EVIDENCE_CLAIM_CANARY' }),
        evidence('inactive', ['turn-a'], { status: 'retracted', claim: 'INACTIVE_EVIDENCE_CLAIM_CANARY' }),
        evidence('missing-turn', ['missing-turn'], { claim: 'MISSING_TURN_CLAIM_CANARY' }),
        evidence('other-territory', ['turn-other'], { territories: ['other'], claim: 'OTHER_TERRITORY_CLAIM_CANARY' })
      ],
      knowledgeGaps: [gap('gap-mixed', 'change', 80, { sourceEvidenceIds: sourceIds })]
    });

    const request = buildGapSeedRequest(campaign, { evidenceClaimLimit: 2, evidenceClaimChars: 40 });
    expect(request?.evidenceClaims).toEqual(['L'.repeat(40), 'Synthetic second eligible claim.'.slice(0, 40)]);
    expect(JSON.stringify(request)).not.toContain('PRIVATE_EVIDENCE_CLAIM_CANARY');
    expect(JSON.stringify(request)).not.toContain('RETRACTED_EVIDENCE_CLAIM_CANARY');
    expect(JSON.stringify(request)).not.toContain('INACTIVE_EVIDENCE_CLAIM_CANARY');
    expect(JSON.stringify(request)).not.toContain('MISSING_TURN_CLAIM_CANARY');
    expect(JSON.stringify(request)).not.toContain('OTHER_TERRITORY_CLAIM_CANARY');
  });

  it('keeps routing structural/content-blind across every Knowledge gap kind', () => {
    const expected = {
      unknown: 'exploration-expedition',
      underexplored: 'investigation',
      curiosity: 'exploration-expedition',
      contradiction: 'mystery-puzzle',
      change: 'memory-echo'
    } as const;

    for (const [kind, adventureKind] of Object.entries(expected) as Array<[KnowledgeGap['kind'], (typeof expected)[KnowledgeGap['kind']]]>) {
      const a = state({ knowledgeGaps: [gap(`gap-${kind}`, kind, 50, { summary: 'TRAUMA_DRAMA_PROSE_CANARY' })] });
      const b = state({ knowledgeGaps: [gap(`gap-${kind}`, kind, 50, { summary: 'BANANAS_PROSE_CANARY' })] });
      const requestA = buildGapSeedRequest(a);
      const requestB = buildGapSeedRequest(b);
      expect(requestA?.adventureKind).toBe(adventureKind);
      expect(requestB?.adventureKind).toBe(adventureKind);
      expect(requestA?.learningTarget).toBe('reflection-eligible');
      expect(requestB?.learningTarget).toBe('reflection-eligible');
      expect(JSON.stringify(requestA)).not.toContain('TRAUMA_DRAMA_PROSE_CANARY');
      expect(JSON.stringify(requestB)).not.toContain('BANANAS_PROSE_CANARY');
    }
  });

  it('groups only same-territory selected gaps and keeps deterministic selector order', () => {
    const campaign = state({
      territories: [
        { id: 'atlas', label: 'Atlas', status: 'exploring', requiredDimensions: ['bananas', 'kiwi'], coveredDimensions: [], evidenceIds: [] },
        { id: 'other', label: 'Other', status: 'exploring', requiredDimensions: ['pear'], coveredDimensions: [], evidenceIds: [] }
      ],
      knowledgeGaps: [
        gap('gap-primary', 'underexplored', 90, { dimensionIds: ['bananas'] }),
        gap('gap-other-territory', 'unknown', 85, { territoryIds: ['other'], dimensionIds: ['pear'] }),
        gap('gap-same-territory', 'change', 80, { dimensionIds: ['kiwi'] })
      ]
    });

    expect(buildGapSeedRequest(campaign)).toMatchObject({
      gapIds: ['gap-primary', 'gap-same-territory'],
      territoryId: 'atlas',
      permittedThemes: ['bananas', 'kiwi']
    });
  });

  it('fails closed for empty/disabled/malformed selection and stays deterministic', () => {
    expect(buildGapSeedRequest(state())).toBeNull();
    expect(buildGapSeedRequest(state({ knowledgeGaps: [gap('gap-safe', 'unknown', 50)] }), { gapLimit: 0 })).toBeNull();
    expect(buildGapSeedRequest(state({ knowledgeGaps: [gap('gap-bad', 'unknown', 50, { territoryIds: ['missing-territory'] })] }))).toBeNull();

    const campaign = state({ knowledgeGaps: [gap('gap-repeat', 'underexplored', 50)] });
    const before = structuredClone(campaign);
    const first = buildGapSeedRequest(campaign);
    const second = buildGapSeedRequest(campaign);
    expect(second).toEqual(first);
    expect(campaign).toEqual(before);
  });

  it('hard-caps user-supplied bounds', () => {
    const turns = Array.from({ length: 8 }, (_, index) => turn(`turn-${index}`));
    const evidenceRecords = turns.map((record, index) => evidence(`evidence-${index}`, [record.id]));
    const campaign = state({
      turns,
      evidence: evidenceRecords,
      knowledgeGaps: Array.from({ length: 5 }, (_, index) => gap(`gap-${index}`, 'underexplored', 100 - index, { sourceEvidenceIds: evidenceRecords.map((record) => record.id) }))
    });

    const request = buildGapSeedRequest(campaign, { gapLimit: 999, evidenceClaimLimit: 999, evidenceClaimChars: 9999 });
    expect(request?.gapIds).toHaveLength(K07_MAX_GAPS);
    expect(request?.evidenceClaims).toHaveLength(K07_MAX_EVIDENCE_CLAIMS);
    expect(request?.evidenceClaims.every((claim) => claim.length <= K07_MAX_EVIDENCE_CLAIM_CHARS)).toBe(true);
  });
});
