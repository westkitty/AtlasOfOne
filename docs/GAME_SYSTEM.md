# Atlas of One — Deterministic Game System

## Prime directive

The game engine — never the Cartographer model — owns XP, levels, territory thresholds, unlocks, achievements, quests, map fragments, and campaign completion.

## CampaignState

The state includes:

- `schemaVersion`
- player and settings
- XP and numeric level
- territories and active territory
- quests and active quest
- achievements and unlocks
- turns and evidence
- insights and contradictions
- map fragments
- private topics/dimensions
- normal/quiet presentation state
- session active/paused state
- deterministic campaign event history
- pending presentation notices

## Event vocabulary

Meaningful mutation occurs through typed events including:

- `ANSWER_ACCEPTED`
- `EVIDENCE_ADDED`
- `QUEST_PROGRESS`
- `QUEST_COMPLETE`
- `TERRITORY_ADVANCED`
- `LEVEL_UP`
- `ABILITY_UNLOCKED`
- `ACHIEVEMENT_UNLOCKED`
- `MAP_FRAGMENT_UNLOCKED`
- `INSIGHT_ADDED`
- `INSIGHT_CONFIRMED`
- `INSIGHT_REJECTED`
- `ANSWER_RETRACTED`
- `PRIVATE_TOPIC_ADDED`
- `PRESENTATION_SET`
- `SESSION_SET`
- `SASS_SET`
- `CAMPAIGN_COMPLETED`

The public model contract does not contain these events.

## XP bootstrap rules

Deterministic source-derived rules for this phase:

| Condition | XP |
|---|---:|
| accepted answer | +5 |
| meaningful development | +3 |
| accepted new evidence | +2 each, capped by engine rule |
| behavioral example | +3 |
| meaningful revision | +5 |
| quest completion | fixed deterministic bonus |
| boss resolution | fixed deterministic bonus |

No additional XP is awarded because a disclosure is painful, traumatic, intimate, or vulnerable.

## Levels

The available source references a Level 8 reveal but does not provide canonical level names/thresholds. Bootstrap uses numeric levels 1–8 and deterministic thresholds stored in `src/game/data.ts`. Those values are replaceable campaign data, not hard-coded UI assumptions.

Each level is computed from XP. A level can be crossed only once in history/presentation.

## Territories

Territory states:

`fogged → discovered → exploring → charted → deeply-charted`

Progression depends on **dimension coverage**, not turn count. Evidence records carry territory IDs and dimensions. Coverage ratio deterministically maps to territory state.

The political territory is explicitly dimensioned by the source with authority, legitimacy, state, democracy, economics, property, labor, justice, speech, institutions, borders, social liberty, equality, environment, technology, and change.

Other bootstrap territory labels are source-derived from required assessment/Vault domains and remain replaceable until fuller canonical campaign naming is supplied.

## Quests

Quests are deterministic state records with target counts/status/bonus. The first bootstrap quest is a synthetic onboarding survey task so the vertical slice can demonstrate quest progress and completion without private content.

## Unlocks

Core agency controls are not unlocks. They are permanent commands.

Optional game moves may unlock by numeric level. Unlock reconciliation runs after deterministic events and de-duplicates by unlock ID.

## Achievements

Achievements are computed from state predicates and de-duplicated. A model may emit an `achievementCandidate` string only as conversational metadata; that string cannot directly create an achievement.

## Insight Cards

Insights are hypotheses with evidence references and status. A player can:

- confirm
- partly accept (future enhancement)
- reject
- ask why/show evidence (future enhancement)

Insight confirmation/rejection is history-bearing state.

## Private topics

`PRIVATE` stores the active question dimension/topic in `privateTopics`. The mock question selector filters those dimensions out. Future model context compilation must do the same.

## Serious/quiet state

`SERIOUS` switches presentation to `quiet` immediately. Progression may continue internally, but celebratory level/unlock/achievement presentation is not surfaced while quiet mode is active.

## Retraction

Answer retraction marks the turn retracted and removes/invalidates evidence derived only from that turn. Derived territory coverage is then recomputed. Retraction must not silently erase the revision history event itself.
