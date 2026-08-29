# ADR-033 — Governed Autonomous Runner Mode

- **Status:** Accepted / Frozen
- **Decision class:** Governed autonomy / NATURAL interaction / deterministic orchestration
- **Applies to:** Surgical DevOps Orchestrator and governed profiles that expose autonomous continuation
- **Authority model:** Human-sovereign; no new operational authority is granted by RUNNER

## Context

Surgical DevOps already separates cognitive assistance from operational authority.
The deterministic Orchestrator mediates workspace evidence, capabilities, physical
mutation and authorization boundaries.

For long development chains, repeatedly asking a human to approve every ordinary
micro-step creates interaction friction without increasing safety when all work
remains inside an already authorized workspace, purpose and capability envelope.

A concise user intent is therefore needed for governed autonomous continuation
without weakening deterministic controls.

## Decision

Surgical DevOps SHALL recognize **RUNNER** as the canonical concise intent for
**Governed Autonomous Runner Mode**.

RUNNER means:

> Continue from the last physically qualified governed baseline; choose the next
> material work unit permitted by the current authority envelope; implement,
> test, diagnose failures, apply minimum deterministic recovery, run canonical
> regression and invariant gates, record evidence, checkpoint locally, and
> continue until GREEN or a genuine external/authority boundary is reached.

RUNNER is continuity automation. It is **not** unrestricted delegation and it
does **not** create, expand or reinterpret operational authority.

## Canonical normalized intent

A NATURAL-language request equivalent to RUNNER SHALL be normalized to a
governed intent equivalent to:

```json
{
  "intent": "AUTONOMOUS_UNTIL_GREEN",
  "continuation_policy": "CHAINED",
  "failure_policy": "DIAGNOSE_AND_RECOVER",
  "approval_policy": "EXTERNAL_BOUNDARY_ONLY",
  "publication": "DENIED",
  "authority_expansion": "DENIED",
  "test_weakening": "DENIED"
}
```

Equivalent NATURAL phrases MAY include requests such as:

- `RUNNER`
- `execute até o verde`
- `continue sozinho até o verde`
- `prossiga autonomamente`
- `continue até a próxima fronteira`
- `implemente tudo que puder até o verde`

Phrase recognition never changes the underlying authority envelope.

## Required execution cycle

Each RUNNER cycle SHALL remain governed by the same deterministic Orchestrator
and SHALL perform, as applicable:

1. resolve the governed workspace and current authority envelope;
2. read and verify the last qualified physical baseline;
3. verify branch/repository/workspace invariants;
4. identify the next material milestone inside current authority;
5. implement the minimum change necessary;
6. execute directed qualification tests;
7. diagnose failures from evidence;
8. apply minimum recovery without broad destructive reset;
9. rerun directed tests;
10. run the canonical regression and architecture/invariant gates;
11. record physical evidence and local checkpoint state;
12. continue automatically only while the next cycle remains within authority.

A failure is evidence. RUNNER SHALL NOT reinterpret a failed gate as success.

## Mandatory fail-closed boundaries

RUNNER SHALL stop before an operation that requires any authority not already
materialized and governed.

At minimum, the following are stopping boundaries unless independently and
explicitly authorized:

- new credentials, secrets or privileged identity material;
- real financial expenditure or procurement;
- push, publication, release or external distribution;
- expansion to another workspace, repository or protected scope;
- new external hardware, operating system, device, host or infrastructure;
- legally sensitive action requiring new human judgment;
- change to an Accepted/Frozen constitutional or architectural principle;
- any operation whose safety contract cannot be proven by current evidence.

The Orchestrator SHALL explain the boundary and request only the additional
human decision actually required.

## Invariants

RUNNER SHALL NOT:

- bypass the deterministic Orchestrator;
- grant direct filesystem, shell or process authority to the cognitive provider;
- weaken, delete or rewrite tests merely to obtain GREEN;
- broaden capabilities implicitly;
- fabricate physical evidence;
- convert NOT_TESTED or NOT_CLAIMED into PASS;
- perform broad reset/clean as a generic recovery mechanism;
- push or publish merely because a local milestone is GREEN;
- turn previous human authorization into an unlimited standing delegation.

The same fail-closed trust boundary applies in NATURAL, ENGINEER and EXPERT
profiles.

## Profile behavior

### NATURAL

NATURAL SHOULD allow concise activation using `RUNNER` or semantically
equivalent language. Technical details MAY be progressively disclosed while
authority and safety semantics remain unchanged.

### ENGINEER

ENGINEER SHOULD expose the resolved milestone, mutation set, physical evidence,
test gates, baseline hashes and stopping boundary.

### EXPERT

EXPERT MAY expose the complete deterministic decision graph, capability envelope,
CAS/invariant details and recovery evidence.

Profile presentation never changes authority.

## Companion intents

### RUNNER STATUS

`RUNNER STATUS` SHALL be read-only and SHALL report at least:

- current governed workspace;
- current qualified baseline;
- active or last material milestone;
- last GREEN gate;
- current authority envelope;
- pending external/authority boundaries;
- whether publication/push authority exists.

It SHALL NOT expand authority or mutate project state.

### RUNNER STOP

`RUNNER STOP` SHALL revoke autonomous continuation after the current
deterministically safe operation boundary.

Stopping SHALL NOT intentionally leave a known unsafe intermediate mutation.
If an atomic governed operation is in progress, the Orchestrator SHALL finish
or deterministically recover that operation before declaring RUNNER stopped.

## Recovery semantics

When a technical gate fails inside the current authority envelope, RUNNER SHALL
prefer deterministic evidence-driven recovery rather than immediately asking
the human what to do.

Recovery MUST preserve already qualified work whenever possible and MUST use
exact mutation-set gates.

Human involvement is required only when recovery itself crosses an external or
authority boundary or when two materially different architectural choices cannot
be resolved from Accepted/Frozen project decisions.

## Security rationale

The safety property of RUNNER is not frequent human clicking.

Its safety derives from:

- a bounded authority envelope;
- deterministic mediation;
- explicit physical evidence;
- invariant-preserving gates;
- fail-closed handling of uncertainty;
- strict separation between cognitive recommendation and operational authority;
- human sovereignty over authority expansion.

RUNNER therefore implements **Automation Restriction, Not Human Restriction**:
automation may continue where authority is already explicit, while new authority
remains human-controlled.

## Consequences

### Positive

- long implementation chains can proceed with substantially lower interaction friction;
- failure diagnosis and recovery become part of the governed execution contract;
- NATURAL users gain a concise high-level control without losing deterministic safety;
- the same semantic contract can be reused across projects;
- external boundaries become explicit rather than being confused with ordinary
  implementation checkpoints.

### Trade-offs

- the Orchestrator must maintain reliable baseline and authority state;
- milestone selection becomes a governed planning responsibility;
- recovery logic must distinguish safe continuation from authority expansion;
- status/evidence UX becomes more important because fewer manual approvals occur.

## Rejected alternatives

### Unrestricted autonomous mode

Rejected because autonomy without an explicit authority envelope would violate
human sovereignty and the Orchestrator trust boundary.

### Human approval for every micro-operation

Rejected as the default because it transfers deterministic governance friction
to the human even when no new authority is being requested.

### Provider-controlled autonomous loop

Rejected because the cognitive provider cannot own workspace authority,
capabilities or mutation rights.

### Treat GREEN as implicit push/release permission

Rejected. Local qualification and external publication remain separate
authorities.

## Acceptance criteria

This ADR is satisfied only when implementation proves that:

- RUNNER and equivalent NATURAL intent normalize to the governed autonomous mode;
- RUNNER cannot bypass workspace or capability confinement;
- technical failures trigger evidence-driven recovery inside existing authority;
- test weakening cannot be used as a continuation strategy;
- push/publication remain denied without explicit authority;
- external/authority boundaries stop execution fail-closed;
- RUNNER STATUS is read-only;
- RUNNER STOP terminates continuation at a safe deterministic boundary;
- ENGINEER/EXPERT observability does not alter operational authority.

## Frozen rule

**RUNNER is governed continuity, never unlimited authority.**

No future implementation may weaken this rule merely to increase autonomy,
throughput or convenience.
