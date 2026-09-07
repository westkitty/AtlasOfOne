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

## Context strategy

Implemented in `src/cartographer/context.ts`. Send only:

- contract/system instructions and the permanent agency rules
- current game state summary
- current territory/quest and the active task
- confirmed and rejected Insights
- relevant evidence, counter-evidence, revisions and open contradictions
- a small recent-turn window
- latest answer
- current Boss Fight / Mystery Door context when one is active

The entire transcript is never sent. Every list is capped by `CONTEXT_BUDGET`, so
context does not grow with campaign length.

Private and retracted material is removed while the context is built. Only the
labels of retired dimensions travel, so the model can avoid a topic without being
given it.

Visibility for DERIVED records — Insights and Contradictions — is decided by
**evidence provenance**, never by reading their prose. A derived record is a
*reading* of evidence, so it is exactly as private as the evidence beneath it,
and a claim can be entirely about a private dimension without ever naming it.
`createEvidenceVisibility` in `src/cartographer/context.ts` is the single
definition: a derived record travels only when it carries `evidenceIds` and every
one resolves to an evidence record that is present, `status: 'active'` (which is
what carries retraction) and on a non-private dimension. A derived record with no
provenance is withheld rather than assumed safe. Both outgoing payloads — the
per-turn context and the finalize context — share that one definition so they
cannot drift apart.

## Structured output and validation

The provider response passes four layers, in order:

1. **Decode** — accepts a real object, bare JSON, a fenced block, or JSON buried
   in reasoning prose (brace-balanced scan that ignores braces inside strings).
2. **Zod** — `cartographerTurnSchema` is authoritative. Being an object schema it
   strips unknown keys, so progression-looking fields cannot survive.
3. **Semantic** — Atlas rules Zod cannot express: no evidence on a retired
   dimension, no retired dimension in prose, no unknown territory id, no quote
   that is not a substring of the player's answer, and no narrated progression
   ("+8 XP", "achievement unlocked", "territory charted").
4. **Normalize** — local presentation wins. A provider may request quiet, but it
   can never pull Atlas back into celebration while the player has asked for
   SERIOUS.

`response_format: { type: 'json_schema' }` is sent where the model documents
support for it, but it is a hint and never a substitute for the layers above.
See `docs/PROVIDER_BAKEOFF.md` for which candidates document it and what remains
unverified.

### Repair is bounded to one attempt

A **structural** failure (decode or schema) earns exactly one repair call, which
asks for the same content as valid JSON. There is no second attempt and no retry
loop. A repair call goes through the identical validation pipeline and grants no
additional authority.

A **semantic** failure is never repaired. A model that proposed a private
dimension is not asked to try again more politely; the response is discarded and
a typed `semantic-invalid` failure is returned.

If repair fails, the caller falls back to the deterministic local turn. A
provider failure never costs the player their answer.

## Failure states

Twelve typed codes: `provider-disabled`, `binding-missing`, `not-configured`,
`model-unavailable`, `quota-exhausted`, `rate-limited`, `capacity`, `timeout`,
`network`, `malformed-output`, `semantic-invalid`, `repair-failed`.

Each has player-facing copy in Atlas's own voice. The player never reads a status
code, a binding name, a schema error or a model id. Quota exhaustion in
particular reads as a boundary Atlas keeps on purpose, not a fault.

No failure may corrupt `CampaignState`, leak private content, double-award
progress, trigger unlimited retries, silently switch to a paid provider, or
delete the locally entered answer.

## Evidence provenance

`EvidenceRecord` carries `origin` (`player-stated` / `model-proposed` /
`engine-derived`) and `providerId`. The player's own words always live verbatim
in `TurnRecord.answer`; a claim is a *reading* of them, so model interpretation
never replaces the original statement. Combined with `basis` and Insight status,
the system can distinguish a player statement, a model-proposed interpretation, a
confirmed Insight, a rejected Insight, a revision, a contradiction and a derived
summary. Retraction semantics are unchanged.

Both fields are additive within schema v1 under DEC-012 and carry Zod defaults,
so earlier exports still import.

## Final assessment contract

Final synthesis uses confirmed territory summaries, evidence ledger, Insight confirmations, contradictions, revision history, representative quotations, and open uncertainty. It must distinguish statements, evidence-backed synthesis, inference, and unknowns.

`FinalAssessment` and `CartographerTurn` are unrelated shapes, so the turn
validator does not and must not operate on an assessment. The final assessment
has its own compatible semantic stage, `validateFinalAssessment` in
`src/cartographer/finalize.ts`, which reuses the shared primitives
(`PROGRESSION_CLAIMS`, `findAuthorityFields`) and restates the rules for this
contract. `/api/finalize` runs it after `finalAssessmentSchema`, because shape is
not honesty: this artifact is long, it is about a real person, it is kept, and it
is printed.

### Final assessment semantic invariants

The validator inspects **every string in the whole assessment**, not a chosen
subset of fields, and refuses one that:

1. names a private or retired topic anywhere in its prose;
2. offers a representative quote that is not grounded in the eligible visible
   quote set supplied in the finalize context — comparison ignores wrapping
   punctuation and whitespace and accepts containment in either direction,
   because the context clips quotes;
3. narrates progression, by the same patterns the per-turn path refuses;
4. carries a progression authority field — Zod strips these, but an attempt is
   reported rather than silently accepted;
5. offers a framework estimate with an empty or missing caveat, or an empty
   framework or estimate. A framework estimate must read as a working
   hypothesis; an uncaveated one reads as a diagnosis.

As on the per-turn path, a semantic failure is **never repaired**. The response
is discarded, `/api/finalize` returns the existing typed `semantic-invalid`
(HTTP 422), and the caller falls back to the deterministic local synthesis, so a
refusal costs the player nothing. A refusal mutates no campaign state and awards
no progression. No retry is introduced beyond the existing bound.

The deterministic local synthesizer is held to the same standard as the model,
because it is what the player actually sees whenever remote synthesis is
unavailable or refused. It reports what the campaign recorded and says so plainly
when the campaign recorded nothing: it states no personality conclusion for an
unmapped axis, invents no contradiction, estimates no psychometric profile, and
never presents placeholder text as a quotation. An empty axis is reported as an
empty axis.

The Final Assessment is an end-state artifact and is gated on
`campaignReachedEndState`, a read of existing engine authority. It is not offered
before the map is finished.

**Not yet verified:** none of this has been exercised against a real Workers AI
response. The validator's practical rejection rate on live model output is
unmeasured (UNV-018). Its failure mode is safe — fallback to the local
synthesis — not lossy.
