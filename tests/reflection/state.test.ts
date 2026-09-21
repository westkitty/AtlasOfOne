import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, expectTypeOf, it } from 'vitest';
import type { AdventureObservation, ReflectionOutcome } from '../../src/contracts';
import { createInitialCampaign } from '../../src/game/engine';
import type { EvidenceRecord } from '../../src/game/types';
import {
  createReflectionRecord,
  recordReflection,
  reflectionEvidenceConversionRequest,
  type ReflectionInput
} from '../../src/reflection/state';

const timestamp = '2026-09-21T12:00:00.000Z';
const options = { id: 'reflection_synthetic', createdAt: timestamp };
const input = (outcome: ReflectionOutcome, overrides: Partial<ReflectionInput> = {}): ReflectionInput => ({
  sourceKind: 'journal',
  sourceIds: ['journal_synthetic'],
  question: '  What does this synthetic record mean to you?  ',
  response: '  The player supplies this synthetic nuance.  ',
  interpretation: '  Candidate interpretation from context.  ',
  outcome,
  ...overrides
});

describe('RF00/RF02/RF03/RF05 reflection authority', () => {
  it('creates durable records for every player outcome with deterministic IDs and times', () => {
    const outcomes: ReflectionOutcome[] = ['CONFIRM', 'PARTIAL', 'REJECT', 'UNCERTAIN', 'REVISE', 'PRIVATE'];
    const records = outcomes.map((outcome) => createReflectionRecord(input(outcome, outcome === 'REVISE' ? { revisionTargetId: 'evidence_before' } : {}), {
      id: `reflection_${outcome}`, createdAt: timestamp
    }));

    expect(records.map((record) => record.outcome)).toEqual(outcomes);
    expect(records.every((record) => record.question === 'What does this synthetic record mean to you?' && record.response === 'The player supplies this synthetic nuance.')).toBe(true);
    expect(records.find((record) => record.outcome === 'REJECT')).toMatchObject({ rejectedInterpretation: 'Candidate interpretation from context.' });
    expect(records.find((record) => record.outcome === 'PRIVATE')).toMatchObject({ privacyRetiredSourceIds: ['journal_synthetic'] });
  });

  it('rejects blank required fields and a revision without its durable target', () => {
    expect(() => createReflectionRecord(input('CONFIRM', { question: '  ' }), options)).toThrow('question');
    expect(() => createReflectionRecord(input('CONFIRM', { response: '  ' }), options)).toThrow('response');
    expect(() => createReflectionRecord(input('CONFIRM', { sourceIds: [' '] }), options)).toThrow('source ID');
    expect(() => createReflectionRecord(input('REVISE'), options)).toThrow('revisionTargetId');
  });

  it('appends immutably and changes only reflections and updatedAt', () => {
    const base = createInitialCampaign();
    const snapshot = { evidence: base.evidence, journal: base.journalEntries, observations: base.adventureObservations, xp: base.xp, territories: base.territories };
    const once = recordReflection(base, input('CONFIRM'), options);
    const first = once.reflections[0];
    const twice = recordReflection(once, input('PARTIAL'), { id: 'reflection_second', createdAt: '2026-09-21T12:01:00.000Z' });

    expect(base.reflections).toEqual([]);
    expect(once.reflections).toEqual([first]);
    expect(twice.reflections.map((record) => record.id)).toEqual(['reflection_synthetic', 'reflection_second']);
    expect(twice.reflections[0]).toBe(first);
    expect({ evidence: twice.evidence, journal: twice.journalEntries, observations: twice.adventureObservations, xp: twice.xp, territories: twice.territories }).toEqual(snapshot);
    expect(twice.updatedAt).toBe('2026-09-21T12:01:00.000Z');
  });

  it('selects a response-grounded CONFIRM request without evidence or progression authority', () => {
    const request = reflectionEvidenceConversionRequest(createReflectionRecord(input('CONFIRM'), options));

    expect(request).toEqual({
      reflectionId: 'reflection_synthetic', sourceKind: 'journal', sourceIds: ['journal_synthetic'], outcome: 'CONFIRM',
      responseText: 'The player supplies this synthetic nuance.', candidateInterpretation: 'Candidate interpretation from context.',
      provenance: { responseSourceId: 'reflection_synthetic', sourceIds: ['journal_synthetic'] }
    });
    for (const forbidden of ['id', 'claim', 'dimension', 'strength', 'territories', 'status', 'providerId', 'xp', 'level', 'progression']) {
      expect(request).not.toHaveProperty(forbidden);
    }
  });

  it('keeps PARTIAL player nuance distinct from candidate wording', () => {
    const request = reflectionEvidenceConversionRequest(createReflectionRecord(input('PARTIAL', {
      response: '  It fits only in this synthetic narrow case.  ',
      interpretation: 'Synthetic broad interpretation.'
    }), options));

    expect(request).toMatchObject({ outcome: 'PARTIAL', responseText: 'It fits only in this synthetic narrow case.', candidateInterpretation: 'Synthetic broad interpretation.' });
  });

  it('remembers REJECT but requests no evidence for REJECT or UNCERTAIN', () => {
    const rejected = createReflectionRecord(input('REJECT'), options);
    expect(rejected.rejectedInterpretation).toBe('Candidate interpretation from context.');
    expect(reflectionEvidenceConversionRequest(rejected)).toBeNull();
    expect(reflectionEvidenceConversionRequest(createReflectionRecord(input('UNCERTAIN'), options))).toBeNull();
  });

  it('carries a revision target without changing or replacing existing evidence', () => {
    const oldEvidence: EvidenceRecord = {
      id: 'evidence_before', dimension: 'synthetic', claim: 'Old synthetic evidence.', sourceTurnIds: ['turn_before'], basis: 'explicit',
      strength: 2, territories: ['identity'], counterEvidenceIds: [], status: 'active', origin: 'player-stated'
    };
    const base = { ...createInitialCampaign(), evidence: [oldEvidence] };
    const next = recordReflection(base, input('REVISE', { revisionTargetId: '  evidence_before  ' }), options);
    const request = reflectionEvidenceConversionRequest(next.reflections[0]);

    expect(request).toMatchObject({ outcome: 'REVISE', revisionTargetId: 'evidence_before', responseText: 'The player supplies this synthetic nuance.' });
    expect(next.evidence).toBe(base.evidence);
    expect(next.evidence).toEqual([oldEvidence]);
  });

  it('records PRIVATE source IDs but neither requests evidence nor changes source domains', () => {
    const base = {
      ...createInitialCampaign(),
      journalEntries: [{ id: 'journal_private', createdAt: timestamp, text: 'Synthetic private journal.', inputMode: 'typed' as const, privacy: 'normal' as const, status: 'active' as const, reflectionIds: [], adventureIds: [] }],
      adventureObservations: [{ id: 'observation_private', runId: 'run_private', sourceActionIds: ['action_private'], observation: 'Synthetic fictional observation.', status: 'unreflected' as const }]
    };
    const journalPrivate = recordReflection(base, input('PRIVATE', { sourceKind: 'journal', sourceIds: ['journal_private'] }), options);
    const observationPrivate = recordReflection(journalPrivate, input('PRIVATE', { sourceKind: 'adventure-observation', sourceIds: ['observation_private'] }), {
      id: 'reflection_private_observation', createdAt: '2026-09-21T12:01:00.000Z'
    });

    expect(journalPrivate.reflections[0].privacyRetiredSourceIds).toEqual(['journal_private']);
    expect(observationPrivate.reflections[1].privacyRetiredSourceIds).toEqual(['observation_private']);
    expect(reflectionEvidenceConversionRequest(journalPrivate.reflections[0])).toBeNull();
    expect(reflectionEvidenceConversionRequest(observationPrivate.reflections[1])).toBeNull();
    expect(observationPrivate.journalEntries).toBe(base.journalEntries);
    expect(observationPrivate.adventureObservations).toBe(base.adventureObservations);
    expect({ ...observationPrivate, reflections: base.reflections, updatedAt: base.updatedAt }).toEqual(base);
  });


  it('refuses forged or mismatched conversion provenance instead of crossing the authority boundary', () => {
    const confirmed = createReflectionRecord(input('CONFIRM'), options);
    const mismatchedSource = { ...confirmed, evidenceProvenance: { responseSourceId: confirmed.id, sourceIds: ['journal_other'] } };
    const mismatchedResponse = { ...confirmed, evidenceProvenance: { responseSourceId: 'reflection_other', sourceIds: [...confirmed.sourceIds] } };
    const duplicateSources = { ...confirmed, sourceIds: ['journal_synthetic', 'journal_synthetic'], evidenceProvenance: { responseSourceId: confirmed.id, sourceIds: ['journal_synthetic', 'journal_synthetic'] } };
    const paddedId = { ...confirmed, id: ' reflection_synthetic ', evidenceProvenance: { responseSourceId: ' reflection_synthetic ', sourceIds: [...confirmed.sourceIds] } };
    const paddedSource = { ...confirmed, sourceIds: [' journal_synthetic '], evidenceProvenance: { responseSourceId: confirmed.id, sourceIds: [' journal_synthetic '] } };

    expect(reflectionEvidenceConversionRequest(mismatchedSource)).toBeNull();
    expect(reflectionEvidenceConversionRequest(mismatchedResponse)).toBeNull();
    expect(reflectionEvidenceConversionRequest(duplicateSources)).toBeNull();
    expect(reflectionEvidenceConversionRequest(paddedId)).toBeNull();
    expect(reflectionEvidenceConversionRequest(paddedSource)).toBeNull();
  });

  it('keeps AdventureObservation behind the reflection firewall at type and runtime boundaries', () => {
    const observation: AdventureObservation = { id: 'observation_synthetic', runId: 'run_synthetic', sourceActionIds: ['action_synthetic'], observation: 'The fictional guard action.', status: 'unreflected' };
    expectTypeOf<AdventureObservation>().not.toMatchTypeOf<Parameters<typeof reflectionEvidenceConversionRequest>[0]>();
    // @ts-expect-error An AdventureObservation alone cannot be converted.
    reflectionEvidenceConversionRequest(observation);
    expect(reflectionEvidenceConversionRequest(observation as unknown as Parameters<typeof reflectionEvidenceConversionRequest>[0])).toBeNull();

    const reflection = createReflectionRecord(input('CONFIRM', { sourceKind: 'adventure-observation', sourceIds: [observation.id], interpretation: observation.observation, response: '  I chose this explicit synthetic response.  ' }), options);
    const request = reflectionEvidenceConversionRequest(reflection);
    expect(request).toMatchObject({ sourceIds: ['observation_synthetic'], responseText: 'I chose this explicit synthetic response.', candidateInterpretation: 'The fictional guard action.' });
    expect(request?.responseText).not.toBe(observation.observation);
  });

  it('contains no forbidden cross-domain imports, evidence records, or evidence events', () => {
    const reflectionDirectory = join(dirname(fileURLToPath(import.meta.url)), '../../src/reflection');
    const source = readdirSync(reflectionDirectory).map((file) => readFileSync(join(reflectionDirectory, file), 'utf8')).join('\n');

    expect(source).not.toMatch(/from ['"][^'"]*(?:App|game\/engine|cartographer|worker|ui)[^'"]*['"]/);
    expect(source).not.toContain('EvidenceRecord');
    expect(source).not.toContain('EVIDENCE_ADDED');
  });
});
