# Atlas v4 Runtime Asset Contract

**Packet:** AS00
**Status:** candidate freeze pending review
**Depends on:** D05
**Runtime mutation:** none

This contract freezes IDs, paths, dimensions, budgets, provenance and manifest metadata for Atlas v4 asset production. It extends the proven v3 pipeline; it does not redesign Greyson, generate art, or switch runtime assets.

## 1. Existing baseline

- current runtime root: `public/assets/atlas/v3/`
- v3 manifest contains 154 files / 250,874 bytes (244.99 KiB)
- v3 Greyson world frames are 48x64; portraits are 96x96; world layers/masks are 360x640
- v3 manifest records byte size, dimensions and SHA-256
- `src/world/manifest.generated.ts` provides the generated static runtime view
- `tools/art/verify_assets.py` verifies PNGs, dimensions, Greyson anchors/palette and Andrew exclusion
- v3 remains immutable during v4 experimentation

## 2. Version and source/runtime boundaries

Candidate runtime root: `public/assets/atlas/v4/`.

Required final generated surfaces before AS18:
- `public/assets/atlas/v4/manifest.json`
- `src/world/manifest.v4.generated.ts`
- `docs/v2/assets/verification/atlas-v4-verification.md`

Unapproved generations never enter `public/`.

Source/quarantine workspace:
- `.art-src/atlas-v4/quarantine/<batch-id>/`
- `.art-src/atlas-v4/approved/<logical-id>/`

Prompt/provenance records:
- `docs/v2/assets/prompts/<batch-id>.md`
- `docs/v2/assets/provenance/<batch-id>.json`

AS18 requires a self-contained `/assets/atlas/v4/` pack. Proven v3 assets still needed at runtime may be copied byte-identically into v4 with lineage retained; final v4 must not depend permanently on mixed v3/v4 paths.

## 3. Runtime directory taxonomy

```text
public/assets/atlas/v4/
  greyson/world/
  greyson/combat/
  greyson/portraits/
  creatures/<logical-id>/
  npcs/<logical-id>/
  elites/<logical-id>/
  bosses/<logical-id>/
  backdrops/<territory-id>/
  vfx/<logical-id>/
  ui/icons/
  ui/markers/
  vault/
  world/masks/
  audio/
  manifest.json
```

No source files, prompt archives, previews, contact sheets, rejected attempts or raw generator output belong in the runtime pack.

## 4. Logical-ID law

Format: `<family>-<territory-or-scope>-<slug-or-number>`.

Examples:
- `greyson-combat-attack`
- `identity-creature-01`
- `cross-oddity-01`
- `cognition-npc-anchor`
- `fears-elite-01`
- `identity-boss-01`
- `relationships-backdrop-sanctuary`
- `vfx-perfect-guard`
- `ui-action-act`

Rules:
- lowercase ASCII kebab-case
- filenames are not canonical IDs
- no temporary suffixes such as final/new/try3
- no generator/model name in the ID
- no psychological verdict encoded in the ID
- IDs are assigned before generation
- Andrew identity/assets remain prohibited

## 5. Runtime dimension classes

| Class | Size | Alpha | Use |
|---|---:|---|---|
| `greyson-world` | 48x64 | required | preserved overworld frames |
| `greyson-combat` | 48x64 | required | Greyson combat |
| `character-world` | 48x64 | required | NPC/companion |
| `portrait` | 96x96 | required | dialogue portrait |
| `creature-ordinary` | 64x64 | required | ordinary/oddity encounter |
| `creature-elite` | 96x96 | required | elite/rare |
| `creature-boss` | 128x128 | required | boss phase |
| `ui-icon` | 32x32 | required | action/status/objective |
| `world-marker` | 32x32 | required | Journal/Adventure/Reflection marker |
| `vfx-small` | 64x64 | required | standard effect |
| `vfx-large` | 96x96 | required | large effect |
| `vault-relic` | 64x64 | required | vault artifact |
| `combat-backdrop` | 360x240 | optional | battle/story background |
| `world-layer` | 360x640 | optional | Worldwalker layer/mask |

A family needing a new runtime size must stop and amend AS00 before bulk generation. Generator canvases may be larger; normalized runtime files must match the declared class.

## 6. Animation contract

Every animated family declares: logical ID, state ID, dimension class, frame count, fps, loop, reduced-motion still, anchor/pivot, frame order and mirror rule.

Frame names use `<state>-00.png`, `<state>-01.png`, etc. Character anchor defaults to `bottom-centre`. Greyson preserves the proven v3 ground-contact convention unless AS02 establishes an evidence-backed exception. Mirroring is allowed only when anatomy/costume/prop handedness stays coherent.

## 7. Greyson identity lock

All Greyson/Aerron v4 work preserves recognizable face/hair/silhouette, established proportions, canonical clothing/body cues, pixel-art palette/outline language, coherent anatomy, consistent ground contact, and continuity between world and combat. No gender-presentation drift. No Andrew-side source material.

AS02 must name exact approved source references. AS03 is the first-of-family proof; bulk Greyson combat generation cannot precede continuity approval.

Required Greyson combat state IDs:
`combat-idle`, `attack`, `guard`, `technique`, `act`, `hurt`, `victory`, `defeated`, `enter-battle`, `exit-battle`.

Every animation has a reduced-motion still. Frame counts remain AS02/AS03 production decisions.

## 8. Other family minimums

Ordinary creature: `idle`, `action`, `hurt`, `resolved`; optional fifth gimmick state.

Elite: `idle`, `action`, `hurt`, `resolved`, `gimmick`.

Boss: same role-appropriate states, default 128x128 canvas. A larger canvas requires AS00 revision plus mobile/performance justification. Boss art may not literalize a psychological category merely because one inspired the story.

Anchor NPC: `idle`, `travel`, `talk-react`, `emotion`, `portrait`. NPC identity records remain separate from art.

Backdrops default to 360x240 layered/reusable territory scenes. No baked dialogue/UI text.

VFX/UI families follow master-plan section 18.8, including combat feedback plus Journal/Adventure/Reflection/Snapshot markers and icons.

## 9. Alpha/background law

Transparent RGBA is required for characters, creatures, portraits, UI/markers, VFX and vault relics. Background/world images may be RGB or RGBA.

Forbidden: matte fringe, colored edge speckles, baked checkerboard transparency, baked text/watermarks, and unused opaque canvas around a logical sprite.

## 10. Runtime size budgets

These are AS00 mobile/offline engineering decisions, not canon.

Measured v3 reference: 244.99 KiB total.

Pack budget:
- soft warning: 6 MiB
- hard runtime cap: 8 MiB

The cap covers normalized files under `public/assets/atlas/v4/`, including pre-rendered audio. Source/quarantine/provenance is excluded. Crossing 6 MiB requires a size report; crossing 8 MiB blocks AS18 unless an explicit later decision revises the budget.

Soft per-file ceilings:
- 48x64 / 64x64 frame: 32 KiB
- 96x96 portrait/elite/VFX frame: 48 KiB
- 128x128 boss frame: 96 KiB
- 32x32 icon/marker: 16 KiB
- 360x240 backdrop: 192 KiB
- 360x640 world layer: 256 KiB
- short pre-rendered audio cue: 128 KiB

Soft family ceilings:
- Greyson combat set: 512 KiB
- ordinary/oddity creature: 256 KiB
- elite: 384 KiB
- boss: 512 KiB
- anchor NPC: 256 KiB
- territory backdrop set: 512 KiB
- all pre-rendered audio: 2 MiB

Procedural Web Audio remains preferred to a large soundtrack dependency.

## 11. Manifest metadata

Runtime manifest top level contains only deterministic fields: `assetPackVersion`, `base`, `families`, `files`. Do not put a build timestamp into the reproducible runtime manifest.

Every family records: id, runtimeFamily, optional territory, role, dimensionClass, states, sourceRefs, generationMethod, promptArchive when generated, provenanceRecord, background, styleAnchorIds, negativeConstraints and requiredQa.

Animation states may record: src, frames, fps, loop, still and anchor.

Every runtime file records: bytes, sha256, `[width,height]`, and mode when useful. External assets additionally require license/provenance before approval.

Machine-readable schema: `docs/v2/assets/manifest-v4.schema.json`.

## 12. Provenance contract

Every family has a durable non-runtime provenance record containing batch ID, logical IDs, source refs, generation method, complete prompt archive or human source note, transformations, style/canon anchors, external license record when relevant, final runtime paths, SHA-256, approval/rejection state and reviewer.

Do not place private conversation material or real Greyson journal content in asset provenance.

## 13. Factory stages

```text
SPEC -> GENERATE -> QUARANTINE -> NORMALIZE -> AUTOMATED INTEGRITY CHECK
-> ANIMATION PREVIEW / CONTACT SHEET -> CONTINUITY & STYLE QA
-> APPROVE / REJECT -> HASH + MANIFEST -> RUNTIME INTEGRATE -> BROWSER PROOF
```

No generator output jumps directly into `public/assets/atlas/v4/`.

## 14. First-of-family locks

Before bulk generation approve one representative: Greyson combat animation, ordinary creature, anchor NPC, elite, backdrop and VFX family. A rejected representative blocks bulk production for that family.

## 15. AS01 validator obligations

AS01 must check decode/type, dimensions, alpha, IDs/path uniqueness, missing manifest targets, undeclared runtime files, animation completeness, reduced-motion stills, SHA-256/bytes, size budgets, duplicates, orphans, Andrew-path prohibition, provenance references, and mechanically checkable Greyson anchors.

Unknown dimension classes or undeclared runtime files fail closed.

## 16. Human visual QA

Human/visual review checks Greyson identity, anatomy/motion coherence, mobile-scale silhouette readability, enemy/NPC differentiation, territory/style fit, text/watermark artifacts, generator anatomy errors, frame-to-frame identity drift and combat readability against real backgrounds.

Technical validity never overrides a Greyson identity failure.

## 17. Runtime switch rule

v3 remains active until AS18. AS18 requires: self-contained v4, AS01 validator pass, batch approvals, AS16 integrity/hash/orphan pass, AS17 human approval, <=8 MiB or approved revision, browser/mobile loading proof, no Greyson identity regression, and no missing v3 capability.

The switch happens behind one manifest/version decision, not scattered path edits.

## 18. Non-goals

AS00 does not generate assets, choose final creature/NPC designs, redesign Greyson, modify v3, switch runtime paths, add runtime AI image generation, add an external soundtrack dependency, or approve ungenerated art.

## AS00 verdict

**CANDIDATE FREEZE.** v4 specs and first-of-family proofs may begin after review; bulk generation remains gated by family approval and downstream content contracts.