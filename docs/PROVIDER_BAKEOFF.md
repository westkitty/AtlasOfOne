# Atlas of One — Cartographer Provider Record

Authoritative record of provider selection for Phase 3.

## Status of this document

**The live bakeoff has NOT been run.** No real Workers AI request has ever been
made from this repository. Everything below that concerns a model's *behaviour*
is documented evidence from Cloudflare's published model and pricing pages, not
measurement. The selected model is therefore a **provisional configuration
default**, not a measured winner.

Everything that concerns Atlas's own code — the provider boundary, the context
compiler, validation, repair bounding, the authority firewall, quota degradation
and the Worker runtime — was implemented and exercised.

## Why the live gate is closed

The environment has no Cloudflare authentication:

- `wrangler whoami` reports "You are not authenticated".
- No `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` (or `CF_*`) variable is set.
- No `~/.wrangler/config` OAuth state exists.

`wrangler login` is an interactive account-level action and was not performed.

A concrete consequence, established by running it: because `wrangler.jsonc`
declares an `ai` binding, `wrangler dev` opens a **remote proxy session** and
fails without a token —

```text
Failed to start the remote proxy session. Error reloading remote server:
In a non-interactive environment, it's necessary to set a CLOUDFLARE_API_TOKEN
environment variable for wrangler to work.
```

There is no local emulation of Workers AI. The binding cannot be exercised at
all without an authenticated account.

## Zero-dollar constraints

| Fact | Value | Source |
|---|---|---|
| Workers Free daily allocation | **10,000 neurons/day** | Workers AI pricing page |
| Neuron rate | $0.011 per 1,000 neurons | Workers AI pricing page |
| Behaviour above the allocation | Requires the Workers Paid plan | Workers AI pricing page |

Atlas must degrade at that ceiling, never cross it. `FREE_NEURONS_PER_DAY` in
`src/cartographer/models.ts` encodes it, and `estimateNeurons` derives per-model
neuron cost from the published USD rate so affordability is decided *before* a
request is made.

## Candidates verified

Verified against the current Workers AI catalogue and pricing pages. The five
candidates named in the Phase 3 brief all still exist and are all free-plan
eligible — but the brief's list was checked rather than trusted, and the
neighbouring GLM, Kimi and DeepSeek-v4 families it might have suggested are
paid-only.

Per-turn figures assume a representative Atlas turn of 1,500 input tokens (one
compiled context) and 350 output tokens (one structured turn), computed by the
shipped estimator.

| Model | Context | $/M in | $/M out | Neurons/turn | Free turns/day | Verdict |
|---|---:|---:|---:|---:|---:|---|
| `@cf/google/gemma-4-26b-a4b-it` | 256,000 | 0.10 | 0.30 | 23.2 | 431 | **Provisional default** |
| `@cf/zai-org/glm-4.7-flash` | 131,072 | 0.06 | 0.40 | 20.9 | 478 | **Runner-up** |
| `@cf/qwen/qwen3-30b-a3b-fp8` | 32,768 | 0.051 | 0.34 | 17.8 | 562 | Eligible; smallest context by ~4x |
| `@cf/openai/gpt-oss-20b` | 128,000 | 0.20 | 0.30 | 36.8 | 271 | Eligible; emits reasoning output |
| `@cf/nvidia/nemotron-3-120b-a12b` | 256,000 | 0.50 | 1.50 | 115.9 | **86** | Eligible but cannot afford a 100-turn campaign |

### Excluded before consideration

Recorded in `EXCLUDED_MODELS` so the exclusion is auditable rather than silent.

| Model | Reason |
|---|---|
| `@cf/zai-org/glm-5.2`, `glm-5.3`, `glm-5.3-flash` | Workers Paid plan or prepaid AI Gateway credits |
| `@cf/moonshotai/kimi-k2.6`, `kimi-k2.7-code` | Workers Paid plan or prepaid AI Gateway credits |
| `@cf/deepseek-ai/deepseek-v4-flash-0731`, `deepseek-v4-pro-0813` | Workers Paid plan or prepaid AI Gateway credits |
| `@cf/google/gemma-3-12b-it`, `@cf/meta/llama-3.1-*` | Deprecated in the catalogue |

The Worker refuses any model id absent from the eligible registry *before* a
request exists, so a paid-only model cannot be reached even by misconfiguration.

## Structured output: an unresolved risk

This is the most important unverified item, and the brief was right to warn
against assuming it.

- Cloudflare's **JSON Mode** support page lists a legacy set —
  `llama-3.1-8b-instruct-fast`, `llama-3.3-70b-instruct-fp8-fast`,
  `hermes-2-pro-mistral-7b`, `deepseek-r1-distill-qwen-32b` and similar. **None
  of the five candidates appears on it.**
- Each candidate's own model page lists `response_format` among its input
  parameters and advertises function calling.

These two sources disagree in emphasis, and only a live probe can settle whether
a given candidate actually *enforces* a JSON schema. `ModelCandidate.structuredOutput`
therefore records `documented-parameter` rather than a guarantee, and
`liveProbe` is `not-run` for every candidate.

Atlas is built so this does not matter for correctness: `response_format` is sent
as a hint, and the response is decoded defensively (object, bare JSON, fenced
block, or JSON buried in reasoning prose) before Zod and semantic validation.
The cost of a model that ignores the hint is a higher repair rate, not a wrong
answer.

## Provisional selection

Weighted in the documented order: privacy compliance, evidence fidelity, schema
reliability, conversation quality, long-context stability, sass/SERIOUS control,
latency, free-allocation efficiency.

Six of those eight cannot be assessed without live inference. The choice was
therefore made on the only two that *can* be evidenced today — long-context
stability and free-allocation efficiency — while avoiding outliers on the rest.

**Provisional default: `@cf/google/gemma-4-26b-a4b-it`**

- Largest documented context (256,000) of the eligible set, which matters for a
  campaign whose compiled context must stay stable over hundreds of turns.
- 23.2 neurons/turn affords 431 turns/day, comfortably clearing the 100-turn gate
  with reserve for the bakeoff itself.
- Documented `response_format` and function calling.
- No reasoning-output preamble to strip, unlike `gpt-oss-20b`.

**Runner-up: `@cf/zai-org/glm-4.7-flash`** — slightly cheaper per turn (20.9) and
a 131k context that is still ample; a close call that only measurement can
settle.

**Why the others lost**

- `qwen3-30b-a3b-fp8` is the cheapest per turn but its 32,768-token context is a
  quarter of the next smallest. The compiler keeps payloads far below that today,
  so it remains a strong fallback if efficiency ever dominates.
- `gpt-oss-20b` costs ~59% more per turn than the default and emits reasoning
  output, raising the risk of prose wrapped around the JSON payload.
- `nemotron-3-120b-a12b` is disqualified on the zero-dollar rule in practice, not
  in principle: at 115.9 neurons/turn a 100-turn campaign costs ~11,600 neurons
  and **exceeds the 10,000/day free allocation**. This is asserted by a test.

### What would trigger reselection

Any one of:

1. The live bakeoff runs (`npm run test:live`) and produces measured evidence.
2. A candidate shows any privacy violation — an automatic disqualification in
   `rank()`, regardless of every other score.
3. A candidate's structured-output probe fails, or its repair rate is materially
   worse than a rival's.
4. Cloudflare changes the free allocation, a candidate's price, or its plan
   eligibility.
5. A candidate is deprecated or removed from the catalogue.

Changing the default is a one-line edit to `DEFAULT_MODEL_ID`, or a
`ATLAS_MODEL_ID` Worker variable with no code change at all.

## How to run the bakeoff

```bash
CLOUDFLARE_ACCOUNT_ID=... CLOUDFLARE_API_TOKEN=... npm run test:live
```

Three stages, funnelled to protect the allocation:

| Stage | What it does | Neuron budget |
|---|---|---:|
| A | One identical smoke fixture through every eligible candidate | 1,500 |
| B | The full Atlas fixture suite through the survivors (max 3) | 3,000 |
| C | The largest free-safe synthetic campaign on the winner, target 100 turns | 4,000 |

The ledger refuses a request that would cross the current stage's budget, holds
stage C's reserve back from benchmarking, and stops cleanly on quota exhaustion
rather than retrying. Stage C prints the exact real-turn count achieved and the
reason it stopped.

Scoring separates machine-measured metrics (schema acceptance, repair rate,
privacy violations, authority-field attempts, quote fidelity, lexical grounding
of `explicit` claims, uncertainty preservation, repetition, latency, neurons)
from `QualitativeScore`, whose fields are explicit nulls for a human to fill in.
A measured number is never confused with an opinion.

## Real-provider turn count

**REAL 100-TURN GATE: NOT YET PASSED.**

Real Workers AI synthetic turns executed: **0**. No live request was made,
because no authenticated account exists in this environment. Scripted-binding
turns — of which 100 were run through the full pipeline — are pipeline evidence
and are deliberately not counted here.
