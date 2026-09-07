import { describe, expect, it } from 'vitest';
import { applyGameEvents, createInitialCampaign } from '../../src/game/engine';
import { campaignStateSchemaV1 } from '../../src/persistence/schema';

describe('Phase 6 minimal onboarding engine invariants', () => {
  it('creates an initial campaign with onboardingCompleted set to false', () => {
    const campaign = createInitialCampaign();
    expect(campaign.onboardingCompleted).toBe(false);
    expect(campaign.xp).toBe(0);
    expect(campaign.level).toBe(1);
    expect(campaign.evidence).toEqual([]);
    expect(campaign.unlocks.filter((u) => u.unlockedAt)).toEqual([]);
  });

  it('completes onboarding with chosen sass and voiceMode without altering progression', () => {
    const initial = createInitialCampaign();
    const updated = applyGameEvents(initial, [
      { type: 'ONBOARDING_COMPLETED', sass: 'risks-understood', voiceMode: 'talk' }
    ]);

    expect(updated.onboardingCompleted).toBe(true);
    expect(updated.settings.sass).toBe('risks-understood');
    expect(updated.settings.voiceMode).toBe('talk');

    // Strict zero-progression invariants
    expect(updated.xp).toBe(0);
    expect(updated.level).toBe(1);
    expect(updated.evidence.length).toBe(0);
    expect(updated.unlocks.filter((u) => u.unlockedAt).length).toBe(0);
    expect(updated.achievements.filter((a) => a.unlockedAt).length).toBe(0);
    expect(updated.quests.filter((q) => q.status === 'complete').length).toBe(0);
  });

  it('preserves permanent controls when onboarding completes with low sass and text mode', () => {
    const initial = createInitialCampaign();
    const updated = applyGameEvents(initial, [
      { type: 'ONBOARDING_COMPLETED', sass: 'low', voiceMode: 'text' }
    ]);

    expect(updated.onboardingCompleted).toBe(true);
    expect(updated.settings.sass).toBe('low');
    expect(updated.settings.voiceMode).toBe('text');
    expect(updated.sessionStatus).toBe('active');
    expect(updated.presentation).toBe('normal');
  });

  it('round-trips through schema v1 with backwards-compatible default', () => {
    const initial = createInitialCampaign();
    const parsedInitial = campaignStateSchemaV1.parse(initial);
    expect(parsedInitial.onboardingCompleted).toBe(false);

    const completed = applyGameEvents(initial, [
      { type: 'ONBOARDING_COMPLETED', sass: 'medium', voiceMode: 'talk' }
    ]);
    const parsedCompleted = campaignStateSchemaV1.parse(completed);
    expect(parsedCompleted.onboardingCompleted).toBe(true);

    // Backwards-compatible default when onboardingCompleted is omitted
    const { onboardingCompleted: _, ...withoutOnboarding } = completed;
    const parsedOmitted = campaignStateSchemaV1.parse(withoutOnboarding);
    expect(parsedOmitted.onboardingCompleted).toBe(false);
  });
});
