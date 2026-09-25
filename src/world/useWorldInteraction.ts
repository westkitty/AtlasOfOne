import { useEffect, useMemo, useRef, useState } from 'react';
import type { CampaignState, GameEvent } from '../game/types';
import { neighboursOf, regionFor, routeBetween } from './geography';
import { playStinger } from './audio';
import { sanctuaryFor } from './sanctuaries';
import type { InteractableTarget } from './playerController';

export interface WorldInteractionOptions {
  state: CampaignState;
  hydrated: boolean;
  talking: boolean;
  encounterActive: boolean;
  menuOpen: boolean;
  worldVisible: boolean;
  dispatch: (...events: GameEvent[]) => void;
  setTalking: (value: boolean) => void;
  setReply: (value: string) => void;
}

export interface ArrivalNotice {
  territoryId: string;
  label: string;
  sanctuary: string;
  glyph: string;
}

/**
 * Owns Worldwalker interaction/presentation orchestration around WorldMap.
 *
 * The hook may emit existing world/encounter GameEvents through the supplied
 * dispatcher, but it never mutates CampaignState directly and owns no reward,
 * eligibility, persistence, or progression rule.
 */
export function useWorldInteraction({
  state,
  hydrated,
  talking,
  encounterActive,
  menuOpen,
  worldVisible,
  dispatch,
  setTalking,
  setReply
}: WorldInteractionOptions) {
  const [activeWaystone, setActiveWaystone] = useState<{ id: string; label: string; inscription?: string } | null>(null);
  const [activeInterior, setActiveInterior] = useState<string | null>(null);
  const [arrivalNotice, setArrivalNotice] = useState<ArrivalNotice | null>(null);
  const [travelling, setTravelling] = useState(false);
  const [travelFrom, setTravelFrom] = useState<string | null>(null);
  const [pulse, setPulse] = useState<{ xp: number; territoryId: string; key: number } | null>(null);
  const [facing, setFacing] = useState<'front' | 'back' | 'left' | 'right'>('front');

  const previousTerritory = useRef<string | null>(null);
  const turnSnapshot = useRef<{ xp: number; turns: number } | null>(null);

  const reachableRegions = useMemo(
    () => neighboursOf(state.activeTerritory).filter((id) => {
      const territory = state.territories.find((item) => item.id === id);
      return Boolean(territory) && territory!.requiredDimensions.some(
        (dimension) => !state.privateTopics.includes(dimension) && !territory!.coveredDimensions.includes(dimension)
      );
    }),
    [state.activeTerritory, state.territories, state.privateTopics]
  );

  useEffect(() => {
    const previous = turnSnapshot.current;
    turnSnapshot.current = { xp: state.xp, turns: state.turns.length };
    if (!previous || !hydrated) return;
    if (state.turns.length !== previous.turns + 1) return;
    const landed = state.turns[state.turns.length - 1];
    setPulse({
      xp: state.xp - previous.xp,
      territoryId: landed?.territoryId ?? state.activeTerritory,
      key: Date.now()
    });
  }, [state.turns.length, state.xp, state.activeTerritory, hydrated]);

  useEffect(() => {
    if (!pulse) return;
    const timer = window.setTimeout(() => setPulse(null), 1200);
    return () => window.clearTimeout(timer);
  }, [pulse]);

  useEffect(() => {
    const from = previousTerritory.current;
    previousTerritory.current = state.activeTerritory;
    if (!from || from === state.activeTerritory) return;

    setActiveInterior(null);
    const region = regionFor(state.activeTerritory);
    const sanctuary = sanctuaryFor(state.activeTerritory);
    setArrivalNotice({
      territoryId: state.activeTerritory,
      label: region.label,
      sanctuary: sanctuary.name,
      glyph: sanctuary.glyph
    });
    playStinger('discover', state.presentation === 'quiet');

    const noticeTimer = window.setTimeout(() => setArrivalNotice(null), 2800);
    const start = regionFor(from).stand;
    const end = regionFor(state.activeTerritory).stand;

    if (Math.abs(end.x - start.x) >= Math.abs(end.y - start.y)) {
      setFacing(end.x >= start.x ? 'right' : 'left');
    } else {
      setFacing(end.y < start.y ? 'back' : 'front');
    }

    if (state.settings.reducedMotion) {
      return () => window.clearTimeout(noticeTimer);
    }

    setTravelFrom(from);
    setTravelling(true);
    const travelTimer = window.setTimeout(() => {
      setTravelling(false);
      setTravelFrom(null);
    }, 2700);

    return () => {
      window.clearTimeout(noticeTimer);
      window.clearTimeout(travelTimer);
    };
  }, [state.activeTerritory, state.settings.reducedMotion, state.presentation]);

  const onSelectRegion = (territoryId: string) => {
    if (territoryId === state.activeTerritory) return;
    const from = state.activeTerritory;
    dispatch(
      ...(routeBetween(from, territoryId)
        ? [{ type: 'ROUTE_TRAVERSED', from, to: territoryId } as GameEvent]
        : []),
      { type: 'ACTIVE_TERRITORY_SET', territoryId }
    );
  };

  const onPositionSettled = (position: { x: number; y: number; territoryId: string }) => {
    dispatch({ type: 'WORLD_POSITION_SET', ...position });
  };

  const onInteract = (target: InteractableTarget | null) => {
    const quiet = state.presentation === 'quiet';

    if (!target || target.type === 'landmark') {
      const regionId = target?.id ?? state.activeTerritory;
      dispatch(
        ...(regionId !== state.activeTerritory
          ? [{ type: 'ACTIVE_TERRITORY_SET', territoryId: regionId } as GameEvent]
          : []),
        { type: 'LANDMARK_DISCOVERED', landmarkId: regionId, territoryId: regionId }
      );
      playStinger('dialogue', quiet);
      setTalking(true);
      setReply('');
      return;
    }

    if (target.type === 'door') {
      playStinger('door', quiet);
      dispatch(
        { type: 'ENCOUNTER_LOCATED', kind: 'door', id: target.id, territoryId: state.activeTerritory },
        { type: 'DOOR_OPENED', doorId: target.id }
      );
      setReply('');
      setTalking(true);
      return;
    }

    if (target.type === 'boss') {
      playStinger('boss', quiet);
      dispatch(
        { type: 'ENCOUNTER_LOCATED', kind: 'boss', id: target.id, territoryId: state.activeTerritory },
        { type: 'BOSS_STARTED', bossId: target.id }
      );
      setReply('');
      setTalking(true);
      return;
    }

    if (target.type === 'waystone') {
      playStinger('discover', quiet);
      setActiveWaystone({ id: target.id, label: target.label, inscription: target.inscription });
    }
  };

  const controlsDisabled = talking || encounterActive || menuOpen || !worldVisible || Boolean(activeWaystone);

  return {
    activeWaystone,
    dismissWaystone: () => setActiveWaystone(null),
    activeInterior,
    setActiveInterior,
    arrivalNotice,
    travelling,
    travelFrom,
    pulse,
    facing,
    reachableRegions,
    controlsDisabled,
    onSelectRegion,
    onPositionSettled,
    onInteract
  };
}
