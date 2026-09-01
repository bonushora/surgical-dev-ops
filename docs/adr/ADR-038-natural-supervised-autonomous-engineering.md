# ADR-038 — NATURAL Supervised Autonomous Engineering

- **Status:** ACCEPTED / FROZEN
- **Date:** 2026-09-01
- **Scope:** Surgical DevOps / next NATURAL engineering milestone
- **Decision authority:** Human
- **Supersedes:** None
- **Extends:** ADR-004, ADR-006, ADR-007, ADR-008, ADR-009, ADR-010,
  ADR-011, ADR-012, ADR-013, ADR-014, ADR-019, ADR-024, ADR-025, ADR-028,
  ADR-032, ADR-033, ADR-034, ADR-036 and ADR-037

## Context

NATURAL already provides governed objectives, persistent missions, bounded
authority envelopes, repair-until-green behavior, an integrated governed-agent
gateway and deterministic conversational projections. Those decisions establish
that cognition may continue inside granted authority while the Surgical DevOps
Orchestrator remains the sole operational boundary.

The next milestone must make the resulting engineering behavior explicit. A
human should be able to authorize a legitimate engineering mission instead of
manually orchestrating each command, while neither the cognitive model nor the
mission acquires sovereign machine authority.

This ADR defines that normative engineering contract. It is an architectural
decision only. It does not implement, enable or qualify new runtime authority.

## Decision

NATURAL SHALL evolve from a governed assisted orchestrator into a governed
supervised autonomous engineering system.

The constitutional objective is:

> Allow an AI to investigate, modify, test, repair and qualify software
> continuously within an explicitly authorized engineering mission without
> granting the model sovereignty over the machine.

The governing principle is:

> **MAXIMUM ENGINEERING AUTONOMY INSIDE MINIMUM NECESSARY AUTHORITY.**

The existing constitutional invariant remains authoritative:

> **AI THINKS / REQUESTS.**
>
> **SURGICAL DECIDES / EXECUTES.**

Model intention MUST NOT equal operational permission. Deterministic
infrastructure remains the operational authority. Human authority remains
sovereign.

## 1. Objective-first engineering

NATURAL SHALL accept engineering objectives rather than requiring the human to
orchestrate individual commands.

Representative objectives include:

- fix this regression until green;
- implement this accepted ADR;
- qualify this release candidate;
- investigate and repair this failure;
- make this subsystem review-ready.

The system SHALL derive and maintain a governed mission containing at least:

- objective;
- canonical physical workspace;
- repository identity;
- physical baseline;
- authorized scope;
- invariants;
- acceptance criteria;
- authority envelope;
- current plan;
- governed evidence;
- progress;
- terminal conditions.

Mission derivation is not authority creation. A derived field becomes
operationally relevant only after the deterministic layer validates it against
physical state, policy and applicable human authority.

## 2. Mission-scoped autonomy

After a human has explicitly authorized a valid engineering mission and the
deterministic authority layer has materialized its bounded authority envelope,
ordinary work necessary to pursue that mission SHOULD proceed without repeated
human interruption while it remains inside that envelope.

Depending on the mission, contained classes of work MAY include:

- repository inspection;
- file reading and governed search;
- code navigation and diagnostics;
- local edits;
- creation or update of legitimate regression tests;
- focused, adjacent, subsystem and canonical tests;
- lint, type checks and builds;
- cross-platform qualification;
- package dry-runs;
- diff inspection and `git diff --check`;
- evidence-based repair iterations;
- evidence collection and local qualification;
- coherent governed local checkpoints when mission policy permits them.

Human authorization MAY apply to a legitimate class of work within one mission.
It need not be represented to the human as approval for each underlying syscall
or command.

The deterministic layer MUST still validate every requested physical operation
against the active objective, physical state, workspace, scope, capability,
policy, risk, CAS and authority contract. Mission authority MUST NOT be exposed
to a model as unrestricted shell, filesystem, Git, network or process access.

## 3. Authority-envelope contract

An authority envelope SHALL be:

- human-authorized where human authority is required;
- bound to one mission identity and objective;
- bound to the canonical physical workspace and repository;
- bound to a validated physical baseline and relevant state/CAS evidence;
- limited to explicit operation classes, targets, risk and side-effect classes;
- time-, state- or terminal-condition-bounded as applicable;
- revocable;
- auditable;
- fail-closed under ambiguity or invalidation.

The authority broker MAY materialize narrower per-operation capabilities from a
valid mission envelope. It SHALL NOT materialize authority outside that envelope
or let a provider manufacture, infer, cache, replay or extend authority.

At any time, the system SHALL be able to answer deterministically:

> What can you do now without asking me?

The answer MUST derive from the active mission authority envelope and current
physical state, not from conversation memory or model interpretation.

## 4. Genuine human-authority boundaries

The system MUST stop and obtain explicit human authorization before crossing a
genuine authority boundary. At minimum, separate authorization is required for:

- push;
- merge;
- tag creation;
- tag movement;
- tag reuse;
- GitHub Release or equivalent release publication;
- npm or other package publication;
- deployment;
- production mutation;
- secret access or disclosure beyond an already authorized boundary;
- expansion outside the authorized workspace or repository;
- material expansion of mission scope;
- policy mutation;
- security-boundary weakening;
- modification of an ACCEPTED / FROZEN architectural decision;
- a new architectural decision not already authorized;
- destructive recovery;
- irreversible external side effects;
- privilege escalation;
- any operation classified by policy as requiring human authority.

The broker SHALL bind authorization to the concrete operation and its relevant
physical state. Approval for one authority class MUST NOT imply another:

- push authority does not imply merge authority;
- merge authority does not imply tag authority;
- tag authority does not imply release authority;
- release authority does not imply package-publication authority;
- publication authority does not imply deployment or production-mutation
  authority.

Authorization MUST NOT be laundered through a broad objective, prior success,
tool availability, provider capability, remembered consent or a prior mission.

## 5. Physical state is authoritative

Memory, conversation history, provider output, plans, summaries and model claims
are not operational authority.

Authoritative evidence MAY include:

- filesystem state;
- canonical physical workspace identity;
- Git refs, commits, index and worktree;
- hashes and applicable CAS state;
- CI and exact-SHA test results;
- process state;
- manifests and journals;
- signed or otherwise qualified authority evidence.

Facts cached or summarized for cognition remain subordinate to fresh physical
validation whenever the governing contract requires it. A hypothesis never
becomes physical truth through repetition or confidence.

## 6. Fail-closed ambiguity and continuity

The system MUST stop rather than guess when physical continuity or authority is
ambiguous. Examples include:

- unexpected HEAD or branch;
- unexplained worktree, index or untracked state;
- unknown files within the proposed mutation set;
- CAS mismatch or changed remote anchor;
- physical workspace identity mismatch;
- conflicting frozen decisions;
- insufficient or contradictory evidence;
- interrupted work that cannot be attributed safely;
- unexpected surviving processes or artifacts;
- an authority envelope that no longer matches the requested operation.

Fail-closed suspension MUST preserve evidence. Legitimate interrupted work MUST
NOT be reset, cleaned, overwritten or discarded merely to obtain a clean state.

## 7. Investigate before mutating

The normal supervised engineering sequence SHOULD be:

objective
→ physical state
→ reproduce
→ investigate
→ hypothesis
→ regression evidence
→ minimal repair
→ focused qualification
→ adjacent qualification
→ broader or canonical qualification
→ diff audit
→ checkpoint
→ authority boundary or terminal result

The model MAY formulate hypotheses and propose actions. The deterministic layer
SHALL distinguish those from observed facts, derived evidence and qualified
conclusions.

Speculative mutation without reasonable evidence SHOULD NOT be the default.

## 8. Minimal change principle

The system SHALL prefer the smallest defensible change that resolves the proven
cause while preserving the authorized baseline.

It SHOULD avoid:

- unrelated refactoring;
- opportunistic cleanup;
- unrelated formatting;
- silent dependency expansion;
- architecture changes disguised as repairs;
- widening authority merely to simplify implementation.

The resulting diff SHOULD remain coherent and reviewable by another engineer.

## 9. GREEN must not be manufactured

The system MUST NOT obtain GREEN by weakening a legitimate contract. It SHALL
NOT:

- delete legitimate tests merely because they fail;
- loosen security checks without explicit architectural authority;
- convert failures into ignored results;
- expand permissions silently;
- bypass applicable CAS;
- bypass workspace confinement;
- suppress evidence;
- reinterpret an invariant solely to make a suite pass.

If a test contains an invalid assumption, changing the test requires physical
evidence that the production contract is correct and the test premise is wrong.

## 10. Regression-oriented repair

When practical, a discovered defect SHOULD become durable regression coverage.
Qualification SHOULD prove not only that the immediate symptom disappeared but
that the relevant failure class is protected.

Regression evidence MUST remain legitimate. It cannot redefine an accepted
contract merely to conform to an implementation defect.

## 11. Layered qualification and truthful GREEN levels

Qualification SHOULD proceed economically from narrow to broad:

focused
→ adjacent
→ subsystem
→ cross-platform or security when affected
→ canonical
→ adversarial or UX when affected
→ packaging or release-readiness gates when applicable

The selected depth SHALL follow the changed surface, applicable invariants and
acceptance criteria. Narrow evidence MUST NOT be represented as broad evidence.

Where applicable, the system SHALL distinguish at least:

- `LOCAL GREEN`;
- `REMOTE GREEN`;
- `POST-MERGE GREEN`;
- `RELEASE QUALIFIED`.

A local result MUST NOT be represented as remote or release GREEN. Remote and
post-merge evidence MUST be bound to the exact qualified SHA. A workflow run for
a different SHA is not reusable qualification evidence.

## 12. Repair until green without blind loops

Inside a valid mission envelope, a failed test is normally evidence for the next
engineering iteration rather than an automatic return to the human.

The loop MAY continue:

failure
→ diagnosis
→ evidence
→ repair
→ requalification

only while:

- scope remains authorized;
- authority and physical bindings remain valid;
- progress remains evidence-based;
- frozen invariants remain intact;
- no genuine authority boundary is crossed.

`Until green` MUST NOT mean indefinite repetition. Every retry or repair
iteration SHOULD be justified by new evidence, a refined hypothesis or a
concrete corrective action. Repeated failures without meaningful progress MUST
trigger deeper diagnosis or human escalation rather than a blind loop.

## 13. Intelligent escalation

When human input is required, NATURAL SHOULD present the engineering decision,
not merely expose a low-level command.

The escalation SHOULD explain:

- what has been proven;
- what remains uncertain;
- why current authority is insufficient;
- available alternatives;
- relevant risks and trade-offs;
- the exact additional authority or decision requested.

Technical difficulty alone is not an authority boundary. Material ambiguity,
scope expansion, architectural choice, policy conflict or reserved external
effect is.

## 14. Interruption and resume

A governed engineering mission SHALL be designed to resume after:

- terminal closure;
- process crash;
- provider failure;
- network loss;
- machine restart;
- power outage;
- conversational or session interruption.

Before further mutation, resume MUST reconstruct physical continuity, including
the current workspace identity, repository state, worktree/index, relevant
process and artifact state, durable journal/CAS state and active authority.

Resume SHALL distinguish a legitimate interrupted repair from an ambiguous or
foreign mutation. It SHALL preserve attributable interrupted work and continue
from it when the mission, physical state and authority contract remain valid.
It SHALL fail closed when attribution or continuity cannot be proven.

Historical authority MUST NOT be resurrected merely because historical mission
state survived.

## 15. Meaningful checkpoints

Checkpoints SHOULD represent coherent, reviewable and appropriately qualified
units of engineering progress. The system SHOULD avoid commit spam and MUST NOT
use commits to conceal unfinished or unrelated work.

Checkpoint policy remains subordinate to mission authority, exact staged-scope
inspection, Git governance, applicable CAS, journal/audit requirements and
qualification state.

A local checkpoint creates no push, merge, tag, release, publish or deployment
authority.

## 16. Git and CI as engineering evidence

Git history is an audit trail. Commits SHOULD communicate coherent engineering
intent and preserve reviewability.

CI is complementary qualification authority. The system SHALL associate remote
qualification with exact commits and workflow runs. It MUST NOT reuse an old run
as evidence for another SHA or infer publication authority from a green run.

Git state and CI state SHALL be physically revalidated before consequential
remote operations.

## 17. Cross-platform engineering is first-class

Linux, macOS and Windows SHALL be treated as physically distinct execution
environments.

The system MUST NOT assume equivalence of:

- lexical paths;
- filesystem identity;
- symlink or junction semantics;
- process and shell behavior;
- durability and atomic-replacement semantics;
- case, alias or traversal behavior.

Existing cross-platform physical-identity, canonicalization, confinement,
symlink, junction, traversal, alias and TOCTOU protections remain mandatory.
Unsupported guarantees fail closed rather than being simulated or claimed.

## 18. Deterministic observability projections

NATURAL SHOULD allow users to operate by objective and ordinary language. It
SHOULD also expose deterministic projections conceptually equivalent to:

- `/status`;
- `/plan`;
- `/authority`;
- `/evidence`;
- `/diff`.

These projections reveal governed state. They do not create an independent
source of truth or authority.

The system SHALL distinguish in projections and reports:

- observed fact;
- derived evidence;
- engineering hypothesis;
- proposed action;
- qualified conclusion.

## 19. No hidden model sovereignty

No cognitive model, provider, agent or coordinator SHALL independently obtain
unrestricted:

- shell or process execution;
- filesystem access or mutation;
- Git mutation;
- network mutation;
- secret access;
- release, publication or deployment;
- privilege escalation.

The model expresses intent. The governed deterministic layer validates,
authorizes, executes, records or refuses the operation.

Tool availability is not authority. Provider confidence, specialization,
consensus or prior success is not authority.

## 20. Scope containment

If pursuing a mission requires material expansion into another repository,
workspace, unrelated subsystem, external service, architectural decision or
frozen architectural change, the system MUST recognize and present that
boundary before crossing it.

The model MUST NOT silently widen a mission to make implementation easier.

## 21. Sensitive-content boundary

Sensitive content SHALL remain governed before provider exposure. The system
MUST inspect, classify, minimize, redact, transform or deny content according to
policy before it reaches a cognitive provider.

Changing providers MUST NOT change this boundary. Provider convenience,
debugging value or mission urgency does not authorize secret disclosure.

## 22. Provider independence

The operational contract SHALL remain invariant across cognitive providers.
Local and remote providers are replaceable cognitive components, not security
principals with sovereign operational authority.

Provider replacement MUST NOT expand the active authority envelope, weaken
workspace confinement, bypass sensitive-content governance or change the
meaning of a qualification result.

## 23. Engineering economy

Time, compute, provider usage and human attention are engineering resources.

When equivalent safe paths exist, the system SHOULD prefer the least expensive
diagnostic or qualification action that preserves evidence quality and safety.
It SHOULD increase qualification depth as the changed surface and evidence
require.

Human interruption is also a cost. It SHOULD be reserved for genuine authority,
scope or engineering-decision boundaries rather than mechanical ceremony.

Economy MUST NOT justify skipped mandatory qualification, weakened evidence or
broader authority.

## 24. Terminal engineering report

At mission completion or suspension, NATURAL SHOULD provide a concise
engineering decision report containing, when applicable:

- objective and result;
- root cause;
- relevant physical evidence;
- files changed;
- regression protection;
- qualification performed and exact totals;
- exact Git SHA;
- worktree and index state;
- CI and workflow-run evidence;
- authority consumed;
- authority explicitly not exercised;
- residual risks;
- next genuine authority boundary.

A raw terminal transcript is not a substitute for an engineering conclusion.
The report MUST NOT claim effects or GREEN levels unsupported by physical
evidence.

## 25. Preserved non-regression invariants

This decision explicitly preserves:

- strict applicable CAS and Manifest CAS authority;
- fail-closed behavior;
- canonical physical workspace identity;
- workspace confinement;
- symlink, junction, traversal, alias and TOCTOU protections;
- governed and content-minimized evidence;
- mutation journal, durability and recovery contracts;
- human sovereignty;
- provider isolation;
- sensitive-content governance;
- deterministic operational authority;
- cross-platform qualification;
- separation between NATURAL, ENGINEER and EXPERT experiences.

NATURAL simplification is an interaction and supervision improvement. It MUST
NOT weaken governance.

This ADR makes no new claim that ADR-009 strict pathname CAS or universal
power-loss safety is qualified. The qualified content-addressed Manifest CAS,
physical adapter and recovery contracts remain authoritative for their exact
proven scope.

## 26. Testable acceptance contract

Future runtime implementation is accepted only when observable tests prove all
of the following:

### A. Authorized local repair continuity

An authorized local repair mission can inspect, edit, test, diagnose and repair
repeatedly without per-command human approval while every operation remains in
its valid authority envelope.

### B. Push boundary

The same mission stops before push unless push authority is explicitly granted
for the concrete remote operation and physical state.

### C. Push does not imply merge

Push authority cannot authorize merge.

### D. Merge does not imply release effects

Merge authority cannot authorize tag creation or movement, release, package
publication or deployment.

### E. Unexpected physical state

An unexpected branch, HEAD, workspace identity, worktree/index, CAS, remote
anchor, process or mutation-set state suspends the mission fail-closed.

### F. Resume revalidation

Resume revalidates physical state and active authority before any mutation.

### G. Interrupted-work preservation

Legitimate attributable interrupted work is preserved and is not reset or
discarded as a cleanliness shortcut.

### H. Deterministic authority mediation

A model cannot bypass, replace or self-approve through the deterministic
authority layer.

### I. Provider invariance

Replacing the cognitive provider does not expand operational authority or alter
security semantics.

### J. Scope expansion

Expansion to another repository, workspace, unrelated subsystem, service or
material mission scope triggers a human-authority boundary.

### K. Frozen architecture

An ACCEPTED / FROZEN decision cannot be modified as an ordinary repair.

### L. Evidence-driven repair iteration

Failed tests can drive diagnosis and further repair iterations inside valid
authority without being hidden or automatically escalated.

### M. Non-progress termination

Repeated iterations without meaningful new evidence or corrective action stop
or escalate instead of looping indefinitely.

### N. Truthful GREEN and exact SHA

LOCAL GREEN, REMOTE GREEN, POST-MERGE GREEN and RELEASE QUALIFIED are represented
accurately, and remote evidence is associated with the exact SHA it qualified.

### O. Sensitive-content mediation

Sensitive-content policy is enforced before any provider exposure, including
after provider replacement or resume.

### P. Cross-platform physical security

Linux, macOS and Windows qualification preserves physical identity, canonical
root, confinement, symlink/junction/traversal/alias/TOCTOU and applicable CAS
invariants.

### Q. Visible authority

The human can deterministically inspect the current mission authority envelope,
including explicitly unavailable authority classes.

## 27. Relationship to existing ADRs

This ADR extends existing decisions and does not silently supersede any of their
security contracts.

- **ADR-004 and ADR-006:** the Orchestrator remains the mandatory trust boundary,
  and authenticated human authority remains the source of reserved operational
  authority.
- **ADR-007 through ADR-010:** mutation, recovery, native Windows safety and
  durability, physical identity and applicable CAS retain their qualified
  meanings and explicit non-claims.
- **ADR-011 through ADR-014:** objective-first interaction, mode separation,
  provider independence, agent subordination, evidence-based behavior and
  mechanical enforcement remain authoritative.
- **ADR-019:** cognitive proposals remain non-authoritative; this ADR adds a
  supervised mission loop, not direct provider mutation power.
- **ADR-024:** existing task envelopes remain bounded. This ADR does not silently
  reinterpret an old read-only or exact-patch envelope as mutation authority.
- **ADR-025:** cross-platform CI and exact-SHA evidence remain complementary
  qualification; release and external publication remain separate effects.
- **ADR-028 and ADR-032:** the qualified exact-patch G1–G10 path remains valid
  and unchanged for its scope. This ADR does not turn a historical G4 approval
  into mission authority or bypass its R3, journal, anti-replay or Manifest CAS
  mechanics. A future mission-scoped mutation implementation requires its own
  deterministic, adversarial and cross-platform qualification.
- **ADR-033:** RUNNER remains continuity within already materialized authority,
  never a phrase that creates authority. This ADR defines the richer engineering
  mission that a governed runner may supervise.
- **ADR-034:** canonical physical-root discovery, workspace confinement,
  qualified command mediation and sensitive evidence boundaries remain
  mandatory.
- **ADR-036:** this ADR makes its persistent mission, repair-until-green,
  interruption and governed-checkpoint model an explicit engineering behavior
  contract.
- **ADR-037:** this ADR consumes its provider-independent gateway, approval
  broker, structured evidence, tool mediation and conversational projections;
  it does not create an alternate execution path.

If future implementation discovers an actual conflict with an ACCEPTED / FROZEN
decision, it MUST stop for human architectural authority. It MUST NOT resolve
the conflict through implementation convenience or implicit supersession.

## 28. Consequences

### Positive

- humans authorize engineering objectives and meaningful authority classes
  rather than micromanaging commands;
- routine engineering can proceed continuously to GREEN inside a narrow
  deterministic envelope;
- real authority boundaries become visible and auditable;
- interruption recovery, layered qualification and terminal reporting become
  part of the engineering contract;
- provider capability can improve without increasing machine authority.

### Trade-offs

- mission authority and physical continuity require durable, inspectable state;
- the authority broker must bind class-level human intent to narrower
  deterministic operations without authority laundering;
- progress detection and non-progress escalation require explicit evidence;
- cross-platform and adversarial qualification remains mandatory for physical
  or security-sensitive behavior;
- truthful GREEN levels require continued exact-SHA CI correlation.

## 29. Explicit non-claims and implementation boundary

This ADR does not:

- implement runtime behavior;
- grant an existing provider, agent, process or mission new authority;
- modify the qualified G1–G10 execution path;
- qualify a mission-scoped mutation broker;
- authorize unrestricted shell, filesystem, Git, network or secret access;
- authorize push, merge, tag, release, publish, deployment or production
  mutation;
- qualify universal power-loss safety, distributed exactly-once execution or
  ADR-009 strict pathname CAS;
- collapse NATURAL, ENGINEER and EXPERT into one experience.

Runtime delivery requires a separately authorized implementation mission,
incremental mechanical tests, adversarial authority tests and native Linux,
macOS and Windows qualification. No implementation milestone may claim this ADR
complete from documentation acceptance alone.

## 30. Frozen decision

The following are ACCEPTED / FROZEN:

1. NATURAL SHALL support supervised autonomous engineering missions.
2. Maximum engineering autonomy SHALL exist only inside minimum necessary,
   explicit and deterministic authority.
3. AI cognition and operational permission SHALL remain separate.
4. Mission-class authorization MAY reduce repetitive human interruption but
   SHALL NOT expose generic machine authority to a model.
5. Genuine external, destructive, architectural, scope, security and privilege
   boundaries require explicit human authority.
6. Physical evidence, not conversation or memory, is operationally
   authoritative.
7. Ambiguous continuity or authority fails closed while preserving legitimate
   interrupted work.
8. Engineering SHALL be evidence-first, minimally invasive,
   regression-oriented and honestly qualified.
9. Repair-until-green MAY continue inside valid authority; blind loops MAY NOT.
10. GREEN levels and remote qualification SHALL be exact and SHA-bound.
11. Cross-platform physical security is a first-class property.
12. Human authority, deterministic execution, provider isolation,
    sensitive-content governance, CAS, journal, recovery and workspace
    confinement remain non-regression invariants.
13. NATURAL simplification SHALL NOT weaken governance or alter ENGINEER and
    EXPERT authority semantics.
14. Future runtime implementation and every later authority expansion require
    separate authorization and qualification.

**Decision:** ACCEPTED / FROZEN

**Authority:** Project authority through explicit architectural decision.
