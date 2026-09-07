# Atlas of One — Architecture

## Locked shape

One React/TypeScript Vite PWA and one same-origin Cloudflare Worker application.

```text
Browser / installed PWA
  ├─ React UI
  ├─ deterministic game engine
  ├─ Dexie / IndexedDB campaign database
  ├─ Zod runtime schemas
  └─ PWA service worker
          │
          └─ same-origin /api/*
               Cloudflare Worker
               ├─ /api/health
               ├─ /api/turn (mock-safe boundary in this phase)
               ├─ /api/transcribe (later)
               └─ /api/finalize (later)
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

Real providers are Phase 3. The current repository exposes a Worker API boundary and a local `MockCartographer`. No paid model is connected and no API secret is needed.

Future provider interface:

```ts
interface AIProvider {
  turn(input: CartographerContext): Promise<CartographerTurn>;
  finalize(input: FinalizationContext): Promise<FinalAtlas>;
}
```

## PWA

`vite-plugin-pwa` generates the service worker and manifest. Phase 1 establishes install/offline-shell support; full device/install validation belongs to later phases.

## Accessibility

The behavior layer must use semantic buttons/forms, keyboard-accessible navigation, visible focus, reduced-motion media queries, readable text hierarchy, and no progression dependency for safety/agency controls.

## Security/privacy boundary

- No actual campaign content in Git/test fixtures.
- No secret in browser source or committed config.
- No server transcript persistence.
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
