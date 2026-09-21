# Independent review — J00-J08 Journal foundation

- **Base SHA:** `b25ef0e4ff620535d958d3961044ac69184a26f9`
- **Implementation commit:** `c7998e4453fb9ddb5582a22a99557145daf8db1b`
- **Branch:** `feat/v2-journal-foundation`
- **Worktree:** `/Users/andrew/AtlasOfOne-journal`
- **Executor:** Codex, with bounded reviewer repairs by GPT-5.6 Sol before commit
- **Independent reviewer:** GPT-5.6 Sol
- **Review verdict:** `MERGE_READY` for `integration/atlas-v2-journal-adventure-combat` only. Not authorized for `main`, push, or deployment.

## Scope

This packet closes master-plan Journal packets **J00-J08 only**. J09 (Journal response/acknowledgement provider behavior) and J10 (dedicated Journal accessibility/reduced-motion/mobile closure pass) remain future work.

The implementation adds Journal domain functions/selectors, durable schema-v2 Journal use through the existing aggregate persistence path, a blank one-action Journal composer, typed local save, editable STT drafts, PRIVATE/retraction controls, history/date navigation, reflection/adventure link helpers, and an optional prompt path that preserves the legacy mapping flow as an explicit secondary action.

`src/App.tsx` and `src/world/WorldwalkerPanel.tsx` are integration-owned/hot-zone surfaces. Their edits are reviewed integration-owner exceptions limited to Journal wiring and the primary-entry label; no game-engine, schema, Worker, package, or provider authority moved into the Journal lane.

## Independent findings and bounded repair

1. **PRIVATE draft exfiltration path — real blocking defect found and repaired.** The candidate allowed `Map this answer` while the draft-level `Keep this entry private` checkbox was active. That could send private Journal text to `/api/turn`. The repair disables mapping for PRIVATE drafts, adds a defense-in-depth root handler guard, visibly states that private entries stay local, and adds a browser canary proving zero `/api/turn` requests.
2. **Prompt-only game moves leaked into the blank Journal state.** `Go deeper` / `Reroll` could appear before Greyson explicitly requested a prompt. They are now gated by `promptRequested`, preserving the blank Journal-first contract.
3. **Lane drift in shared CSS.** Journal-only CSS had been placed in shared `src/styles.css`. It was moved into `src/journal/JournalPanel.css`; the shared stylesheet is unchanged by the final packet. Journal interactive controls touched by the repair meet the existing 44px target convention.
4. **Privacy proof was initially weaker than the architecture claim.** The unit canary now checks `providerEligibleV2State()` directly, in addition to the existing provider compiler, so PRIVATE/retracted Journal-derived state is proven structurally absent from future provider-eligible v2 state.
5. **Legacy browser assertion drift.** `journey.test.ts` still expected the old visible speaker label `The Cartographer`. The product intentionally renders the primary input surface as `Journal`; the stale test-only assertion was corrected. The full Journey suite then passed 18/18.
6. **Invalid executor validation orchestration.** The executor spawned overlapping browser-test processes and a build, making those timing results non-authoritative. The reviewer stopped the executor, preserved its code, then reran all decisive browser gates sequentially from a stable production build. Only the clean serial reruns below count as review evidence.

## J00-J08 requirement traceability

| Packet | Requirement | Evidence | Result |
| --- | --- | --- | --- |
| J00 | JournalEntry domain functions/selectors | `src/journal/state.ts`; `tests/journal/state.test.ts` | PASS |
| J01 | Durable Journal persistence through current schema-v2 storage model | IndexedDB + serialize/deserialize round trip; aggregate row retained; deterministic history/date selectors provide the Journal indexing surface without a new DB store/index | PASS |
| J02 | Blank Journal composer reachable in one action | production-bundle browser opens Journal with editable input and no prompt; 320/390px checks | PASS |
| J03 | Typed Journal save without preceding question | browser save creates `JournalEntry`, makes zero `/api/turn` requests, changes no XP/turn/evidence/world progression, survives reload | PASS |
| J04 | STT transcript becomes editable Journal text | `voice-turn.test.ts` central invariant; transcript returns to textarea, may be edited before save, persists as `speech-to-text`, mic does not auto-reopen | PASS |
| J05 | PRIVATE and retraction controls | draft PRIVATE, persisted PRIVATE, retraction history, provider-exclusion and derived-retirement canaries; private mapping blocked | PASS |
| J06 | History/list/date navigation | newest-first and date selectors plus production Journal history/date UI and reload proof | PASS |
| J07 | Journal links to reflection/adventure IDs | idempotent link helper plus persistence/export round-trip test | PASS |
| J08 | Prompt is optional, never mandatory | one-action blank path contains no prompt; explicit `Give me a prompt`; optional mapping path remains functional | PASS |

## Validation after repair

- `npx tsc --noEmit` — **PASS**.
- Focused Journal/persistence unit gate — **20/20 PASS** across Journal state, DB, transfer, and schema-v2 tests.
- `npm test` — **310/310 PASS** across 40 files.
- `npm run build -- --configLoader runner` — **PASS**; existing non-fatal >500 kB client chunk warning remains.
- `git diff --check` / staged diff check — **PASS**.
- `tests/browser/journal-foundation.test.ts` — **4/4 PASS**: blank one-action Journal, zero-progression local save/reload, PRIVATE/retraction/optional prompt, explicit legacy mapping, 320/390px mobile geometry.
- `tests/browser/voice-turn.test.ts` — **11/11 PASS**: editable STT draft, no automatic provider turn, no automatic mic reopen, STOP/Cancel/background race protections preserved.
- `tests/browser/journey.test.ts` — **18/18 PASS** after the one stale label assertion was corrected.
- `tests/browser/provider.test.ts` — **7/7 PASS**.
- `tests/browser/encounter-concurrency.test.ts` — **5/5 PASS**.
- `tests/browser/phase5-long-session.test.ts` — **6/6 PASS**, including retraction -> export -> delete -> import -> local finalization.
- Selected post-repair production-bundle browser gates total **51/51 PASS** across six suites.
- Negative scan: no `speechSynthesis` / `SpeechSynthesisUtterance` references in `src` or `tests`.
- Synthetic Journal tests contain none of the protected real-person names scanned during review.
- No dependency, `worker/`, `src/contracts/**`, `src/game/types.ts`, `src/game/engine.ts`, persistence schema/migration, or Cartographer schema drift in this packet.

## Product / authority result

- Journal is now the primary open input surface from the Worldwalker entry action.
- Saving a Journal entry is local deterministic state only: no provider call and no gameplay/progression mutation.
- Fictional/game behavior remains separate from personal evidence authority.
- PRIVATE/retracted Journal sources structurally retire or withhold dependent v2 state through existing provenance logic.
- Legacy prompted mapping still exists, but only after an explicit prompt request and never for a draft marked PRIVATE.
- TTS remains absent; STT remains input-only and editable before save.

## Deferred work

- **J09:** provider/mock Journal-response mode supporting acknowledgement/reflection with no forced follow-up.
- **J10:** dedicated Journal accessibility/reduced-motion/mobile closure pass. This packet includes narrow 320/390 and touch-target checks but does not claim the broader J10 gate.
- Local-date semantics for history grouping are currently ISO-date based and may be revisited during J10 if human testing shows timezone confusion; no current requirement or regression evidence makes that a blocker here.
- Physical-device and non-Chrome verification remain outside this packet.

## Merge boundary

This review authorizes only fast-forward integration of the reviewed Journal packet into local branch `integration/atlas-v2-journal-adventure-combat` after environment/branch identity is rechecked. It does not authorize push, deployment, or merge to `main`.
