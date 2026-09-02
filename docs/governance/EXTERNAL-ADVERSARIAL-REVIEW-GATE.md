# External Adversarial Review Gate

**Status:** APPROVED / FROZEN
**Authority:** Human project authority
**Classification:** Operational governance gate
**Trigger:** Complete GREEN qualification of ADR-038
**Project:** Surgical DevOps

## Purpose

This operational rule prevents indefinite internal feature expansion after
ADR-038 and requires a bounded external adversarial engineering-review stage
before normal substantial roadmap expansion resumes.

This document does not replace ADR-038.

It does not declare ADR-038 complete.

It does not authorize merge, release, deployment or public posting.

## Mandatory trigger

This gate becomes mandatory only after ADR-038 reaches complete physical GREEN
qualification.

R1 through R7, where used during implementation, are internal runtime
checkpoints under the singular ADR-038 runtime-delivery milestone. They are not
separate official ADR milestones.

ADR-038 completion must be established from physical repository, test,
qualification and Git evidence.

Conversational or model memory is insufficient.

## Mandatory next operational stage

After ADR-038 reaches complete GREEN qualification, the next mandatory
operational priority is:

**EXTERNAL ADVERSARIAL REVIEW READINESS**

Substantial new functional roadmap expansion must not supersede this stage
merely because additional ADRs or features remain available.

Required sequence:

ADR-038 COMPLETE GREEN

→ EXTERNAL ADVERSARIAL REVIEW READINESS

→ FREEZE AN EXACT REVIEW SHA

→ PREPARE A REPRODUCIBLE ADVERSARIAL HARNESS / REVIEW PACKAGE

→ QUALIFY THE EXTERNAL REVIEW PACKAGE

→ SEPARATELY AUTHORIZE PUBLIC ADVERSARIAL EXPOSURE

→ HACKER NEWS AS THE INITIAL INTENDED ENGINEERING AUDIENCE

→ RECEIVE EXTERNAL ATTEMPTS TO FALSIFY QUALIFIED INVARIANTS

→ TRIAGE FINDINGS BY REPRODUCIBLE PHYSICAL EVIDENCE

→ REPAIR REPRODUCED MATERIAL FAILURES

→ REQUALIFY

→ RESUME NORMAL SUBSTANTIAL FUNCTIONAL ROADMAP EXPANSION

## Exact review boundary

Before external exposure, an exact Git SHA must be frozen as the review
candidate.

All technical claims, reproduction instructions and adversarial tests for that
review cycle must refer to that exact physical state.

The reviewed SHA must not be silently moved while findings are being
evaluated.

If repairs are required, a new exact SHA must be produced and explicitly
identified as superseding the previous candidate.

Historical reviewed SHAs must not be rewritten.

## Reproducible adversarial review package

The review package must allow technically capable third parties to attempt to
falsify qualified claims including, where applicable:

- AI operational authority boundaries;
- deterministic Orchestrator sovereignty;
- fail-closed behavior;
- physical state over conversational or model memory;
- workspace confinement;
- conditional mutation and CAS;
- stale-state invalidation;
- authority non-transitivity;
- read not implying mutation;
- mutation not implying test authority;
- tests not implying Git authority;
- local commit not implying push;
- provider independence;
- absence of hidden model sovereignty;
- repair-until-green without manufactured GREEN;
- cancellation;
- interruption, restart and governed resume;
- canonical event truth;
- mission, plan and state coherence;
- test integrity;
- exact-SHA qualification.

The package must explicitly state both what is claimed and what is not claimed.

## External falsification principle

External criticism is valuable but is not automatically operational truth.

A report becomes an actionable engineering finding when supported by
sufficient reproducible physical evidence.

Failure to reproduce a report must not be represented as proof that a defect
or vulnerability cannot exist.

Evidence-oriented finding classifications may include:

- REPRODUCED
- PARTIALLY_REPRODUCED
- NOT_REPRODUCED
- INSUFFICIENT_EVIDENCE
- OUT_OF_SCOPE
- DUPLICATE
- EXPECTED_BY_CONTRACT

## Failure handling

A reproducible break of a claimed invariant must not be hidden, bypassed or
weakened merely to preserve a commercial, public or technical claim.

If a finding invalidates an existing qualification claim, the affected claim
must be treated as non-GREEN or blocked until repaired and requalified.

Required engineering loop:

REPRODUCIBLE FINDING

→ PHYSICAL RECONSTRUCTION

→ MINIMAL REPAIR

→ TARGETED REGRESSION

→ CANONICAL REQUALIFICATION

→ NEW EXACT SHA

→ UPDATED REVIEW EVIDENCE

GREEN must never be manufactured by removing, weakening or bypassing the test
or invariant that exposed the defect.

## Hacker News

Hacker News is the initially intended external engineering audience for the
first public adversarial exposure after External Adversarial Review Readiness
has been qualified.

The objective is not marketing-only exposure.

The objective is to invite technically capable outsiders to attempt to falsify
the system's qualified invariants.

A future submission should center on:

- an exact reproducible artifact;
- bounded technical claims;
- attack and reproduction instructions;
- known limitations;
- an explicit invitation to break the invariants;
- a repository, issue or equivalent reproduction path.

This operational rule does not itself authorize a Hacker News submission.

Public posting remains a separate human-authorized action.

## Roadmap resumption

Normal substantial functional roadmap expansion resumes after:

- external adversarial exposure has occurred;
- relevant findings have been triaged;
- reproduced material failures affecting claimed invariants have been repaired
  or explicitly retained as known blockers;
- affected qualification has been rerun;
- current physical status has been documented truthfully.

This gate does not require every external comment to be resolved.

It requires disciplined evidence-based triage.

## Existing frozen work before the trigger

Before ADR-038 complete GREEN triggers this gate, already-approved and frozen
work may proceed when physically isolated and when it does not compromise
ADR-038 continuity.

ADR-039 private telemetry/dashboard implementation may therefore proceed in an
isolated worktree.

It must not mutate, reset, discard, overwrite, contaminate or invalidate the
active ADR-038 worktree or its recovery evidence.

After ADR-038 complete GREEN triggers this gate, new substantial feature
expansion must not be used to postpone External Adversarial Review Readiness.

## ADR-039 dashboard relationship

The ADR-039 private dashboard may present telemetry useful during later
external engineering review, but remains a projection layer.

It must remain:

- read-only with respect to operational authority;
- non-Orchestrator;
- non-mutation authority;
- non-shell authority;
- non-Git authority;
- non-release authority;
- non-deployment authority;
- non-provider authority;
- privacy-gated.

The dashboard is not sovereign evidence by itself.

Underlying deterministic events, physical state and governed evidence remain
authoritative.

## Authority remains non-transitive

This gate grants no authority for:

- push to main;
- merge;
- tag;
- release;
- npm publication;
- deployment;
- Hacker News submission;
- other public posting;
- credential access;
- production infrastructure mutation.

Each remains independently authorized.

## Frozen operational rule

After ADR-038 reaches complete GREEN qualification, External Adversarial
Review Readiness becomes the mandatory next operational priority.

The project must freeze an exact review SHA, prepare and qualify a reproducible
adversarial review package, expose the qualified claims to external
falsification under separate publication authority, triage findings using
physical evidence, repair reproduced material failures, requalify, and only
then resume normal substantial functional roadmap expansion.
