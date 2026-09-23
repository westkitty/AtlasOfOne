# Atlas v2 Proof Receipt Contract

Every completed work packet writes `docs/v2/proof/<PACKET_ID>.md`.

A proof receipt records **what actually happened**. It is not the task prompt, a completion claim, or a copy of raw CI logs.

## Required identity

```text
Packet:
Title:
Base SHA:
Final SHA:
Branch:
Executor:
Reviewer:
Risk/proof class:
```

Use the actual final implementation SHA. If the packet is documentation-only, say so.

## Changed-file envelope

List every changed file and its role.

When a shared hot-zone file changed, name why that mutation was authorized.

When important forbidden surfaces were deliberately untouched, record that too.

## Acceptance matrix

| Criterion | Evidence | State |
|---|---|---|
| exact packet requirement | inspectable source/test/runtime evidence | PASS / FAIL / UNVERIFIED |

Rules:

- `PASS` requires evidence appropriate to the claim.
- `UNVERIFIED` is allowed and preferable to fake certainty.
- One failed mandatory criterion blocks merge readiness.
- Source presence alone never proves a user journey.
- A build alone never proves browser behavior.
- Executor self-test success alone does not certify high-risk work.

## Validation executed

Record exact commands, suites, runtime journeys, and counts actually observed.

Examples:

- TypeScript/typecheck result;
- unit test files and test count;
- production/PWA build result;
- browser suite files and test count;
- focused migration/privacy/concurrency canary result;
- source/bundle negative scan;
- exact GitHub Actions run and job IDs.

Do not paste full logs.

## Validation not executed

Record decisive checks that were unavailable or intentionally out of scope.

Examples:

- physical mobile device;
- Safari/iOS;
- live provider inference;
- local MacBook execution;
- production deployment.

Never silently convert an unavailable check into a pass.

## Protected behavior rechecked

Reference the stable capability-invariant IDs affected by the packet.

Use `docs/v2/CAPABILITY_INVARIANTS.md` as the minimum impact-radius source.

## Privacy / cost / persistence impact

State explicitly whether the packet:

- changes personal-data eligibility;
- changes provider context;
- changes persisted schema;
- changes migration behavior;
- adds a remote service or dependency;
- can create monetary spend.

For `none`, say `none`.

## Reviewer verdict

Allowed packet verdicts:

- `MERGE_READY`
- `REPAIR`
- `BLOCKED`

For high-risk work, name the independent evidence/reviewer that justifies `MERGE_READY`.

## Next packets unblocked

List the exact downstream packet IDs whose dependencies are now met.

## Merge queue contract

A packet may enter the integration branch only when:

1. every dependency is already present in the integration lineage;
2. the changed-file envelope still matches the packet;
3. mandatory validation has passed;
4. its proof receipt exists;
5. consequential/high-risk work has independent review;
6. the integration owner has confirmed no shared-interface drift;
7. merge order respects dependency order rather than finish time.

After merge:

- run the narrowest integration proof that can detect collisions;
- for `App.tsx`, persistence, provider contracts, migrations, privacy, shared game authority, or other hot zones, use the full supported suite unless a narrower gate is demonstrably equivalent;
- update `AUTONOMY_LEDGER.md` to `MERGED` only after integration evidence exists;
- do not equate an integration merge with release authority.

## Release boundary

`main` is coupled to Workers Builds and therefore is a release/deployment surface.

No packet, packet batch, or green integration PR may merge to `main` merely because its local or integration tests pass.

Only the final release workflow may propose that mutation.
