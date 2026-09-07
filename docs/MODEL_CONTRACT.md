# Atlas of One — Cartographer Model Contract

## Boundary

The Cartographer returns structured conversational analysis. It does **not** return game-progression mutations.

```ts
interface CartographerTurn {
  reply: string;
  nextQuestion: string;
  presentation: "normal" | "quiet";
  evidence: Array<{
    dimension: string;
    claim: string;
    basis: "explicit" | "example" | "inference" | "revision";
    strength: 1 | 2 | 3;
    territories: string[];
  }>;
  connections: Array<{
    evidenceIds: string[];
    hypothesis: string;
    confidence: "low" | "moderate" | "strong";
  }>;
  quoteCandidates: string[];
  summaryPatch: string;
  achievementCandidates: string[];
}
```

The repository implements this as a Zod schema in `src/cartographer/schema.ts`.

## Forbidden model authority

A Cartographer response must not contain authoritative fields for:

- XP
- numeric level
- level completion
- unlock grants
- achievement grants
- quest completion
- territory thresholds or territory completion
- map-fragment grants
- campaign completion
- deletion of evidence/history

If a future provider returns extra fields, Zod strips/rejects them according to the chosen runtime parse policy; game code still has no pathway to apply them as progression.

## Evidence semantics

- `explicit`: directly stated by player.
- `example`: inferred from a concrete example the player supplied.
- `inference`: model hypothesis that must remain visibly inferential.
- `revision`: new material explicitly revising/correcting a prior claim.

Strength is evidence strength, not moral value or diagnostic certainty.

## Privacy/presentation controls

The context compiler must omit/filter private topics and must carry the current presentation state. `SERIOUS`/quiet can be set by local UI before a provider is called. A provider may request quiet presentation but cannot force celebratory mode against local quiet state.

## Context strategy for real providers later

Send only:

- contract/system instructions
- current game state summary
- current territory/quest
- confirmed profile summary
- relevant evidence and contradictions
- a small recent-turn window
- latest answer

Do not send the entire transcript by default.

## Final assessment contract (later phase)

Final synthesis uses confirmed territory summaries, evidence ledger, Insight confirmations, contradictions, revision history, representative quotations, and open uncertainty. It must distinguish statements, evidence-backed synthesis, inference, and unknowns.
