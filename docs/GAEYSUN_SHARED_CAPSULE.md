# Gaeysun Shared Capsule Boundary

## Status

This integration is intentionally **candidate-only**. It validates Gaeysun Shared Capsule v1 files and converts their shared entries into inert Atlas candidate records. It does not mutate the Atlas campaign or Gaeysun memory.

## Authority

- **Gaeysun** decides what is shared and exports the capsule.
- **Atlas of One** validates the capsule as external context.
- Capsule entries are not Atlas progression events.
- Atlas does not write directly back to Gaeysun.
- A future return path may emit candidates only and must require explicit Gaeysun approval.

## Forbidden data

A valid capsule cannot contain:

- Andrew-private material
- Greyson-private material
- sealed material
- Surprise entries
- Walk candidates
- Vault plaintext
- Vault ciphertext
- passphrases

Real relationship capsules must not be committed to Git, fixtures, logs, analytics, screenshots, or remote model context by default. Tests use synthetic data only.

## Progression firewall

The adapter exports no XP, level, unlock, achievement, quest, territory, campaign, or progression mutation fields. Importing a capsule cannot itself:

- grant XP
- increase level
- unlock landmarks or territory
- complete quests
- award achievements
- chart campaign progress

Any future gameplay use must pass through the existing deterministic Atlas action/event rules.

## Integration API

`parseGaeysunSharedCapsule(input)`

Validates type, version, source authority, policy, shared-only entries, unique IDs, entry count, and closed relation/lineage references.

`verifyGaeysunSharedCapsuleIntegrity(capsule)`

Recomputes the SHA-256 digest over the same stable JSON representation used by Gaeysun.

`gaeysunCapsuleToCandidates(capsule)`

Returns inert `GaeysunCandidate[]` records for an approval or interpretation layer. It does not persist them or create game events.

## Runtime contract

1. User selects a Gaeysun Shared Capsule locally.
2. Atlas parses and verifies it entirely in the browser.
3. Invalid or integrity-mismatched capsules are rejected before candidate creation.
4. Valid entries become previewable candidates.
5. No candidate changes campaign state until a separately designed user action maps it into an existing deterministic Atlas event.
6. Raw capsule bytes are not sent to providers by this adapter.

## Tests

`tests/gaeysunCapsule.test.ts` uses synthetic fixtures to prove:

- shared-only capsule acceptance
- private/surprise/widened-authority rejection
- count and relation closure
- digest mismatch detection
- absence of progression-authority fields from candidates
