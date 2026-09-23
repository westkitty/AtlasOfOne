# Atlas v2 Capability Invariant Manifest

This file converts current verified behavior and explicit v2 product laws into proof obligations for future packets.

Status meanings:

- **VERIFIED** — current repository/runtime evidence proves the capability.
- **REQUESTED** — controlling v2 authority requires it, but implementation proof does not exist yet.
- **EVIDENCE-STALE** — previously verified but must be refreshed before relying on it after an affected change.

Only the invariants inside a packet's impact radius must be re-run, unless the packet touches `App.tsx`, shared game authority, persistence, provider schemas, privacy/provenance, or migrations; those surfaces require the full supported suite.

## Verified invariants

| ID | Class | Protected capability | Preconditions / action | Expected result | Current proof | Recheck trigger |
|---|---|---|---|---|---|---|
| INV-GAME-001 | functional | Model proposals cannot own deterministic progression | Submit valid/malicious provider output | XP, levels, unlocks, achievements and quest authority remain engine-owned | `tests/cartographer/firewall.test.ts`, `tests/cartographer/validate.test.ts`, F05 CI | cartographer apply/schema, game events, provider mode changes |
| INV-PRIV-001 | privacy | PRIVATE filtering is structural | Mark a dimension private, compile provider context | private source content is absent before payload creation | `tests/cartographer/context.test.ts`, `tests/adversarial/security-defensive.test.ts` | context compiler, provenance, Journal/privacy changes |
| INV-PRIV-002 | data-integrity | Retraction invalidates dependent current evidence without erasing history | Retract recorded answer | turn remains historical; derived evidence is retired; canary cannot reach synthesis | `tests/browser/phase5-long-session.test.ts`, `tests/adversarial/final-assessment-trust.test.ts` | retraction, evidence, migration, Snapshot work |
| INV-AGENCY-001 | safety | PASS / PRIVATE / STOP / SERIOUS / HELP / sass remain progression-independent | Exercise controls in current ordinary/encounter paths | controls work without XP cost or unlock requirement | `tests/browser/journey.test.ts`, `tests/browser/encounters.test.ts`, `tests/voice/commands.test.ts` | shared controls, Journal/Adventure/Combat/Reflection UI |
| INV-QUIET-001 | UI | SERIOUS suppresses celebratory presentation without deleting state | Enter serious mode after earning progress | state remains; fanfare/presentation is quiet | browser journey/game-feel coverage | presentation queue, global UI, Reflection |
| INV-PERSIST-001 | data-integrity | Campaign state survives reload | mutate campaign, reload real app | authoritative campaign restores semantically | `tests/persistence/db.test.ts`, `tests/browser/journey.test.ts` | schema/migration/db changes |
| INV-XFER-001 | data-integrity | Export -> delete -> import restores campaign state | run real transfer journey | valid state round-trips and retracted material stays retracted | `tests/browser/phase5-long-session.test.ts`, `tests/adversarial/persistence-torture.test.ts` | schema, transfer, migration, new durable records |
| INV-WORLD-001 | functional | Worldwalker movement and interactions remain real gameplay | move/travel/interact in browser | position/routes/landmarks/sanctuaries behave and persist | `tests/browser/overworld-verbs.test.ts`, world unit suites | world hooks, App decomposition, adventure markers |
| INV-ENCOUNTER-001 | functional | Boss/Mystery availability and resolution are deterministic | enter/resolve/pass/leave current special encounters | model cannot start/advance/reward them; safe withdrawal remains | `tests/game/boss-fight.test.ts`, `tests/game/mystery-door.test.ts`, `tests/browser/encounters.test.ts` | encounter adapters, Adventure/Combat integration |
| INV-CONCUR-001 | safety | One user action cannot double-apply progression | same-task double submit / stale async completion | exactly one authoritative mutation; stale result discarded | `tests/browser/concurrency.test.ts`, `tests/browser/encounter-concurrency.test.ts` | async lifecycle, submit handlers, import, voice, combat |
| INV-PROVIDER-001 | resilience | Provider failure cannot corrupt local game state | malformed/timeout/offline provider path | typed failure/fallback, no duplicate or fabricated state | `tests/adversarial/network-failures.test.ts`, `tests/browser/provider.test.ts` | provider/context/mode changes |
| INV-COST-001 | safety | Ineligible AI model configuration fails closed | select unknown/non-free model | request is refused before billable binding call | `tests/cartographer/provider.test.ts`, `tests/cartographer/transcribe.test.ts` | model registry, Worker provider/transcribe route |
| INV-STT-001 | functional | Speech-to-text is optional editable input, not auto-submit | dictate one turn | transcript enters editor; player edits/submits explicitly | `tests/browser/voice-conversation.test.ts` V01 CI #61/#65 | voice capture/transcribe, Journal composer |
| INV-STT-002 | safety | Leaving/backgrounding cancels capture safely | background or leave while capture/transcription active | no late transcript/provider turn mutates state | `tests/browser/voice-conversation.test.ts`, `tests/browser/concurrency.test.ts` | voice lifecycle, routing, Journal |
| INV-TTS-001 | safety | Assistant TTS remains absent | build production client | source/bundle contains no `speechSynthesis`, `SpeechSynthesisUtterance`, voice picker or Voice Lab marker | V01 negative browser/build proof; CI #61/#65 | any voice/UI/provider change |
| INV-TYPING-001 | functional | Typing is a complete fallback | use Atlas with microphone unavailable/off | ordinary answer path remains complete | `tests/browser/voice.test.ts`, journey/provider suites | Journal/input refactor |
| INV-PWA-001 | resilience | Offline shell and local mapped state remain available | take production PWA offline/reload | existing local surfaces remain usable; no fake AI response | `tests/browser/pwa.test.ts` | service worker, routes, Journal/Atlas/World shell |
| INV-ONBOARD-001 | functional | Hydration cannot flash/replace the wrong first-run state | load fresh and legacy campaigns | onboarding decision is stable and persisted truthfully | `tests/browser/hydration-race.test.ts`, `tests/browser/onboarding-continuity.test.ts` | App bootstrap, schema migration, onboarding |
| INV-ASSET-001 | compatibility | Canonical Greyson/Aerron identity is preserved and Andrew assets remain excluded | build/scan runtime pack | approved runtime targets remain present; Andrew asset invariant holds | `tests/assets/greyson-assets.test.ts` | asset v4 switch, character animation work |
| INV-SYNTH-001 | privacy | Long-form synthesis never resurrects private/retracted or fabricated material | synthesize from campaign with canaries | output uses eligible provenance only | `tests/adversarial/final-assessment-trust.test.ts`, phase5 long-session | Snapshot migration/provider synthesis |
| INV-NO-REAL-DATA-001 | privacy | Development fixtures contain no real Greyson journal/private material | add/modify tests, prompts, evaluation corpora | synthetic-only development evidence | controlling project law + repository test-fixture policy | every content/test/eval packet |

## Explicit v2 invariants not yet verified

These are controlling requirements, not claims about current implementation.

| ID | Class | Required future capability | Required proof before promotion |
|---|---|---|---|
| INV-JOURNAL-001 | functional | Blank Journal is reachable and can save without a prompt | unit persistence + real-browser no-prompt save/reload |
| INV-JOURNAL-002 | privacy | PRIVATE/retracted Journal sources never reach provider or derived eligible state | provenance canary across Journal -> evidence/gap/memory/Snapshot |
| INV-REFLECT-001 | safety | Fictional Adventure/Combat behavior alone cannot become confirmed self-evidence | mutation-negative test plus browser rejection/confirmation journey |
| INV-REFLECT-002 | functional | Greyson can CONFIRM / PARTIAL / REJECT / UNCERTAIN / REVISE / PRIVATE | state-machine tests + browser UI proof |
| INV-ADVENTURE-001 | functional | Adventure lifecycle is bounded, fail-forward, persistent and optional | local/mock full AdventureRun suite + mid-run reload |
| INV-FUN-001 | product | Pure-fun adventure can complete with no learning target/reflection | schema/engine test + browser journey |
| INV-COMBAT-001 | functional | ATTACK / TECHNIQUE / GUARD / ACT / LEAVE resolve through deterministic Combat engine | objective/gimmick matrix tests + browser encounter |
| INV-COMBAT-002 | safety | Combat actions create observations, never personality evidence | negative mutation/provenance test |
| INV-NOGRIND-001 | product | Combat rewards cannot create an optimal repeatable grind loop | encounter definition/tuning checks |
| INV-SNAPSHOT-001 | data-integrity | Snapshots are dated immutable historical artifacts, not terminal completion | two-Snapshot persistence/comparison journey |
| INV-SNAPSHOT-002 | privacy | Snapshot eligibility/content retires exclusive PRIVATE/retracted provenance | end-to-end canary |
| INV-MIGRATE-001 | compatibility | Canonical v1 exports migrate to v2 without losing legacy turns, Boss/Mystery, worldJourney, settings or historical assessment | M00 fixtures -> deterministic M02/M03/M04 tests |
| INV-WORLD-002 | functional | Journal-derived Adventure seeds appear as deterministic Worldwalker opportunities | Journal -> gap -> marker -> physical travel browser journey |

## Impact-radius rules

### App presentation/decomposition (D01–D04)

Mandatory subset:

- INV-AGENCY-001
- INV-QUIET-001
- INV-CONCUR-001
- INV-STT-001
- INV-STT-002
- INV-TTS-001
- INV-TYPING-001
- INV-WORLD-001
- INV-ENCOUNTER-001
- INV-ONBOARD-001
- full production build + browser suite while `App.tsx` is touched

### Schema/persistence (M01–M07)

Mandatory subset:

- INV-PERSIST-001
- INV-XFER-001
- INV-PRIV-001
- INV-PRIV-002
- INV-SYNTH-001
- INV-NO-REAL-DATA-001
- INV-MIGRATE-001
- canonical M00 fixture parity

### Provider/mode work

Mandatory subset:

- INV-GAME-001
- INV-PRIV-001
- INV-PROVIDER-001
- INV-COST-001
- INV-SYNTH-001
- relevant requested mode invariant

### Adventure/Combat

Mandatory subset:

- INV-GAME-001
- INV-AGENCY-001
- INV-PRIV-001
- INV-ENCOUNTER-001
- INV-CONCUR-001
- INV-REFLECT-001
- INV-COMBAT-002
- INV-FUN-001 where pure-fun paths are affected

## F07 verdict

The manifest is usable as the protected-capability baseline for v2 work.

Verified entries are backed by current test/user-path evidence; future v2 behaviors remain explicitly **REQUESTED**, never falsely promoted to verified.
