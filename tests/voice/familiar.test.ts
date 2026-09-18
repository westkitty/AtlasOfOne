import { describe, expect, it } from 'vitest';
import { familiarForPrivacy, familiarForVoiceState } from '../../src/familiar';

describe('Atlas Familiar Bus adapter', () => {
  it('maps the existing voice lifecycle without changing it', () => {
    expect(familiarForVoiceState('idle', 1)).toMatchObject({ attention: 'idle', reaction: 'neutral' });
    expect(familiarForVoiceState('listening', 2)).toMatchObject({ attention: 'focused', reaction: 'curious' });
    expect(familiarForVoiceState('thinking', 3)).toMatchObject({ attention: 'focused', reaction: 'neutral' });
    expect(familiarForVoiceState('speaking', 4)).toMatchObject({ attention: 'aware', reaction: 'pleased' });
    expect(familiarForVoiceState('error', 5)).toMatchObject({ attention: 'interrupted', reaction: 'error' });
  });

  it('makes privacy visible without changing private-topic authority', () => {
    expect(familiarForPrivacy(0, 1)).toMatchObject({ attention: 'idle', reaction: 'neutral' });
    expect(familiarForPrivacy(1, 2)).toMatchObject({ attention: 'aware', reaction: 'warning' });
    expect(familiarForPrivacy(20, 3).intensity).toBeLessThanOrEqual(0.75);
  });
});
