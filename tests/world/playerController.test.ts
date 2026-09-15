import { describe, expect, it } from 'vitest';
import { detectTerritory, findNearbyInteractable, updatePlayer } from '../../src/world/playerController';
import { createInitialCampaign } from '../../src/game/engine';
import { REGIONS } from '../../src/world/geography';

describe('overworld player controller', () => {
  it('detects territory based on spatial coordinates', () => {
    // Identity origin clearing
    expect(detectTerritory(178, 350).id).toBe('identity');
    // Values cairn in western highlands
    expect(detectTerritory(90, 220).id).toBe('values');
    // Republic of Greyson on northern plateau
    expect(detectTerritory(188, 120).id).toBe('politics');
    // Cognition on eastern terraces
    expect(detectTerritory(285, 230).id).toBe('cognition');
  });

  it('updates player position and facing direction from movement vector', () => {
    const campaign = createInitialCampaign();
    const initial = {
      x: 178,
      y: 352,
      facing: 'front' as const,
      isMoving: false,
      territoryId: 'identity',
      nearbyTarget: null
    };

    // Move East (right)
    const movedEast = updatePlayer(initial, { x: 1, y: 0 }, 0.1, campaign);
    expect(movedEast.x).toBeGreaterThan(initial.x);
    expect(movedEast.y).toBe(initial.y);
    expect(movedEast.facing).toBe('right');
    expect(movedEast.isMoving).toBe(true);

    // Move North (back)
    const movedNorth = updatePlayer(initial, { x: 0, y: -1 }, 0.1, campaign);
    expect(movedNorth.y).toBeLessThan(initial.y);
    expect(movedNorth.facing).toBe('back');
    expect(movedNorth.isMoving).toBe(true);
  });

  it('identifies nearby interactable landmark when in range', () => {
    const campaign = createInitialCampaign();
    const identityRegion = REGIONS.find((r) => r.id === 'identity')!;

    // Standing right next to Identity landmark (stones)
    const target = findNearbyInteractable(
      identityRegion.centre.x + 10,
      identityRegion.centre.y + 10,
      campaign
    );

    expect(target).not.toBeNull();
    expect(target?.type).toBe('landmark');
    expect(target?.id).toBe('identity');
  });

  it('returns null when far away from any landmark or encounter', () => {
    const campaign = createInitialCampaign();
    // Middle of open terrain far from landmarks, doors, or waystones
    const target = findNearbyInteractable(100, 320, campaign);
    expect(target).toBeNull();
  });
});
