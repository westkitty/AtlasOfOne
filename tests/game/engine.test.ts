import { describe, expect, it } from 'vitest';
import { createMockTurn, getMockPrompt, recordsFromMockTurn } from '../../src/cartographer/mock';
import { CORE_COMMANDS } from '../../src/game/data';
import { applyGameEvent, applyGameEvents, createInitialCampaign, levelForXp, territoryStatusForCoverage } from '../../src/game/engine';
import type { EvidenceRecord, GameEvent } from '../../src/game/types';
import { syntheticDevelopedAnswer, syntheticRevisionAnswer, syntheticShortAnswer } from '../fixtures/synthetic';

describe('agency invariants', () => {
  it('keeps protected commands outside unlock progression', () => {
    expect(CORE_COMMANDS).toEqual(['PASS','PRIVATE','STOP','SERIOUS','HELP','SASS']);
    expect(createInitialCampaign().unlocks.map((item) => item.id)).not.toContain('pass');
  });
  it('private topics are excluded from intentional mock question selection', () => {
    const start = createInitialCampaign(); const first = getMockPrompt(start);
    const next = applyGameEvent(start,{type:'PRIVATE_TOPIC_ADDED',topic:first.dimension});
    expect(getMockPrompt(next).dimension).not.toBe(first.dimension);
  });
  it('serious mode preserves progress while remaining quiet', () => {
    const quiet = applyGameEvent(createInitialCampaign(),{type:'PRESENTATION_SET',mode:'quiet'});
    const prompt = getMockPrompt(quiet); const turn = createMockTurn(quiet,prompt,syntheticShortAnswer); const records=recordsFromMockTurn(prompt,syntheticShortAnswer,turn);
    const next=applyGameEvents(quiet,[{type:'ANSWER_ACCEPTED',turn:records.turnRecord},...records.evidence.map((evidence)=>({type:'EVIDENCE_ADDED',evidence}) as GameEvent)]);
    expect(next.presentation).toBe('quiet'); expect(next.xp).toBeGreaterThan(0);
  });
});

describe('deterministic progression', () => {
  it('derives levels from XP',()=>{expect(levelForXp(0)).toBe(1);expect(levelForXp(35)).toBe(2);expect(levelForXp(675)).toBe(8);});
  it('derives territory status from coverage',()=>{expect(territoryStatusForCoverage(0,4)).toBe('fogged');expect(territoryStatusForCoverage(1,4)).toBe('exploring');expect(territoryStatusForCoverage(2,4)).toBe('charted');expect(territoryStatusForCoverage(4,4)).toBe('deeply-charted');});
  it('awards deterministic answer XP and quest progress',()=>{const s=createInitialCampaign();const p=getMockPrompt(s);const t=createMockTurn(s,p,syntheticDevelopedAnswer);const r=recordsFromMockTurn(p,syntheticDevelopedAnswer,t);const n=applyGameEvent(s,{type:'ANSWER_ACCEPTED',turn:r.turnRecord});expect(n.xp).toBe(11);expect(n.quests.find(q=>q.id==='first-coordinates')?.progress).toBe(1);});
  it('rewards revision without a vulnerability multiplier',()=>{const s=createInitialCampaign();const p=getMockPrompt(s);const t=createMockTurn(s,p,syntheticRevisionAnswer);const r=recordsFromMockTurn(p,syntheticRevisionAnswer,t);const n=applyGameEvent(s,{type:'ANSWER_ACCEPTED',turn:r.turnRecord});expect(r.turnRecord.revision).toBe(true);expect(n.xp).toBe(13);});
  it('cannot bypass progression by dispatching model-like unlock events',()=>{const s=createInitialCampaign();const n=applyGameEvents(s,[{type:'LEVEL_UP',level:8},{type:'ABILITY_UNLOCKED',unlockId:'turnaround-reveal'},{type:'ACHIEVEMENT_UNLOCKED',achievementId:'cartographer'}]);expect(n.level).toBe(1);expect(n.unlocks.find(u=>u.id==='turnaround-reveal')?.unlockedAt).toBeUndefined();});
});

describe('evidence retraction',()=>{
  it('retracts derived evidence and recomputes coverage',()=>{const s=createInitialCampaign();const p=getMockPrompt(s);const t=createMockTurn(s,p,syntheticShortAnswer);const r=recordsFromMockTurn(p,syntheticShortAnswer,t);const withE=applyGameEvents(s,[{type:'ANSWER_ACCEPTED',turn:r.turnRecord},...r.evidence.map((evidence)=>({type:'EVIDENCE_ADDED',evidence}) as GameEvent)]);expect(withE.territories.find(x=>x.id===p.territoryId)?.coveredDimensions).toContain(p.dimension);const n=applyGameEvent(withE,{type:'ANSWER_RETRACTED',turnId:r.turnRecord.id});expect(n.evidence.every(e=>e.status==='retracted')).toBe(true);expect(n.territories.find(x=>x.id===p.territoryId)?.coveredDimensions).not.toContain(p.dimension);});
  it('does not award duplicate evidence XP',()=>{const s=createInitialCampaign();const evidence:EvidenceRecord={id:'ev1',dimension:'self-description',claim:'Synthetic claim',sourceTurnIds:['turn1'],basis:'explicit',strength:1,territories:['identity'],counterEvidenceIds:[],status:'active'};const one=applyGameEvent(s,{type:'EVIDENCE_ADDED',evidence});const two=applyGameEvent(one,{type:'EVIDENCE_ADDED',evidence:{...evidence,id:'ev2'}});expect(one.xp).toBe(2);expect(two.xp).toBe(2);});
});
