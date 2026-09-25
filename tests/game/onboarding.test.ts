import { describe, expect, it } from 'vitest';
import { applyGameEvents, createInitialCampaign } from '../../src/game/engine';
import { campaignStateSchemaV1 } from '../../src/persistence/schema';
import { campaignStateSchemaV2 } from '../../src/persistence/schema-v2';
import { migrateCampaign } from '../../src/persistence/migrations';

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

  it('keeps onboarding defaults compatible across frozen v1 input and active v2 state', () => {
    const initial = createInitialCampaign();
    const parsedInitial = campaignStateSchemaV2.parse(initial);
    expect(parsedInitial.schemaVersion).toBe(2);
    expect(parsedInitial.onboardingCompleted).toBe(false);

    const completed = applyGameEvents(initial, [
      { type: 'ONBOARDING_COMPLETED', sass: 'medium', voiceMode: 'talk' }
    ]);
    const parsedCompleted = campaignStateSchemaV2.parse(completed);
    expect(parsedCompleted.onboardingCompleted).toBe(true);

    // Historical v1 data may predate onboardingCompleted and every v2 collection.
    const legacy = structuredClone(completed) as unknown as Record<string, unknown>;
    legacy.schemaVersion = 1;
    delete legacy.onboardingCompleted;
    for (const field of [
      'journalEntries',
      'knowledgeGaps',
      'adventureSeeds',
      'adventureRuns',
      'adventureActions',
      'adventureObservations',
      'reflections',
      'adventureMemories',
      'atlasSnapshots'
    ]) delete legacy[field];

    const parsedLegacy = campaignStateSchemaV1.parse(legacy);
    expect(parsedLegacy.onboardingCompleted).toBe(false);

    const migrated = migrateCampaign(legacy);
    expect(migrated.schemaVersion).toBe(2);
    expect(migrated.onboardingCompleted).toBe(false);
  });
});
