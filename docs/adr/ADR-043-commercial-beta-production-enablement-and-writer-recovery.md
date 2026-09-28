# ADR-043 — Commercial Beta production enablement and registry-writer recovery

- Status: ACCEPTED / FROZEN
- Date: 2026-09-28
- Logical protocols: `sacp.sdo-local/v1` and `sacp.sdo-local/v2` unchanged
- Related: ADR-006, ADR-007, ADR-009, ADR-010, ADR-040, ADR-041, ADR-042

## Context

ADR-042 qualified one governed physical `mutation.applyConditional` operation
but did not qualify a production composition. Capability discovery is static and
cannot truthfully assert that current, one-shot human authority exists for a
particular operation. An orphan Control Plane registry-writer record also
blocked future registry progress; deleting it because time elapsed or a PID was
missing was deliberately forbidden.

## Decision

No v3 protocol is required. The frozen v2 submit already binds the exact
operation, canonical workspace identity, repository and HEAD, qualified
worktree state, target, before/after hashes, proposal and authorization
fingerprints, and expected CAS. Production eligibility and current Surgical
authority are therefore resolved at submission time without changing either
v1 or v2 schema or digest.

The production composition uses the following distinct internal states:

1. `IMPLEMENTATION_UNAVAILABLE` or `IMPLEMENTATION_AVAILABLE`;
2. `PRODUCTION_DISABLED` or `PRODUCTION_CONFIGURED`;
3. `OPERATION_INELIGIBLE`;
4. `AUTHORITY_REQUIRED` or `AUTHORITY_VALID`;
5. `READY_FOR_EXACT_PHYSICAL_OPERATION`.

Only the final state may supply an authorized execution to the existing
governed physical executor. Configuration, environment variables, capability
discovery, endpoint availability, and a Control Plane approval reference never
produce that state. The executor and gateway still independently verify and
consume local Surgical human authority and enforce the final CAS.

Registry writer ownership is upgraded only as an internal storage record. It
binds the owner token to the exact operation, external execution identity,
workspace, repository, physical binding, observed registry generation/digest,
intended generation, and mutation kind. This is not a wire-protocol change.

Recovery requires all of the following before deletion of ownership:

- an exact, structurally valid owner record and registry generation;
- Surgical physical evidence classifying the writer as `ORPHAN_CONFIRMED` and
  correlating the exact operation/external identity with no effect or a proven
  commit;
- a durable, exclusive recovery claim for the exact owner fingerprint;
- a locally resolved, one-shot Surgical recovery authorization bound to the
  complete recovery request;
- a second evidence inspection and exact owner/registry CAS immediately before
  mutation;
- durable removal and durable publication of the recovery result.

Recovery never uses age, timeout, PID existence, polling, retry delay, or
automatic resubmission. A legacy owner record, absent/contradictory Surgical
evidence, an active writer, changed generation, replacement owner, malformed or
substituted file, reused/forged authorization, or racing recovery claim fails
closed. The closed outcomes are `NOT_ORPHANED`, `ORPHAN_CONFIRMED`,
`RECOVERY_NOT_AUTHORIZED`, `RECOVERY_CONFLICT`, `RECOVERED_NO_EFFECT`,
`RECOVERED_COMMITTED`, `INDETERMINATE`, and `CORRUPT_FAIL_CLOSED`.

## Preserved boundaries

`sacp.sdo-local/v1` remains non-physical with digest
`cd4e3fa7d7086f78291ef35b87e1b450be15bc77cb6ae8527e299101e5a11935`.
`sacp.sdo-local/v2` remains frozen with digest
`0276897c7e22dc2cc77f049a4a329842abff50290ada1f946bce9747660d31e4`.

The qualified production capability remains only
`mutation.applyConditional`. This decision grants no arbitrary filesystem,
shell, process, network, push, merge, tag, publish, release, or deploy
authority. Active mutation cancellation remains `NON_INTERRUPTIBLE_MUTATION`.
Universal power-loss survival is not claimed; platform-specific qualified
durability primitives remain the boundary.
