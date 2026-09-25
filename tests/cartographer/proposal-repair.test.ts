import { describe, expect, it, vi } from 'vitest';
import { parseAdventureSceneProposalForContext } from '../../src/cartographer/adventureSceneProposal';
import { parseProposalWithSingleRepair } from '../../src/cartographer/proposalRepair';
import { parseReflectionProposalForContext } from '../../src/cartographer/reflectionProposal';
import { parseSnapshotProposalForContext } from '../../src/cartographer/snapshotProposal';

const allowed = { entityIds: [], npcIds: ['npc_a'], memoryIds: [] };
const parseScene = (v: unknown) => parseAdventureSceneProposalForContext(v, allowed);
const goodScene = JSON.stringify({ kind: 'adventure-scene', mode: 'adventure', sceneProse: 'Synthetic.' });

describe('single-repair / no-loop policy (P07)', () => {
  it('returns a valid proposal without calling repair', async () => {
    const repair = vi.fn();
    const result = await parseProposalWithSingleRepair(goodScene, parseScene, repair);
    expect(result).toMatchObject({ ok: true, repaired: false });
    expect(repair).toHaveBeenCalledTimes(0);
  });

  it('repairs a malformed response exactly once', async () => {
    const repair = vi.fn().mockResolvedValue(goodScene);
    const result = await parseProposalWithSingleRepair('{not json', parseScene, repair);
    expect(result).toMatchObject({ ok: true, repaired: true });
    expect(repair).toHaveBeenCalledTimes(1);
    expect(repair).toHaveBeenCalledWith('{not json', 'malformed');
  });

  it('never loops: a second malformed response fails after one repair call', async () => {
    const repair = vi.fn().mockResolvedValue('still not json');
    const result = await parseProposalWithSingleRepair('nope', parseScene, repair);
    expect(result).toEqual({ ok: false, code: 'malformed', repairAttempted: true });
    expect(repair).toHaveBeenCalledTimes(1);
  });

  it('treats schema-invalid JSON as malformed', async () => {
    const result = await parseProposalWithSingleRepair(
      JSON.stringify({ kind: 'adventure-scene', mode: 'adventure' }),
      parseScene
    );
    expect(result).toEqual({ ok: false, code: 'malformed', repairAttempted: false });
  });

  it('fails authority violations immediately without repair', async () => {
    const repair = vi.fn().mockResolvedValue(goodScene);
    const raw = JSON.stringify({ kind: 'adventure-scene', mode: 'adventure', sceneProse: 'x', damage: 9 });
    const result = await parseProposalWithSingleRepair(raw, parseScene, repair);
    expect(result).toEqual({ ok: false, code: 'authority-violation', repairAttempted: false });
    expect(repair).toHaveBeenCalledTimes(0);
  });

  it('fails provenance violations immediately without repair (P03/P04/P02 parsers)', async () => {
    const repair = vi.fn().mockResolvedValue(goodScene);
    const scene = JSON.stringify({
      kind: 'adventure-scene', mode: 'adventure', sceneProse: 'x', referencedNpcIds: ['npc_invented']
    });
    const snapshot = JSON.stringify({
      kind: 'snapshot', mode: 'snapshot', asOfDate: '2026-01-01', revisable: true, summary: 's',
      claims: [{ text: 'c', provenanceIds: ['invented'] }], uncertainties: ['u']
    });
    const reflection = JSON.stringify({
      kind: 'reflection', mode: 'reflection', question: 'q?',
      interpretationCandidate: 'i', supportingSourceIds: ['invented']
    });

    const cases: Array<[string, (v: unknown) => unknown]> = [
      [scene, parseScene],
      [snapshot, (v: unknown) => parseSnapshotProposalForContext(v, ['obs_1'])],
      [reflection, (v: unknown) => parseReflectionProposalForContext(v, ['obs_1'])]
    ];
    for (const [raw, parse] of cases) {
      const result = await parseProposalWithSingleRepair(raw, parse, repair);
      expect(result).toEqual({ ok: false, code: 'provenance-violation', repairAttempted: false });
    }
    expect(repair).toHaveBeenCalledTimes(0);
  });

  it('reports the repaired response failure code (e.g. authority after repair)', async () => {
    const repair = vi.fn().mockResolvedValue(
      JSON.stringify({ kind: 'adventure-scene', mode: 'adventure', sceneProse: 'x', xp: 1 })
    );
    const result = await parseProposalWithSingleRepair('bad', parseScene, repair);
    expect(result).toEqual({ ok: false, code: 'authority-violation', repairAttempted: true });
    expect(repair).toHaveBeenCalledTimes(1);
  });

  it('a throwing repair callback degrades to malformed after one call', async () => {
    const repair = vi.fn().mockRejectedValue(new Error('offline'));
    const result = await parseProposalWithSingleRepair('bad', parseScene, repair);
    expect(result).toEqual({ ok: false, code: 'malformed', repairAttempted: true });
    expect(repair).toHaveBeenCalledTimes(1);
  });

  it('without a repair callback, malformed fails with no repair attempt', async () => {
    const result = await parseProposalWithSingleRepair('bad', parseScene);
    expect(result).toEqual({ ok: false, code: 'malformed', repairAttempted: false });
  });
});
