# Atlas of One — Model Contract

## Principle

The model proposes language and bounded interpretations. It does not own game truth.

Every model operation receives an explicit typed **mode** and a bounded, privacy-filtered context.

## Supported proposal modes

The provider layer evolves toward a discriminated union with mode-specific schemas.

### JournalProposal

May contain:

- short acknowledgement/response;
- optional one-question follow-up;
- possible theme/change/contradiction note;
- optional "explore this later" suggestion;
- candidate evidence only where the source itself supports it.

Must not force a follow-up question.

### ReflectionProposal

May contain:

- one concise reflection question;
- optional interpretation/hypothesis;
- source/provenance references;
- uncertainty language.

It cannot mark an interpretation confirmed. Greyson owns that outcome.

### AdventureSceneProposal

May contain:

- scene prose;
- dialogue;
- bounded next-beat proposal;
- candidate NPC/object flavor;
- ACT wording;
- narration for deterministic encounter state.

It cannot change world/combat/progression state directly.

### SnapshotProposal

May contain prose synthesis only from eligible provenance-visible material.

It must preserve:

- uncertainty;
- contradiction;
- revisions;
- provenance distinctions;
- counter-evidence;
- Greyson's confirmation/rejection status.

It must not claim finality.

## Explicitly forbidden model authority

Model output must not directly control:

- XP;
- level;
- achievements;
- unlocks;
- quest completion;
- territory thresholds;
- combat HP;
- damage;
- turn order;
- encounter outcome;
- rewards;
- persistence;
- migration;
- privacy status;
- retraction propagation;
- adventure eligibility;
- Snapshot eligibility.

Unknown fields are rejected or stripped according to the validated mode contract.

## Context compiler

Each provider call receives only the minimum eligible context for that mode.

Possible ingredients:

- current mode;
- current journal/adventure/reflection state;
- current territory/quest;
- confirmed profile summary;
- relevant active evidence;
- counter-evidence;
- open contradictions;
- recent revisions;
- bounded recent turns/actions;
- bounded relevant memories;
- knowledge gaps;
- latest input.

The full transcript is not sent.

## Privacy boundary

PRIVATE and retracted source material is excluded while the context object is constructed.

Derived records are eligible only when their supporting provenance is eligible.

Do not send private content and then instruct the model to ignore it.

Only safe labels/retirement metadata may be included when needed to prevent recurrence.

## Human authority boundary

The model may hypothesize.

It must not:

- diagnose;
- state unsupported motive as fact;
- equate fictional behavior with personality;
- reassert rejected interpretations as accepted;
- flatten contradiction into certainty;
- invent quotes;
- reward or privilege vulnerability.

A reflection response from Greyson may itself become evidence under deterministic evidence rules.

## Adventure boundary

The model can author fiction inside bounded templates.

It cannot:

- invent new reward categories;
- bypass reflection;
- alter adventure eligibility;
- create hidden psychological tests;
- encode a psychological verdict into ACT options;
- mutate deterministic consequences.

## Combat boundary

The model may narrate the authoritative combat state.

It cannot decide:

- whether an attack hit;
- damage amount;
- HP;
- status application;
- turn order;
- objective progress;
- victory/pacification/escape/defeat;
- rewards.

## Snapshot boundary

Snapshot synthesis operates on eligible confirmed/uncertain/rejected/revised provenance-aware state, not raw transcript alone.

Every substantive claim should remain explainable by:

- supporting sources;
- source type;
- confirmation status;
- counter-evidence;
- temporal change.

Old Snapshots are immutable.

## Output validation

Each proposal must pass:

1. structural schema validation;
2. semantic authority validation;
3. privacy/provenance validation where applicable.

Malformed structure may receive at most one repair attempt.

Semantic authority violations are refused rather than repaired into game authority.

No retry loop.

## Local fallback

Provider failure must leave the deterministic game usable.

Where practical, local fallback supports:

- journal acknowledgement;
- reflection wording;
- adventure template continuation;
- deterministic Snapshot summary.

Mechanics never require a narrative provider call to complete.

## Cost boundary

Provider selection must remain within the zero-surprise-cost policy.

A paid-only or otherwise disallowed model must be refused before a request is made.

Quota exhaustion is non-retryable where the provider exposes that distinction and must degrade safely.

## TTS

There is no model contract for assistant speech output.

Speech-to-text is an input concern only and produces editable text before submission.
