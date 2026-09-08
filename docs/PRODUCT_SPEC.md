# Atlas of One — Product Specification

## 1. Product identity

**Atlas of One** is a mobile-first installable personality-cartography game. Its first campaign is **The Greyson Map**, built for Greyson (he/they). It should feel like an expedition through a living map rather than a questionnaire or clinical assessment.

The Cartographer adapts conversation to what has already been learned, while the deterministic game system turns accepted substantive participation into visible progress. The product must preserve uncertainty and contradiction rather than flattening a person into a single type.

## 2. Core experience

The player moves among mapped territories, answers adaptive questions, receives Insight Cards, unlocks game abilities and fragments, resolves Boss Fights and Mystery Doors, fills a Vault, and eventually receives a final Atlas/character assessment. Conversation can be typed in v1 and later spoken through the voice state machine defined in the master plan.

The experience should cover, at minimum, the domains explicitly required by the source material:

- identity and temperament
- values and moral architecture
- politics, ideology, authority, legitimacy, state, democracy, economics, property, labor, justice, speech, institutions, borders, social liberty, equality, environment, technology, and change
- relationships and social world
- cognitive style and contradiction/revision
- interests and ordinary preferences
- motivation, aversions, fears, hopes, dreams, ideal future, and ambition
- conflict, strengths, vulnerabilities, and open uncertainty
- personality-framework estimates as estimates, not diagnoses or facts

## 3. Interaction tone and agency

The Cartographer has selectable sass. Source-defined onboarding levels are **Low**, **Medium**, and **I Understand the Risks**. Sass never outranks consent or presentation state.

These controls must always exist and must never be progression-gated:

- **PASS** — skip without penalty or forced explanation.
- **PRIVATE** — mark the current topic/dimension private; it must not be intentionally revisited.
- **STOP** — pause the encounter/session loop.
- **SERIOUS** — enter quiet/respectful presentation immediately.
- **HELP** — explain available controls and current game state.
- **sass controls** — increase/decrease or select sass without requiring an unlock.

The system must automatically shift into respectful/quiet presentation when the player signals seriousness. Quiet presentation suppresses celebratory effects even if progression occurs internally.

## 4. Game surfaces

### Map

- Greyson avatar support
- fog-of-war presentation
- territory nodes and paths
- active territory and territory state
- current quest
- XP and level
- map fragments
- unlock/achievement presentation when not quiet

### Talk / Encounter

- Cartographer reply and next question
- text answer input in this phase
- future microphone/voice entry point
- always-available protected controls
- small contextual unlocked-move surface rather than a wall of buttons

### Vault

Starts sparse and fills with source-defined classes of artifacts:

- Identity Fragment
- Values Fragment
- Political Fragment
- Relationship Fragment
- Interest Constellation
- Cognitive Fragment
- Fear Map
- Future Postcard
- Contradiction Ledger
- achievements
- Insight Cards

### Me / Character

- Greyson character/avatar area
- XP, level, progress
- settings and accessibility
- voice/sass settings
- export/import/delete controls
- eventual complete character sheet
- detailed turnaround art only after substantial progression

## 5. Progression

Progress is deterministic and owned by TypeScript.

Source examples for XP rules:

- accepted answer: +5
- meaningfully developed answer: +3
- new evidence accepted: +2 each, capped by deterministic rules
- behavioral example: +3
- meaningful revision: +5
- quest completion: fixed bonus
- boss resolution: fixed bonus

Do **not** grant extra XP for painful disclosures or vulnerability.

Territory progress is based on evidence coverage, not raw question count. Territory states are:

`FOGGED → DISCOVERED → EXPLORING → CHARTED → DEEPLY CHARTED`.

## 6. Evidence and revision

Evidence records must preserve provenance, basis, strength/confidence, relevant territories, counter-evidence, and status. Insights are presented as hypotheses the player can confirm, partly accept, reject, or ask to inspect.

Deleting/retracting an answer must be able to remove or invalidate derived evidence. Revisions remain visible in history. Contradictions are data, not errors to hide.

## 7. Privacy

- Full campaign state lives locally in IndexedDB.
- No server database is part of v1.
- No actual Greyson answer/transcript may be committed to Git or used in synthetic tests.
- No provider secret may ship to the browser bundle.
- Real-provider inference, when added later, receives only the necessary context payload.
- PRIVATE dimensions/topics are not intentionally surfaced again.
- Export/import and delete foundations are required from the first persisted schema.

## 7b. Opening presentation

Atlas opens **dormant**. A fresh launch — new campaign, returning campaign or
reload alike — begins in near-black cinematic space with no application chrome:
no Map, Talk, Vault or Me, no navigation, cards, XP, controls, toasts or
onboarding choices. The interface appears only after the person deliberately
engages, and the whole viewport is the activation surface rather than a
conventional button.

Engagement IS the canonical "Begin" step, so a first-run campaign moves straight
from waking to the sass choice. Waking brightens decisively — a short
illumination, not a slow fade — and is effectively instant under reduced motion.
This state is session-level: it awards nothing, never enters CampaignState, and
recurs on every launch.

## 8. Voice and accessibility requirements

Voice is a first-class interaction mode, not a substitute for text. It uses
`getUserMedia` + `MediaRecorder` → `/api/transcribe` → transcript, with browser
`speechSynthesis` for output.

**Talk is a continuous turn-taking conversation, not push-to-talk per answer.**
One activation starts a spoken session: Atlas states the current question aloud,
then listens on its own. The player finishes a turn by simply stopping talking;
Atlas answers, establishes what it is asking next, and returns to listening with
no further tap. The canonical loop is `LISTENING → TRANSCRIBING → THINKING →
SPEAKING → LISTENING`, and `IDLE` is reserved for a conversation that is not
running — cancelled, switched to Type, stopped, or failed.

Spoken-turn completion is detected locally from microphone amplitude; no audio is
transmitted to decide when someone stopped speaking. "Done speaking" remains
available as a fallback for noisy rooms, accessibility and long pauses. Silence
before speech never submits an empty turn. While listening, an amplitude-reactive
visualizer is the primary status indicator, and its reappearance without a tap is
how the player knows the turn is theirs again.

The application must remain usable by text if voice is unavailable. Voice states must be visibly captioned. Common voice commands should be recognized locally when voice is implemented.

Accessibility requirements include semantic controls, keyboard access, visible focus, sufficiently large mobile touch targets, reduced-motion respect, readable contrast, transcript/caption availability, and preserving all critical controls in quiet mode.

## 9. Final assessment

The final Atlas is generated from confirmed territory summaries, evidence ledger, Insight confirmations, contradictions, revision history, representative quotations, and open uncertainty — not raw transcript alone.

It must include:

- personality and temperament
- values and moral architecture
- political constellation and ideology
- relationships and social world
- cognitive style
- interests
- motivation and aversions
- fears and hopes
- ideal future and ambition
- conflict
- strengths and vulnerabilities
- contradictions
- personality-framework estimates
- revision history
- representative player words
- open questions
- character sheet
- a final **Who is Greyson?** synthesis

Browser print CSS should later support **Save as PDF** without a PDF backend.

## 10. PWA and resilience

- Installable PWA foundation.
- Cached application shell; map/Vault/journal-like local content should remain available offline once implemented.
- Campaign state survives reload automatically.
- Export/import round trips without losing state.
- `schemaVersion` and migrations exist from day one.
- Provider/quota failure later degrades Cartographer functionality without risking campaign data or surprise billing.

## 11. Visual assets

Canonical source mapping is now explicit:

- **Aerron is Greyson's former asset/code name.** Aerron assets in `aerron_andrew_snes_pack_RENDERED.zip` are Greyson's canonical Atlas visuals.
- The Andrew assets contained in the same mixed source pack are not Atlas/Greyson assets and must not be imported.
- The five `rendered-prompts/aerron/game-ready-48x64/` transparent PNGs are the canonical sharp overworld set. The front view is the default avatar; the left view may be mirrored for the opposite direction; quarter-front, back, and quarter-back views are available for later map motion.
- The detailed canonical progression art is `sheets/aerron_turnaround_hires.png`. Reserve it for Character/Vault/final-assessment progression rather than showing it immediately.
- Duplicate raw renders, preview enlargements, and contact sheets are source/reference material, not required runtime payload.
- Runtime filenames may use `Greyson`-facing paths while preserving provenance back to Aerron source names. Visual appearance must not be silently redrawn or changed.

The current Phase 2 runtime integrates the five exact 48×64 Aerron sprite bytes under `public/assets/greyson/map/`. The high-resolution turnaround is supplied and canonically identified but remains reserved until its progression reveal is implemented.

## 12. Source coverage gap and reversible bootstrap defaults

The planning source requires “all territories” and “all levels,” explicitly defines the political territory dimensions, and references a Level 8 reveal, but it does not enumerate canonical names/details for every territory or every level in the material available to this pass. To keep implementation moving without pretending missing canon exists:

- Phase 1/2 uses source-derived functional territory labels based on required assessment/Vault domains.
- Levels are numeric 1–8 with deterministic bootstrap thresholds.
- These labels/thresholds are implementation defaults and must remain easy to replace when a fuller canonical campaign table is supplied.
