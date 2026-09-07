import { describe, expect, it } from 'vitest';
import { cartographerTurnSchema } from '../../src/cartographer/schema';

const base={reply:'Synthetic reply.',nextQuestion:'Synthetic next question?',presentation:'normal' as const,evidence:[],connections:[],quoteCandidates:[],summaryPatch:'',achievementCandidates:[]};
describe('Cartographer contract',()=>{
  it('accepts structured conversational output',()=>{expect(cartographerTurnSchema.parse(base).reply).toBe('Synthetic reply.');});
  it('strips progression-looking fields',()=>{const parsed=cartographerTurnSchema.parse({...base,xp:99999,level:8,questComplete:true,unlocks:['everything']});expect('xp' in parsed).toBe(false);expect('level' in parsed).toBe(false);expect('questComplete' in parsed).toBe(false);expect('unlocks' in parsed).toBe(false);});
});
