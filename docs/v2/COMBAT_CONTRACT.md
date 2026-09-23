# Atlas v2 Minimal Combat Contract

**Packet:** C00  
**Status:** candidate freeze pending review  
**Depends on:** D05  
**Implements:** no runtime combat code

This contract freezes the smallest deterministic Combat ruleset that C01-C17 may implement.

Combat exists to add tension, playfulness, pacing and story variety. It does not become a second progression game, a loot treadmill, or evidence about Greyson.

---

## 1. Core player verbs

The universal **verb set** is exactly:

1. **ATTACK**
2. **TECHNIQUE**
3. **GUARD**
4. **ACT**
5. **LEAVE**

This freezes capability, not button chrome. The mobile UI may present ATTACK / TECHNIQUE / GUARD / ACT as the four primary combat controls and render LEAVE contextually, matching section 16.4. LEAVE must remain discoverable whenever the encounter permits an exit.

Encounter-specific interactions belong under ACT or contextual Technique entries. They do not become new permanent top-level commands.

---

## 2. Minimal combat state

The runtime contract remains centered on the master-plan shape:

```ts
interface CombatDefinition {
  id: string;
  encounterId: string;
  objective: CombatObjective;
  gimmicks: CombatGimmick[];
  combatants: CombatantDefinition[];
  turnLimit?: number;
  rewards: FixedCombatReward[];
  fleeRule: 'always' | 'after-turn' | 'story-gated';
}

interface CombatState {
  definitionId: string;
  round: number;
  phase: 'player' | 'enemy' | 'resolved';
  combatants: CombatantState[];
  statuses: CombatStatus[];
  objectiveProgress: number;
  outcome?: 'victory' | 'pacified' | 'escaped' | 'defeat' | 'story';
}
```

C01 may refine internal field names but may not add a gear/class/loot/metagame layer.

### 2.1 Player encounter-local envelope

Initial deterministic defaults from Appendix I:

```text
starting HP:                         100
persistent HP between encounters:   none
baseline ATTACK damage:              18
successful timed ATTACK bonus:       +6
timed ATTACK total:                  24
GUARD incoming reduction:            50%
timed/perfect GUARD reduction:       75%
TECHNIQUE charges at encounter start: 2
ordinary status duration target:     1-2 rounds
```

These are tuning defaults, not canon. Only C17 may change them after encounter simulation/browser evidence.

---

## 3. Deterministic damage formulas

### 3.1 ATTACK

Before scenario/status modifiers:

```ts
attackDamage = 18 + (timedSuccess ? 6 : 0);
```

Rules:

- missing or declining the timing input still deals **18**;
- timing may improve ATTACK, never determine whether ATTACK works;
- MVP has no random damage roll;
- MVP has no general player ATK stat or enemy DEF spreadsheet;
- shield/exposed/counter gimmicks may apply deterministic scenario modifiers later, but cannot change the base formula contract.

### 3.2 Incoming damage and GUARD

Enemy actions declare deterministic raw integer damage inside the approved encounter definition/intent.

Ordinary starting envelope:

```text
enemy raw action damage: 10-22
```

Reduction:

```ts
unguardedDamage = rawDamage;
guardedDamage = ceil(rawDamage * 0.50);
timedGuardDamage = ceil(rawDamage * 0.25);
```

`ceil` is a C00 implementation clarification for integer HP: it prevents rounding from making GUARD stronger than the stated 50%/75% reductions. Appendix I fixes the percentages but does not prescribe integer rounding.

Damage never depends on a model response or random roll.

### 3.3 HP

- HP is encounter-local.
- An encounter starts the player at 100 HP unless a later explicitly reviewed encounter modifier says otherwise.
- HP does not persist as an attrition economy between encounters.
- Resolution/defeat is determined by the Combat engine.
- Narrative text may describe injury or strain but cannot alter numeric HP.

---

## 4. TECHNIQUE contract

TECHNIQUE is a small tactical verb, not a skill-tree system.

Baseline:

- 2 encounter-local charges at start;
- technique effects are deterministic;
- each Technique has one tactical job;
- Techniques may be contextual to an Adventure/encounter;
- no inventory of dozens of permanent abilities is required.

Approved tactical jobs include:

- interrupt a charge;
- protect an ally;
- expose a shielded target;
- reposition objective state;
- trade damage for control.

C04 owns the registry and exact charge-cost/cooldown representation.

---

## 5. ACT contract

ACT is scenario-owned interaction.

It may target:

- an enemy;
- an ally;
- an object;
- terrain;
- the encounter objective.

ACT can:

- reveal information;
- change deterministic objective/gimmick state;
- create a pacification path;
- interrupt or redirect a scripted mechanic;
- produce an AdventureObservation.

ACT cannot:

- confirm a personality claim;
- directly create Evidence;
- let model prose declare pacification complete.

When a nonviolent route exists, deterministic ACT progress uses scenario conditions. The default tuning shape is **0-3 steps**.

---

## 6. LEAVE / fail-forward contract

LEAVE is always part of the player verb contract. Its control may be contextual on mobile, and immediate physical exit may still be story-gated by the encounter definition.

Flee rules:

- `always` — leave now;
- `after-turn` — deterministic encounter condition permits exit after the declared threshold;
- `story-gated` — a visible story/objective condition controls when exit becomes possible.

LEAVE is not moral failure.

Withdrawal/defeat produces a defined fail-forward consequence such as:

- retreat to sanctuary;
- alternate route;
- NPC interruption/rescue;
- story consequence;
- retry-later state.

**C00 fail-forward choice:** defeat/withdrawal never subtracts XP or applies a self-knowledge penalty, and never creates a personality inference. The master plan explicitly forbids punishment-loop framing and requires defined fail-forward outcomes; C00 makes the progression consequence unambiguous.

---

## 7. Objective registry

Frozen objective IDs:

```ts
type CombatObjective =
  | 'defeat'
  | 'survive'
  | 'escape'
  | 'protect'
  | 'interrupt'
  | 'pacify'
  | 'reach-object'
  | 'hold-position'
  | 'escort'
  | 'discover-act';
```

MVP C07 implements first:

1. `defeat`
2. `survive`
3. `protect`
4. `interrupt`
5. `pacify`

Objective truth is deterministic.

### 7.1 Initial turn targets

- ordinary: usually 2-5 meaningful player turns;
- elite: usually 4-7;
- boss phase: usually 5-9;
- ordinary survival: usually 3-5 rounds.

If ordinary encounters routinely exceed target length without strategic error, tune effective HP/objective design in C17 rather than inventing stronger gear progression.

---

## 8. Gimmick registry

Frozen gimmick IDs:

```ts
type CombatGimmick =
  | 'shielded'
  | 'charging'
  | 'counterattacking'
  | 'enraged'
  | 'healing'
  | 'swarm'
  | 'linked-pair'
  | 'stance-changing'
  | 'mimic-disguise'
  | 'unstable-terrain'
  | 'morale-fear'
  | 'timed-vulnerability'
  | 'environmental-hazard'
  | 'ally-in-danger'
  | 'non-kill-target';
```

MVP C08 implements first:

1. `shielded`
2. `charging`
3. `counterattacking`
4. `swarm`
5. pacify/ACT state through `non-kill-target` plus objective-owned state

Gimmicks are deterministic templates. Model prose may skin them but cannot invent mechanic semantics at runtime.

---

## 9. Enemy envelope

Initial tuning envelope:

```text
ordinary enemy total effective HP: 35-70
elite total effective HP:          80-130
boss-phase effective HP:           110-180
ordinary enemy action damage:      10-22
ordinary enemy count:              1-3
```

A swarm may represent more entities fictionally while keeping bounded engine state.

"Effective HP" may include shields/phases. It is not permission to inflate raw HP indefinitely.

---

## 10. Initiative and visible intent

- player acts first by default;
- an explicit, story-telegraphed `ambush` definition may alter the first action;
- enemy next intent is visible whenever planning matters;
- the model may word the telegraph, but the engine owns its category and resolution.

Frozen intent categories:

```ts
type CombatIntent =
  | 'attack'
  | 'defend'
  | 'charge'
  | 'recover'
  | 'hazard'
  | 'objective-action'
  | 'special-act-reactive';
```

C09 owns deterministic intent selection/telegraph state.

---

## 11. Minimal status vocabulary

MVP statuses:

- `guarded`
- `exposed`
- `charging`
- `staggered`
- `pacifiable`
- `protected-target`

Ordinary duration target: 1-2 rounds.

C10 freezes exact resolution order/idempotency before additional status families are allowed.

Do not add generic poison/burn/freeze families until a concrete Adventure needs them.

---

## 12. Timing input accessibility

Timing is texture, never a gate.

Required invariants:

- generous window;
- missing the window performs the base action;
- every ordinary MVP encounter is winnable without a perfect timed input;
- reduced-motion mode does not rely on animation timing cues alone;
- tests inject deterministic timing quality/state rather than sleeping on wall-clock animation;
- no frame-perfect mechanics.

C14 owns browser/touch/keyboard/reduced-motion proof.

---

## 13. Rewards and anti-grind

Rewards are fixed and encounter-owned.

Allowed reward families:

- story consequence;
- fixed encounter progress;
- map/world change;
- route access;
- NPC memory;
- journal artifact;
- cosmetic relic;
- bounded fixed XP;
- contextual Technique;
- scene access.

Rules:

- rewards are keyed to deterministic encounter completion;
- completion reward is nonfarmable for the same encounter instance/ID;
- no random loot table;
- no rarity ladder;
- no repeatable grind loop;
- avoiding reflection/journaling must not become mechanically optimal.

C01/C11 may choose the durable representation, but not change this authority.

---

## 14. Combat/self-knowledge firewall

A Combat action may create an `AdventureObservation`.

It does **not** create Evidence.

```text
CombatAction
   -> AdventureObservation
   -> optional Reflection
   -> Greyson response/decision
   -> deterministic evidence conversion, if justified
```

Example:

```text
Observation: Greyson guarded the companion three turns in a row.
NOT Evidence: Greyson always prioritizes others over himself.
```

Defeat, fleeing, aggression, pacification or timing performance carry zero automatic personality meaning.

---

## 15. Model authority

Combat resolves without a provider.

TypeScript owns:

- HP;
- damage;
- charges;
- statuses;
- phase/turn order;
- enemy intent;
- objective progress;
- outcome;
- reward;
- persistence.

A model may propose:

- enemy personality/name from approved content;
- narration;
- ACT wording;
- contextual description;
- story-consequence prose;
- allowed-template visual/fiction skin.

A provider cannot author authoritative HP, damage, objective truth, status change, turn order, outcome or reward.

C12 must mutation-prove this firewall.

---

## 16. Persistence boundary

C00 does not add Combat to M01 schema.

C11 may add/persist Combat state only after:

- C01 defines the deterministic state/reducer;
- M05 v2 import/export exists;
- shared schema authority accepts the durable representation.

Mid-combat save/reload must preserve engine truth, not narrative reconstruction.

---

## 17. Explicit non-goals

Do not build in this cycle:

- equipment rarity progression;
- large inventory;
- crafting;
- elemental spreadsheet;
- classes/build optimization;
- random stat rolls;
- large permanent skill trees;
- grind loops;
- loot boxes/gacha;
- mandatory twitch/reflex minigames;
- provider-dependent mechanics;
- permanent HP attrition across adventures.

---

## 18. Comparative-recon notes

The recon validates, rather than replaces, the master-plan direction:

- **Sea of Stars** documents timed inputs that increase outgoing/reduce incoming damage and explicitly presents its combat as no-grind; Atlas adopts the "bonus texture" idea but keeps timing optional and deterministic.
- **Paper Mario's official manual** documents action commands that increase damage and timed guarding that reduces incoming damage; Atlas keeps the interaction pattern without making success mandatory.
- **UNDERTALE** demonstrates scenario-specific ACT/MERCY resolution alongside ordinary attack choices; Atlas adopts scenario-owned ACT/nonviolent resolution, not its bullet-dodging layer.
- **Into the Breach** explicitly telegraphs enemy attacks before resolution; Atlas adopts visible deterministic intent when planning matters.

Sources:

- https://seaofstarsgame.co/
- https://www.nintendo.com/eu/media/downloads/games_8/emanuals/nintendo_8/Manual_Nintendo64_PaperMario_EN.pdf
- https://store.steampowered.com/app/391540/UNDERTALE/
- https://store.steampowered.com/app/590380/Into_the_Breach/

---

## 19. C00 verdict

**CANDIDATE FREEZE.**

C01 may implement only after this contract receives review. Numeric tuning may change only through C17 with evidence.
