# ADR-011 — Intent-Driven Orchestration and User Interaction Modes

**Status:** APPROVED / FROZEN
**Date:** 2026-08-22
**Decision ID:** SDO-9
**Scope:** Surgical DevOps / Orchestrator / Human Interaction / AI Decision Layer
**Extends:** ADR-002, ADR-004, ADR-005, ADR-006, ADR-007, ADR-009 and ADR-010

---

## 1. Context

Surgical DevOps v2.4.1 established a qualified governed execution baseline
including deterministic orchestration, bounded capabilities, human authority,
risk classification, governed reads, governed mutation, journaling, recovery,
content-addressed authority and explicit trust boundaries.

The qualified CLI proves that these mechanisms can be exposed directly to an
operator.

However, requiring a human operator to manually express low-level orchestration
steps such as repository discovery, governed reads, Git inspection, validation,
planning and execution sequencing creates unnecessary operational friction.

This is particularly undesirable when the human knows the desired outcome but
should not need to know the internal command vocabulary required to reach it.

Surgical DevOps therefore requires a higher-level interaction architecture in
which the human primarily expresses intent while an AI reasoning layer may
determine an appropriate procedure under Surgical DevOps governance.

This evolution SHALL NOT weaken the existing authority model.

---

## 2. Decision

Surgical DevOps SHALL evolve from primarily command-driven interaction toward
an intent-driven orchestration model.

The normative high-level flow SHALL be:

Human Intent
→ Interpretation
→ Reasoning
→ Decision
→ Planning
→ Orchestrator Governance
→ Authorization
→ Execution
→ Verification
→ Evidence / Explanation

The human SHALL be able to express the desired objective, constraints and
acceptable authority boundary without manually specifying every internal
operation necessary to achieve that objective.

An AI reasoning provider MAY autonomously determine the operational procedure
required to pursue the declared intent within its granted authority.

The Surgical DevOps Orchestrator SHALL remain the mandatory authority and
governance boundary.

---

## 3. Fundamental Authority Principle

The following distinction is normative:

> AI decision autonomy does not imply unrestricted execution authority.

The AI reasoning layer MAY:

- interpret human intent;
- inspect available governed context;
- formulate hypotheses;
- select relevant artifacts;
- determine inspection procedures;
- choose appropriate validations;
- construct plans;
- choose among permitted operational alternatives;
- make bounded operational decisions;
- propose mutations;
- execute operations for which valid authority has already been granted;
- evaluate results;
- iterate within an authorized objective;
- explain its decisions and evidence.

The AI reasoning layer SHALL NOT, merely because it selected an action:

- grant itself additional authority;
- enlarge workspace scope;
- bypass risk classification;
- bypass capability grants;
- impersonate human authority;
- self-approve operations requiring human approval;
- obtain generic shell authority;
- obtain unrestricted filesystem authority;
- obtain unrestricted Git authority;
- access credentials outside explicitly authorized mechanisms;
- weaken CAS, journal, durability or recovery guarantees;
- redefine architectural policy.

Decision autonomy and execution authority SHALL remain separate concepts.

---

## 4. Human Intent as the Primary High-Level Interface

For intent-driven modes, the primary human input SHALL describe an objective
rather than a sequence of implementation commands.

Example:

"Continue the current implementation, preserve the qualified baseline, run the
relevant tests, and stop if an architectural decision or destructive operation
requires my authority."

The system MAY derive from this intent a sequence such as:

1. repository discovery;
2. state inspection;
3. relevant artifact selection;
4. governed reads;
5. hypothesis generation;
6. validation;
7. patch planning;
8. authorized mutation;
9. test execution;
10. result verification;
11. iteration;
12. escalation when required.

The user SHALL NOT be required to manually express these internal steps unless
the selected interaction mode intentionally exposes them.

---

## 5. Interaction Mode Selectors

Surgical DevOps SHALL support explicit interaction-mode selection according to
the needs and technical profile of the operator.

At minimum, the following modes are frozen.

### 5.1 Natural Mode

Target audience:

- non-technical users;
- product owners;
- domain specialists;
- business users;
- users who primarily understand desired outcomes rather than implementation
  mechanics.

Primary interaction:

Intent → governed autonomous procedure → understandable result.

Internal implementation details SHOULD be hidden by default.

The interface SHOULD expose:

- objective;
- progress;
- important decisions;
- required human choices;
- outcome;
- significant risk;
- understandable evidence.

Low-level Git, CAS, journal, hashes and internal orchestration mechanics SHOULD
remain available for audit but SHALL NOT be required for ordinary interaction.

---

### 5.2 Engineer Mode

Target audience:

- software engineers;
- architects;
- DevOps engineers;
- AI engineers;
- technical project maintainers.

Primary interaction:

Intent → AI reasoning and autonomous planning → governed execution → technical
evidence.

The engineer MAY express constraints such as:

- preserve public API;
- do not refactor;
- maintain backward compatibility;
- remain within specified directories;
- preserve the qualified baseline;
- run specified test classes;
- stop at architectural authority boundaries.

Engineer Mode SHOULD expose:

- plan;
- files inspected;
- hypotheses;
- selected procedure;
- proposed and executed changes;
- diffs;
- tests;
- validation evidence;
- risk classification;
- blockers;
- reasons for escalation.

The engineer SHALL retain the ability to inspect the exact operations selected
by the AI.

---

### 5.3 Expert / Deterministic Mode

Target audience:

- security engineers;
- auditors;
- forensic reviewers;
- maintainers of Surgical DevOps itself;
- qualification operators;
- users requiring direct deterministic control.

Primary interaction:

Explicit governed commands → deterministic execution → exact evidence.

This mode SHALL preserve access to low-level surfaces including, where
applicable:

- governed repository inspection;
- exact Git selectors;
- explicit reads;
- hashes;
- manifests;
- CAS state;
- capability grants;
- journal state;
- recovery evidence;
- policy decisions;
- exact validation operations.

The existing `surgical>` CLI model SHALL be preserved as an Expert /
Deterministic interaction surface.

The introduction of higher-level AI interfaces SHALL NOT remove this mode.

---

## 6. Mode Selection

Interaction mode SHALL be explicitly selectable.

The implementation MAY expose selectors through:

- CLI startup options;
- interactive CLI selectors;
- configuration files;
- graphical interfaces;
- API contracts;
- SDK configuration;
- future product interfaces.

A mode selector changes presentation, interaction abstraction and permitted
automation policy.

A mode selector SHALL NOT silently weaken security invariants.

Changing from Expert to Natural mode, for example, SHALL NOT disable:

- workspace boundaries;
- risk classification;
- capability enforcement;
- human approval requirements;
- journaling;
- CAS;
- recovery;
- audit evidence.

---

## 7. AI Reasoning Layer

Surgical DevOps SHALL support one or more replaceable AI reasoning providers.

The AI reasoning layer is responsible for cognitive functions such as:

Interpret
→ Reason
→ Decide
→ Plan
→ Evaluate
→ Explain

It is not the final execution authority.

The architecture SHALL remain provider-independent.

No OpenAI, Anthropic, Google, local model or other specific AI provider SHALL
become normative to the architecture.

Provider replacement SHALL NOT redefine the authority model.

---

## 8. Orchestrator Authority

The Surgical DevOps Orchestrator remains responsible for determining whether a
selected operation is permitted to execute.

The Orchestrator SHALL continue enforcing, where applicable:

- workspace boundaries;
- repository identity;
- tenant/project context;
- declarative inspection;
- risk classification;
- policy;
- capability grants;
- authenticated human authority;
- operation lifecycle;
- mutation authority;
- content-addressed state;
- locking;
- journaling;
- durability;
- recovery;
- validation;
- evidence generation.

The AI proposes or selects procedure.

The Orchestrator governs authority.

---

## 9. Human Authority

ADR-004 and ADR-006 remain authoritative.

Human architectural authority SHALL NOT be silently transferred to an AI
provider.

Human approval remains mandatory wherever existing or future policy classifies
an operation as requiring human authority.

Examples MAY include:

- architectural boundary changes;
- destructive operations;
- irreversible mutations;
- authority expansion;
- credential/security changes;
- remote publication;
- production deployment;
- release promotion;
- operations classified at a human-approval risk level.

The objective is not to require humans to approve routine mechanics.

The objective is to require human intervention at meaningful authority
boundaries.

---

## 10. Autonomous Work Until Authority Frontier

Intent-driven orchestration SHOULD permit the AI reasoning layer to continue
working autonomously through permitted operations until one of the following
occurs:

1. the objective is achieved;
2. validation fails without a safe permitted recovery path;
3. the authorized scope would need to expand;
4. policy blocks further execution;
5. an architectural decision requires human authority;
6. a destructive or critical operation requires approval;
7. required evidence becomes insufficient;
8. an unrecoverable ambiguity prevents deterministic continuation.

This behavior is referred to as working until the authority frontier.

Routine intermediate steps SHOULD NOT require unnecessary human interaction.

---

## 11. Explainability and Evidence

Autonomous decisions SHALL remain inspectable.

For materially significant decisions, Surgical DevOps SHOULD be capable of
providing evidence including:

- declared human intent;
- interpreted objective;
- constraints;
- inspected state;
- relevant artifacts;
- selected plan;
- alternatives when materially relevant;
- policy decision;
- risk classification;
- authority used;
- operations executed;
- mutations performed;
- validations executed;
- final outcome;
- reason for any escalation.

Natural Mode MAY summarize this information.

Engineer Mode SHOULD expose technical evidence.

Expert / Deterministic Mode SHALL preserve exact evidence required for
qualification and audit.

---

## 12. Progressive Disclosure

The three modes SHALL represent progressive disclosure of the same governed
system rather than three independent orchestration engines.

Conceptually:

Natural
    ↓ more technical visibility
Engineer
    ↓ full deterministic visibility
Expert / Deterministic

All modes SHALL converge on the same normative governance core.

This prevents the creation of a less secure "easy mode".

---

## 13. Preservation of Qualified Core

The intent-driven interaction layer SHALL be built above the qualified
Surgical DevOps governance and execution core.

Implementation SHALL prefer extension and composition over unnecessary rewrite
of already-qualified components.

The v2.4.1 qualified baseline SHALL serve as the starting authority for this
evolution.

Existing qualified behavior SHALL NOT be weakened merely to simplify natural
language interaction.

---

## 14. Failure Semantics

Ambiguous intent SHALL NOT automatically become broad authority.

When the system cannot safely determine a permitted interpretation, it SHALL:

- narrow the action;
- remain read-only where appropriate;
- request clarification when necessary; or
- stop at the authority frontier.

Provider failure SHALL NOT bypass governance.

Reasoning-provider unavailability SHALL NOT corrupt execution authority.

Malformed or adversarial model output SHALL be treated as untrusted input to
the Orchestrator.

---

## 15. Security Boundary

AI-generated plans, commands, patches, arguments and operation requests SHALL
be treated as untrusted until validated through the Surgical DevOps governance
boundary.

Prompt content SHALL NOT itself constitute execution authority.

Natural-language intent SHALL NOT itself constitute unrestricted capability.

The authority chain remains explicit and mechanically enforceable.

---

## 16. Product Architecture Consequence

Surgical DevOps becomes a progressively accessible governed engineering
platform.

The product MAY serve:

- non-technical users through Natural Mode;
- professional developers through Engineer Mode;
- auditors and advanced operators through Expert / Deterministic Mode.

These are interaction profiles over the same authority architecture.

They are not separate security models.

---

## 17. Canonical Principle

The following principle is frozen:

> Human declares intent.
> AI decides the permitted procedure.
> Surgical DevOps governs authority.
> Execution remains bounded, verifiable and recoverable.

Equivalent operational form:

INTENT
→ REASON
→ DECIDE
→ PLAN
→ GOVERN
→ AUTHORIZE
→ EXECUTE
→ VERIFY
→ EXPLAIN

---

## 18. Rejected Alternatives

### 18.1 Command-only interaction

Rejected as the exclusive interaction model because it unnecessarily transfers
internal orchestration complexity to the human operator.

It remains valid for Expert / Deterministic Mode.

### 18.2 AI as unrestricted execution authority

Rejected because autonomous reasoning does not justify unrestricted shell,
filesystem, Git, credential or mutation authority.

### 18.3 Separate simplified orchestration engine

Rejected because an independent "easy" execution engine could bypass or diverge
from the qualified governance core.

### 18.4 Fixed AI provider

Rejected because Surgical DevOps is provider-independent.

### 18.5 Human approval for every internal step

Rejected because it defeats the purpose of autonomous orchestration and creates
unnecessary operational latency.

Human approval SHALL instead occur at meaningful authority boundaries.

---

## 19. Implementation Direction

Implementation SHOULD proceed incrementally.

A preferred sequence is:

1. interaction-mode contract;
2. explicit mode selector;
3. provider-neutral AI reasoning interface;
4. natural-language intent contract;
5. structured intent representation;
6. planning contract;
7. governed read/discovery integration;
8. bounded autonomous iteration;
9. human authority-frontier escalation;
10. Engineer Mode evidence surface;
11. Natural Mode progressive-disclosure surface;
12. preservation and integration of Expert / Deterministic CLI;
13. end-to-end qualification across modes.

Each implementation frontier SHALL preserve the qualified baseline until the
new behavior is independently validated.

---

## 20. Frozen Decision

The following decisions are APPROVED and FROZEN:

1. Surgical DevOps SHALL support intent-driven orchestration.
2. Humans MAY primarily declare objectives instead of low-level procedures.
3. AI reasoning MAY autonomously interpret, reason, decide and plan.
4. AI decision autonomy SHALL remain distinct from execution authority.
5. The Surgical DevOps Orchestrator remains the mandatory governance boundary.
6. Existing human architectural and critical operational authority is
   preserved.
7. Natural Mode SHALL target non-technical interaction.
8. Engineer Mode SHALL target autonomous engineering with technical evidence.
9. Expert / Deterministic Mode SHALL preserve direct deterministic control.
10. The existing `surgical>` interface SHALL remain available as an Expert /
    Deterministic surface.
11. All modes SHALL use the same normative governance core.
12. Mode selection SHALL NOT weaken security guarantees.
13. AI providers SHALL remain replaceable and non-authoritative.
14. The AI SHOULD work autonomously until reaching an authority frontier.
15. Material decisions SHALL remain explainable and auditable.
16. Existing qualified execution, CAS, journal, recovery and authority
    invariants SHALL be preserved.
17. The intent-driven layer SHALL be built above the qualified core rather than
    replacing it without justification.
18. Any future proposal granting unrestricted execution authority to an AI,
    eliminating meaningful human authority, or weakening the common governance
    core requires a new ADR explicitly superseding this decision.

---

## 21. Decision Authority

**Decision:** APPROVED / FROZEN

**Date:** 2026-08-22

**Authority:** Project authority through explicit architectural decision.

This ADR extends the existing Surgical DevOps authority model without
superseding the trust, human-authority, mutation, recovery or
content-addressed-authority guarantees established by previous ADRs.
