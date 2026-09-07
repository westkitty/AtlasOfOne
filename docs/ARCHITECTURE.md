# Atlas of One — Architecture

## Locked shape

One React/TypeScript Vite PWA and one same-origin Cloudflare Worker application.

```text
Browser / installed PWA
  ├─ React UI
  ├─ deterministic game engine
  ├─ Dexie / IndexedDB campaign database
  ├─ Zod runtime schemas
  ├─ context compiler (privacy filter + budget)
  └─ PWA service worker
          │
          └─ same-origin /api/*
               Cloudflare Worker
               ├─ /api/health   (reports whether a provider is live)
               ├─ /api/turn     (Workers AI inference; typed failures)
               ├─ /api/transcribe (later)
               └─ /api/finalize (later)
                    │
                    └─ env.AI → Workers AI (Free plan)
```

The Cloudflare Vite plugin is the integration point for Vite static assets and Worker code. `wrangler.jsonc` uses SPA not-found handling and routes `/api/*` through the Worker.

## State ownership

`CampaignState` is authoritative for gameplay. UI renders it. IndexedDB persists it. The Cartographer may return structured conversational/evidence proposals, but does not mutate or calculate game progression.

Progression is derived only by deterministic functions in `src/game/`.

## Browser persistence

- Dexie database: one active campaign record plus room for future metadata.
- Every committed state transition is persisted automatically after hydration.
- `schemaVersion: 1` exists in campaign data.
- `src/persistence/migrations.ts` owns future in-memory migration from older export/state shapes.
- Import validates/migrates before replacing local state.

## Model boundary

The model contract contains language, proposed evidence, connections, quote candidates, summary patch, and achievement *candidates*. It contains no writable XP, level, unlock, achievement, quest-completion, or territory-threshold fields.

The UI/game engine decides whether and how structured model proposals become deterministic events.

## Provider boundary

`src/cartographer/provider.ts` defines the boundary. It is deliberately small:
Atlas needs a mock, a Workers AI implementation, and a disabled state, not a
multi-provider framework. Provider selection never enters `src/game/`.

```ts
interface AIProvider {
  readonly id: string;
  turn(context: CartographerContext): Promise<ProviderResult>;
}
```

`ProviderResult` is either a validated `CartographerTurn` with usage, or a typed
`ProviderFailure`. Implementations:

- `disabledProvider` — no AI configured; the deterministic local script answers.
- `createWorkersAiProvider` — Worker-side, over the native `env.AI` binding.
- `createRemoteProvider` — browser-side, posting a compiled context to `/api/turn`.

The browser client holds no credential and knows no model id; the model registry
is Worker-side only, which the production bundles are checked against.

The selected production model lives in exactly one replaceable place:
`DEFAULT_MODEL_ID` in `src/cartographer/models.ts`, overridable at runtime by the
`ATLAS_MODEL_ID` Worker variable. See `docs/PROVIDER_BAKEOFF.md`.

## Context compiler

`src/cartographer/context.ts` builds the outgoing payload from authoritative
local state. It never sends the transcript.

**Privacy is structural.** A private dimension is filtered out *while the context
object is being constructed*, so private content never exists inside the
outgoing payload. Atlas does not send private material followed by an instruction
to ignore it, because that is a request rather than a guarantee. Retracted
material is excluded on the same grounds. Only the *labels* of retired dimensions
travel, so the model knows what not to ask without being handed what it must not
see.

**The payload is bounded.** `CONTEXT_BUDGET` caps the recent-turn window,
relevant evidence, counter-evidence, revisions, contradictions, insights and
recalled answer length. Selection priority is: current-turn necessities, then
directly relevant evidence, then unresolved contradictions and revisions, then
recent continuity, then compact summaries. A 600-turn campaign compiles to
roughly the same payload as a 40-turn one, which is asserted by test rather than
assumed. No embeddings or vector database are involved.

## Zero-dollar enforcement

The `ai` binding costs nothing by existing. The Workers Free daily neuron
allocation is the hard ceiling, and `estimateNeurons` derives per-model cost from
Cloudflare's published rate so affordability is decided before a request is made.
A model outside the free-plan registry is refused by the Worker *before* a
request exists. Quota exhaustion is a non-retryable typed failure that degrades
to the local script; it never escalates to a paid plan.

## PWA

`vite-plugin-pwa` generates the service worker and manifest. Phase 1 establishes install/offline-shell support; full device/install validation belongs to later phases.

## Accessibility

The behavior layer must use semantic buttons/forms, keyboard-accessible navigation, visible focus, reduced-motion media queries, readable text hierarchy, and no progression dependency for safety/agency controls.

## Security/privacy boundary

- No actual campaign content in Git/test fixtures.
- No secret in browser source or committed config.
- No server transcript persistence. The Worker uses the compiled context for one
  request and discards it with the request scope; nothing is logged.
- Private dimensions are removed before the outgoing payload exists.
- No D1, KV, R2, analytics, or account/auth database.
- An invite/access secret, when Phase 4 adds it, lives only as a Worker secret and local client credential.

## Zero-cost invariant

Atlas of One must not *require* paid ChatGPT, paid Cloudflare Workers/Workers AI, paid OpenRouter, a paid domain, paid database, paid speech service, paid deployment, or paid analytics. A later quota exhaustion state must stop/degrade AI features instead of generating cost.

## Explicit non-goals for v1/bootstrap

Do not add:

- D1, KV, R2
- authentication accounts/password reset
- analytics/tracking
- SSR or Next.js
- native Android/iOS/Electron wrappers
- 3D map
- vector database/embeddings
- multiplayer/social sharing
- runtime-generated character art
