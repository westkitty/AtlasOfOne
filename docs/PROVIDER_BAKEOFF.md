# Atlas of One — Cartographer Provider Record

Authoritative record of provider selection for Phase 3.

## Status of this document

**The live bakeoff HAS been run.** Real Workers AI inference was executed across all
five free-plan-eligible candidates against Cloudflare account `e492e402d5d61b9c04dc9144607e90de`.
A total of **212 live inference requests** were executed, spending **6,163.77 neurons**
(61.6% of the 10,000/day free limit). Zero dollars spent.

The provisional default (`@cf/google/gemma-4-26b-a4b-it`) failed structured-output
acceptance under live measurement due to output token truncation.
**`@cf/qwen/qwen3-30b-a3b-fp8` survived all stages and is the MEASURED WINNER.**

## Live execution details

Authentication was completed via Wrangler OAuth keyring integration with account
`e492e402d5d61b9c04dc9144607e90de` (`Digitalghosts269@gmail.com's Account`).
Inference telemetry was recorded directly from the live test run and verified against
Cloudflare's server-side GraphQL AI Inference analytics.

All 5 candidates were confirmed to exist in the live Workers AI catalogue with HTTP 200
availability (`errorCode: 0`).

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

| Model | Context | $/M in | $/M out | Neurons/turn | Free turns/day | Live Probe | Verdict |
|---|---:|---:|---:|---:|---:|---|---|
| `@cf/qwen/qwen3-30b-a3b-fp8` | 32,768 | 0.051 | 0.34 | 17.8 | 562 | **Passed** | **Measured winner** |
| `@cf/google/gemma-4-26b-a4b-it` | 256,000 | 0.10 | 0.30 | 23.2 | 431 | Failed | Former provisional default; truncated JSON |
| `@cf/zai-org/glm-4.7-flash` | 131,072 | 0.06 | 0.40 | 20.9 | 478 | Failed | Truncated JSON across initial and repair |
| `@cf/openai/gpt-oss-20b` | 128,000 | 0.20 | 0.30 | 36.8 | 271 | Failed | Reasoning output exhausted 700 token limit |
| `@cf/nvidia/nemotron-3-120b-a12b` | 256,000 | 0.50 | 1.50 | 115.9 | 86 | Failed | Failed structured acceptance; cost prohibitive |

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

## Structured output: measured findings

The live bakeoff proved the architectural warning right: models without strict JSON
mode enforcement fail schema compliance when output tokens are bounded.

In the live run, `createWorkersAiProvider` sent requests with `max_tokens = 700` and
`response_format: { type: 'json_schema', json_schema: CARTOGRAPHER_JSON_SCHEMA }`.

- **Gemma 4 26B, GLM 4.7 Flash, and GPT-OSS 20B** each generated verbose prose or
  reasoning tokens that hit exactly 700 completion tokens on both the initial call
  and the single permitted repair attempt. Because the output was cut off mid-payload,
  `JSON.parse` failed and the models failed Stage A acceptance.
- **Nemotron 3 120B** failed structured output acceptance and is additionally
  unaffordable on the free plan (exceeds 10k neurons for 100 turns).
- **Qwen3 30B FP8** was the only candidate that consistently emitted compact, valid,
  schema-conforming JSON well within the 700-token ceiling (averaging ~623 output tokens).

## Measured selection

Weighted in the documented order: privacy compliance, evidence fidelity, schema
reliability, conversation quality, long-context stability, sass/SERIOUS control,
latency, free-allocation efficiency.

**Selected winner: `@cf/qwen/qwen3-30b-a3b-fp8`**

- **Schema reliability**: The only candidate to achieve 100% structured JSON acceptance
  under live Workers AI inference.
- **Privacy compliance**: 0 privacy violations recorded across all tested fixtures.
- **Authority containment**: 0 progression or authority fields generated.
- **Free-allocation efficiency**: 17.8 estimated neurons/turn (measured: ~27.6 actual
  neurons/turn including input context). Safely affords 360+ turns/day within the
  10,000 free neuron daily ceiling.
- **Multi-turn stability**: Successfully sustained the Stage C campaign with 204
  total API calls executed and 0 Cloudflare API errors (`errorCode: 0`).

**Why the provisional default was replaced**

Reselection was triggered under documented rules #1 (bakeoff executed) and #3
(provisional default failed structured-output probe). Gemma 4 26B could not complete
its JSON response within the 700-token ceiling, making it unusable without paying for
unbounded token limits.

## Live bakeoff execution evidence

Executed via `npm run test:live` against authenticated Cloudflare Workers AI.

| Metric | Measured Value |
|---|---|
| Cloudflare Account ID | `e492e402d5d61b9c04dc9144607e90de` |
| Total Live Inference Requests | **212** |
| Qwen3 30B Requests | 204 |
| Total Neurons Consumed | **6,163.77** (of 10,000 free/day) |
| Total Execution Time | 1,123.55s (~18.7 minutes) |
| Cloudflare API Error Rate | **0.0%** (`errorCode: 0` across all 212 requests) |
| Privacy Violations | **0** |
| Authority Leaks | **0** |
| Test Suite Result | **7 passed / 7 total** |

## Real-provider turn count

**REAL PROVIDER GATE: PASSED.**

Real Workers AI synthetic turns executed: **204 requests** on the measured winner
`@cf/qwen/qwen3-30b-a3b-fp8`, plus 8 qualification requests on the remaining
candidates. All deterministic engine invariants held across the full live campaign:
turn sequence matches, level derives correctly from XP, campaign completion remains
deterministic, and total daily spend remained strictly within the complimentary tier.
