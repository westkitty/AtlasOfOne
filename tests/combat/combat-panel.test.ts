import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ENCOUNTER_BANK } from '../../src/combat/content/encounters';
import { PACIFY_VERTICAL, PROTECT_VERTICAL, SURVIVE_VERTICAL } from '../../src/combat/content/verticals';
import { reduceCombatLifecycle } from '../../src/combat/engine';
import { playRound, startEncounter } from '../../src/combat/runner';
import type { CombatDefinition, CombatState } from '../../src/combat/types';
import { CombatPanel } from '../../src/combat/ui/CombatPanel';
import { STATUS_COPY, buildCombatPanelView } from '../../src/combat/ui/combatPanelView';

const verb = (view: ReturnType<typeof buildCombatPanelView>, id: string) => view.verbs.find((v) => v.verb === id)!;
const render = (definition: CombatDefinition, state: CombatState, extra: Record<string, unknown> = {}) =>
  renderToStaticMarkup(createElement(CombatPanel, { view: buildCombatPanelView(definition, state), onIntent: () => {}, ...extra }));

describe('C13 buildCombatPanelView', () => {
  it('always lists the five verbs in order, with LEAVE present', () => {
    for (const d of ENCOUNTER_BANK) {
      const view = buildCombatPanelView(d, startEncounter(d));
      expect(view.verbs.map((v) => v.verb)).toEqual(['attack', 'technique', 'guard', 'act', 'leave']);
    }
  });

  it('shows HP text, objective line/progress and telegraphed intents', () => {
    const view = buildCombatPanelView(PROTECT_VERTICAL, startEncounter(PROTECT_VERTICAL));
    expect(view.player.hpText).toBe('100 / 100 HP');
    expect(view.allies[0]).toMatchObject({ label: 'Wren the Porter', hpText: '30 / 30 HP' });
    expect(view.objective).toMatchObject({ id: 'protect', line: 'Keep your ally standing', progress: 0, required: 3 });
    expect(view.objective.progressText).toBe('Round 0 of 3 held');
    expect(view.intents).toHaveLength(1);
    expect(view.intents[0]).toMatchObject({ intent: 'objective-action', targetLabel: 'Wren the Porter', damage: 14 });
    expect(view.intents[0].text).toContain('Ferry Eel');
  });

  it('LEAVE is disabled with a reason when after-turn gated, then enabled from round 2', () => {
    const start = startEncounter(PACIFY_VERTICAL);
    const leave = verb(buildCombatPanelView(PACIFY_VERTICAL, start), 'leave');
    expect(leave.enabled).toBe(false);
    expect(leave.reason).toMatch(/first round/);
    const next = playRound(PACIFY_VERTICAL, start, { verb: 'guard' });
    expect(verb(buildCombatPanelView(PACIFY_VERTICAL, next), 'leave').enabled).toBe(true);
  });

  it('story-gated LEAVE follows the context gate', () => {
    const state = startEncounter(SURVIVE_VERTICAL);
    expect(verb(buildCombatPanelView(SURVIVE_VERTICAL, state), 'leave').reason).toMatch(/blocked/);
    expect(verb(buildCombatPanelView(SURVIVE_VERTICAL, state, { storyGateOpen: true }), 'leave').enabled).toBe(true);
  });

  it('technique disables with a reason when charges run out; unavailable verbs always carry a reason', () => {
    let state = startEncounter(PROTECT_VERTICAL);
    state = playRound(PROTECT_VERTICAL, state, { verb: 'technique', techniqueId: 'cover', targetId: 'wren' });
    state = playRound(PROTECT_VERTICAL, state, { verb: 'technique', techniqueId: 'cover', targetId: 'wren' });
    const view = buildCombatPanelView(PROTECT_VERTICAL, state);
    expect(verb(view, 'technique')).toMatchObject({ enabled: false });
    expect(verb(view, 'technique').reason).toMatch(/charge/);
    expect(verb(view, 'act')).toMatchObject({ enabled: false, reason: expect.any(String) });
    for (const v of view.verbs) if (!v.enabled) expect(v.reason).toBeTruthy();
  });

  it('ACT options hide completed paths and show step progress', () => {
    let state = startEncounter(PACIFY_VERTICAL);
    state = playRound(PACIFY_VERTICAL, state, { verb: 'act', actId: 'read_runes' });
    state = playRound(PACIFY_VERTICAL, state, { verb: 'act', actId: 'offer_bread' });
    const options = verb(buildCombatPanelView(PACIFY_VERTICAL, state), 'act').options;
    expect(options.map((o) => o.id)).toEqual(['offer_bread']);
    expect(options[0].label).toContain('(1/2)');
    expect(options[0].intent).toEqual({ verb: 'act', actId: 'offer_bread' });
  });

  it('all verbs disable with a reason outside the player phase, including LEAVE', () => {
    const d = ENCOUNTER_BANK[0];
    const enemyPhase = reduceCombatLifecycle(startEncounter(d), { type: 'END_PLAYER_PHASE' });
    const resolved = reduceCombatLifecycle(startEncounter(d), { type: 'RESOLVE', outcome: 'escaped' });
    for (const state of [enemyPhase, resolved]) {
      const view = buildCombatPanelView(d, state);
      expect(view.verbs).toHaveLength(5);
      for (const v of view.verbs) {
        expect(v.enabled).toBe(false);
        expect(v.reason).toBeTruthy();
        expect(v.options.every((o) => !o.enabled)).toBe(true);
      }
    }
  });

  it('statuses carry distinct glyphs and text labels (non-colour distinction)', () => {
    const glyphs = Object.values(STATUS_COPY).map((s) => s.glyph);
    const labels = Object.values(STATUS_COPY).map((s) => s.label);
    expect(new Set(glyphs).size).toBe(glyphs.length);
    expect(new Set(labels).size).toBe(labels.length);
    const state = playRound(PACIFY_VERTICAL, startEncounter(PACIFY_VERTICAL), { verb: 'act', actId: 'offer_bread' });
    const view = buildCombatPanelView(PACIFY_VERTICAL, state);
    expect(view.statuses.map((s) => s.label)).toContain('Calming');
    expect(view.statuses.every((s) => s.explanation.length > 0)).toBe(true);
  });

  it('is pure: does not mutate engine state', () => {
    const state = startEncounter(PROTECT_VERTICAL);
    const snapshot = structuredClone(state);
    buildCombatPanelView(PROTECT_VERTICAL, state);
    expect(state).toEqual(snapshot);
  });
});

describe('C13 CombatPanel render (static markup)', () => {
  it('renders HP text, objective, intent, and five buttons with LEAVE visible', () => {
    const html = render(PROTECT_VERTICAL, startEncounter(PROTECT_VERTICAL));
    expect(html).toContain('Keep your ally standing');
    expect(html).toContain('100 / 100 HP');
    expect(html).toContain('Ferry Eel: Threat');
    for (const v of ['attack', 'technique', 'guard', 'act', 'leave']) expect(html).toContain(`data-verb="${v}"`);
  });

  it('renders a disabled LEAVE with its visible reason', () => {
    const html = render(PACIFY_VERTICAL, startEncounter(PACIFY_VERTICAL));
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*data-verb="leave"|<button[^>]*data-verb="leave"[^>]*disabled=""/);
    expect(html).toContain('data-reason-for="leave"');
    expect(html).toContain('after the first round');
  });

  it('renders the option menu for an opened verb and status glyph text', () => {
    const state = playRound(PACIFY_VERTICAL, startEncounter(PACIFY_VERTICAL), { verb: 'act', actId: 'offer_bread' });
    const html = render(PACIFY_VERTICAL, state, { initialOpenVerb: 'act' });
    expect(html).toContain('data-option="offer_bread"');
    expect(html).toContain('Calming');
  });

  it('never imports engine mutators (props-in/intents-out)', () => {
    const source = readFileSync('src/combat/ui/CombatPanel.tsx', 'utf8');
    expect(source).not.toMatch(/from '\.\.\/(engine|runner|intent|gimmicks|objectives|statuses)'(?!;?\s*$)/m);
    expect(source).not.toMatch(/\b(playRound|applyAttack|resolveAct|resolveLeave|activateTechnique|resolveEnemyPhase)\(/);
  });
});

describe('C13 CSS contract', () => {
  const css = readFileSync('src/styles.css', 'utf8');
  const start = css.indexOf('/* ---- v2 CombatPanel (C13) ---- */');
  const end = css.indexOf('/* ---- end v2 CombatPanel (C13) ---- */');
  const section = css.slice(start, end);

  it('has a delimited section with 44px touch targets', () => {
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    expect(section).toMatch(/\.cp-verb, \.cp-option \{[^}]*min-height: 44px/);
  });

  it('has no fixed widths that could overflow a 320px viewport', () => {
    const widths = [...section.matchAll(/(?:^|[;{\s])(?:min-)?width:\s*(\d+)px/g)].map((m) => Number(m[1]));
    for (const w of widths) expect(w).toBeLessThanOrEqual(44);
    expect(section).toMatch(/\.cp-verbs \{[^}]*repeat\(2, minmax\(0, 1fr\)\)/);
    expect(section).toMatch(/\.combat-panel \{[^}]*max-width: 100%/);
  });
});
