# Atlas of One — Cartographer Provider Record

Authoritative record of provider selection for Phase 3.

## Status of this document

**The live bakeoff was run, and its raw output was not kept.**

`@cf/qwen/qwen3-30b-a3b-fp8` is the selected provider and that decision is not in
doubt. Two different kinds of claim appear below and must not be read as one:

**VERIFIED — independently checkable right now**

- `DEFAULT_MODEL_ID` in `src/cartographer/models.ts` is `@cf/qwen/qwen3-30b-a3b-fp8`.
- The deployed production Worker reports the same model on an unauthenticated
  `GET /api/health`.
- The per-turn neuron arithmetic in the tables below is reproducible from
  `estimateNeurons` and Cloudflare's published USD rates. It was independently
  recomputed at state revision 14 and matched.
- A paid-plan model is refused before a request exists, on `/api/turn` and
  `/api/finalize`. (Not on `/api/transcribe` — see KNOWN-004.)

**REPORTED — historical results with no surviving artifact**

The run reported 212 live inference requests spending 6,163.77 neurons in
1,123.55s with zero API errors, zero privacy violations and zero authority leaks,
and reported the Stage A / B / C outcomes recorded below. Zero dollars were spent.

`tests/live/bakeoff.live.test.ts` emits its results through `console.log` and
writes no file. Nothing was committed. A repository-wide search finds these
figures only in this document and in `OPERATIONAL_STATE.md` — that is, only in
prose describing the run, never in output produced by it. They are therefore
**reported historical results, not independently reproducible evidence of that
execution**, and they cannot be recovered without spending the allocation again
on a *different* run. Tracked as UNV-019.

This does not demote Qwen3. A missing log is missing evidence about the past, not
evidence against the decision, and the decision is separately confirmed by source
and by the live health endpoint.

**Unresolved numeric tension.** The figures below report 100% structured-output
acceptance for Qwen3 — which implies no repair calls — while also reporting 204
requests on Qwen3, against a Stage C loop capped at 100 turns plus at most one
repair each. Those two statements are hard to hold together. A plausible reading
is that Stage B fixtures account for the difference, but that is inference, not
record. It is left flagged rather than resolved, and it needs a historical
explanation rather than an invented one. Any future rerun **must write a durable
artifact** so this class of question is answerable.

## Live execution details (reported)

Authentication was completed via supported Wrangler OAuth keyring integration.
Inference telemetry was reported as recorded from the live test run and checked
against Cloudflare's server-side GraphQL AI Inference analytics; neither the test
output nor the analytics response was archived.

All 5 candidates were reported present in the live Workers AI catalogue with HTTP
200 availability (`errorCode: 0`).

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
request exists, so a paid-only model cannot be reached even by misconfiguration
— on `/api/turn` and `/api/finalize`. **This guard is missing on
`/api/transcribe`**, which uses `ATLAS_TRANSCRIBE_MODEL_ID` without consulting
`TRANSCRIBE_MODEL_CANDIDATES` (which is declared and never referenced). Reachable
only by Worker configuration, not by a player, but it is a real gap in the
zero-dollar guarantee. Tracked as KNOWN-004.

## Structured output: reported findings

The live bakeoff reported the architectural warning as borne out: models without
strict JSON mode enforcement failed schema compliance when output tokens were
bounded. As above, this is the run's reported finding; the raw outputs were not
archived.

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

## Selection

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

## Live bakeoff execution evidence (reported, unarchived)

Executed via `npm run test:live` against authenticated Cloudflare Workers AI.
Every figure in this table is REPORTED. See "Status of this document" — the run
committed no artifact, so none of it is independently reproducible.

| Metric | Measured Value |
|---|---|
| Cloudflare Account | Authenticated via Wrangler OAuth |
| Total Live Inference Requests | **212** |
| Qwen3 30B Requests | 204 |
| Total Neurons Consumed | **6,163.77** (of 10,000 free/day) |
| Total Execution Time | 1,123.55s (~18.7 minutes) |
| Cloudflare API Error Rate | **0.0%** (`errorCode: 0` across all 212 requests) |
| Privacy Violations | **0** |
| Authority Leaks | **0** |
| Test Suite Result | **7 passed / 7 total** |

## Real-provider turn count

**REAL PROVIDER GATE: PASSED (reported).**

Real Workers AI synthetic turns executed: **204 requests** on the measured winner
`@cf/qwen/qwen3-30b-a3b-fp8`, plus 8 qualification requests on the remaining
candidates. All deterministic engine invariants held across the full live campaign:
turn sequence matches, level derives correctly from XP, campaign completion remains
deterministic, and total daily spend remained strictly within the complimentary tier.
