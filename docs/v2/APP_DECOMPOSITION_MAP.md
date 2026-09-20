# App decomposition map (D00)

This is an implementation map for the behavior-preserving D00-D04 refactor. It
does not change product, persistence, or authority contracts.

| Responsibility | Current App seams | Side effects / authority | Target | Safe now | Preservation proof |
| --- | --- | --- | --- | --- | --- |
| Root campaign lifecycle | `state`, `hydrated`, `dispatch`, load/save effects | IndexedDB hydration/autosave and deterministic `applyGameEvents` | `App.tsx` | No | unit, journey, concurrency |
| Provider lifecycle / ordinary submission | `provider`, `currentRequestId`, `submitInFlight`, `commitTurn`, `submitViaProvider` | provider request, stale-response suppression, Cartographer event firewall | `App.tsx` | No | concurrency, journey |
| Voice/STT lifecycle | capture refs, conversation generation, recording callbacks | microphone, cancellation, transcription, stale capture suppression | `App.tsx` with existing `src/voice/**` authority | No | voice-turn, concurrency |
| Navigation / generic presentation | progress, sheet and milestone display | none; callbacks remain supplied by App | `src/presentation/AppPresentation.tsx` | Yes | journey, onboarding |
| Talk conversation body | prompt/reply/composer/voice presentation and action row | callback-only; no persistence, provider, or dispatch ownership | `src/journal/JournalPanel.tsx` | Yes | journey, voice-turn, concurrency |
| Boss/Mystery presentation | stage/door display and typed input controls | callback-only; encounter lock and deterministic dispatch remain in App | `src/combat/EncounterPanel.tsx` | Yes | encounters, encounter-concurrency |
| Worldwalker view seam | `WorldMap` adapter, HUD, arrival and waystone presentation | emits typed region/position/interaction callbacks to App | `src/world/WorldwalkerPanel.tsx` | Yes | overworld-verbs, journey |
| Encounter derivation/enrichment | `activeBossRun`, `describe*`, `submitEncounter`, lock | deterministic encounter events; non-authoritative enrichment | `App.tsx` | No | encounters, encounter-concurrency |
| Persistence / transfer / delete | import, export, delete and request invalidation | IndexedDB and import continuity | `App.tsx` and existing persistence modules | No | concurrency, onboarding-continuity |
| Vault, Me, Final Assessment, onboarding | presentation mixed with root callbacks | import/export, finalization, onboarding dispatch | Deferred | No | existing full suite |

## Boundary rules

- **Remains in App:** root `CampaignState`, hydration/autosave, dispatch,
  provider and voice lifecycles, request and encounter locks, import/delete,
  finalization, onboarding, encounter derivation and cross-feature coordination.
- **Pure/presentational:** progress, milestones and sheets; all preserve exact
  text, class names, test IDs, accessibility attributes, and ordering.
- **Journal/Talk:** receives values and callbacks only. It cannot persist,
  request a provider, create evidence, or dispatch game state.
- **Encounter:** receives an already-derived encounter and invokes callbacks;
  all Boss/Mystery authority and locking remain at root.
- **Worldwalker:** adapts root state to `WorldMap` and reports typed actions;
  game rules and world persistence remain at root/engine authority.
- **Voice/STT:** stays owned by existing `src/voice/**` plus the root lifecycle;
  no TTS or new voice state is introduced.
- **Deferred intentionally:** Vault, Me/settings, final assessment, onboarding,
  provider orchestration, persistence/transfer, and deterministic game modules.
