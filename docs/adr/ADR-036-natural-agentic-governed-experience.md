# ADR-036 — NATURAL Agentic Governed Experience

- Status: ACCEPTED / FROZEN
- Date: 2026-08-31
- Scope: Surgical DevOps v2.6+ NATURAL experience
- Decision authority: Human
- Supersedes: none
- Related:
  - ADR-004 — Surgical DevOps Orchestrator Trust Boundary
  - ADR-009 — Strict Physical Identity Conditional CAS Boundary
  - ADR-010 — Governed Content-Addressed Workspace Authority
  - ADR-011 — Intent-Driven Orchestration User Modes
  - ADR-014 — Governed AI Behavior Contract
  - ADR-019 — Single-Agent Governed Engineering Loop
  - ADR-028 — NATURAL Governed Development Execution Loop
  - ADR-032 — NATURAL Interactive Development Closure
  - ADR-033 — Governed Autonomous Runner Mode
  - ADR-034 — Deterministic Governed Workspace Experience

## Context

Surgical DevOps already defines deterministic authority, physical workspace
identity, governed mutation, CAS, durability, recovery, governed AI behavior,
NATURAL/ENGINEER/EXPERT interaction profiles, autonomous governed execution,
and a cross-platform sandbox architecture whose physical implementation is
adapted to Linux, Windows and macOS while preserving its security contract.

The remaining product-experience objective is not to redesign the sandbox and
not to grant additional authority to the model.

The objective is to make the NATURAL interaction experience comparable to a
modern agentic engineering session such as the operational experience presented
by Codex:

- the human states an engineering objective;
- the system establishes and maintains a mission;
- the agent plans the work;
- it investigates using governed evidence;
- it reports meaningful progress;
- it performs authorized work continuously;
- it diagnoses failures;
- it repairs forward;
- it re-runs qualification;
- it creates governed checkpoints when permitted;
- it stops only on success, an explicit human interruption, or a genuine
  authority/architectural boundary.

This ADR freezes that experience as a product contract while preserving all
existing deterministic and security invariants.

## Decision

The NATURAL profile SHALL expose a persistent, mission-oriented,
agentic-governed engineering experience.

The experience SHALL provide high operational continuity and low interaction
friction without weakening authority boundaries.

NATURAL SHALL behave as a governed engineering agent working with the human,
rather than as a conversational interface that repeatedly delegates terminal
operation back to the human when the required operation is already inside
granted authority.

No clause in this ADR grants new physical authority to the model.

## 1. Persistent governed mission

A NATURAL engineering request MAY establish a governed mission.

A mission SHALL have an explicit deterministic state and SHALL remain bound to:

- physical workspace identity;
- repository identity when applicable;
- current governed state;
- human authority envelope;
- applicable CAS expectations;
- granted operation classes;
- journal/audit identity;
- task/mission identity.

Mission continuity MUST NOT transform conversational memory into authority.

A resumed mission MUST revalidate the physical state required by its authority
before privileged continuation.

## 2. Live plan

The NATURAL experience SHALL maintain a concise live plan for non-trivial
missions.

The plan MAY evolve as evidence is discovered.

Plan modification does not expand authority.

A plan SHALL distinguish at least:

- pending work;
- active work;
- completed work;
- blocked work.

The plan is an experience projection over governed state, not an execution
capability.

## 3. Explicit mission states

The implementation SHALL expose meaningful mission states such as:

- PLANNING
- AUDITING
- IMPLEMENTING
- TESTING
- REPAIRING
- QUALIFYING
- CHECKPOINTING
- GREEN
- BLOCKED
- CANCELLED

Equivalent deterministic names MAY be used if semantics remain explicit.

A user-facing status MUST never report GREEN when mandatory qualification
evidence is incomplete, ambiguous or failed.

## 4. Concise progress updates

During long-running missions, NATURAL SHALL provide concise progress updates
that communicate meaningful engineering state.

Updates SHOULD report:

- material findings;
- important defects;
- completed qualification boundaries;
- transition to a new mission phase;
- genuine blockers requiring human authority.

The user SHALL NOT need to inspect raw terminal output continuously in order to
understand mission progress.

Raw evidence MAY remain available for audit.

## 5. Continuous execution inside granted authority

After human authorization establishes a valid authority envelope, NATURAL MAY
continue autonomously across multiple governed micro-operations that remain
inside that envelope.

The system SHOULD NOT request repeated approval for operations already
authorized for the same valid mission/state boundary.

Authority reuse MUST remain:

- scoped;
- state-bound;
- mission-bound;
- revocable;
- auditable;
- fail-closed.

State invalidation, identity change, CAS mismatch or authority-boundary crossing
MUST invalidate stale permission as required by the governing contracts.

## 6. Repair-until-green

When an authorized engineering mission includes implementation and
qualification, NATURAL SHALL support a repair-until-green workflow.

The normal loop is:

1. inspect evidence;
2. formulate the smallest legitimate change;
3. mutate through governed authority;
4. execute targeted qualification;
5. diagnose failures;
6. repair forward;
7. re-run qualification;
8. execute canonical regression when required;
9. stop at GREEN or a genuine authority boundary.

The system MUST NOT weaken valid tests, security controls, deterministic
invariants or accepted expectations merely to obtain GREEN.

Failure is evidence, not permission to bypass governance.

## 7. Contextual human approval UX

When additional authority is required, NATURAL SHALL explain the requested
operation in human-understandable terms.

Approval UX SHOULD communicate:

- what operation is requested;
- why it is required;
- relevant scope;
- whether authorization is one-time or mission-scoped;
- what authority is explicitly not being granted.

Approval MUST remain subordinate to the deterministic authority mechanisms.

Human-friendly UX SHALL NOT become an alternate authority channel.

## 8. Governed checkpoints

When permitted by the mission authority, NATURAL MAY create local governed
checkpoints after coherent GREEN states.

Checkpoint creation SHALL remain subject to:

- repository/workspace identity;
- applicable CAS;
- staged-scope inspection;
- deterministic qualification;
- human authority policy;
- journal/audit requirements.

A checkpoint MUST NOT imply authorization for:

- push;
- tag creation or movement;
- release;
- publication;
- external network mutation.

Those remain independent authority classes.

## 9. Session interruption and redirection

The human SHALL be able to interrupt, cancel or redirect a mission.

Interruption MUST NOT corrupt deterministic state.

Redirection that changes material scope SHALL cause authority to be reevaluated.

The system MUST preserve legitimate completed work unless an independently
authorized operation changes it.

## 10. Governed resume

NATURAL SHALL support continuation from durable governed checkpoints.

Resume MUST be based on revalidated physical evidence.

A conversation transcript, summary or persistent memory MAY assist cognition,
but MUST NOT independently restore operational authority.

When resumability evidence conflicts with physical state, physical governed
state is sovereign and continuation MUST fail closed or re-plan.

## 11. User-facing deterministic projections

The NATURAL experience SHOULD expose concise projections comparable to:

- `/status`
- `/plan`
- `/changes`
- `/tests`
- `/authority`
- `/journal`
- `/resume`

These names are product-interface recommendations, not mandatory command syntax.

Equivalent natural-language interactions MAY expose the same projections.

Such projections SHALL only reveal existing governed state.

They MUST NOT create authority by observation.

## 12. Status projection

A status projection SHOULD include, where applicable:

- project/workspace;
- interaction mode;
- mission identity or description;
- mission state;
- current plan progress;
- current HEAD/repository state;
- worktree classification;
- last qualification result;
- active authority classes;
- explicitly unavailable authority classes.

The projection MUST distinguish observed facts from planned operations.

## 13. Evidence and transcript summarization

The system SHALL maintain auditable evidence according to existing journal and
governance contracts.

NATURAL MAY project a concise human-readable summary of:

- operations performed;
- files changed;
- tests executed;
- failures diagnosed;
- repairs made;
- checkpoints created;
- remaining limitations.

Summary compression MUST NOT replace required durable evidence.

## 14. Final mission report

A completed engineering mission SHOULD produce a final report containing, when
applicable:

- objective;
- initial governed state;
- material findings;
- changes made;
- qualification performed;
- complete canonical test result;
- local commits/checkpoints created;
- final repository/workspace identity;
- remaining limitations;
- next milestones outside the completed scope;
- operations explicitly not performed.

The final report MUST NOT claim operations or qualification that were not
physically evidenced.

## 15. NATURAL-only experience simplification

This ADR primarily governs the NATURAL experience.

ENGINEER and EXPERT SHALL remain distinct interaction profiles.

They MAY expose additional technical detail or lower-level control.

NATURAL simplification MUST NOT silently alter ENGINEER or EXPERT semantics.

## 16. Existing sandbox architecture remains sovereign

This ADR does not define a new sandbox.

The existing cross-platform sandbox architecture remains authoritative.

Linux, Windows and macOS MAY use platform-specific physical mechanisms while
preserving the already-governed sandbox semantics.

NATURAL SHALL consume the governed execution surface exposed by that
architecture rather than bypassing or replacing it.

## 17. Model authority remains NONE

The cognitive model SHALL NOT receive direct authority over:

- filesystem mutation;
- unrestricted shell/process execution;
- Git mutation;
- network mutation;
- credentials;
- secrets;
- release;
- publication;
- platform sandbox controls.

Every physical effect remains mediated by deterministic governed components and
human authority.

## 18. Sensitive-content boundary

Content destined for cognition MUST continue to respect the governed
sensitive-content boundary.

The agentic experience MUST NOT increase the amount of secret or sensitive
content exposed to a provider merely for convenience.

Inspection/redaction/denial requirements remain fail-closed.

## 19. Command and tool mediation

Agentic continuity SHALL use qualified/governed operation surfaces.

The experience MUST NOT obtain continuity by providing unrestricted native
primitives directly to the model.

Tool execution remains subordinate to:

- qualified command/catalog rules where applicable;
- authority envelopes;
- physical identity;
- workspace confinement;
- CAS;
- journaling/audit;
- sensitive boundaries;
- fail-closed behavior.

## 20. No authority amplification through convenience

The following equivalences are explicitly forbidden:

- read authority != write authority
- write authority != shell authority
- shell authority != network authority
- local commit authority != push authority
- repository access != release authority
- mission continuity != permanent authority
- remembered approval != current authority
- GREEN targeted test != GREEN canonical qualification
- sandbox availability != model authority

## 21. Fail-closed experience

If evidence is incomplete, state is stale, identity cannot be revalidated,
authority is ambiguous, CAS mismatches, sensitive policy cannot be established,
or a required qualification result is unavailable, the agentic experience MUST
fail closed.

A friendly NATURAL interface MUST never convert uncertainty into presumed
permission or presumed success.

## 22. Product objective

The intended user experience is:

> The human describes the engineering objective. Surgical DevOps establishes a
> governed mission, plans, investigates, reports meaningful progress, performs
> authorized work, diagnoses and repairs failures, qualifies the result, creates
> permitted checkpoints, and reports completion — while deterministic authority
> remains sovereign throughout the entire process.

The objective is experiential parity with a modern agentic engineering
workflow, not replication of another product's internal implementation.

Surgical DevOps preserves its defining property:

> agentic capability without transferring sovereign machine authority to the
> cognitive model.

## Consequences

### Positive

- NATURAL becomes substantially closer to the interaction quality of modern
  agentic engineering environments.
- Users no longer need to operate the terminal manually for every already
  authorized micro-operation.
- Long engineering missions become understandable through live plans and status.
- Failure diagnosis and repair become a first-class continuous workflow.
- Cross-platform users receive the same governed product experience over the
  existing sandbox architecture.
- Deterministic governance remains independent from provider/model capability.

### Costs

- Mission-state management becomes a product contract.
- Resume requires rigorous revalidation.
- Approval UX must remain synchronized with underlying authority.
- More adversarial qualification is required for interruption, stale authority,
  CAS invalidation, resumption and repair loops.
- Human-friendly projections must remain provably non-authoritative.

## Qualification requirements

ADR-036 SHALL NOT be considered fully implemented merely because this document
exists.

Qualification requires executable evidence that the production NATURAL path
supports the frozen behaviors without weakening existing invariants.

At minimum, qualification SHOULD cover:

1. persistent governed mission lifecycle;
2. live-plan projection;
3. explicit mission states;
4. progress projection;
5. continuous execution within granted scope;
6. authority invalidation on physical-state change;
7. repair-until-green behavior;
8. contextual authorization;
9. governed local checkpoints;
10. safe interruption/redirection;
11. physical-state-bound resume;
12. `/status`-equivalent projection;
13. `/plan`-equivalent projection;
14. changes/tests/authority/journal projections;
15. sensitive-content enforcement;
16. NATURAL isolation from ENGINEER/EXPERT semantics;
17. adversarial stale-state/CAS/symlink/platform-boundary coverage;
18. canonical regression;
19. multiplatform semantic qualification on Linux, Windows and macOS.

## Frozen invariants

The following are explicitly frozen:

- human authority is sovereign;
- the cognitive model has no direct physical authority;
- BH-SEP v2.2 remains normative;
- BH-SDP v2.2 remains normative;
- strict physical identity and CAS remain normative;
- fail-closed behavior remains normative;
- durability, journal and recovery remain normative;
- existing cross-platform sandbox architecture is preserved;
- NATURAL receives an agentic mission-oriented UX;
- mission continuity does not create authority;
- repair-until-green cannot weaken valid controls;
- friendly projections cannot create authority;
- ENGINEER and EXPERT remain distinct;
- external mutation classes remain independently authorized.

Any material reversal of this decision requires a new ADR.
