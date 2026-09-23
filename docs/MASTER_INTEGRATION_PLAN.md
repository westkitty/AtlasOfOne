# Atlas of One - Autonomous Master Build & Integration Bible

**Document status:** Authoritative autonomous-production source document candidate
**Version:** 2.0 - Autonomous Production Edition
**Supersedes:** Version 1.0 of this plan
**Date:** 2026-09-20
**Project:** Atlas of One / The Greyson Map
**Repository:** `westkitty/AtlasOfOne`
**Intended repository path:** `docs/MASTER_INTEGRATION_PLAN.md`
**Planning baseline:** `main` at `87d57f3c341b363e078668895b9b691b56258cd7`; Worldwalker application release recorded from `6e720b28f74a794b31178058dc5004aee198174f`

### Document map

- **Part I - Authority and production control:** sections 0-7 plus 2A-2H. Product purpose, source-of-truth graph, autonomy rules, Git/worktree topology, model routing, Astra fuse, context packaging, pipeline contracts, schema v2.
- **Part II - Product systems:** sections 8-17. Journal, Knowledge Gaps, adventures, Worldwalker integration, JRPG combat, reflection, memory, Snapshots, UI restructuring, and complete TTS removal.
- **Part III - Production factories and execution graph:** sections 18-21D. Asset generation, content generation, parallel lanes, nine implementation phases, 201 autonomous work packets, dependency rules, and merge contracts.
- **Part IV - Implementation architecture and proof:** sections 22-29 plus 26A-26D. Module map, provider redesign, tests, cost/data budgets, release strategy, proof ladder, rollback, specialist quality gates, risk register, definition of done, and traceability.
- **Appendices A-P:** combat variation/tuning, exact TTS checklist, task/proof templates, asset factory contract, adventure schema, Astra ledger, cold-start protocol, optional autonomy CLI, model/tool routing examples, release evidence bundle, and the final synthetic completion oracle.

**Fastest autonomous entry:** section 21B -> choose a `READY` packet -> expand it with Appendix F -> execute under sections 2C-2G -> prove with Appendix G.

---

## 0. Purpose of this document

This document defines the next complete build of Atlas of One and the autonomous production system used to execute it. It exists to keep every human and AI contributor aligned on one product: a journaling adventure game for Greyson that helps him notice, explore, revise, and understand things about himself through ordinary journaling, an evolving explorable world, generated adventures, lightweight JRPG encounters, reflection, and a persistent personal Atlas.

This is not a loose roadmap. Once adopted into the repository authority chain, it is the controlling implementation source for the integration cycle described here. Older project documents remain evidence and historical context, but any conflicting implementation assumption must be reconciled against this document and the latest explicit user instruction.

### 0.1 Immediate product decisions locked by this document

1. Atlas is journaling-first. It is not fundamentally a personality questionnaire.
2. Greyson can journal freely without first being asked a question.
3. Worldwalker is the machinery that turns Greyson's evolving Atlas, open questions, interests, and unresolved themes into playable adventures.
4. Adventure behavior is not automatically treated as evidence about Greyson.
5. Atlas may propose interpretations. Greyson decides whether those interpretations belong on his Atlas.
6. JRPG-style turn-based encounters are part of the target product. They must be simple, short, varied, visible in the world when practical, and unnecessary to grind.
7. Combat is a storytelling verb, not a progression treadmill.
8. Campaign progression and all combat outcomes remain deterministic TypeScript authority. A model may propose language, scene content, encounter flavor, and evidence candidates only.
9. Local-first privacy, structural PRIVATE exclusion, retraction provenance, permanent agency controls, zero-surprise-cost behavior, and Greyson/Aerron visual identity remain protected.
10. The permanent "Final Assessment" / "Greyson is complete" model is replaced conceptually by dated, revisable Atlas Snapshots.
11. **Text-to-speech is removed from the product for now.** No assistant speech synthesis, browser `speechSynthesis`, voice picker, spoken Cartographer output, or TTS provider belongs in this build.
12. Speech-to-text remains allowed as an optional input method unless separately removed. It must produce text and return control to the visual interface; it must not reintroduce TTS indirectly.
13. Development-time GPT-6 Astra may be used whenever it produces disproportionate value, but it is escalation-only by default and must not become the project's bulk coding, testing, content, or asset-production workhorse.

### 0.2 Canonical product loop

```text
LIVE
  -> JOURNAL
  -> ATLAS NOTICES SOMETHING INTERESTING OR UNCERTAIN
  -> OPTIONAL ADVENTURE SEED
  -> EXPLORE WORLD
  -> STORY / PUZZLE / SOCIAL / JRPG ENCOUNTER
  -> CONSEQUENCE
  -> REFLECT
  -> GREYSON CONFIRMS, REVISES, REJECTS, OR LEAVES UNCERTAIN
  -> ATLAS CHANGES
  -> FUTURE WORLD REMEMBERS
  -> LIVE
```

Every adventure must satisfy two tests:

- It is worth playing even if Atlas learns nothing useful about Greyson.
- Nothing about Greyson becomes a durable self-claim merely because he chose it in a fictional scenario.


### 0.3 How to use this document

This document has two simultaneous jobs:

1. **Product constitution** - what Atlas is and what it must never become.
2. **Production operating system** - how autonomous agents turn that constitution into verified repository changes.

If you are Andrew or an integration owner, use sections 20-21D to see what can run next and sections 26A-26D to decide whether it is safe to merge/release.

If you are an implementation agent, do **not** read 4,000+ lines indiscriminately. Read the source-of-truth order, your work packet, the exact master-plan sections named by that packet, the affected operational-state invariants, and the relevant code/tests.

If you are a reviewer, start from the packet acceptance criteria and proof receipt. Review the actual diff and evidence rather than re-solving the whole project from memory.

If you are producing assets/content, work from the frozen runtime IDs/schemas and the factory contracts. Do not invent new engine behavior inside an asset or content batch.

### 0.4 Build map at a glance

```text
WAVE 0  AUTHORITY / BASELINE / AUTONOMY CONTROL PLANE
   |
WAVE 1  TTS REMOVAL + APP DECOMPOSITION + SCHEMA/INTERFACE FREEZE
   |
   +----------------+----------------+----------------+----------------+
   |                |                |                |                |
WAVE 2 JOURNAL   REFLECTION       ADVENTURE        COMBAT          PROVIDER
   |                |                |                |                |
   +----------------+----------------+----------------+----------------+
                                    |
WAVE 3                  FIRST COMPLETE VERTICAL SLICE
                                    |
                  +-----------------+------------------+
                  |                                    |
WAVE 4      MEMORY / SNAPSHOTS / SPECIALS       WORLD CONSEQUENCES
                  |                                    |
                  +-----------------+------------------+
                                    |
WAVE 5                  ASSET + CONTENT SCALE FACTORY
                                    |
WAVE 6                  HARDEN / PROVE / CLEAN BUILD
                                    |
WAVE 7                       GREYSON PILOT
```

The detailed registry contains **201 uniquely identified autonomous work packets** at this document revision. Packet count is not a success metric; it exists so work can be claimed, proven, merged, rolled back, and resumed without conversational guesswork.

### 0.5 Autonomous production roles

- **Orchestrator:** selects the highest-value READY packet from the dependency graph and prepares its context pack.
- **Executor:** makes only the authorized change and performs self-verification.
- **Reviewer:** independently checks scope and evidence; may return a bounded repair.
- **Integration owner:** owns hot-zone files, cross-lane wiring, merge order, and gate SHAs.
- **Asset/content producer:** creates schema-bound production material without changing runtime rules.
- **QA owner:** owns proofs, canaries, replay journeys, mutation gates, and release evidence.
- **Andrew:** product authority for unresolved purpose/taste/canon decisions and the human Greyson-pilot interpretation.

One agent may occupy more than one role on low-risk packets. High-risk packets require meaningful executor/reviewer separation.

---

## 1. Current baseline: preserve and reuse

The Worldwalker unification work already solved a large portion of the expensive foundation. The next cycle should build on it rather than replace it.

### 1.1 Existing capabilities to preserve

- Mobile-first React + TypeScript + Vite PWA.
- Cloudflare Worker API boundary.
- Deterministic campaign engine.
- Local-first IndexedDB persistence and export/import/delete.
- Structural PRIVATE filtering before provider context exists.
- Answer retraction with provenance-aware evidence invalidation.
- Evidence records with source turn IDs, basis, strength, territory links, counter-evidence and status.
- Insights with pending/confirmed/rejected states.
- Existing Boss Fight and Mystery Door deterministic encounter authority.
- Worldwalker physical island, eight-region geography, trails, fog/reveal masks, region discovery and traversed-route traces.
- Free player movement, collision, D-pad/touch controls and keyboard controls.
- Authored sanctuary interiors and inspectable props.
- Canonical Greyson/Aerron overworld and portrait assets.
- Persisted `worldJourney` state including visited territories, discovered landmarks, settled position, arrivals, traversed routes and encounter locations.
- Procedural Web Audio music/SFX foundation and quiet-mode compliance.
- Worker-side free-plan model eligibility and access-secret boundary.
- Browser and unit regression suites.

### 1.2 Baseline evidence at planning time

The Worldwalker release recorded:

- 304/304 unit tests passing across 38 files.
- 143/143 browser tests passing across 15 browser files.
- TypeScript clean.
- Production/PWA build clean apart from the existing non-fatal chunk-size warning.
- Cloudflare deployment active for the Worldwalker release.

These are not permission to assume new systems work. They define the regression baseline that the new build must protect.

### 1.3 Existing architecture that should not be blindly preserved

Several current shapes were appropriate for the earlier questionnaire-oriented Atlas and now need to evolve:

- `TurnRecord` assumes a `question` followed by an `answer`.
- `CartographerTurn` requires `nextQuestion`.
- Talk is organized around question-answer cycling.
- `FinalAssessment` implies a terminal synthesis.
- `CAMPAIGN_COMPLETED` exists even though there is no coherent lifelong-journal meaning for a permanently completed person.
- Adventure and reflection are not first-class domain objects.
- Contradictions are representable but not fully created through normal play.
- `App.tsx` is 1,928 lines / 98,979 characters at this planning baseline and has become a very large orchestration surface, making parallel feature development unnecessarily collision-prone.

The new build should preserve verified behavior while changing these assumptions.

---

## 2. Source-of-truth adoption and authority

### 2.1 Adoption rule

This file should be added to the repository as:

`docs/MASTER_INTEGRATION_PLAN.md`

Before feature implementation begins, update `AGENTS.md` so contributors read:

1. `AGENTS.md`
2. `OPERATIONAL_STATE.md`
3. `docs/MASTER_INTEGRATION_PLAN.md`
4. `docs/PRODUCT_SPEC.md`
5. `docs/ARCHITECTURE.md`
6. `docs/GAME_SYSTEM.md`
7. `docs/MODEL_CONTRACT.md`
8. `docs/ACCEPTANCE.md`
9. `docs/MASTER_BUILD_PLAN.md`

The older documents must then be reconciled in a bounded documentation pass. Do not leave two contradictory canonical descriptions active.

### 2.2 Important deployment warning

The repository is configured so pushes to `main` trigger Workers Builds and deployment. Therefore:

- Do not directly push documentation adoption or feature work to `main` merely to "save the plan".
- Use branches and PRs.
- A documentation-only merge still creates a deployment event.
- Merge only after the relevant validation and explicit release decision.

### 2.3 Authority rule inside this integration cycle

When implementation choices conflict, apply this order:

1. Latest explicit user instruction.
2. Active `OPERATIONAL_STATE.md` invariant or safety boundary.
3. This master integration plan after repository adoption.
4. Reconciled specialist source docs.
5. Verified existing behavior.
6. Implementation convenience.

---

## 2A. Autonomous production operating model

This integration is intentionally designed so multiple coding agents, research agents, content generators, art pipelines, and QA reviewers can make useful progress without continuously asking Andrew what to do next. Autonomy is permitted only inside a frozen task envelope. The project must never trade correctness, privacy, recoverability, or Greyson's agency for the appearance of speed.

### 2A.1 Governing autonomy rule

Every autonomous work unit must be reducible to this lifecycle:

```text
READ AUTHORITY
  -> RESOLVE BASELINE
  -> CLAIM ONE WORK PACKET
  -> VERIFY DEPENDENCIES
  -> MUTATE ONLY AUTHORIZED SURFACES
  -> RUN REQUIRED PROOF
  -> PRODUCE HANDOFF RECEIPT
  -> STOP OR HAND TO REVIEW
```

An executor is allowed to make implementation decisions that are local, reversible, and already implied by the packet. It is not allowed to silently create new product policy, privacy policy, progression rules, persistence formats, model authority, dependency classes, or canon.

### 2A.2 Autonomous default behavior

When a packet is marked `READY`, the assigned agent should proceed without asking routine questions if all of the following are true:

- the branch/worktree fingerprint matches the packet;
- all packet dependencies are `MERGED` into the packet base;
- allowed files and prohibited files are explicit;
- acceptance criteria are executable or inspectable;
- no source-of-truth conflict is present;
- no unexpected security, persistence, migration, concurrency, privacy, or deployment change appears;
- the requested work remains inside the planned changed-file envelope.

The agent must stop rather than improvise when one of those conditions fails.

### 2A.3 Work packet states

Every implementation packet uses exactly one execution state:

| State | Meaning |
|---|---|
| `BLOCKED` | A dependency, decision, environment, or evidence requirement prevents safe execution. |
| `READY` | Dependencies are satisfied and the packet may be claimed. |
| `CLAIMED` | One executor owns the packet branch/worktree. |
| `RUNNING` | Implementation is in progress. |
| `SELF_VERIFIED` | Executor ran the packet's required checks successfully. This is not merge authority. |
| `REVIEW` | Waiting for independent review or integration proof. |
| `REPAIR` | Review found a bounded defect and returned the packet to the same envelope. |
| `MERGE_READY` | Independent gate passed and the packet may enter the integration merge queue. |
| `MERGED` | Packet is present in the integration branch and its proof receipt is recorded. |
| `SUPERSEDED` | A newer accepted packet made this packet irrelevant. |

No agent may mark its own consequential packet `MERGE_READY` solely because its local tests passed.

### 2A.4 Autonomy ledger

Create a derived execution ledger after this plan is adopted:

`docs/v2/AUTONOMY_LEDGER.md`

The ledger is not a competing source of product truth. It tracks execution state derived from this master plan and `OPERATIONAL_STATE.md`.

Minimum columns:

```text
packet_id
status
lane
base_sha
branch
worktree
executor
reviewer
astra_eligible
claimed_at
head_sha
required_checks
proof_receipt
blocker
next_packets
```

The ledger should be compact. Raw terminal output does not belong in it.

### 2A.5 Proof receipts

Every completed packet produces one compact proof receipt under:

`docs/v2/proof/<PACKET_ID>.md`

A proof receipt records what actually happened, not what the prompt asked for. It includes:

- packet ID and title;
- base SHA and final SHA;
- changed files;
- explicit out-of-scope files confirmed untouched when important;
- validation commands actually run;
- exact pass/fail counts;
- build/typecheck/lint status where applicable;
- browser/runtime evidence where applicable;
- migration/privacy/security evidence where applicable;
- known unverified items;
- reviewer verdict;
- next packets unblocked.

A missing proof receipt means the packet is not merge-ready.

### 2A.6 No agent self-certification for high-risk work

Independent verification is mandatory for:

- schema migration;
- privacy filtering;
- retraction propagation;
- model authority/firewall changes;
- combat authority;
- concurrency/async lifecycle changes;
- import/export;
- deployment/release;
- changes to the master source-of-truth documents;
- security/access-secret behavior;
- anything that expands dependencies or runtime infrastructure.

The independent verifier may be another strong model, deterministic test suite, runtime replay, or human review depending on what can actually prove the claim.

---

## 2B. Source-of-truth graph

The project must distinguish design authority, current verified state, derived implementation docs, execution state, and generated artifacts.

### 2B.1 Authority graph

```text
Latest explicit user decision
          |
          v
OPERATIONAL_STATE.md  <---- verified runtime/repo evidence
          |
          +---------------------------+
          |                           |
          v                           v
MASTER_INTEGRATION_PLAN.md      active invariant corrections
          |
          +------------+-------------+-------------+-------------+
          |            |             |             |             |
          v            v             v             v             v
 PRODUCT_SPEC   ARCHITECTURE   GAME_SYSTEM   MODEL_CONTRACT   ACCEPTANCE
          \            |             |             |             /
           \-----------+-------------+-------------+------------/
                              |
                              v
                    implementation contracts
                              |
                  +-----------+-----------+
                  |                       |
                  v                       v
          AUTONOMY_LEDGER             asset/content manifests
                  |                       |
                  +-----------+-----------+
                              |
                              v
                         repository code
                              |
                              v
                      tests/runtime evidence
                              |
                              v
                      OPERATIONAL_STATE.md
```

### 2B.2 What each authority owns

| Surface | Owns | Must not own |
|---|---|---|
| `OPERATIONAL_STATE.md` | Current verified/broken/unverified state, active invariants, release identity | New speculative product design |
| This master plan | Target architecture, phase ordering, autonomy contracts, product laws | Claims that unimplemented work is verified |
| `PRODUCT_SPEC.md` | User-visible product requirements | Low-level implementation details |
| `ARCHITECTURE.md` | Technical boundaries, module ownership, persistence/provider architecture | Narrative content |
| `GAME_SYSTEM.md` | Progression, encounter, combat, adventure rules | Provider prompt wording |
| `MODEL_CONTRACT.md` | Model inputs/outputs, schemas, forbidden authority | Deterministic game calculations |
| `ACCEPTANCE.md` | End-to-end release gates and proof obligations | Desired-but-unverified claims |
| `AUTONOMY_LEDGER.md` | Packet status, ownership, proof links | Product rules |
| asset/content manifests | Runtime identifiers, provenance, hashes, integration status | Product authority |

### 2B.3 Stale-source rule

When the master plan changes a governing concept, the same integration cycle must identify downstream source files made stale. A change is not fully propagated merely because the master document is correct.

At minimum, each accepted product change must evaluate impact on:

- `AGENTS.md`;
- `OPERATIONAL_STATE.md`;
- `docs/PRODUCT_SPEC.md`;
- `docs/ARCHITECTURE.md`;
- `docs/GAME_SYSTEM.md`;
- `docs/MODEL_CONTRACT.md`;
- `docs/ACCEPTANCE.md`;
- `docs/MASTER_BUILD_PLAN.md`;
- affected tests;
- generated manifests;
- task packets not yet executed.

---

## 2C. Git, branch, and worktree production topology

Because `main` is coupled to Workers Builds, `main` is a release surface. Autonomous production must happen elsewhere.

### 2C.1 Integration branch

Create one long-lived integration branch for this cycle:

`integration/atlas-v2-journal-adventure-combat`

All feature lanes branch from the current integration head unless their packet explicitly names another dependency SHA.

Only the final release gate may propose merging the integration branch to `main`.

### 2C.2 Worktree strategy

Parallel agents should use separate worktrees so they do not compete over one working directory.

Illustrative setup after source-of-truth adoption:

```bash
git fetch origin
git switch -c integration/atlas-v2-journal-adventure-combat origin/main

git worktree add ../AtlasOfOne-journal -b feat/v2-journal integration/atlas-v2-journal-adventure-combat
git worktree add ../AtlasOfOne-adventure -b feat/v2-adventure integration/atlas-v2-journal-adventure-combat
git worktree add ../AtlasOfOne-combat -b feat/v2-combat integration/atlas-v2-journal-adventure-combat
git worktree add ../AtlasOfOne-provider -b feat/v2-provider-modes integration/atlas-v2-journal-adventure-combat
git worktree add ../AtlasOfOne-assets -b feat/v2-assets integration/atlas-v2-journal-adventure-combat
```

These are planning commands, not commands this document author executed.

### 2C.3 Shared-file hot zone

The following files are integration-owner surfaces. Feature agents must not casually edit them after the contract freeze:

- `src/App.tsx`;
- `src/game/types.ts`;
- `src/game/engine.ts` when cross-domain event wiring changes;
- `src/persistence/migrations.ts`;
- `src/cartographer/schema.ts` at the discriminated-union boundary;
- `worker/index.ts`;
- `package.json`;
- `AGENTS.md`;
- `OPERATIONAL_STATE.md`;
- this master plan;
- generated central asset manifests.

Feature lanes should work behind typed interfaces so most commits stay inside lane-owned directories.

### 2C.4 Lane-owned paths after contract freeze

| Lane | Primary owned paths |
|---|---|
| Journal | `src/journal/**`, focused Journal tests |
| Reflection | `src/reflection/**`, focused Reflection tests |
| Knowledge | `src/knowledge/**` or `src/adventure/seeds.ts`, focused tests |
| Adventure | `src/adventure/**`, Adventure tests |
| Combat | `src/combat/**`, Combat tests |
| World/UI | `src/world/**`, dedicated World UI components |
| Provider | `src/cartographer/modes/**`, context compilers, provider tests |
| Atlas/Snapshots | `src/atlas/**`, Snapshot tests |
| Asset factory | `.art-src/**`, `tools/art/**`, `public/assets/atlas/v4/**` via generated output |
| QA | `tests/**`, proof receipts; no product mutation unless returned as a bounded repair |

### 2C.5 Merge queue

Merge order is dependency-driven, not completion-time-driven.

Default queue:

1. contract/schema foundation;
2. behavior-preserving App modularization;
3. persistence/migration foundation;
4. independent domain engines;
5. provider discriminated-union support;
6. UI/domain surfaces;
7. first vertical slice;
8. content/asset expansion;
9. special encounter migration;
10. whole-product hardening;
11. release candidate.

A fast later packet does not jump ahead if its upstream interface is not merged.

---

## 2D. Model and tool routing policy

Atlas has access to several strong systems. The objective is not to make the strongest/scarcest model do everything. The objective is the lowest total cost per verified accepted change.

### 2D.1 Relative execution tiers

The exact model catalog may change. Routing is therefore defined by role and risk, then mapped to available tools.

| Tier | Default use | Current practical candidates |
|---|---|---|
| `LIGHT` | Mechanical edits, scaffolding, deterministic transforms, straightforward test expansion | Anti-Gravity/Gemini Flash; Grok Build on bounded packets |
| `STANDARD` | Ordinary feature implementation with good tests; moderate multi-file work | Grok Build; Quad Code/Sonnet-class coding; GPT-5.6 Sol when orchestration matters |
| `STRONG` | Architecture, persistence, migration, provider contracts, concurrency, cross-domain review | GPT-5.6 Sol; Quad Code/Opus-class coding/review |
| `CHALLENGER` | Independent alternative, adversarial review, comparative agent result | LM Arena agent mode; a different strong coding model from the executor |
| `ASTRA` | Scarce escalation for unusually ambiguous/high-value work | GPT-6 Astra when available |

This table is routing policy, not a claim that one listed system is universally better than another.

### 2D.2 Risk/verifiability routing

Packets are classified by consequence (`R1`-`R4`) and independent verifiability (`V1`-`V4`).

- `R1`: local, reversible, no persistent/public/privacy effect.
- `R2`: bounded behavior change across several files.
- `R3`: cross-cutting architecture, persistence, public contract, difficult rollback.
- `R4`: privacy/security, destructive migration, release/deployment, major concurrency correctness.

- `V1`: compiler/schema/deterministic exhaustive proof.
- `V2`: strong targeted automated coverage.
- `V3`: partial tests plus human/runtime judgment.
- `V4`: broad emergent behavior or subjective product judgment.

Default routing:

| Risk / proof | V1 | V2 | V3 | V4 |
|---|---|---|---|---|
| R1 | LIGHT | LIGHT | STANDARD | STANDARD |
| R2 | LIGHT/STANDARD | STANDARD | STRONG | STRONG |
| R3 | STANDARD + review | STRONG | STRONG + challenger | strongest practical + independent review |
| R4 | STRONG + independent proof | strongest practical + independent proof | strongest practical + human/independent review | do not proceed without an explicit proof plan |

### 2D.3 Astra hard rule

**Astra is an escalation instrument, not a workhorse.**

Every packet defaults to:

`ASTRA_ELIGIBLE: NO`

A packet may be marked `ASTRA_ELIGIBLE: YES` only when at least one of these triggers exists:

1. two competent non-Astra attempts disagree on a material architecture decision;
2. a high-risk (`R3/R4`) problem remains ambiguous after the ordinary strong-model path;
3. a repeated failure survives one evidence-backed repair and the root cause remains uncertain;
4. a final integration gate needs one high-value adversarial synthesis across many systems;
5. a particularly difficult canon/identity-sensitive creative problem has failed cheaper generation/review routes;
6. Andrew explicitly directs Astra to the packet.

Astra must not be the default for:

- bulk coding;
- boilerplate;
- file moves;
- routine tests;
- ordinary bug fixes with a reproducible failing case;
- mass asset variants;
- repeated content generation;
- routine PR review;
- documentation synchronization;
- lint/type fixes;
- deterministic data transforms.

### 2D.4 Astra budget fuse

When Astra is used, record one entry in the derived ledger:

```text
packet_id
why_non_astra_path_was_insufficient
question_given_to_astra
artifact_or_decision_returned
how_it_was_independently_verified
whether_the_result_changed_the_project
```

If the answer did not materially change the decision or artifact, do not automatically use Astra on the next adjacent packet.

### 2D.5 Workhorse strategy by activity

| Activity | Default route | Stronger review/escalation |
|---|---|---|
| Mechanical refactor under passing tests | LIGHT | STANDARD if diff grows beyond envelope |
| New bounded React component | STANDARD | STRONG if shared state architecture changes |
| Pure deterministic engine module | STANDARD | STRONG review for progression authority |
| Persistence/schema migration | STRONG | independent STRONG; Astra only on unresolved architecture |
| Async voice/STT lifecycle | STRONG | independent runtime proof |
| Combat content definitions | LIGHT/STANDARD | sampled STRONG review |
| Adventure templates | STANDARD | CHALLENGER sample review |
| Bulk asset prompt/spec generation | LIGHT/STANDARD | STRONG art-direction QA on samples |
| Greyson identity-critical visual asset | STANDARD generation + continuity QA | Astra only after lower-cost failures if useful |
| Cross-system source-of-truth decision | STRONG | Astra eligible |
| Final release synthesis/red-team | STRONG + CHALLENGER | Astra eligible once |

### 2D.6 Executor/reviewer separation

For R3/R4 packets, the model or agent that authored the change should not be the only reviewer. A useful default pairing is:

- bounded executor -> stronger/different reviewer;
- strong executor -> deterministic proof + different strong reviewer;
- Astra consultation -> non-Astra implementation + deterministic verification where possible.

Astra advice is not proof merely because Astra produced it.

---

## 2E. Context-efficiency and evidence-retention policy

Autonomous agents fail when they receive either too little authority context or the entire project history. The project should package context by loss class.

### 2E.1 Protected context classes

**L0 - exact/protected**

Never paraphrase away:

- current packet acceptance criteria;
- exact branch/base SHA;
- allowed/prohibited paths;
- schema names and field contracts;
- privacy rules;
- TTS removal lock;
- commands/IDs/literals when exactness matters;
- current failing assertion or error signature;
- model authority boundary;
- migration ordering.

**L1 - structured/protected**

May be compacted structurally but not materially:

- Git status;
- changed-file inventory;
- dependency changes;
- test counts;
- environment fingerprint;
- validation matrix;
- active packet status.

**L2 - semantic**

May be summarized while preserving decisions, reversals, uncertainty, and rejected paths:

- architectural rationale;
- research notes;
- old exploration;
- prior agent discussions.

**L3 - disposable noise**

May be dropped on success:

- progress bars;
- repetitive install/download lines;
- duplicate passing-test lines;
- routine unchanged directory listings.

### 2E.2 Agent context packet

An autonomous coding packet should normally receive only:

1. packet contract;
2. exact relevant master-plan sections;
3. current `OPERATIONAL_STATE` excerpt for affected invariants;
4. interface/type contracts it consumes;
5. files it is authorized to edit;
6. relevant existing tests;
7. validation commands;
8. current Git/environment fingerprint.

Do not paste the entire multi-thousand-line master plan into every agent prompt.

### 2E.3 Compact-on-success, expand-on-anomaly

Agents should report successful validation as structured counts and commands. On failure, preserve the first meaningful error, unique signatures, changed behavior, and raw recovery location. Do not flood downstream context with thousands of successful lines.

### 2E.4 Compaction boundary

Compact after:

- validated commit;
- accepted decision;
- merged packet;
- completed gate.

Do not compact while root-cause diagnosis is unresolved.

---

## 2F. Autonomous work packet contract

Every packet in the detailed registry later in this document is expanded into a task contract before execution.

### 2F.1 Required packet fields

```yaml
packet_id: J03
name: Journal composer UI
phase: 2
lane: journal
status: READY
risk: R2
verifiability: V2
astra_eligible: false
base_ref: integration/atlas-v2-journal-adventure-combat
requires: [V2-03, J01, J02]
objective: "..."
allowed_paths:
  - src/journal/**
  - tests/browser/journal*.test.ts
prohibited_paths:
  - src/persistence/migrations.ts
  - worker/index.ts
protected_invariants:
  - INV-017
  - TTS-REMOVED
acceptance:
  - "..."
validation:
  - npx tsc --noEmit
  - npm test -- --run <focused suite if supported>
  - npm run test:browser -- <focused suite if supported>
stop_conditions:
  - "requires schema change outside frozen interface"
handoff:
  - proof receipt
  - final commit SHA
```

### 2F.2 Packet sizing law

A packet should normally produce one coherent inspectable behavior or one enabling interface. Split a packet when:

- it crosses two domain ownership lanes;
- it requires unrelated UI and persistence changes;
- it cannot be validated without another unbuilt feature;
- the changed-file envelope becomes broad enough that independent review loses clarity;
- the agent starts making architecture decisions not frozen in the packet.

Do not split trivial code merely to inflate packet count.

### 2F.3 Autonomous stop conditions

All packets inherit these stop rules:

- base SHA or branch does not match;
- working tree contains unexplained user changes in authorized files;
- dependency packet is not present;
- required source file is missing;
- requested change requires weakening an acceptance criterion;
- implementation expands to a new dependency or service not authorized by the packet;
- privacy/security/migration/concurrency scope appears unexpectedly;
- tests expose a pre-existing defect outside the packet and continuing would conflate repairs;
- expected deterministic command cannot be run;
- changed-file count/path envelope materially exceeds plan;
- two sources of truth conflict.

The agent returns a bounded blocker report instead of guessing.

### 2F.4 Repair rule

A failed review returns the packet to `REPAIR` with the smallest evidence-backed correction set. Do not restart the whole phase. Do not combine unrelated polish into the repair.

---

## 2G. Pipeline handoff contracts

Parallel work only works if stages exchange typed outputs rather than prose assumptions.

### 2G.1 Contract freeze -> domain lane

**Input to domain lane**

- frozen TypeScript interface or JSON schema;
- packet acceptance criteria;
- lane-owned paths;
- canonical privacy/progression rules;
- expected local fallback behavior.

**Output from domain lane**

- implementation commit;
- focused tests;
- proof receipt;
- no edits to shared interface unless integration owner accepted a contract change.

### 2G.2 Domain lane -> integration owner

**Input**

- merge-ready domain commit;
- proof receipt;
- known unknowns;
- any new public exports.

**Integration owner rights**

- wire modules together;
- resolve shared-file collisions;
- reject interface drift;
- add integration tests.

**Integration owner prohibitions**

- silently redesign lane behavior while merging;
- mark lane verified without rerunning impact-radius checks.

### 2G.3 Asset factory -> runtime integration

**Asset lane output contract**

- stable IDs;
- normalized files;
- dimensions/frame metadata;
- provenance;
- hashes;
- human continuity verdict where required;
- runtime manifest fragment.

**Runtime integration rights**

- reference approved IDs;
- optimize loading/packing without changing visual identity;
- reject assets that exceed budgets or fail continuity.

### 2G.4 Content factory -> Adventure/Combat runtime

Content generators may author:

- template text;
- encounter definitions inside approved schemas;
- NPC records;
- ACT options;
- flavor and fallback copy.

They may not:

- change engine rules;
- invent new reward categories;
- bypass reflection firewall;
- mark sensitive material as eligible;
- add runtime code through content data.

### 2G.5 QA -> repair

QA owns findings and verdicts, not broad mutation. A defect handoff must include:

- failing behavior;
- reproduction path;
- expected behavior;
- evidence;
- smallest suspected scope if known;
- regression acceptance test.

The repair lane owns the code change.

---

## 2H. Agent-routing calibration before scale-out

Before dozens of packets are delegated, calibrate the available workhorses on a few representative bounded tasks. This prevents tool choice from becoming reputation-based mythology.

### 2H.1 Calibration set

Use three non-destructive or disposable representative tasks:

1. **Mechanical extraction task** - move a small pure helper behind an interface with existing tests.
2. **Bounded feature task** - add one isolated synthetic-only component/test in a scratch branch.
3. **Diagnosis task** - analyze a seeded failing fixture and propose the minimal fix without applying it.

### 2H.2 Score dimensions

Record for each tool/model:

- correctness;
- scope discipline;
- changed-file accuracy;
- validation quality;
- unnecessary exploration/tool calls;
- repair burden;
- reporting clarity;
- ability to stop at boundaries.

### 2H.3 Routing result

Use the results to choose default executor/reviewer pairings for LIGHT, STANDARD, and STRONG packets. Re-run calibration only when the available stack changes materially or the current routing repeatedly causes rework.

Astra is not the routine calibration contestant. It may be evaluated on one architecture/review challenge if its use would answer a real routing question.

---

## 3. Product laws: non-negotiable invariants

### 3.1 Human authority

- Atlas may notice patterns, ask questions, offer hypotheses, and show evidence.
- Atlas must not state a fictional action as proof of Greyson's real beliefs or personality.
- Greyson can confirm, partially accept, reject, revise, retract, mark private, or leave uncertain any interpretation.
- Rejected interpretations remain history-bearing but cannot count as confirmed self-knowledge.
- PRIVATE and retracted material must remain structurally excluded from provider payloads and derived memory.

### 3.2 Game authority

- TypeScript owns XP, level, unlocks, map state, world state, combat HP, damage, turn order, objectives, status effects, encounter outcomes, rewards, snapshot eligibility and persistence.
- Model output cannot directly grant or calculate any of those.
- Model-authored material must cross a typed validation boundary before it can become a deterministic proposal.
- Existing progression firewall tests must be expanded, not weakened.

### 3.3 Fun law

- Not every journal entry must produce a lesson.
- Not every adventure must measure anything.
- Not every encounter must be combat.
- Not every combat encounter must be won by reducing HP to zero.
- Some sessions should exist only because Greyson enjoyed them.
- Pure-fun adventures are a required content type, not a failure to extract data.

### 3.4 No-grind law

- Random encounter spam is prohibited.
- Required level grinding is prohibited.
- Repeating low-information fights solely for XP is prohibited.
- Combat rewards must not make grinding the optimal way to progress the Atlas.

### 3.5 Privacy and locality

- No real Greyson journal text, transcript, private material or personal evidence enters Git fixtures.
- Runtime personal data stays local except the minimum bounded non-private payload required for an explicitly invoked provider operation.
- No server database, analytics platform, vector database, account system or cloud journal store is introduced in this integration cycle.

### 3.6 TTS removal lock

For this entire plan:

- No text-to-speech feature.
- No `window.speechSynthesis` or `SpeechSynthesisUtterance` runtime path.
- No voice selection UI.
- No assistant-spoken prompts or replies.
- No TTS service, model, quota, cache or fallback.
- No acceptance criterion may require hearing Atlas speak.
- Voice input may remain as speech-to-text only.
- Any future TTS return requires a new explicit product decision and separate acceptance gate.

---

## 4. Target product surfaces

The target product should expose four conceptual surfaces even if the final navigation uses overlays or world locations.

### 4.1 World

The living Worldwalker island where Greyson moves, discovers places, encounters stories, sees consequences, enters sanctuaries, finds NPCs, begins adventures and meets visible encounter entities.

### 4.2 Journal

The fastest path for Greyson to record what is happening in his life or head. It must not require a prompt.

Journal supports:

- free text entry;
- optional speech-to-text input;
- optional prompt if Greyson asks Atlas for one;
- entry privacy;
- entry retraction;
- links to reflections, evidence, adventures and memories;
- short conversational Atlas response without forcing a follow-up question;
- "explore this later" adventure seeding;
- no XP bonus for pain, vulnerability or disclosure intensity.

### 4.3 Vault / Atlas

The inspectable record of what Atlas currently believes it knows, why it believes it, what Greyson confirmed or rejected, contradictions, memories, adventure history and dated Atlas Snapshots.

### 4.4 Me
Settings, accessibility, input mode, export/import/delete, privacy explanation, current progression, snapshot history and project/account-free local data controls.

---

## 5. Target experience modes

Atlas needs explicit modes so the provider and UI know what job they are performing.

1. **Journal mode** - listen/respond to Greyson's real-life entry without turning it into an interrogation.
2. **Reflection mode** - ask what a journal entry, adventure or contradiction means to Greyson.
3. **Adventure mode** - generate and continue a playable fictional situation.
4. **World interaction mode** - NPC, object, sanctuary, route or environmental interaction.
5. **Combat mode** - deterministic turn-based encounter with model-authored flavor only.
6. **Boss synthesis mode** - larger multi-stage story conflict built from confirmed Atlas material.
7. **Mystery Door mode** - cross-domain discovery from two mapped areas.
8. **Snapshot mode** - synthesize the current Atlas state without claiming finality.
9. **Pure-fun mode** - explicitly no learning target required.

Mode must be a typed input to provider compilation. The model should not infer its own authority or task from prose alone.

---

## 6. Architecture target

```text
Greyson
  |
  +--> Journal Input -----------------------------+
  |                                               |
  +--> World / Adventure Actions -----------------|----> Local authoritative state
  |                                               |       |
  +--> Combat Commands ---------------------------+       +--> deterministic game engine
                                                          +--> deterministic combat engine
                                                          +--> deterministic seed eligibility
                                                          +--> deterministic privacy/provenance
                                                          +--> IndexedDB persistence
                                                          |
                                                          v
                                                 Bounded Context Compiler
                                                          |
                                                          v
                                                 Model Proposal Boundary
                                                          |
                             +----------------------------+---------------------------+
                             |                            |                           |
                      journal response             adventure scene             reflection proposal
                             |                            |                           |
                             +----------------------------+---------------------------+
                                                          |
                                                 Typed validation only
                                                          |
                                                          v
                                             candidate language / evidence
                                                          |
                                                          v
                                         Greyson confirmation where required
                                                          |
                                                          v
                                                Atlas / world consequences
```

The model does not become a second game engine.

---

## 7. Domain model v2 and migration

The new product requires a schema-version boundary. Do not continue stretching schema v1 indefinitely.

### 7.1 Recommended schema version

Raise `CURRENT_SCHEMA_VERSION` to `2` when the first new durable journal/adventure state is committed.

### 7.2 New first-class records

The exact TypeScript naming may change during implementation, but the semantic contracts should not.

```ts
interface JournalEntry {
  id: string;
  createdAt: string;
  text: string;
  inputMode: 'typed' | 'speech-to-text';
  privacy: 'normal' | 'private';
  status: 'active' | 'retracted';
  sourcePrompt?: string;
  linkedReflectionIds: string[];
  linkedAdventureIds: string[];
}

interface KnowledgeGap {
  id: string;
  kind: 'unknown' | 'contradiction' | 'change' | 'underexplored' | 'curiosity';
  territoryIds: string[];
  dimensionIds: string[];
  sourceEvidenceIds: string[];
  sourceJournalEntryIds: string[];
  summary: string;
  status: 'open' | 'seeded' | 'resolved' | 'retired';
  priority: number;
}

interface AdventureSeed {
  id: string;
  sourceGapIds: string[];
  kind: AdventureKind;
  territoryId: string;
  premise: string;
  learningTarget: 'none' | 'reflection-eligible';
  status: 'available' | 'started' | 'retired';
}

interface AdventureRun {
  id: string;
  seedId: string;
  territoryId: string;
  status: 'active' | 'complete' | 'withdrawn';
  currentBeat: string;
  characterIds: string[];
  memoryIds: string[];
  startedAt: string;
  completedAt?: string;
}

interface AdventureAction {
  id: string;
  runId: string;
  createdAt: string;
  kind: 'say' | 'do' | 'inspect' | 'travel' | 'combat' | 'leave';
  text: string;
}

interface AdventureObservation {
  id: string;
  runId: string;
  sourceActionIds: string[];
  observation: string;
  status: 'unreflected' | 'reflected' | 'discarded';
}

interface ReflectionRecord {
  id: string;
  sourceKind: 'journal' | 'adventure' | 'contradiction' | 'insight';
  sourceIds: string[];
  question: string;
  response: string;
  interpretation?: string;
  status: 'pending' | 'confirmed' | 'partial' | 'rejected' | 'uncertain';
  createdAt: string;
}

interface AdventureMemory {
  id: string;
  type: 'character' | 'place' | 'event' | 'relationship' | 'promise' | 'object';
  summary: string;
  triggerTerms: string[];
  sourceIds: string[];
  privacy: 'normal' | 'private';
  status: 'active' | 'retired';
  lastUsedAt?: string;
}

interface AtlasSnapshot {
  id: string;
  createdAt: string;
  evidenceIds: string[];
  insightIds: string[];
  contradictionIds: string[];
  synthesis: FinalAssessmentLikeShape;
  previousSnapshotId?: string;
}
```

### 7.3 Legacy preservation

- Do not delete `TurnRecord` history during migration.
- Existing question/answer turns remain valid provenance.
- Old Boss/Mystery state must continue to load.
- Existing `FinalAssessment`, if present, should migrate into a historical snapshot-shaped record rather than be discarded.
- Existing `campaignCompleted` may remain as a legacy field for compatibility but should not govern the new lifelong-journal model.
- Migration must be deterministic and tested against real v1 export fixtures containing synthetic data only.

### 7.4 Retraction and privacy propagation

A retracted or private source must retire or withhold every derived item that depends exclusively on it, including:

- evidence;
- insights;
- contradictions;
- knowledge gaps;
- adventure seeds;
- adventure memories;
- snapshot source eligibility.

This propagation must be provenance-based, never prose-search-based.


---

## 8. Journal system

The Journal becomes the primary self-discovery input surface.

### 8.1 Journal behavior

Greyson must be able to:

- open Journal and type immediately;
- use speech-to-text as an optional input method;
- save an entry without answering a question;
- ask Atlas to respond conversationally;
- ask Atlas for a prompt only when he wants one;
- mark an entry PRIVATE;
- retract an entry while preserving revision history;
- link an entry to an adventure or reflection;
- revisit older entries by date, tag, territory, memory or linked Atlas item;
- export all journal state through the existing local export path.

### 8.2 Atlas response contract for journals

A journal response may do one or more of the following:

- acknowledge;
- reflect a theme;
- ask one optional follow-up;
- note a possible contradiction or change;
- offer "explore this later";
- suggest a relevant existing memory;
- say nothing analytical when the entry does not call for analysis.

A response must not:

- diagnose;
- pretend certainty about motive;
- turn every entry into a question;
- award more progression for emotional intensity;
- create confirmed evidence without the normal evidence/reflection rules;
- reveal private content in a non-private context.

### 8.3 Journal progression

Participation may still earn ordinary deterministic participation progress, but the system should stop making raw turn count the emotional center of play. Useful progress should increasingly come from:

- charting a region through confirmed or high-quality evidence coverage;
- completing adventures;
- discovering places;
- resolving a reflection;
- revising an old belief;
- finding a cross-region connection;
- completing story objectives;
- combat/story milestones that are fixed and non-grindable.

---

## 9. Greyson model and Knowledge Gap Engine

The Knowledge Gap Engine is the deterministic bridge between self-knowledge and adventures.

### 9.1 Inputs

It reads only local authoritative state:

- active evidence;
- confirmed and rejected insights;
- contradictions;
- revisions;
- undercovered territory dimensions;
- journal entries eligible for reflection;
- old vs recent evidence;
- explicit Greyson curiosity markers;
- recent adventure themes to avoid repetition;
- PRIVATE/retracted exclusions.

### 9.2 Gap types

#### Unknown
A meaningful dimension has little or no usable evidence.

#### Contradiction
Two active, provenance-backed claims appear difficult to reconcile.

#### Change
Recent confirmed material differs materially from older confirmed material.

#### Underexplored
There is some evidence, but it is narrow, repetitive or weak.

#### Curiosity
Greyson explicitly indicates that he wants to understand or explore something.

### 9.3 Gap scoring

Gap selection should be deterministic enough to prevent the model from deciding what Greyson "needs" to examine.

Recommended scoring factors:

- undercoverage;
- age since last exploration;
- explicit Greyson interest;
- contradiction relevance;
- recent journal salience;
- adventure-theme diversity;
- privacy eligibility;
- avoidance of recently repeated domains.

Do not rank trauma, pain or vulnerability higher because they are dramatic.

### 9.4 Gap -> seed boundary

The engine may produce a structured seed request such as:

```ts
{
  gapIds: ['gap_17'],
  territoryId: 'relationships',
  adventureKind: 'social-dilemma',
  permittedThemes: ['trust', 'honesty', 'loyalty'],
  forbiddenDimensions: ['retired_dimension_id'],
  evidenceClaims: ['...bounded active claims...'],
  learningTarget: 'reflection-eligible'
}
```

The model may turn that into a premise. It may not alter the underlying gap priority or privacy eligibility.

---

## 10. Worldwalker Adventure Director

Worldwalker becomes an Adventure Director layered over deterministic world state.

### 10.1 Adventure requirements

Every adventure must have:

- a reason to exist in the world;
- a location or route;
- a hook;
- at least one meaningful choice or open action opportunity;
- intrinsic fun or interest independent of self-analysis;
- a defined completion/withdrawal condition;
- a consequence that the future world can remember;
- an optional reflection handoff when appropriate.

### 10.2 Adventure kinds

Initial catalog:

1. social dilemma;
2. investigation;
3. rescue/support;
4. exploration expedition;
5. negotiation;
6. absurd comedy problem;
7. ethical conflict;
8. creative/building challenge;
9. memory echo;
10. relationship/companion scene;
11. mystery/puzzle;
12. survival/escape;
13. combat-forward story;
14. pure-fun wildcard.

### 10.3 Adventure beat contract

Use a small number of beats rather than open-ended unbounded generation.

Recommended ordinary adventure:

1. **Hook** - something interesting occurs.
2. **Approach** - Greyson can investigate, avoid, question or act.
3. **Complication** - new information or obstacle.
4. **Encounter** - social, puzzle, traversal, combat or mixed.
5. **Choice / consequence** - state changes.
6. **Optional reflection** - only if the experience offers a legitimate question.

Boss adventures may be longer. Pure-fun adventures may end without reflection.

### 10.4 Free input

Adventure input should not become numbered choose-your-own-adventure only. Greyson should be able to type or dictate ordinary actions in natural language.

The runtime must translate model scene proposals into bounded state. If an action is impossible, the model may explain why in-world; it may not silently mutate deterministic state to make the action true.

### 10.5 Fail-forward rule

Withdrawal, escape, combat defeat or a strange decision should usually create a different story state rather than a dead-end "game over". Atlas is a journal world, not a punishment loop.

### 10.6 Adventure replay and recurrence

- Completed adventures stay in history.
- Recurring NPCs and places may reference them.
- The same seed must not be regenerated as though it never occurred.
- Unresolved themes may return in materially different forms after a cooldown.
- Greyson can explicitly say "I do not want adventures about this" and retire the relevant seed/gap path.

---

## 11. World integration

The existing Worldwalker island should become the physical presentation of Journal-derived opportunities.

### 11.1 Territory role

Each territory is not just a topic bucket. It is a recurring place with its own visual language, adventure families, inhabitants, ambient encounters and memory.

Current territory/sanctuary identity should remain the starting point:

- identity / Origin Grove;
- values / Tribunal of Values;
- politics / Forum of Concord;
- relationships / Beacon of Kinship;
- cognition / Archive of Axioms;
- interests / Atelier of Curios;
- fears / Abyssal Chasm;
- future / Spire of Horizons.

Names can be refined only through an explicit canon decision. Do not casually rename them during implementation.

### 11.2 World opportunity markers

The world may show:

- adventure marker;
- optional journal shrine;
- NPC conversation;
- visible hostile or non-hostile encounter;
- Mystery Door;
- Boss arena;
- memory marker;
- environmental discovery;
- sanctuary interaction;
- pure-fun event.

Markers should communicate category without exposing hidden analytical intent.

### 11.3 No psychological map labels in-world

Do not make every object announce "this tests loyalty" or "this measures authority." The fiction should be legible as fiction. Reflection happens after the experience, not as a label pasted over it.

### 11.4 Persistent world consequences

Adventure outcomes may deterministically change:

- NPC availability;
- route traces;
- environmental state;
- unlocked dialogue;
- sanctuary props;
- remembered promises;
- recurring enemies;
- future scene eligibility;
- cosmetic world details.

These consequences must be stored locally and export/import cleanly.

---

## 12. Lightweight JRPG combat system

### 12.1 Role in Atlas

Combat exists to add tension, playfulness, pacing and mechanical variety. It must never become the reason Atlas stops being a journaling adventure.

### 12.2 Core actions

The initial universal command set should be small:

- **ATTACK** - ordinary damage, optionally improved by a simple timed input.
- **TECHNIQUE** - a small contextual or unlocked ability set.
- **GUARD** - reduce or alter incoming damage; optional timed block.
- **ACT** - interact with the enemy, environment or encounter objective.
- **LEAVE** - flee, withdraw, surrender, disengage or otherwise exit when the encounter permits. It is not framed as moral failure.

If a fight requires additional commands, add them contextually rather than expanding the permanent command wall.

### 12.3 No complex RPG layer

Do not build in this cycle:

- gear rarity ladders;
- large equipment inventories;
- crafting trees;
- elemental spreadsheet complexity;
- dozens of permanent skills;
- character-class optimization;
- random stat rolls that undermine deterministic testing;
- grinding loops;
- loot-box or gacha logic.

### 12.4 Encounter objectives

Combat variety should primarily come from objective + gimmick + fiction.

Initial objective catalog:

1. defeat;
2. survive N turns;
3. escape;
4. protect a target;
5. interrupt a charged action;
6. pacify/calm;
7. break or reach an object;
8. hold a position;
9. escort;
10. discover the correct ACT interaction.

### 12.5 Encounter gimmicks

Initial gimmick catalog:

1. shielded;
2. charging;
3. counterattacking;
4. enraged;
5. healing;
6. swarm;
7. linked pair;
8. stance-changing;
9. mimic/disguise;
10. unstable terrain;
11. morale/fear;
12. timed vulnerability;
13. environmental hazard;
14. ally in danger;
15. enemy that should not actually be killed.

The engine should be able to combine these safely from deterministic templates.

### 12.6 Recommended combat state

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

### 12.7 Determinism

The combat engine owns:

- maximum/current HP;
- damage formulas;
- technique costs;
- statuses;
- turn order;
- enemy intent selection from allowed deterministic rules;
- objective progress;
- victory/pacification/escape/defeat;
- rewards;
- encounter persistence.

The model may provide:

- enemy name and personality from an approved content template;
- battle narration;
- ACT wording;
- contextual descriptions;
- story consequence prose;
- candidate encounter skin from an allowed template.

The model may not provide authoritative HP changes, success flags, rewards or turn order.

### 12.8 Timed inputs

Timed attack/guard inputs are allowed because they provide texture without requiring a deeper ruleset.

Rules:

- generous timing window;
- optional, never required for accessibility;
- reduced-motion mode must not depend on animation timing cues alone;
- missing the timing window still performs the base action;
- no frame-perfect mechanics;
- tests use deterministic timing hooks rather than flaky wall-clock assumptions.

### 12.9 Visible encounters

Prefer visible world entities, scripted story contacts, sanctuary encounters and deliberate ambushes over invisible random battle rolls.

### 12.10 Duration target

Ordinary encounters should usually resolve in roughly 2-5 meaningful player turns. Elite encounters may run longer. Boss phases may be multi-part but should not become endurance tests.

### 12.11 Combat and self-knowledge firewall

A combat action creates an `AdventureObservation`, not evidence.

Example:

```text
Observation: Greyson guarded the companion three turns in a row.
NOT evidence: Greyson always prioritizes others over himself.
```

Only a later reflection can establish whether the action meant anything about Greyson outside the game.

### 12.12 Rewards

Good combat rewards:

- story consequence;
- fixed encounter progress;
- map change;
- new route;
- NPC memory;
- journal artifact;
- cosmetic relic;
- bounded fixed XP;
- new contextual Technique;
- access to a new scene.

Bad combat rewards:

- infinitely farmable progression;
- escalating stat gear;
- rewards that make avoiding reflection/journaling mechanically inferior.

---

## 13. Reflection and evidence conversion

Reflection is the firewall between simulated behavior and personal interpretation.

### 13.1 Reflection sources

A reflection can originate from:

- a journal entry;
- an adventure observation;
- a contradiction;
- an older Insight;
- a repeated pattern across multiple confirmed sources;
- an Atlas Snapshot comparison.

### 13.2 Reflection outcomes

Greyson can respond:

- **Confirm** - yes, this fits.
- **Partial** - some of it fits; preserve the nuance.
- **Reject** - no; do not count this interpretation.
- **Uncertain** - leave it unresolved.
- **Revise** - replace or amend an older confirmed claim.
- **Private** - close the topic.

### 13.3 Evidence rules

- Explicit journal statements can still create player-stated evidence under the current evidence model.
- Model inferences remain model-proposed.
- Adventure behavior alone cannot produce confirmed real-world evidence.
- Reflection may produce new evidence if the response itself supports it.
- A rejection must be remembered strongly enough that Atlas does not keep proposing the same interpretation.
- Contradictions are retained as useful state, not automatically "solved" by choosing whichever statement is newer.

### 13.4 Explainability

Every Insight and Snapshot claim must be able to answer:

- What sources support this?
- Which sources were explicit versus inferred?
- Did Greyson confirm it?
- Is there counter-evidence?
- Has it changed over time?

---

## 14. Adventure memory and continuity

Atlas needs durable story memory without sending an unbounded transcript to the provider.

### 14.1 Memory layers

Use two local layers:

1. **Adventure summary** - compact high-level history of each adventure.
2. **Triggered memory cards** - concise character/place/event/relationship/object facts inserted only when relevant.

This follows a proven general pattern from AI adventure systems: keep always-needed context compact and retrieve specific world facts only when they become relevant.

### 14.2 Memory card rules

Each card should have:

- stable ID;
- type;
- concise summary;
- deterministic trigger terms and/or direct entity references;
- source provenance;
- privacy status;
- retirement state;
- optional last-used timestamp.

### 14.3 Bounded provider context

Extend `CONTEXT_BUDGET` rather than removing it.

Suggested additional caps:

```ts
adventureSummary: 1,
relevantAdventureMemories: 8,
recentAdventureActions: 6,
knowledgeGaps: 3,
reflectionHistory: 4
```

Exact token/character caps should be measured against the selected Workers AI model and free-plan budget.

### 14.4 No cloud memory dependency

Do not introduce embeddings/vector DB infrastructure in this cycle. Deterministic tags/entity references plus recency/relevance scoring are sufficient for the target scale and preserve locality.

---

## 15. Atlas Snapshots: replace terminal Final Assessment semantics

### 15.1 Principle

Greyson is not a campaign that becomes "complete." The Atlas can become better charted, but it remains revisable.

### 15.2 Snapshot behavior

A Snapshot is a dated synthesis of what is currently supported.

It should include:

- confirmed self-knowledge;
- important uncertainties;
- contradictions;
- recent changes;
- representative Greyson words where provenance permits;
- territory summaries;
- relationships and social world;
- values and moral architecture;
- interests and ordinary preferences;
- cognitive style;
- motivations, hopes and aversions;
- open questions;
- notable adventure history only where appropriate;
- "What changed since the last snapshot?" after the first one.

### 15.3 Snapshot eligibility

The first major Snapshot can still use a deterministic milestone such as substantial territory coverage. Later snapshots should be available by a bounded deterministic cadence or explicit Greyson request.

Do not restore `CAMPAIGN_COMPLETED` merely to satisfy an old event vocabulary.

### 15.4 Historical comparison

Snapshots are immutable historical artifacts. New evidence does not rewrite an old Snapshot; it produces a new one.

---

## 16. UI/UX restructuring

### 16.1 Navigation target

Preferred product language:

- **World**
- **Journal**
- **Atlas** or **Vault**
- **Me**

"Talk" should no longer imply that Atlas speaks aloud. If the visual shell keeps an overlay interaction model, user-facing wording should still make Journal the primary concept.

### 16.2 Journal-first entry

After onboarding, Greyson should be able to reach a blank journal composer in one action from anywhere practical.

### 16.3 Adventure entry

Adventure seeds can appear:

- quietly in Journal as "Explore this";
- as a map/world marker;
- through an NPC or sanctuary;
- through a Mystery Door;
- as a Boss opportunity;
- as a pure-fun roaming event.

### 16.4 Combat UI

Mobile combat UI should show:

- enemy and player state clearly;
- objective in one short line;
- enemy intent when the design exposes it;
- 4 core actions plus contextual Leave;
- accessible status explanations;
- no tiny inventory menu;
- no hidden required gesture;
- reduced-motion-safe feedback;
- immediate return to the world after resolution.

### 16.5 App modularization for parallel development

Before simultaneous feature implementation becomes heavy, mechanically extract large interaction domains from `src/App.tsx` without changing behavior.

Recommended boundaries:

- `src/journal/`
- `src/adventure/`
- `src/combat/`
- `src/reflection/`
- `src/atlas/`
- existing `src/world/`
- existing `src/cartographer/`
- existing `src/voice/` reduced to speech-to-text input only

Keep top-level App orchestration thin enough that parallel branches do not all edit the same 100 KB file.

The extraction must be behavior-preserving and tested before feature changes are layered on top.

---

## 17. Text-to-speech removal migration

This is the first implementation cleanup because later architecture should not depend on a feature already rejected.

### 17.1 Remove

- browser `speechSynthesis` use;
- `SpeechSynthesisUtterance` construction;
- Cartographer voice enumeration and voice-choice settings;
- assistant `speaking` lifecycle state if it exists only for TTS output;
- auto-loop behavior that depends on waiting for synthesis to finish;
- TTS-specific error handling;
- TTS-specific browser tests;
- spoken onboarding/help copy requirements;
- any future-plan text that treats assistant speech as required.

### 17.2 Keep

- `getUserMedia` + `MediaRecorder` speech capture if desired;
- local amplitude/silence detection for ending a dictated entry;
- `/api/transcribe`;
- transcription free-plan eligibility guard;
- mic visualizer;
- typed input as the complete fallback;
- local agency command parsing when speech-to-text input is active, if it remains useful.

### 17.3 New speech-to-text UX

Recommended simplified path:

```text
Tap mic
 -> listening
 -> local silence detection or Done
 -> transcribing
 -> transcript appears in Journal input
 -> Greyson may edit or submit
 -> Atlas responds in text
```

Do not automatically reopen the microphone after a model response. Removing TTS should also remove the awkward hidden dependency between assistant speech completion and microphone lifecycle.

### 17.4 Voice state target

Recommended state set:

`idle -> requesting-permission -> listening -> transcribing -> idle/error`

"Thinking" belongs to the provider/UI request state rather than the microphone state. "Speaking" is removed.

### 17.5 Acceptance criteria

- Production bundle contains no `speechSynthesis` or `SpeechSynthesisUtterance` runtime reference.
- No voice picker is rendered.
- Speech-to-text still works when available.
- Typing remains fully functional.
- Leaving the page/backgrounding cancels capture.
- STOP/private agency behavior remains correct.
- No microphone automatically reopens after a text response.


---

## 18. Asset generation master plan

Asset work is a first-class parallel production lane. It must be organized around manifests and integration contracts so visual generation can proceed without blocking gameplay code.

### 18.1 Asset versioning strategy

Do not mutate the proven `public/assets/atlas/v3/` pack in-place while the new systems are experimental.

Create a new candidate pack:

`public/assets/atlas/v4/`

The build pipeline should emit:

- runtime PNG/audio assets;
- `manifest.json` with dimensions, family, frames, fps/loop metadata where relevant, source/provenance and hashes;
- `src/world/manifest.v4.generated.ts` or a deliberate successor to the current generated manifest;
- verification report from the asset validation tool.

Only switch the runtime from v3 to v4 after the candidate pack passes all visual, provenance, size and browser checks.

### 18.2 Asset law

- Greyson's visual identity must remain canonical to the approved Aerron/Greyson source.
- Andrew assets remain excluded.
- Generated enemies/NPCs must not drift into Greyson's silhouette, face or costume language.
- Do not bake dialogue or UI text into art.
- Prefer transparent PNG sprite families for characters/VFX.
- Preserve source prompts, source images, transformations and hashes outside the runtime pack.
- No runtime AI image generation.
- Every generated family needs a stable logical ID before integration.

### 18.3 Asset Lane A - Greyson combat expansion

Purpose: let the existing Greyson sprite participate in combat without redesigning him.

Minimum animation families:

1. combat-idle;
2. attack;
3. guard;
4. technique;
5. act/interact;
6. hurt;
7. victory/relief;
8. defeated/exhausted;
9. enter-battle;
10. exit-battle.

Recommended approach:

- Preserve the existing pixel-art proportions and palette anchors.
- Use the smallest frame count that reads cleanly at phone scale.
- Reuse/mirror frames only when anatomy remains coherent.
- Keep one reduced-motion still for every family.
- Avoid generating a second unrelated "battle Greyson" design.

### 18.4 Asset Lane B - ordinary encounter creatures

Target final content bank:

- at least 2 ordinary creature/enemy families per territory = 16 base families;
- palette/prop/state variants may expand variety without becoming separate species;
- at least 1 non-hostile ACT-focused encounter family per 2 territories;
- at least 4 cross-region oddities used for pure-fun encounters.

Each family should include:

- idle;
- attack/action;
- hurt/react;
- resolved/pacified or defeat;
- one distinctive gimmick animation if applicable;
- portrait/icon only if the encounter UI benefits from it.

Design priority is readable personality and gimmick, not visual complexity.

### 18.5 Asset Lane C - elite and Boss encounter art

Target:

- 1 elite/rare visual family per territory;
- 1 major Boss visual identity per territory or major synthesis arc where Boss use is justified;
- Boss art may be larger than ordinary combat sprites but must remain performant on mobile.

Boss visuals should reflect the fictional conflict, not turn a psychological category into a literal monster by default. Symbolism must remain symbolism unless the adventure intentionally literalizes it.

### 18.6 Asset Lane D - NPCs and companions

Initial target:

- 3 recurring NPC archetypes per territory = 24 recurring character slots;
- not all 24 need unique full animation at MVP;
- prioritize 8 anchor NPCs, one per territory, then expand.

Required first-wave states:

- idle;
- walk or simple travel;
- talk/react;
- one emotional variation;
- portrait.
NPC records must be separable from artwork so a character can recur with the same identity even if visual assets improve later.

### 18.7 Asset Lane E - combat and adventure environments

Initial set:

- 8 territory combat backdrops;
- 8 sanctuary interior battle/story variants where relevant;
- reusable neutral/road/ruin/cave/coast/forest/archive/workshop/abyss layers;
- foreground overlays for weather, fog, debris, magical effects and environmental hazards.

Use layered backgrounds rather than unique bespoke full-screen art for every fight.

### 18.8 Asset Lane F - VFX and UI

Generate/author reusable effects for:

- basic hit;
- guarded hit;
- perfect-timed hit;
- perfect guard;
- heal/recover;
- status application;
- status removal;
- charge;
- interrupt;
- pacify;
- escape;
- objective progress;
- victory;
- nonviolent resolution;
- memory/Insight connection;
- adventure marker;
- journal marker;
- reflection marker.

UI icon families:

- Attack;
- Technique;
- Guard;
- Act;
- Leave;
- objective types;
- common status effects;
- Journal privacy/retraction/link states;
- Snapshot/history states.

### 18.9 Asset Lane G - sound and music

No TTS assets are required.

Preserve and extend the procedural Web Audio foundation where it already works.

Required audio categories:

- combat start sting;
- player action cues;
- guard/perfect guard;
- enemy action cues;
- objective complete;
- pacify/nonviolent resolution;
- escape;
- defeat/fail-forward;
- elite/Boss intensity layer;
- region encounter ambience;
- Journal open/save subtle cues;
- adventure marker discovered;
- reflection/Insight confirmation cue.

Avoid a large external soundtrack dependency until procedural/compact audio proves insufficient.

### 18.10 Asset production packet for every family

Every asset batch must have:

1. stable asset IDs and intended runtime paths;
2. exact dimensions;
3. frame count and animation role;
4. style/canon references;
5. palette/outline constraints;
6. transparent/background rule;
7. source-generation prompt or source file reference;
8. negative constraints;
9. integration owner;
10. QA checklist;
11. provenance/license record if an external asset is used;
12. SHA-256 after final normalization.

### 18.11 Asset QA

Automated checks should validate where possible:

- expected dimensions;
- alpha channel rules;
- filenames/IDs;
- no Andrew assets;
- no missing manifest target;
- animation family completeness;
- file-size budgets;
- duplicate/orphan files;
- source provenance metadata.

Human visual review must check:

- Greyson identity continuity;
- anatomy and motion coherence;
- readability at actual mobile scale;
- enemy silhouette differentiation;
- territory style fit;
- no unintended text artifacts;
- no frame-to-frame identity drift.

---

## 19. Content generation plan

Code and art alone will not make Atlas feel alive. Content needs a governed production lane.

### 19.1 Adventure template library

Create 12 core adventure structures matching the kinds in section 10. Each structure defines:

- valid territories;
- required setup data;
- optional knowledge-gap target;
- story beat skeleton;
- compatible encounter objectives;
- compatible combat/non-combat gimmicks;
- reflection eligibility;
- fail-forward outcomes;
- memory outputs;
- content safety/privacy checks.

Templates are scaffolding, not scripts. The model supplies fresh details inside them.

### 19.2 Combat encounter template bank

Build an initial validated bank of at least 30 encounter definitions from the objective/gimmick matrix.

Suggested mix:

- 8 simple defeat encounters;
- 4 survive encounters;
- 4 protect/escort encounters;
- 4 interrupt encounters;
- 4 pacify/ACT encounters;
- 3 escape encounters;
- 3 object/environment encounters.

Do not require 30 unique art families. Reuse visual families with different deterministic objectives and story context.

### 19.3 Pure-fun content quota

At least 20 percent of available ordinary adventure seeds in the mature content bank should have `learningTarget: 'none'`.

Examples:

- ridiculous creature problem;
- treasure hunt;
- absurd NPC request;
- harmless competition;
- strange object mystery;
- exploration landmark;
- combat encounter with no psychological reading attached.

### 19.4 Reflection prompt library

Create reflection forms for:

- action meaning;
- changed mind;
- contradiction;
- relationship interpretation;
- value tradeoff;
- "that was just game behavior";
- uncertainty;
- explicit revision;
- no-reflection exit.

Prompts should remain conversational and short. Avoid clinical survey language.

---

## 20. Parallel workstreams

After the shared type contracts and TTS removal are frozen, the project should deliberately split into parallel lanes.

| Lane | Scope | Can start after | Main outputs | Main collision risk |
|---|---|---|---|---|
| P0 | Product/docs + schema contract | immediately | reconciled authority docs, v2 interfaces | source-of-truth drift |
| P1 | App modularization + Journal UI | P0 contracts | `src/journal/`, thinner App | `App.tsx`, shared state |
| P2 | Knowledge Gap + reflection engine | P0 contracts | deterministic gap/reflection logic | game types/engine |
| P3 | Adventure runtime | P0 contracts | `src/adventure/` | game state, world hooks |
| P4 | Combat engine | P0 combat contract | `src/combat/`, unit tests | shared game events |
| P5 | Provider/context/schema | P0 contracts | typed modes, bounded context | cartographer schemas |
| P6 | Asset v4 production | asset contract from P0 | sprites, enemies, UI, VFX, audio | manifest/runtime paths |
| P7 | World/content integration | P3/P4 interfaces stable | markers, NPCs, encounter triggers | world components |
| P8 | QA/privacy/accessibility | interfaces stable | invariant and browser suites | none if test-only |

### 20.1 Rules for simultaneous work

- Shared interfaces are frozen at synchronization gates before branches fan out.
- One branch owns each shared file during a wave when possible.
- `App.tsx`, `src/game/types.ts`, `src/game/engine.ts`, provider schemas and generated manifests are integration-hot files; avoid multiple independent branches editing them after the contract freeze.
- Each lane must return its own tests and exact changed-file list.
- No lane may independently invent a new progression event that bypasses the authority contract.
- Asset lane may continue while code lanes run as long as paths/IDs are frozen.
- Content authors may generate encounter/adventure definitions against schemas before the runtime UI is finished.

### 20.2 Suggested branch layout

All feature branches derive from the integration branch defined in section 2C. Example lane branches:

- `integration/atlas-v2-journal-adventure-combat` - long-lived integration target, never direct routine work;
- `refactor/v2-domain-boundaries`;
- `feat/v2-journal`;
- `feat/v2-knowledge-reflection`;
- `feat/v2-adventure-runtime`;
- `feat/v2-combat-engine`;
- `feat/v2-provider-modes-memory`;
- `art/v2-atlas-v4`;
- `feat/v2-world-adventure-integration`;
- `test/v2-journal-adventure-e2e`.

Branch names remain implementation suggestions. The controlling rules are: all lanes start from the correct integration SHA, use separate ownership/worktrees where practical, and do not merge partial v2 work to `main`.

---

## 21. Master implementation phases

The full integration should be executed in nine major phases (Phase 0 through Phase 8). Substeps inside a phase may run in parallel when their dependencies are satisfied.

### Phase 0 - Authority correction, TTS removal and safe parallelization

**Goal:** make the repository describe the product we are actually building and remove architecture that is already rejected.

#### Tasks

1. Add this master integration plan to `docs/` through a branch/PR.
2. Update `AGENTS.md` read order.
3. Reconcile `PRODUCT_SPEC`, `ARCHITECTURE`, `GAME_SYSTEM`, `MODEL_CONTRACT`, `ACCEPTANCE`, `MASTER_BUILD_PLAN` and `OPERATIONAL_STATE` with:
   - journaling-first product identity;
   - Adventure Director;
   - combat target;
   - Snapshot semantics;
   - explicit TTS removal.
4. Remove TTS runtime/UI/tests per section 17.
5. Keep speech-to-text only.
6. Perform behavior-preserving extraction from `App.tsx` into stable domain modules.
7. Freeze schema-v2 shared interfaces and branch ownership.

#### Acceptance

- No canonical doc still requires assistant TTS.
- No production runtime TTS reference.
- Existing Worldwalker movement, persistence, privacy, encounters, STT input, export/import and agency controls still pass.
- App modularization changes no user-observable behavior beyond TTS removal.
- Full baseline tests/build green before feature branches fan out.

#### Parallel work after gate

Once interfaces are frozen, Journal, Knowledge/Reflection, Adventure, Combat, Provider and Asset lanes may begin simultaneously.

---

### Phase 1 - Schema v2 and Journal foundation

**Goal:** make Atlas a real journal before trying to make every journal entry an adventure.

#### Tasks

1. Implement schema v2 migration.
2. Add `JournalEntry` persistence and export/import.
3. Build Journal UI.
4. Add typed and speech-to-text entry paths.
5. Add PRIVATE and retraction behavior.
6. Allow a journal entry without a preceding question.
7. Add model response mode that does not require `nextQuestion`.
8. Link journal entries to existing evidence when explicitly supported.
9. Preserve legacy turn history.

#### Acceptance

- Fresh user can create, edit-before-submit, save, reload, export/import, privatize and retract a journal entry.
- No prompt is required.
- Private/retracted journal text cannot reach provider context.
- Legacy v1 export imports without loss.
- Journal response may end without a follow-up question.

---

### Phase 2 - Build Adventure and Combat engines in parallel

**Goal:** create the two major deterministic gameplay foundations independently of full content scale.

#### Phase 2A - Adventure runtime

1. Implement `KnowledgeGap` and `AdventureSeed` domain state.
2. Implement `AdventureRun`, actions, observations and completion/withdrawal.
3. Create 3 adventure templates: investigation, social dilemma, pure fun.
4. Add provider schema for adventure scene proposals.
5. Add local fallback scenes sufficient to test without Workers AI.
6. Persist/reload active adventure mid-run.

#### Phase 2B - Combat engine

1. Implement `CombatDefinition`, `CombatState` and reducer/engine.
2. Add Attack, Technique, Guard, Act and Leave.
3. Add 5 objective types and 5 gimmicks first.
4. Add deterministic enemy intent.
5. Add optional timed attack/guard hook.
6. Add fail-forward outcomes.
7. Persist/reload mid-combat.
8. Prove model output cannot alter authoritative combat state.

#### Acceptance

- Adventure can complete using local deterministic/mock content.
- Combat can complete without a model.
- Save/reload works mid-adventure and mid-combat.
- No roleplay/combat action creates confirmed evidence.
- Flee/withdraw paths do not corrupt progression.
- Combat fixtures are deterministic.

---

### Phase 3 - First integrated Journaling Adventure vertical slice

**Goal:** prove the entire new loop once before producing lots of content.

#### Required vertical slice

1. Greyson journals a synthetic entry.
2. Atlas identifies a deterministic eligible gap/curiosity.
3. "Explore this" creates one Adventure Seed.
4. A marker appears in the Worldwalker world.
5. Greyson physically reaches it.
6. Adventure begins.
7. Adventure includes one natural-language scene and one visible combat or ACT encounter.
8. Combat resolves through more than one possible method.
9. Adventure records a consequence and an observation.
10. Atlas offers a reflection.
11. Synthetic Greyson rejects the first interpretation.
12. Atlas preserves the rejection.
13. A second reflection creates confirmed evidence from the response itself.
14. Map/Vault reflects the confirmed material.
15. Reload preserves all of it.
16. Export/delete/import preserves all of it.

#### Acceptance

This single path must pass in a real browser with no Workers AI dependency and synthetic content only.

Do not continue to mass content production until this loop feels coherent in the browser.

---

### Phase 4 - Memory, contradictions and Atlas Snapshots

**Goal:** make Atlas cumulative rather than episodic.

#### Tasks

1. Add AdventureMemory records and deterministic retrieval.
2. Add adventure summary compaction.
3. Make contradiction creation reachable in real play.
4. Add change detection between older and newer confirmed evidence.
5. Add Reflection confirmation/partial/reject/uncertain/revise UI.
6. Replace terminal Final Assessment UI language with Atlas Snapshot.
7. Migrate old assessments into snapshot history.
8. Implement deterministic first-snapshot eligibility and later snapshot request/cadence.
9. Add "what changed since previous snapshot" synthesis.

#### Acceptance

- A recurring NPC can reference a previous synthetic adventure through bounded memory.
- Private/retracted sources retire derived memories.
- Rejected Insight does not reappear as accepted truth.
- Contradiction can be created, inspected and later resolved/reframed without deleting its history.
- Two snapshots can coexist and show change without rewriting the older one.

---

### Phase 5 - Asset and content scale-up

**Goal:** turn the proven mechanics into a varied world rather than a prototype with one scenario.

#### Parallel production

- Greyson combat sprite expansion.
- 16 ordinary creature families.
- 8 anchor NPCs, then 24 recurring slots.
- 8 elite families.
- Boss visual bank where justified.
- 8 territory combat/story backdrops.
- VFX/UI icon bank.
- combat SFX and regional audio extensions.
- 12 adventure templates.
- 30 validated combat encounter definitions.
- reflection prompt library.
- pure-fun content bank.

#### Acceptance

- Asset v4 manifest passes automated integrity checks.
- Greyson continuity passes visual review.
- At least 3 encounter objective types and 3 gimmicks are visibly represented in actual browser play before claiming "varied combat."
- Each territory has at least one adventure and one encounter that feels mechanically or narratively different from its neighbors.

---

### Phase 6 - Bosses, Mystery Doors and world consequences integration

**Goal:** evolve existing special encounters into the new adventure grammar without losing deterministic authority.

#### Bosses

Turn Boss Fights into multi-scene synthesis adventures:

`setup -> conflict -> combat/social phase -> complication -> choice -> final phase -> reflection`

The old priority/tradeoff/contradiction skeleton can remain useful but should drive fiction rather than three naked survey questions.

#### Mystery Doors

Turn Mystery Doors into cross-region story events built from confirmed evidence on both sides.

They may resolve through:

- dialogue;
- exploration;
- puzzle;
- combat;
- mixed encounter;
- deliberate refusal.

#### Acceptance

- Existing privacy rules remain absolute.
- Special encounters are optional and non-trapping.
- Their deterministic availability/reward authority remains outside the model.
- They generate story history/memory as well as ordinary progression.

---

### Phase 7 - Whole-product integration and hardening

**Goal:** make the new Atlas robust enough for a real Greyson session.

#### Required hardening

- mobile 320/390/430 widths;
- iPhone/Safari when available;
- Android/Chrome when available;
- keyboard/touch controls;
- reduced motion;
- offline shell and local data access;
- provider quota failure;
- malformed provider responses;
- import/export migration torture;
- background microphone cancellation;
- adventure/combat double-submit races;
- cross-campaign import races;
- save/reload during every major mode;
- PRIVATE/retraction propagation;
- context budget on long campaigns;
- no-TTS bundle scan;
- secret/private-data repository scan;
- asset orphan/path/hash scan.

#### Acceptance

Full end-to-end synthetic journey:

```text
wake
-> onboard
-> journal
-> seed
-> walk
-> adventure
-> combat/ACT
-> consequence
-> reflection rejection
-> reflection confirmation
-> Atlas update
-> second adventure remembers first
-> contradiction/change
-> Snapshot
-> export
-> delete
-> import
-> reload
```

No step may rely on hidden fixture mutation once the session begins.

---

### Phase 8 - Greyson pilot and product closure

**Goal:** test whether Atlas serves the human purpose, not merely whether the code works.

This phase cannot be automated into completion.

Observe, without collecting or committing private content:

- Does Greyson choose to journal without being pushed?
- Does he understand what the world is for?
- Does he notice and want to follow adventure markers?
- Does combat feel fun rather than intrusive?
- Are encounters varied enough to avoid repetition?
- Does reflection feel respectful rather than like a disguised test?
- Does he reject or revise Atlas when it is wrong?
- Does Atlas remember that correction?
- Does the world feel personal without feeling invasive?
- Does he want to come back?

Record only product-friction categories and implementation-safe observations unless Greyson explicitly chooses to preserve personal content.

Phase 8 results drive the next bounded revision. They do not justify a giant speculative rebuild.

---

## 21A. Critical path and parallel wave schedule

The phase list above describes product maturity. Autonomous production should execute through dependency waves so unrelated lanes can move at the same time without colliding.

### Wave 0 - Authority and execution infrastructure

**Critical path:** `F00 -> F01 -> F02 -> F03 -> F04 -> F05`

Can run in parallel after `F02`:

- TTS removal investigation;
- App extraction mapping;
- schema-v2 design;
- asset ID/spec preproduction;
- agent routing calibration.

**Gate W0:** repository has one accepted authority chain, one integration branch, one task ledger, exact baseline proof, and no ambiguity about TTS removal.

### Wave 1 - Contract freeze and decomposition

Parallel groups:

```text
Group A: TTS removal + STT-only lifecycle
Group B: App/domain extraction
Group C: schema-v2 + migration fixture design
Group D: provider discriminated-union contract
Group E: asset/content schemas
```

**Gate W1:** shared public interfaces are frozen enough that Journal, Reflection, Adventure, Combat, Provider, and Asset lanes can work without editing the same central files.

### Wave 2 - Independent domain foundations

Run simultaneously:

- Journal foundation;
- Reflection foundation;
- Knowledge Gap engine;
- Adventure runtime;
- Combat engine;
- provider mode implementations;
- asset factory setup;
- content template factory setup.

**Gate W2:** each engine works locally with synthetic fixtures, persists where appropriate, and has focused tests. No full vertical slice is required yet.

### Wave 3 - First vertical slice

Integration-owner work dominates this wave. Content/art lanes may continue in parallel but must not outrun frozen IDs.

**Gate W3:** one complete browser journey proves journal -> seed -> world -> adventure -> combat/ACT -> consequence -> reflection -> confirmed/rejected Atlas state -> reload/export/import.

### Wave 4 - Memory, snapshots, world consequence, and special encounters

Parallel groups:

- adventure memory and recurrence;
- contradiction/change engine;
- Atlas Snapshot history;
- Boss/Mystery migration;
- world consequence surfaces;
- asset/content scale-up.

**Gate W4:** the world remembers earlier synthetic events and two dated snapshots can coexist.

### Wave 5 - Content and asset scale

This is the highest-parallelism wave. Engines should be stable enough that most work is data/assets, not architecture.

**Gate W5:** every territory has a distinct playable identity; combat variation is demonstrated in-browser; v4 asset manifest is coherent and source-traceable.

### Wave 6 - Hardening and release proof

Parallel QA may inspect different lanes, but fixes enter one controlled repair queue.

**Gate W6:** full synthetic lifecycle, migration torture, privacy canaries, no-TTS scan, clean build, mobile layouts, performance budgets, asset integrity, and independent release review pass.

### Wave 7 - Greyson pilot

Automation prepares the build and observation checklist. Human use determines the result.

---

## 21B. Detailed autonomous work packet registry

This registry is intentionally more granular than the phase list. It exists so an orchestrator can choose the next `READY` packet from dependencies rather than re-planning the project every session.

**Executor labels:**

- `L` = LIGHT workhorse.
- `S` = STANDARD workhorse.
- `H` = STRONG reasoning/coding path.
- `C` = independent challenger/reviewer.
- `A?` = Astra eligible only under the escalation rules in section 2D.

### Foundation, authority, and repository control (`F`)

| ID | Work packet | Depends | Default | Astra | Exit evidence |
|---|---|---|---|---|---|
| F00 | Capture exact Git baseline, test scripts, main/deploy coupling, untracked state | none | L | No | environment/proof receipt |
| F01 | Add v2 master plan on non-main branch | F00 | L | No | file present; no runtime diff |
| F02 | Reconcile `AGENTS.md` read order and authority graph | F01 | S | No | source-of-truth diff review |
| F03 | Reconcile `PRODUCT_SPEC`, `ARCHITECTURE`, `GAME_SYSTEM`, `MODEL_CONTRACT`, `ACCEPTANCE`, `MASTER_BUILD_PLAN` | F02 | H | Yes only on unresolved conflict | contradiction scan + review |
| F04 | Create integration branch/worktree topology and autonomy ledger | F02 | L | No | branches/worktrees fingerprinted |
| F05 | Re-run exact pre-change baseline (`tsc`, unit, browser, build, diff check) | F04 | L | No | baseline counts recorded |
| F06 | Run 3-task agent-routing calibration and record default pairings | F04 | S/C | No | benchmark receipt |
| F07 | Compile protected capability/invariant manifest from current state | F02,F05 | H | A? | invariant list tied to tests |
| F08 | Establish proof-receipt format and merge queue rules | F04 | L | No | template + ledger fields |
| F09 | Establish shared-file hot-zone ownership | F04 | S | No | ownership matrix |

### TTS removal and STT simplification (`V`)

| ID | Work packet | Depends | Default | Astra | Exit evidence |
|---|---|---|---|---|---|
| V00 | Inventory all TTS runtime/UI/test/doc references | F05 | L | No | exact reference list |
| V01 | Define STT-only lifecycle contract | V00,F03 | H | A? only if lifecycle conflict | state diagram + acceptance |
| V02 | Remove browser speech synthesis implementation | V01 | S | No | source scan clean |
| V03 | Remove voice picker/output-voice settings and persistence | V01 | S | No | UI/state scan + tests |
| V04 | Remove auto-listen restart dependency on TTS completion | V01 | H | No | lifecycle browser test |
| V05 | Preserve mic capture, visualizer, silence end, transcription, cancellation | V02,V04 | H | No | focused voice/STT suite |
| V06 | Present transcript as editable text before submission | V05 | S | No | browser journey |
| V07 | Remove/supersede TTS-only tests and docs | V02,V03,V04 | L | No | no canonical TTS requirement |
| V08 | Production-bundle and source no-TTS negative proof | V07 | L/C | No | `speechSynthesis`/`SpeechSynthesisUtterance` absent |

### App decomposition and shared contracts (`D`)

| ID | Work packet | Depends | Default | Astra | Exit evidence |
|---|---|---|---|---|---|
| D00 | Map `App.tsx` responsibilities and shared-state seams | F05 | H | A? | extraction map |
| D01 | Extract presentational/navigation helpers with zero behavior change | D00 | S | No | baseline browser suite unchanged |
| D02 | Extract journal-facing shell boundary placeholder | D01 | S | No | compile + no UX change |
| D03 | Extract encounter/combat presentation boundary placeholder | D01 | S | No | compile + existing encounters green |
| D04 | Extract world-interaction orchestration hooks | D01 | S | No | Worldwalker journeys green |
| D05 | Freeze v2 domain public interfaces | F03,D02,D03,D04 | H | A? | reviewed interface document/types |
| D06 | Freeze shared event-dispatch authority rules | D05,F07 | H/C | A? | firewall tests planned |
| D07 | Declare integration-owner surfaces and prohibit lane drift | D05 | L | No | ledger rules updated |

### Persistence/schema v2 (`M`)

| ID | Work packet | Depends | Default | Astra | Exit evidence |
|---|---|---|---|---|---|
| M00 | Create synthetic canonical v1 export fixtures | F05 | S | No | fixtures validate under v1 |
| M01 | Implement schema-v2 type/schema additions with no feature wiring | D05,M00 | H | A? | type/schema tests |
| M02 | Implement deterministic v1 -> v2 migration | M01 | H | A? | migration fixture parity |
| M03 | Migrate historical FinalAssessment to first historical snapshot representation | M02 | H | A? | deterministic migration test |
| M04 | Preserve legacy turns, Boss/Mystery runs, worldJourney, settings | M02 | H | No | round-trip fixture tests |
| M05 | Extend export/import validator to v2 | M02 | H | No | malformed + valid import tests |
| M06 | Add derived-state retirement hooks for private/retracted v2 sources | M01 | H/C | A? on unresolved provenance design | canary tests |
| M07 | Persistence torture: save/reload/export/delete/import across v1 and v2 | M03-M06 | H/C | No | browser + unit proof |

### Journal (`J`)

| ID | Work packet | Depends | Default | Astra | Exit evidence |
|---|---|---|---|---|---|
| J00 | Implement `JournalEntry` domain functions/selectors | M01,D05 | S | No | unit tests |
| J01 | Persist journal entries and indexes | J00,M05 | S | No | IndexedDB round trip |
| J02 | Build blank journal composer reachable in one action | J00,D02 | S | No | 320/390 browser proof |
| J03 | Wire typed journal save without preceding question | J01,J02 | S | No | browser test |
| J04 | Wire STT transcript into editable journal composer | V06,J02 | S | No | STT-only browser test |
| J05 | Journal PRIVATE and retraction controls | J01,M06 | H | No | privacy/retraction canary |
| J06 | Journal history/list/date navigation | J01 | S | No | browser test |
| J07 | Link journal entry -> reflection/adventure IDs | J01,D05 | S | No | persistence test |
| J08 | Add optional user-requested prompt, never mandatory | J02 | S | No | no-prompt path remains complete |
| J09 | Journal response UI supports acknowledgement with no follow-up | J02,P03 | S | No | provider/mock test |
| J10 | Journal accessibility/reduced-motion/mobile pass | J02-J09 | S/C | No | accessibility/browser receipt |

### Reflection and evidence authority (`R`)

| ID | Work packet | Depends | Default | Astra | Exit evidence |
|---|---|---|---|---|---|
| RF00 | Implement `ReflectionRecord` state machine | M01,D05 | H | No | unit tests |
| RF01 | Build reflection UI: Confirm/Partial/Reject/Uncertain/Revise/Private | RF00 | S | No | browser proof |
| RF02 | Convert explicit reflection response into evidence proposal path | RF00,D06 | H | A? | authority tests |
| RF03 | Prove AdventureObservation alone cannot become evidence | RF00,D06 | H/C | No | mutation/negative test |
| RF04 | Persist rejected interpretations as anti-repeat context | RF00,P04 | H | No | recurrence test |
| RF05 | Implement partial/revision provenance behavior | RF02,M06 | H | A? | provenance tests |
| RF06 | Make contradiction creation reachable from active supported claims | RF02 | H | A? | deterministic contradiction tests |
| RF07 | Implement changed-mind/change-over-time candidate detection | RF05 | H | A? | old/new fixture tests |
| RF08 | Explainability surface: show why an insight exists | RF02,RF05 | S | No | Vault/Atlas browser proof |
| RF09 | Reflection privacy/retraction propagation | RF05,M06 | H/C | No | canary tests |

### Knowledge Gap engine (`K`)

| ID | Work packet | Depends | Default | Astra | Exit evidence |
|---|---|---|---|---|---|
| K00 | Implement gap types and deterministic selectors | M01 | S | No | unit tests |
| K01 | Implement undercoverage and age scoring | K00 | S | No | score fixtures |
| K02 | Implement explicit curiosity markers from Greyson actions | K00,J07 | S | No | fixture tests |
| K03 | Implement contradiction/change inputs without drama weighting | K00,RF06,RF07 | H | A? | rank-order fixtures |
| K04 | Implement theme diversity/cooldown/repetition suppression | K01 | S | No | long synthetic selection test |
| K05 | Implement private/retracted exclusion | K00,M06 | H/C | No | canary proof |
| K06 | Implement gap retirement/user 'do not explore this' action | K00 | S | No | browser + unit proof |
| K07 | Implement deterministic gap -> seed request object | K01-K06 | H | No | schema snapshot test |

### Adventure runtime (`A`)

| ID | Work packet | Depends | Default | Astra | Exit evidence |
|---|---|---|---|---|---|
| A00 | Implement AdventureSeed state/eligibility/deduplication | K07,M01 | H | No | unit tests |
| A01 | Implement AdventureRun deterministic lifecycle | A00 | H | No | unit tests |
| A02 | Implement AdventureAction and observation recording | A01 | S | No | action/observation tests |
| A03 | Implement six-beat bounded runtime skeleton | A01 | S | No | local template test |
| A04 | Implement natural-language action submission boundary | A03,P05 | H | A? | malformed/valid action tests |
| A05 | Implement withdrawal/fail-forward outcomes | A01 | H | No | state tests |
| A06 | Implement local fallback adventure renderer | A03 | S | No | offline browser proof |
| A07 | Implement world consequence output contract | A01,W05 | H | A? | consequence schema tests |
| A08 | Persist/reload active adventure mid-beat | A01,M05 | H | No | persistence torture |
| A09 | Implement pure-fun seed path with `learningTarget:none` | A00 | S | No | no-reflection-required test |
| A10 | Integrate reflection handoff only when eligible | A02,RF00 | H | No | firewall test |
| A11 | Adventure engine independent test suite complete | A00-A10 | S/C | No | suite receipt |

### Adventure memory and recurrence (`N`)

| ID | Work packet | Depends | Default | Astra | Exit evidence |
|---|---|---|---|---|---|
| N00 | Implement typed AdventureMemory records | A01,M01 | S | No | unit tests |
| N01 | Implement compact adventure summary | N00 | S | No | deterministic summary fixture/local fallback |
| N02 | Implement entity/tag/recency retrieval without vectors | N00 | H | No | relevance fixtures |
| N03 | Bound context memory selection to explicit budget | N02,P04 | H | No | max-size tests |
| N04 | Retire memory derived from private/retracted source | N00,M06 | H/C | No | canary proof |
| N05 | Recurring NPC references prior synthetic adventure | N02,A07,W04 | S | No | browser journey |
| N06 | Promise/object/place memory continuity | N02 | S | No | fixture tests |
| N07 | Long-campaign memory budget/regression test | N03 | S/C | No | sustained suite |

### Combat engine (`C`)

| ID | Work packet | Depends | Default | Astra | Exit evidence |
|---|---|---|---|---|---|
| C00 | Freeze minimal combat stats/formulas/objective contract | D05 | H | A? if design deadlock | reviewed contract |
| C01 | Implement CombatDefinition/CombatState and reducer | C00,M01 | H | No | unit tests |
| C02 | Implement ATTACK deterministic damage and timing bonus hook | C01 | S | No | formula/timing tests |
| C03 | Implement GUARD and optional perfect-guard hook | C01 | S | No | damage reduction tests |
| C04 | Implement TECHNIQUE registry/cooldown/context contract | C01 | S | No | technique fixtures |
| C05 | Implement ACT resolver and scenario-owned actions | C01 | H | No | ACT tests |
| C06 | Implement LEAVE/flee/story exit rules | C01 | H | No | fail-forward tests |
| C07 | Implement 5 MVP objectives | C01 | S | No | objective matrix tests |
| C08 | Implement 5 MVP gimmicks | C01 | S | No | gimmick matrix tests |
| C09 | Implement deterministic enemy intent/telegraph state | C01,C08 | H | No | intent tests |
| C10 | Implement minimal statuses and resolution order | C01 | H | No | order/idempotency tests |
| C11 | Persist/reload mid-combat | C01,M05 | H | No | IndexedDB/import test |
| C12 | Combat authority firewall rejects model-authored outcome/reward/HP | C01,D06 | H/C | No | mutation proof |
| C13 | Build mobile CombatPanel and objective/intent display | C02-C10,D03 | S | No | browser layout proof |
| C14 | Timed-input accessibility fallback/reduced motion | C02,C03,C13 | H | No | keyboard/touch/reduced-motion tests |
| C15 | Nonviolent pacify encounter vertical fixture | C05,C07,C08 | S | No | unit + browser proof |
| C16 | Protect/interrupt/survive vertical fixtures | C07-C09 | S | No | 3 distinct browser encounters |
| C17 | Combat tuning pass against 2-5-turn target | C13,C15,C16 | H/C | A? only if systemic design issue | deterministic encounter metrics |

### Provider/context/fallback (`P`)

| ID | Work packet | Depends | Default | Astra | Exit evidence |
|---|---|---|---|---|---|
| P00 | Replace universal CartographerTurn target with discriminated proposal union | D05 | H | A? | schema tests |
| P01 | JournalProposal schema | P00 | S | No | parse/semantic tests |
| P02 | ReflectionProposal schema | P00 | S | No | parse/semantic tests |
| P03 | AdventureSceneProposal schema | P00 | H | A? | parse/semantic tests |
| P04 | SnapshotProposal schema | P00 | H | No | provenance semantic tests |
| P05 | Mode-specific bounded context compilers | P01-P04,K07,N03 | H | A? | privacy/budget tests |
| P06 | Mode-specific prompt/system instructions | P01-P05 | H | A? only on failed eval | synthetic evaluation fixtures |
| P07 | Single-repair/no-loop malformed response policy for new modes | P00 | H | No | failure-code tests |
| P08 | Local journal acknowledgement fallback | P01 | S | No | offline test |
| P09 | Local reflection wording fallback | P02 | S | No | offline test |
| P10 | Local adventure template continuation fallback | P03,A06 | S | No | offline test |
| P11 | Rename/reframe `/api/finalize` product semantics toward Snapshot without breaking compatibility | P04,M03 | H | A? | compatibility tests |
| P12 | Provider call-count/cost guard: mechanics never require narrative call | P05 | H/C | No | call-count tests |

### World/UI integration (`W`)

| ID | Work packet | Depends | Default | Astra | Exit evidence |
|---|---|---|---|---|---|
| W00 | Rename user-facing Talk concept toward Journal without breaking routes | J02,V07 | S | No | visual/browser proof |
| W01 | Add adventure/world marker taxonomy and icons contract | A00 | S | No | render tests |
| W02 | Place deterministic available seeds into world marker state | W01,A00 | H | No | world state tests |
| W03 | Visible encounter entity/contact contract | C01,W01 | H | No | world browser test |
| W04 | NPC identity/state records separated from art | A01,N00 | S | No | recurrence fixture |
| W05 | Persist world consequence flags | A07,M05 | H | No | reload/import tests |
| W06 | Sanctuary interaction hooks for adventure/journal/reflection | W02,RF00 | S | No | browser journey |
| W07 | World consequence visuals (props/routes/NPC availability) | W05 | S | No | before/after visual proof |
| W08 | Journal shortcut reachable from world in one action | J02 | S | No | mobile test |
| W09 | Marker accessibility/non-color distinction | W01 | S/C | No | accessibility proof |
| W10 | World/adventure/combat transitions no horizontal overflow at 320/390/430 | W02,W03,C13 | S/C | No | viewport suite |

### Atlas/Snapshots/special encounters (`S`)

| ID | Work packet | Depends | Default | Astra | Exit evidence |
|---|---|---|---|---|---|
| S00 | Implement AtlasSnapshot local record/history | M01 | H | No | persistence tests |
| S01 | Implement deterministic snapshot eligibility/request path | S00 | H | No | eligibility tests |
| S02 | Local snapshot synthesizer from provenance-visible material | S00,RF05 | H | A? on synthesis design only | canary tests |
| S03 | Remote Snapshot proposal path + semantic validator | S00,P04,P05 | H | A? | provider tests |
| S04 | Snapshot history and immutable comparison UI | S00 | S | No | two-snapshot browser proof |
| S05 | `what changed` comparison from supported deltas | S04,RF07 | H | A? | synthetic comparison fixture |
| S06 | Migrate existing Boss skeleton into story-phase adapter | A01,C01,RF00 | H | A? | existing Boss invariants + new journey |
| S07 | Migrate Mystery Door into cross-region adventure adapter | A01,RF00 | H | A? | privacy + optionality tests |
| S08 | Prove special encounter withdrawal/PASS/PRIVATE remain safe | S06,S07 | H/C | No | regression suite |

### Asset factory (`AS`)

| ID | Work packet | Depends | Default | Astra | Exit evidence |
|---|---|---|---|---|---|
| AS00 | Freeze v4 asset IDs, directories, budgets, metadata schema | D05 | H | A? | reviewed manifest contract |
| AS01 | Build/extend asset validator for v4 families | AS00 | S | No | validator fixtures |
| AS02 | Create Greyson combat animation production brief | AS00 | S | A? only identity failure | continuity brief |
| AS03 | Generate Greyson combat-idle/attack/guard/hurt first proof batch | AS02 | standard visual generator | A? after failed lower-cost attempts | visual QA contact sheet + files |
| AS04 | Generate Technique/ACT/victory/defeat/entry/exit Greyson set | AS03 | standard visual generator | A? | continuity pass |
| AS05 | Create 16 ordinary creature family briefs | AS00,CT02 | S | No | generation-ready specs |
| AS06 | Generate ordinary creature families 1-8 | AS05 | standard visual generator | No | batch manifest + QA |
| AS07 | Generate ordinary creature families 9-16 | AS05 | standard visual generator | No | batch manifest + QA |
| AS08 | Generate 4 cross-region pure-fun oddity families | AS05 | standard visual generator | No | batch manifest + QA |
| AS09 | Generate 8 anchor NPC visual families | AS00,CT03 | standard visual generator | A? on hard continuity only | portraits/states + QA |
| AS10 | Generate 8 elite visual families | AS05 | standard visual generator | No | batch QA |
| AS11 | Boss concept lock and generation only for approved Boss slots | S06,AS00 | H + visual generator | A? | concept approval + runtime assets |
| AS12 | Generate 8 territory combat/story backdrop sets | AS00 | standard visual generator | No | mobile readability QA |
| AS13 | Generate reusable VFX sprite/effect bank | C13,AS00 | standard visual generator | No | effect manifest |
| AS14 | Author/generate UI icon bank | AS00 | L/standard visual | No | 1x/2x mobile proof |
| AS15 | Extend procedural/compact combat audio cues; no TTS | C13 | S | No | audio lifecycle tests |
| AS16 | Normalize, hash, manifest, orphan-check candidate assets | AS01,AS03-AS15 | L | No | generated manifest/integrity report |
| AS17 | Human continuity/readability review at target scale | AS16 | C/human | A? only after unresolved defects | approval ledger |
| AS18 | Runtime v4 integration behind one manifest switch | AS16,AS17 | S | No | browser + size-budget proof |

### Content factory (`CT`)

| ID | Work packet | Depends | Default | Astra | Exit evidence |
|---|---|---|---|---|---|
| CT00 | Freeze AdventureTemplate schema | A03 | H | No | schema tests |
| CT01 | Draft 12 core adventure template skeletons | CT00 | S | No | schema-valid content bank |
| CT02 | Define territory encounter ecology/style matrix | CT00,C07,C08 | S | A? on high-value world synthesis | reviewed matrix |
| CT03 | Author 8 anchor NPC records | W04,CT02 | S | No | identity/memory fields complete |
| CT04 | Author 30 combat encounter definitions against objective/gimmick matrix | C07,C08 | L/S | No | schema + deterministic sim |
| CT05 | Enforce at least 20% pure-fun ordinary seed bank | CT01 | L | No | content count/test |
| CT06 | Build reflection prompt/form library | RF00 | S | No | anti-survey review |
| CT07 | Build local fallback journal/reflection/adventure copy bank | P08-P10 | S | No | offline journey |
| CT08 | Build per-territory ambient event banks | CT01,W01 | S | No | content manifest |
| CT09 | Build ACT option bank without encoding psychological verdicts | C05 | S/C | No | semantic review |
| CT10 | Content repetition and hidden-test-language lint | CT01-CT09 | S/C | A? only if systemic prompt problem | lint report |

### Vertical slice and integration (`I`)

| ID | Work packet | Depends | Default | Astra | Exit evidence |
|---|---|---|---|---|---|
| I00 | Wire Journal -> Gap -> Explore-this seed | J03,K07,A00 | H | No | integration test |
| I01 | Wire Seed -> World marker -> Adventure start | I00,W02,A01 | H | No | browser journey |
| I02 | Wire Adventure -> Combat/ACT encounter | I01,C13,A03 | H | A? on interface deadlock | browser journey |
| I03 | Wire combat outcome -> consequence -> observation | I02,A02,A07 | H | No | state/provenance proof |
| I04 | Wire observation -> optional reflection | I03,A10,RF01 | H | No | no-evidence-without-reflection proof |
| I05 | Prove rejected first interpretation suppresses recurrence | I04,RF04 | H/C | No | browser + context proof |
| I06 | Prove second explicit reflection can create supported evidence | I04,RF02 | H/C | No | evidence provenance proof |
| I07 | Wire confirmed Atlas change to world/vault presentation | I06,W07,RF08 | H | No | rendered proof |
| I08 | Reload/export/delete/import whole vertical slice state | I00-I07,M07 | H/C | No | long browser receipt |
| I09 | Independent vertical-slice adversarial review | I08 | C/H | Yes | gate verdict |

### QA, hardening, and release (`Q`)

| ID | Work packet | Depends | Default | Astra | Exit evidence |
|---|---|---|---|---|---|
| Q00 | Full unit suite on integration head | W5 systems | L | No | exact counts |
| Q01 | Full browser suite on production/PWA build | Q00 | L | No | exact counts |
| Q02 | TypeScript + build + diff check | Q00 | L | No | commands clean |
| Q03 | v1/v2 migration torture chain | M07,I08 | H/C | No | proof receipt |
| Q04 | PRIVATE/retraction canary across journal/evidence/gap/memory/snapshot | all provenance systems | H/C | A? only if failure root cause unclear | canary absent everywhere |
| Q05 | Combat/adventure same-task double-submit/concurrency hammer | I02 | H/C | No | mutation-proven regression |
| Q06 | Provider malformed/timeout/quota/offline degradation | P07-P12 | H/C | No | browser + unit proof |
| Q07 | Long-campaign context budget and memory retention | N07,P05 | H/C | No | bounded payload metrics |
| Q08 | Asset orphan/hash/path/provenance scan | AS18 | L/C | No | integrity report |
| Q09 | No-TTS source/bundle/canonical-doc scan | V08 | L/C | No | zero forbidden refs |
| Q10 | 320/390/430/tablet mobile visual and interaction pass | W10,C13,J10 | S/C | No | screenshot/runtime evidence |
| Q11 | Reduced-motion/keyboard/touch/semantic accessibility pass | UI complete | S/C | No | accessibility matrix |
| Q12 | Safari/iPhone run when device/browser access exists | integration RC | human/runtime | No | explicit pass/unverified record |
| Q13 | Android/Chrome PWA run when reachable hardware exists | integration RC | human/runtime | No | explicit pass/unverified record |
| Q14 | Clean-clone/reproducible build certificate | Q00-Q11 | H/C | No | clean baseline build proof |
| Q15 | Sensitive-data/repository secret boundary audit | RC | H/C | No | leakage certificate |
| Q16 | Cold-start successor audit: can a fresh agent resume from repo docs alone? | RC | C/H | A? | recovery verdict |
| Q17 | Full synthetic lifecycle from onboarding through second Snapshot and import | Q00-Q11 | H/C | Yes for final adversarial read only | terminal oracle pass |
| Q18 | Final diff-scope verification against integration plan | Q17 | C/H | No | scope matrix |
| Q19 | Release candidate decision memo with remaining unknowns | Q14-Q18 | H | Yes | release packet |
| Q20 | Merge to `main` only after explicit release authority | Q19 | human/integration owner | No | remote head + CI/deploy proof |

### Human pilot and learning (`H`)

| ID | Work packet | Depends | Default | Astra | Exit evidence |
|---|---|---|---|---|---|
| H00 | Prepare privacy-safe Greyson pilot checklist | Q19 | S | No | checklist |
| H01 | Run real Greyson session without recording private content into repo | H00,Q20 or approved test build | human | No | friction-only notes |
| H02 | Classify friction F0-F3 and defects vs taste vs misunderstanding | H01 | H | A? if product interpretation genuinely ambiguous | categorized observations |
| H03 | Convert real defects/corrections into regression packets | H02 | H | No | fixtures/contracts |
| H04 | Decide bounded next revision; do not reopen whole architecture by default | H02,H03 | H/human | A? | accepted revision scope |

---

## 21C. Dependency shortcuts for autonomous orchestration

An orchestrator does not need to read every row to find work. Use these readiness rules.

### Earliest safe parallel fan-out

After `F05`:

- `V00`;
- `D00`;
- `M00`;
- `F06`;
- `AS00` design may begin after `D05`, but art references/creative exploration can begin earlier without committing runtime IDs.

After `D05` + `M01`:

- Journal (`J00`);
- Reflection (`R00`);
- Knowledge (`K00`);
- Adventure (`A00` after `K07`);
- Combat (`C01` after `C00`);
- Provider union (`P00`);
- Snapshot record (`S00`);
- asset/content schemas (`AS00`, `CT00`).

### Highest-value unblocked work rule

When several packets are `READY`, prefer in this order:

1. critical-path packet that unlocks multiple lanes;
2. proof/gate packet that prevents bad work from compounding;
3. interface packet required by several branches;
4. independent domain packet;
5. content/asset scale packet;
6. polish.

Do not choose work merely because it is visually impressive while a critical contract is still unstable.

### Parallelism ceiling

Parallelism is limited by shared-file collision, not by number of available models. If two packets need the same hot-zone file, sequence them or move the interface behind a lane-owned boundary first.

---

## 21D. Merge packet contract

Before any feature branch enters the integration branch, require:

```text
PACKET: <id>
BASE: <sha>
HEAD: <sha>
CHANGED FILES: <exact list>
DEPENDENCIES PRESENT: yes/no
ACCEPTANCE: each criterion -> evidence
VALIDATION RUN: exact commands + counts
VALIDATION NOT RUN: explicit list
NEW DEPENDENCIES: none or exact list
NEW NETWORK/SERVICE SURFACES: none or exact list
PRIVACY/PERSISTENCE/MIGRATION IMPACT: none or exact notes
KNOWN UNKNOWNS: list
REVIEWER: identity/tool
VERDICT: MERGE_READY | REPAIR | BLOCKED
```

An agent message saying "done" or "all tests pass" without this evidence is not a merge packet.


## 22. Recommended file/module map

Target organization after modularization:

```text
src/
  App.tsx
  atlas/
    snapshots.ts
    selectors.ts
  journal/
    types.ts
    engine.ts
    JournalPanel.tsx
  reflection/
    types.ts
    engine.ts    ReflectionPanel.tsx
  adventure/
    types.ts
    seeds.ts
    runtime.ts
    memory.ts
    templates.ts
    AdventurePanel.tsx
  combat/
    types.ts
    engine.ts
    objectives.ts
    gimmicks.ts
    timing.ts
    CombatPanel.tsx
  game/
    engine.ts
    types.ts
    data.ts
    encounters.ts
  cartographer/
    schema.ts
    context.ts
    apply.ts
    provider.ts
    workersai.ts
    mock.ts
    modes/
      journal.ts
      reflection.ts
      adventure.ts
      snapshot.ts
  world/
    ...existing Worldwalker modules...
  voice/
    access.ts
    capture.ts
    transcribe-input.ts
    commands.ts
    state.ts
  persistence/
    ...
```

Do not create files merely to match this tree. Use it to create domain ownership boundaries where code actually exists.

---

## 23. Model/provider contract redesign

### 23.1 Replace one universal turn shape

Current shape centered on `reply + nextQuestion` should become a discriminated union by mode.

Conceptual example:

```ts
type ModelProposal =
  | JournalProposal
  | ReflectionProposal
  | AdventureSceneProposal
  | EncounterFlavorProposal
  | SnapshotProposal;
```

Every proposal includes a `kind` discriminator.

### 23.2 Journal proposal

May contain:

- response;
- optionalFollowUp;
- evidence proposals grounded in the current entry;
- possible gap candidates;
- optional exploreLaterSuggestion.

It must not require a follow-up question.

### 23.3 Adventure proposal

May contain:

- scene text;
- NPC speech;
- allowed scene choices as UI hints;
- open-action guidance;
- encounter skin request from allowed IDs;
- candidate observation wording;
- memory candidate wording.

It may not mutate adventure/combat outcome.

### 23.4 Reflection proposal

May contain:

- one short question;
- interpretation candidate;
- supporting source IDs;
- uncertainty statement.

No evidence is confirmed until Greyson responds and deterministic conversion rules accept the response.

### 23.5 Snapshot proposal

Must use provenance-visible confirmed material only and pass the existing semantic safety philosophy used for Final Assessment.

### 23.6 Failure behavior

Provider failure must degrade to:

- local journal acknowledgment;
- local adventure template continuation where feasible;
- deterministic combat unaffected;
- local reflection wording;
- local Snapshot synthesis.

The game must never lose local state because a model is unavailable.

---

## 24. Test and verification master plan

### 24.1 Unit suites

Add:

- `tests/journal/`
- `tests/reflection/`
- `tests/adventure/`
- `tests/combat/`
- `tests/atlas/`

Required unit coverage:

- schema v1 -> v2 migration;
- journal privacy/retraction;
- deterministic gap scoring;
- adventure seed deduplication;
- adventure state transitions;
- combat objective resolution;
- combat gimmick state transitions;
- leave/fail-forward;
- model authority firewall;
- observation != evidence;
- reflection conversion;
- rejected interpretation suppression;
- contradiction/change detection;
- memory visibility;
- Snapshot provenance.

### 24.2 Browser suites

Add focused browser journeys for:

1. Journal lifecycle.
2. Speech-to-text-only input.
3. Adventure marker -> run -> consequence.
4. Combat controls and 320px layout.
5. Timed-input accessibility fallback.
6. Reflection confirm/reject/revise.
7. Adventure memory recurrence.
8. Snapshot history.
9. v1 import migration.
10. Long-session full loop.

### 24.3 Mutation/negative proofs

The strongest tests should fail when the protection is deliberately removed.

Examples:

- remove adventure->reflection firewall: test must catch fictional behavior becoming evidence;
- remove privacy propagation: private canary must leak and test fail;
- allow forged combat outcome: firewall test must fail;
- restore TTS call: bundle/no-TTS test must fail;
- remove encounter lock: same-task double-click must duplicate state and test fail;
- remove memory provenance: retracted canary must appear in a later adventure and test fail.

### 24.4 Visual QA

Required rendered states:

- Journal empty and long entry;
- World with multiple marker categories;
- ordinary combat;
- nonviolent ACT resolution;
- elite/Boss encounter;
- Reflection panel;
- Atlas Snapshot;
- reduced motion;
- quiet presentation;
- 320x640, 390x844, 430-width and tablet width.

---

## 25. Performance, cost and data budgets

### 25.1 Browser performance

- Do not add a game engine dependency unless native React/Canvas architecture becomes demonstrably insufficient.
- Reuse Canvas 2D world rendering.
- Keep battle effects bounded and dispose transient audio/animation resources.
- Preload only nearby/relevant encounter assets rather than the entire future asset bank when pack size grows materially.
- Measure bundle/chunk growth per major phase.

### 25.2 AI cost

- Workers AI Free remains the only real provider unless a later explicit decision changes it.
- Development-time systems such as GPT-5.6 Sol, Quad Code, Grok Build, LM Arena, AI Studio, Anti-Gravity, and Astra are build/review tools, not runtime Atlas providers.
- Astra use follows section 2D and never alters the in-app zero-surprise-cost boundary.
- No paid overflow.
- Long-running adventures must use bounded memory/context rather than replaying the whole transcript.
- Combat resolution must never require an AI call per animation or deterministic turn calculation.
- Provider calls should occur for story/narrative value, not mechanics that TypeScript can calculate.

### 25.3 Data growth

Journal/adventure history can grow indefinitely, so state should distinguish:

- durable source records;
- compact summaries;
- retrievable memory cards;
- transient UI state.

Do not keep duplicate raw provider payloads as permanent campaign state.

---

## 26. Release and integration strategy

### 26.1 Merge gates

**Gate A - Product contract**
Docs reconciled; TTS removal accepted; v2 interfaces frozen.

**Gate B - Journal foundation**
Journal works and migration safe.

**Gate C - Mechanics foundations**
Adventure and Combat engines independently green.

**Gate D - Vertical slice**
One entire journal->adventure->combat->reflection loop proven in browser.

**Gate E - Content/asset expansion**
v4 asset/content bank passes integrity and visual review.

**Gate F - Full integration**
Long synthetic lifecycle passes.

**Gate G - Human pilot**
Greyson friction observations collected without privacy violation.

### 26.2 Do not merge on completion claims alone

For every gate require:

- exact commit;
- changed-file list;
- unit results;
- browser results for affected user paths;
- build result;
- private/secret scan where provider or data paths changed;
- current open unknowns;
- operational-state update.

### 26.3 Rollback

Major migrations must keep the last known-good export readable. Do not introduce a v2 write path that destroys the ability to recover a v1 campaign backup.

---

## 26A. Autonomous proof architecture

The project should be optimized for **verified accepted change**, not agent throughput. Every important claim needs a proof surface independent of prose.

### 26A.1 Proof ladder

Use the strongest available level appropriate to the claim:

1. **Static contract proof** - type system, Zod schema, exact literal scanner, dependency manifest.
2. **Deterministic unit proof** - reducer/engine/selector/migration tests.
3. **Mutation/negative proof** - deliberately remove protection and confirm the test fails.
4. **Built-browser proof** - production/PWA bundle in real Chrome browser harness.
5. **Cross-lifecycle proof** - reload, export/import, offline, backgrounding, concurrent input.
6. **Device/browser proof** - real Safari/iPhone or Android/Chrome where available.
7. **Human-purpose proof** - Greyson can understand and willingly use the product.

Do not use a lower proof level to claim a higher-level behavior.

### 26A.2 Standard validation command set

Current repository scripts support this baseline command set:

```bash
npx tsc --noEmit
npm test
npm run test:browser
npm run build
git diff --check
```

Focused suites may run earlier, but gate packets eventually run the impact-appropriate full set.

Asset-producing packets additionally use the existing art pipeline where relevant:

```bash
npm run art:stage
npm run art:build
```

Do not run live/provider-cost tests merely to make a routine packet look thorough. Use them only when the affected surface requires them and the current quota/cost boundary permits it.

### 26A.3 Required negative proofs

At least these protections need mutation-quality or equivalent negative evidence before release:

- model cannot grant XP/levels/unlocks/combat outcomes;
- fictional AdventureAction cannot become evidence directly;
- PRIVATE source cannot reach provider context;
- retracted source cannot survive into memory/snapshot synthesis;
- duplicate submission cannot advance a combat/adventure task twice;
- imported campaign cannot be overwritten by a late previous-campaign response;
- TTS cannot return unnoticed;
- asset manifest cannot reference a missing file;
- v1 migration cannot discard legacy turns/encounters/worldJourney;
- pure-fun adventure does not fabricate a learning target.

### 26A.4 Headless combat validator

Before content scale, add a deterministic combat-definition validator or simulator. Its job is not to "play well" but to catch mechanically impossible or degenerate definitions before browser QA.

For every encounter definition, validate:

- referenced combatants/gimmicks/objectives exist;
- rewards are fixed and non-farmable under the definition;
- ordinary encounter has at least one reachable terminal outcome;
- no objective requires perfect timing;
- `LEAVE` behavior matches the definition;
- turn-limit objectives cannot become mathematically impossible from starting state;
- pacify/ACT route has an explicit progress condition when advertised;
- protect/escort target cannot begin already invalid;
- charge/interrupt encounter actually exposes an interrupt window;
- ordinary encounter does not require an excessive number of turns under a simple objective-aware reference policy.

Recommended deterministic reference policies:

- attack-biased;
- defense-biased;
- objective-aware;
- nonviolent/ACT-biased when available.

A content definition that cannot complete under any reasonable reference policy is blocked before art/polish.

### 26A.5 Adventure template static validator

Adventure templates should also be checked before provider prose exists.

Validate:

- Hook is reachable from start;
- every required beat has at least one transition;
- withdrawal is reachable where contract permits it;
- completion is reachable;
- pure-fun templates do not require reflection;
- reflection-eligible templates do not auto-confirm an interpretation;
- combat beats reference valid encounter categories;
- all memory outputs have provenance sources;
- no template references private data directly;
- no branch dead-ends solely because Greyson refuses a premise.

### 26A.6 Content semantic lint

Create a bounded text lint for generated content to detect recurring anti-patterns:

- explicit "this tests whether you..." language;
- survey-like A/B personality phrasing inside fiction;
- diagnostic language;
- claims that a fictional choice proves a real trait;
- coercive disclosure language;
- shame for leaving/fleeing/refusing;
- fake certainty about motive;
- repeated adventure hooks or identical ACT solutions;
- accidental TTS/voice-output instructions.

Lint findings are review prompts, not automatic psychological truth.

---

## 26B. Failure recovery, rollback, and blast-radius control

### 26B.1 Known-good gate points

At each major gate, record an exact integration SHA. Optionally tag it using a recognizable gate tag such as:

```text
atlas-v2/w0-authority
atlas-v2/w1-contracts
atlas-v2/w2-foundations
atlas-v2/w3-vertical-slice
atlas-v2/w4-memory-snapshots
atlas-v2/w5-content-assets
atlas-v2/w6-release-candidate
```

Tags are optional; exact SHAs in proof receipts are mandatory.

### 26B.2 Rollback unit

Prefer reverting one merged packet or one merge commit rather than manually deleting pieces from several packets. Atomic packet commits make rollback possible.

### 26B.3 Persistence safety

Before any v2 migration writes real user state:

- v1 export remains importable;
- migration consumes a copy/structured object, not the only durable backup;
- malformed or partially migrated state is rejected rather than silently normalized into data loss;
- import validation finishes before replacing the active campaign;
- schema migration errors never delete the original IndexedDB record automatically.

### 26B.4 Asset rollback

The v3 runtime pack remains intact until v4 passes its switch gate. Runtime asset selection should have one clear manifest/version boundary so rollback means selecting the known-good manifest, not manually restoring dozens of files.

### 26B.5 Provider rollback

New proposal modes must preserve local fallback paths. If a provider schema/prompt becomes unreliable, the application can degrade to local Journal acknowledgement, local Reflection wording, local Adventure templates, deterministic Combat, and local Snapshot synthesis without corrupting state.

### 26B.6 Repair escalation ladder

When a packet fails:

1. reproduce the earliest meaningful failure;
2. freeze the failure as a test/fixture when feasible;
3. attempt one bounded repair inside the packet envelope;
4. independently verify;
5. if still failing, mark `BLOCKED` and escalate reasoning tier;
6. Astra becomes eligible only when the section 2D conditions are met;
7. do not expand into unrelated cleanup while the failure is unresolved.

### 26B.7 Unknown-state discipline

If proof is unavailable, use `UNVERIFIED`, not `PASS`.

Examples:

- no iPhone available -> Safari device path remains unverified;
- no real provider call executed -> provider live behavior remains unverified;
- asset exists but has not been inspected at runtime -> integrated appearance remains unverified;
- generated NPC text passes schema but no human has reviewed tone -> tone remains unverified.

---

## 26C. High-value project workflow hooks

The installed workflow library contains several specialist gates that can materially improve this project. They are not all active at once. Use them at the point where their evidence exists.

| Moment | Workflow hook | Why it matters |
|---|---|---|
| Before major refactor/migration | `capability-invariant-compiler` | Turn known-good user journeys into explicit must-not-regress obligations. |
| After any coding agent produces a consequential diff | `diff-scope-verifier` | Detect collateral files/dependencies/deletions outside packet scope. |
| Early routing calibration | `cross-agent-benchmark-harness` | Choose workhorses from real task evidence rather than reputation. |
| External game asset sourcing | `game-asset-governor` + visual/audio/code scouts | Govern provenance, licenses, fit, and integration. |
| Original game-asset specification | `game-asset-compiler` | Produce generator-ready sprite/tiles/VFX contracts before rendering. |
| Generated asset lineage | `artifact-lineage-ledger` | Preserve which source/prompt/revision produced each runtime asset. |
| Repeated real correction | `correction-to-regression-compiler` | Turn the mistake into durable fixtures. |
| Pre-release clean baseline | `clean-build-reproducibility-certificate` | Prove build does not depend on hidden machine state. |
| Pre-share/release privacy | `sensitive-data-boundary-auditor` | Catch secrets, local paths, private evidence, backups, or logs. |
| Before handoff/pause | `cold-start-recovery-auditor` | Prove another AI can resume from repository + source docs alone. |
| Screen recording from real play | `screen-recording-visual-qa` | Convert visible friction into timestamped evidence without guessing hidden root cause. |
| Verified visual defect -> coding task | `screen-evidence-to-repair-contract` | Turn visual evidence into bounded implementation acceptance criteria. |

The master plan remains the source of product intent; these workflows provide evidence, gating, or packaging.

---

## 26D. Project risk register

| ID | Risk | Trigger/signature | Mitigation | Release consequence |
|---|---|---|---|---|
| RK01 | Atlas becomes a questionnaire again | every Journal response ends in a question | JournalProposal follow-up optional; pure acknowledgement fixtures | Block vertical slice |
| RK02 | Adventures feel like disguised tests | fiction names trait being measured | semantic content lint + human sample review | Block content gate |
| RK03 | Fictional action becomes personality evidence | observation appears in evidence without reflection | hard firewall + mutation test | Release blocker |
| RK04 | TTS sneaks back through legacy helper | `speechSynthesis`/`SpeechSynthesisUtterance` reference | source + bundle negative scan | Release blocker |
| RK05 | STT removal by accident during TTS cleanup | mic/transcribe path disappears | focused STT-only lifecycle tests | Repair before fan-out |
| RK06 | App refactor breaks Worldwalker | movement/interior browser failures | behavior-preserving extraction + full baseline gate | Block contract freeze |
| RK07 | Schema v2 loses old state | v1 fixture differs after round-trip | migration torture + original backup preservation | Release blocker |
| RK08 | Privacy leak through derived memory | private canary appears in later scene | provenance retirement + context canary | Release blocker |
| RK09 | Model gains mechanics authority | proposal includes accepted HP/reward/outcome | schema/firewall + mutation test | Release blocker |
| RK10 | Combat grows into a second giant RPG | equipment/classes/stats expand | explicit exclusion list + C00 contract | Stop scope expansion |
| RK11 | Combat becomes repetitive | only defeat objective used | objective/gimmick coverage + browser samples | Block "varied" claim |
| RK12 | Combat becomes grind-optimal | repeatable XP exceeds story path | fixed/nonfarmable rewards + simulator | Rebalance before content scale |
| RK13 | Timed input becomes accessibility gate | perfect timing required to win | base action always works + reduced-motion fallback | Release blocker |
| RK14 | Adventure generation becomes unbounded | context/turn count grows without cap | six-beat templates + bounded memory | Repair before scale |
| RK15 | Provider quota drives mechanics | combat turn waits on model call | deterministic mechanics + call-count tests | Release blocker |
| RK16 | World markers expose hidden analytics | marker says what trait is tested | category-only markers | Repair UX |
| RK17 | Asset production outpaces IDs/contracts | generated files have no stable slot | AS00 before bulk generation | Quarantine assets |
| RK18 | Greyson visual identity drifts | combat sprite no longer recognizable | anchor source + continuity review | Reject batch |
| RK19 | AI-generated assets contain text/artifacts | gibberish lettering/duplicate limbs | visual QA + no baked UI text | Reject frame/batch |
| RK20 | Parallel agents overwrite shared files | competing `App.tsx`/types edits | hot-zone ownership + worktrees | Stop merge |
| RK21 | Agent makes scope-creep "helpful" changes | unexplained file count expands | diff-scope verification + packet envelope | Return to repair |
| RK22 | Strongest model becomes costly default | Astra used on routine packets | default `ASTRA_ELIGIBLE:NO` + ledger | Routing violation |
| RK23 | Cheap model causes rework tax | repeated repairs/reviews | calibration + escalation fuse | Change routing |
| RK24 | Generated content becomes stale after schema change | manifest validation failures | schema version content packs + rebuild gate | Block integration |
| RK25 | Snapshot sounds definitive/final | language implies Greyson is complete | Snapshot contract + open-questions requirement | Repair copy/model prompt |
| RK26 | User correction is forgotten | rejected claim reappears | rejection context + regression fixture | Release blocker |
| RK27 | Main deploys half-built integration | feature branch merged early | integration branch only; main release gate | Operational blocker |
| RK28 | Raw personal content enters repo/tests | realistic fixture copied from Greyson | synthetic fixtures only + sensitive-data audit | Release blocker |
| RK29 | Long campaign state/bundle becomes heavy | load time/context grows | summary/memory budgets + asset lazy-loading | Performance gate |
| RK30 | Human pilot over-collects private details | notes contain journal content | friction-only observation protocol | Stop/purge unsafe notes |

---

## 27. Explicitly deferred or excluded from this cycle

- Text-to-speech.
- Full-duplex voice conversation.
- Acoustic barge-in.
- Server-side journal database.
- Accounts/cloud sync.
- Native app wrapper.
- 3D/WebGL game conversion.
- Multiplayer.
- Large equipment/crafting system.
- Procedurally generated runtime artwork.
- Paid AI provider overflow.
- Vector database/embedding infrastructure.
- Psychological diagnosis.
- Automatic interpretation of fictional behavior as real personality evidence.

These can be reconsidered later. They are not missing requirements for this integration plan.

---

## 28. Definition of done for this master integration

The integration is complete only when all of the following are true:

1. Greyson can journal freely without a prompt.
2. TTS is absent from runtime and canonical plan.
3. Speech-to-text, if retained, is input-only and optional.
4. Journal privacy/retraction is provenance-safe.
5. Atlas can identify bounded knowledge gaps without a model choosing what Greyson "needs" to examine.
6. A gap can become an optional Worldwalker adventure.
7. Adventures are playable and worth playing independent of analysis.
8. World exploration has meaningful story opportunities beyond questions.
9. Turn-based combat is deterministic, simple, short and demonstrably varied.
10. Combat has non-kill and leave paths where appropriate.
11. No fictional action becomes self-knowledge without reflection.
12. Greyson can confirm, partially accept, reject, revise or leave uncertain an interpretation.
13. Rejections/corrections persist and affect future model context.
14. Contradictions and change over time are reachable product concepts, not dead schema fields.
15. Adventure characters/places/events can recur through bounded local memory.
16. The Atlas can generate multiple dated Snapshots without claiming Greyson is finished.
17. v1 campaigns migrate safely.
18. Save/reload and export/import preserve the full new state.
19. PRIVATE and retraction propagate through evidence, gaps, memories, adventures and Snapshots.
20. The model still cannot mutate progression or combat truth.
21. The full synthetic browser journey in Phase 7 passes.
22. Asset v4 passes provenance/integrity and human continuity review.
23. Real mobile-device verification is completed when reachable hardware is available.
24. Greyson has actually used the product and the resulting friction has been recorded as product observations rather than private-content harvesting.
25. Every merged v2 packet has a proof receipt and exact SHA.
26. The integration branch can be resumed cold from repository documents without hidden chat memory.
27. No routine packet requires Astra; every Astra use, if any, satisfies the escalation rule and has an independent verification path.
28. A clean clone can build and run the required automated suites without hidden global project state.
29. Agent-produced diffs have been checked for scope drift at consequential gates.
30. The release-candidate evidence bundle in Appendix O is complete or explicitly marks unavailable device proof as unverified.

The project is not "done forever" after this. This definition closes the integration described by this document.

---

## 29. Requirement traceability for this document

| ID | Controlling requirement | Where satisfied |
|---|---|---|
| R01 | Build one complete master plan for integrating the new direction | Entire document, especially sections 21 and 28 |
| R02 | Make the document usable as a project source document | Sections 0, 2, 3 and 26 |
| R03 | Journaling must be the primary purpose | Sections 0, 4, 8, 21 |
| R04 | Integrate Worldwalker adventures around Greyson | Sections 9-11, 21 |
| R05 | Integrate simple, varied JRPG turn-based combat | Section 12, Phase 2B, Phase 5 |
| R06 | Include separate asset-generation planning | Section 18 |
| R07 | Include work that can run simultaneously | Section 20 and parallel portions of Phase 2/5 |
| R08 | Drop text-to-speech entirely for now | Sections 0.1, 3.6, 17, Phase 0, section 27 |
| R09 | Preserve existing project strengths and privacy/game authority | Sections 1, 3, 6, 24 |
| R10 | Provide a complete staged build order | Section 21 |
| R11 | Define validation and acceptance gates | Sections 21, 24, 26, 28 |
| R12 | Account for current repo architecture and Worldwalker baseline | Sections 1, 16.5, 22 |
| R13 | Keep asset work integration-ready and source-traceable | Section 18 |
| R14 | Avoid turning roleplay behavior directly into personality claims | Sections 3.1, 12.11, 13 |
| R15 | Replace terminal "finished person" semantics with evolving snapshots | Section 15 |
| R16 | Plan deeply enough for autonomous production without continual re-planning | Sections 2A-2H, 21A-21D, Appendices F-G/L-M |
| R17 | Make parallel development explicit and collision-safe | Sections 2C, 20, 21A-21C |
| R18 | Allow Astra where valuable but prohibit it from becoming the main workhorse | Section 2D, packet registry Astra column, Appendices K/N |
| R19 | Provide proof, recovery, rollback, and release evidence rather than completion-by-claim | Sections 26A-26D, Appendices G/O/P |
| R20 | Make asset generation a governed autonomous factory rather than an ad hoc art request list | Section 18, AS packets, Appendix H |
| R21 | Make combat varied but deliberately shallow and non-grindy | Section 12, C packets, Appendices I and A/B |

---

## Appendix A - Combat variation matrix

Use this matrix as a content generator, not as a requirement to implement every cell.

| Objective | Good gimmick pairings | Example fictional shape |
|---|---|---|
| Defeat | shield, stance, counter | Armored archive construct changes guard stance |
| Survive | swarm, terrain, hazard | Paper-bird storm for four rounds |
| Escape | charge, terrain, linked pair | Two sentries close exits while bridge collapses |
| Protect | swarm, ally danger, healing | Keep attackers away from an NPC repairing a gate |
| Interrupt | charge, shield, timed vulnerability | Ritual engine telegraphs a devastating pulse |
| Pacify | rage, morale, mimic | Frightened creature attacks until ACT reveals why |
| Reach object | terrain, counter, linked pair | Cross arena and disable a beacon rather than fight |
| Hold position | swarm, hazard, healing | Maintain a ward until sanctuary doors open |
| Escort | ally danger, stance, terrain | Move a vulnerable NPC through a changing battlefield |
| Discover ACT | mimic, morale, non-kill | Enemy is actually protecting something and can be reasoned with |

---

## Appendix B - First combat mechanic set

Do not begin with all 15 gimmicks. MVP should implement:

1. shielded;
2. charging;
3. counterattacking;
4. swarm;
5. pacify/ACT state.

And objectives:

1. defeat;
2. survive;
3. protect;
4. interrupt;
5. pacify.

This yields enough combinations to prove variation before expansion.

---

## Appendix C - Exact TTS removal checklist

Search and eliminate or supersede all runtime dependencies on:

- `speechSynthesis`
- `SpeechSynthesisUtterance`
- available/output voice selection
- assistant `speaking` state
- `pendingReply` logic that exists only to schedule spoken output
- auto-listen restart triggered by synthesis `onEnd`
- spoken-reply browser fixtures
- voice-choice local storage/settings
- documentation that promises spoken Atlas output

After removal, explicitly search the production client bundle for `speechSynthesis` and `SpeechSynthesisUtterance`.

Do not remove:

- microphone permission/capture solely because TTS is removed;
- `/api/transcribe`;
- input-only speech-to-text unless a separate decision removes it.

---

## Appendix D - External precedent lessons used to validate this plan

These are design references, not source-of-truth dependencies.

### Sea of Stars

Official material describes timed input that can increase outgoing damage/reduce incoming damage, a lock system for interrupting powerful actions, no random encounters and no grinding. Transferable lesson: simple turn-based combat can feel active and varied without a deep equipment/stat treadmill.

Source: https://seaofstarsgame.co/

### UNDERTALE

The official Steam description explicitly states that killing is unnecessary, negotiation can resolve danger, and timed attack/defense mechanics coexist with that system. Transferable lesson: the same encounter UI can support violence, interaction and alternate resolution rather than making every enemy an HP check.

Source: https://store.steampowered.com/app/391540/undertale/

### AI Dungeon memory / Story Cards

AI Dungeon documents a bounded-context approach that combines summary memory with selectively triggered cards for characters, locations and concepts. Transferable lesson: Atlas should not send an entire adventure history every turn; it should keep compact summaries and inject only relevant local memory.

Sources:
- https://help.aidungeon.com/faq/the-memory-system
- https://help.aidungeon.com/faq/story-cards

Atlas deliberately does **not** copy AI Dungeon's cloud/vector architecture. It adopts only the general memory-layer pattern while keeping Atlas local-first and using deterministic relevance instead of adding a vector database.

---

## Appendix E - First next action after this document is approved

Do not start with mass asset generation or dozens of adventures.

The exact next build packet should be:

**Phase 0: adopt the source-of-truth document, remove TTS, reconcile canonical docs, perform behavior-preserving App/domain extraction, freeze schema-v2 interfaces, and run the complete regression baseline.**

Only then fan work into Journal, Knowledge/Reflection, Adventure, Combat, Provider and Asset lanes.

That ordering creates the maximum safe parallelism for the rest of the project.

---

## Appendix F - Autonomous task packet template

Use this exact skeleton when turning a registry row into an executable agent instruction. The packet should be self-contained enough that a new agent can work without rereading the whole conversation.

```text
ATLAS OF ONE - AUTONOMOUS WORK PACKET

PACKET ID:
TITLE:
PHASE / WAVE:
LANE:
STATUS: READY
RISK: R1 | R2 | R3 | R4
VERIFIABILITY: V1 | V2 | V3 | V4
ASTRA_ELIGIBLE: NO | YES (reason required)

BASELINE
- repository: westkitty/AtlasOfOne
- base branch/ref:
- expected base SHA:
- worktree:
- current operational-state revision:

OBJECTIVE
[One observable result.]

WHY THIS EXISTS
[1-4 sentences connecting the packet to the master plan.]

DEPENDENCIES
- [packet IDs / interface versions]

AUTHORITATIVE INPUTS
- exact master-plan sections
- exact source docs
- exact interface/schema definitions

PROTECTED INVARIANTS
- [stable IDs or explicit rules]

ALLOWED MUTATIONS
- exact paths/globs

PROHIBITED MUTATIONS
- exact paths/globs
- no new dependencies unless explicitly listed
- no main push/deploy

IMPLEMENTATION REQUIREMENTS
1. ...
2. ...

NON-GOALS
- ...

ACCEPTANCE CRITERIA
- [binary/inspectable]

REQUIRED VALIDATION
- command / runtime journey / visual proof

STOP CONDITIONS
- ...

REPORTING CONTRACT
Return only:
1. outcome
2. changed-file list
3. exact validation results
4. unresolved items
5. final commit SHA
6. proof-receipt path
```

For coding-agent prompts, run the final packet through an agent-prompt-efficiency gate before dispatch so it does not waste context or tools while preserving every requirement.

---

## Appendix G - Proof receipt template

```markdown
# Proof Receipt - <PACKET_ID>

## Identity
- Packet:
- Base SHA:
- Final SHA:
- Branch:
- Executor:
- Reviewer:

## Changed files
- ...

## Acceptance evidence
| Criterion | Evidence | Status |
|---|---|---|
| ... | ... | PASS/FAIL/UNVERIFIED |

## Validation executed
| Command/journey | Result |
|---|---|
| `npx tsc --noEmit` | ... |

## Validation not executed
- ...

## Protected behavior rechecked
- ...

## Scope notes
- New dependencies: none / ...
- New network surfaces: none / ...
- Migration impact: none / ...
- Privacy impact: none / ...

## Remaining unknowns
- ...

## Reviewer verdict
`MERGE_READY | REPAIR | BLOCKED`

## Newly unblocked packets
- ...
```

---

## Appendix H - Asset batch production contract

Every original-art batch, whether produced through ChatGPT image generation or another approved visual generator, uses this contract.

```yaml
batch_id: AS06-T01-CREATURES
runtime_family: creature
territory: identity
style_anchor_ids:
  - greyson-canonical-overworld
logical_assets:
  - id: identity-creature-01
    role: ordinary-enemy
    states: [idle, action, hurt, resolved]
source_refs: []
generation_method: original-ai-art
prompt_archive: docs/v2/assets/prompts/AS06-T01-CREATURES.md
background: transparent
pixel_policy: exact-runtime-pixel-art
runtime_dimensions: defined-by-AS00
negative_constraints:
  - no text
  - no Greyson face/costume mimicry
  - no Andrew assets
  - no extra limbs unless creature canon requires them
required_qa:
  - dimensions
  - alpha
  - anatomy/identity coherence
  - silhouette readability
  - animation continuity
  - mobile-scale readability
  - manifest integrity
```

### H.1 Asset factory stages

```text
SPEC
 -> GENERATE
 -> QUARANTINE
 -> NORMALIZE
 -> AUTOMATED INTEGRITY CHECK
 -> ANIMATION PREVIEW / CONTACT SHEET
 -> CONTINUITY & STYLE QA
 -> APPROVE / REJECT
 -> HASH + MANIFEST
 -> RUNTIME INTEGRATE
 -> BROWSER PROOF
```

Generated files do not go directly from model output to runtime directories.

### H.2 Quarantine

Store unapproved generations outside `public/assets/atlas/v4/`. Runtime directories contain only approved normalized files.

### H.3 First-of-family lock

Before bulk-generating a large family class, approve one representative example. Examples:

- one Greyson combat animation;
- one ordinary creature;
- one anchor NPC;
- one elite;
- one backdrop;
- one VFX family.

After the representative passes, generate the rest against that lock. This is cheaper than repairing a whole batch built on the wrong style.

### H.4 Greyson continuity priority

Greyson assets require the strictest review because a technically correct sprite that does not look like Greyson defeats the purpose. Preserve:

- recognizable face/hair/silhouette;
- existing pixel-art proportions;
- canonical costume/identity cues;
- coherent anatomy across animation frames;
- no random gender presentation drift;
- no unrelated redesign between overworld and combat.

Astra may be consulted only after ordinary visual-generation and continuity-repair routes fail or when a single high-value identity decision truly needs stronger synthesis. It is never the bulk sprite generator.

---

## Appendix I - Combat MVP numeric tuning baseline

These numbers are **initial deterministic tuning defaults**, not permanent canon. Change them only through `C17` with simulation/browser evidence.

### I.1 Player combat state

Combat HP is encounter-local, not a persistent attrition economy.

```text
ordinary starting HP: 100
persistent HP between encounters: none
baseline ATTACK damage: 18
successful timed ATTACK bonus: +6 (24 total)
GUARD incoming reduction: 50%
perfect/timed GUARD incoming reduction: 75%
TECHNIQUE charges at encounter start: 2
ordinary status duration target: 1-2 rounds
```

The player can win every ordinary MVP encounter without a perfect timed input.

### I.2 Enemy envelope

Recommended starting envelope for tuning:

```text
ordinary enemy total effective HP: 35-70
elite total effective HP: 80-130
boss phase effective HP: 110-180
ordinary enemy action damage: 10-22
ordinary enemy count: 1-3
swarm exception: may represent more fictionally, but engine state remains bounded
```

Effective HP means shields/phases may contribute to the experience without inflating raw HP indefinitely.

### I.3 Turn-count targets

- ordinary: usually 2-5 meaningful player turns;
- elite: usually 4-7;
- boss phase: typically 5-9 unless objective design resolves earlier;
- survival encounter: explicit turn limit, generally 3-5 ordinary rounds.

If ordinary encounter simulations routinely exceed the target without strategic error, reduce effective HP or change the objective rather than adding stronger gear progression.

### I.4 Initiative and intent

- player acts first by default;
- an explicit `ambush` definition may alter first action but must be telegraphed by story state;
- enemy next intent is visible whenever the gimmick depends on planning;
- intent categories: attack, defend, charge, recover, hazard, objective action, special/ACT-reactive.

### I.5 Minimal status vocabulary

MVP status set should stay small:

- `guarded`;
- `exposed`;
- `charging`;
- `staggered`;
- `pacifiable`;
- `protected-target` where an objective needs it.

Do not add generic poison/burn/freeze families until an adventure actually benefits from them.

### I.6 Technique philosophy

Technique is not a large skill tree. A technique should do one tactical job such as:

- interrupt a charge;
- protect an ally;
- expose a shielded target;
- reposition objective state;
- trade damage for control.

Techniques can be contextual to an adventure. The player does not need a permanent inventory of dozens of buttons.
### I.7 ACT/pacify progress

When an encounter advertises a nonviolent route, deterministic state owns its progress. A simple default is 0-3 progress steps with specific scenario conditions. The model may narrate the interaction but cannot declare pacification complete.

### I.8 Defeat

Greyson is not punished with a traditional game-over loop. Defeat yields a defined fail-forward outcome such as:

- retreat to sanctuary;
- lose access to one immediate route and gain another;
- NPC rescues/interrupts;
- story consequence;
- opportunity to retry later.

No real-world self-judgment is attached to defeat.

---

## Appendix J - Adventure template schema

A content template should be representable approximately as:

```ts
interface AdventureTemplate {
  id: string;
  kind: AdventureKind;
  validTerritories: string[];
  learningTarget: 'none' | 'reflection-eligible';
  requiredInputs: string[];
  beats: Array<{
    id: string;
    role: 'hook' | 'approach' | 'complication' | 'encounter' | 'choice' | 'consequence';
    required: boolean;
    allowedEncounterKinds: Array<'none' | 'social' | 'puzzle' | 'combat' | 'mixed'>;
    exits: string[];
  }>;
  withdrawalAllowed: boolean;
  memoryOutputs: string[];
  reflectionFormId?: string;
  cooldownClass: string;
}
```

### J.1 Template quality gate

A template passes only if:

- the hook creates a reason to care;
- Greyson can do more than choose between prewritten personality answers;
- refusal/withdrawal does not corrupt state;
- at least one consequence matters to the fictional world;
- learning target can be removed and the adventure remains worth playing;
- the story does not state the hidden analytic theme as a test;
- the template supports at least one materially different skin or territory use;
- reflection is optional unless the user explicitly initiated reflection.

### J.2 Initial 12-template bank

1. Missing Person / Search.
2. Competing Stories / Investigation.
3. Someone Needs Help / Support without takeover.
4. Broken Machine / Creative repair.
5. Faction Dispute / Negotiation.
6. Untrustworthy Companion / Social dilemma.
7. Dangerous Shortcut / Risk expedition.
8. Strange Festival / Pure fun.
9. Creature Problem / ACT or combat.
10. Memory Echo / voluntary reminiscence.
11. Locked Place / puzzle and discovery.
12. Escort Through Trouble / protect/survive encounter.

These are structures, not repeated scripts.

---

## Appendix K - Astra usage ledger template

Astra is allowed wherever it creates disproportionate value, but the project must be able to prove it did not become the default workhorse.

```markdown
# Astra Usage - <date> - <packet>

- Packet:
- Trigger condition from section 2D:
- Non-Astra attempts/evidence already available:
- Exact question/task given to Astra:
- Output category: architecture | diagnosis | adversarial review | creative lock | other
- Did Astra mutate repo directly? yes/no
- Independent verification used:
- Result adopted? yes/no/partial
- Material project delta:
- Follow-up packet:
```

No entry is required when Astra is not used.

---

## Appendix L - Autonomous session cold-start protocol

A fresh coding agent should be able to enter a packet without chat memory.

### L.1 Read order

1. `AGENTS.md`.
2. `OPERATIONAL_STATE.md`.
3. `docs/MASTER_INTEGRATION_PLAN.md` sections named by the packet.
4. `docs/v2/AUTONOMY_LEDGER.md` packet row.
5. packet-specific proof receipts from dependencies.
6. authorized source/test files.

### L.2 Fingerprint before mutation

Record:

```text
pwd
git remote -v
git branch --show-current
git rev-parse HEAD
git status --short
node --version
npm --version
```

Do not proceed when the packet expects a different repository/branch/base or when unexplained work is present in authorized files.

### L.3 Resume behavior

If resuming an interrupted packet:

- read its last proof/handoff;
- inspect current diff rather than assuming the previous agent's report is correct;
- rerun the smallest relevant failing/passing check;
- continue from evidence, not from conversational memory.

### L.4 Completion behavior

Do not begin the next packet in the same branch unless the master registry explicitly combines them. Finish, prove, hand off, then allow orchestration to select new work.

---

## Appendix M - Optional repo-local autonomy helper

After the packet registry is adopted, a small deterministic helper may be built under:

`tools/autonomy/atlas_tasks.py`

It must not call AI models or make architecture decisions. Its purpose is bookkeeping.

Suggested commands:

```text
atlas_tasks.py status
atlas_tasks.py ready
atlas_tasks.py next
atlas_tasks.py claim <PACKET_ID> --agent <label>
atlas_tasks.py block <PACKET_ID> --reason <text>
atlas_tasks.py proof <PACKET_ID> --file <receipt>
atlas_tasks.py complete <PACKET_ID> --sha <sha>
atlas_tasks.py graph
```

### M.1 `next` selection algorithm

Filter packets where:

- status is `READY`;
- all dependencies are `MERGED`;
- no conflicting packet owns the same hot-zone surface;
- branch/base requirement is satisfiable.

Then order by:

1. release-blocking/critical-path unlock count;
2. proof/gate value;
3. number of downstream packets unlocked;
4. ordinary domain work;
5. content/asset scale;
6. polish.

Return the packet ID and its context-pack inputs. The helper never edits product code.

---

## Appendix N - Development-tool routing examples

These examples make the model policy operational without turning a model name into project authority.

### N.1 Anti-Gravity / fast Gemini lane

Good candidates:

- deterministic boilerplate from frozen schemas;
- moving small helpers during App decomposition;
- repeated fixture construction;
- content schema normalization;
- routine asset manifest maintenance.

Escalate immediately if the packet requires redefining a public interface, migration, privacy rule, or concurrency lifecycle.

### N.2 Grok Build lane

Good candidates:

- bounded multi-file feature packets with explicit acceptance tests;
- quick implementation of Combat objectives/gimmicks after interfaces are frozen;
- repetitive browser-test additions;
- code generation where a separate reviewer will verify scope.

Do not trust a Grok Build completion claim without reading diff/test evidence.

### N.3 Quad Code Sonnet/Opus lane

Good candidates:

- repo-aware implementation;
- moderately cross-cutting refactors;
- careful review of engine/provider boundaries;
- independent code review of another executor.

Use the stronger option for migration, async lifecycle, or authority-firewall changes.

### N.4 GPT-5.6 Sol lane

Good candidates:

- orchestration and source-of-truth work;
- architecture/interface contracts;
- complex debugging;
- integration-owner merges;
- adversarial review and proof planning;
- converting Greyson feedback into bounded project changes.

### N.5 LM Arena lane

Good candidates:

- challenge an Adventure/Combat design with independent agent outputs;
- compare multiple bounded implementation strategies;
- QA agent-produced output;
- generate alternative content/asset concepts where variety is useful.

LM Arena output is evidence/challenge material, not automatic authority.

### N.6 Google AI Studio lane

Good candidates:

- prototype structured prompts/content;
- stress-test Adventure scene output formats;
- produce synthetic evaluation data;
- visual/content exploration when it is cheaper than scarce-model use.

### N.7 Astra lane

Use for the defined escalation cases only. Ideal uses include:

- one difficult architecture synthesis after competing strong-model recommendations;
- final adversarial review of the vertical slice or release candidate;
- a stubborn cross-system root cause with mixed evidence;
- one identity-sensitive creative lock that cheaper approaches repeatedly fail.

Astra should typically advise or challenge. Routine implementation should return to the ordinary workhorse lane unless the packet explicitly requires otherwise.

---

## Appendix O - Release-candidate evidence bundle

Before proposing a merge to `main`, produce one release packet containing:

1. integration branch and exact SHA;
2. master-plan version;
3. operational-state revision;
4. merged work packet IDs;
5. changed-file inventory from baseline;
6. dependency delta;
7. schema/migration summary;
8. privacy boundary summary;
9. no-TTS negative proof;
10. unit test counts;
11. browser test counts;
12. typecheck/build/diff-check status;
13. clean-build proof;
14. asset manifest integrity report;
15. long synthetic lifecycle proof;
16. known unverified device/browser states;
17. current risk exceptions, if any;
18. reviewer/adversarial verdict;
19. rollback SHA;
20. explicit release authority.

No release packet may hide an `UNVERIFIED` item by describing the project as universally tested.

---

## Appendix P - Completion oracle for the autonomous build

The build is ready for Greyson only when a fresh browser can, using synthetic test data, complete this exact story without hidden state injection after initialization:

```text
launch cold
-> wake Atlas
-> complete or correctly bypass onboarding
-> open Journal in one action
-> type an ordinary journal entry
-> save it
-> receive a non-interrogative response
-> mark a second synthetic entry PRIVATE
-> create an explore-later seed from eligible non-private material
-> see a world marker without seeing the hidden analytic target
-> walk Greyson to the marker
-> begin an adventure
-> perform one open natural-language action
-> encounter a visible JRPG encounter
-> resolve it through ATTACK/TECHNIQUE/GUARD/ACT/LEAVE mechanics
-> demonstrate a non-kill outcome in at least one fixture
-> record consequence + observation
-> reject an interpretation
-> verify rejection persists
-> confirm a different interpretation from Greyson's explicit reflection text
-> verify only that reflection-backed material becomes evidence
-> see the Atlas/world change
-> finish a pure-fun adventure that produces no personality evidence
-> encounter a recurring NPC who remembers an earlier synthetic event
-> create or expose a contradiction/change over time
-> make Snapshot 1
-> add later supported evidence
-> make Snapshot 2
-> compare change without rewriting Snapshot 1
-> reload mid-flow without state loss
-> export
-> delete local campaign
-> import exact export
-> verify privacy/retraction/memory/snapshot parity
-> run offline fallback path
-> verify TTS never speaks and microphone does not auto-reopen
```

If this oracle passes and the other release gates pass, the system is technically ready for the human pilot. It still does not prove Greyson will enjoy it; that belongs to Phase 8.
