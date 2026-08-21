# ADR-004 — Surgical DevOps Orchestrator — Trust Boundary & Secure Execution

**Status:** APPROVED / FROZEN\
**Date:** 2026-08-19\
**Decision ID:** SDO-2\
**Scope:** Surgical DevOps / Surgical DevOps Accelerator\
**Extends:** [ADR-002 — Surgical DevOps Accelerator](./ADR-002-surgical-devops-accelerator.md)\
**Supersedes:** None\
**Related Protocols:** [BH-SEP v2.2 — Safe Evolution Protocol](../../protocols/BH-SEP.md) / [BH-SDP v2.2 — Snapshot & Delivery Protocol](../../protocols/BH-SDP.md)

---

## 1. Context

The Surgical DevOps Accelerator evolves Surgical DevOps from a protocol-governed workflow into a Development Orchestration Layer capable of coordinating multiple agents, tools and execution providers.

This evolution is intended to accelerate engineering work through:

- declarative repository inspection;
- controlled task decomposition;
- parallel analysis and execution;
- mechanical validation;
- provider-independent agent coordination;
- deterministic snapshots and delivery;
- physical verification of repository state.

The same capabilities also increase operational risk. An AI agent with direct and unrestricted terminal access could unintentionally or maliciously:

- modify files outside the authorized repository;
- delete or overwrite unrelated work;
- execute arbitrary shell commands;
- disclose credentials or sensitive data;
- bypass validation or repository state inspection;
- mutate remote systems without adequate authorization;
- create inconsistent concurrent changes;
- make architectural decisions without human approval;
- report success without physical evidence.

Textual instructions alone do not constitute an enforceable security boundary. The system therefore requires a technical control layer between agents and every capability that can read or modify the user's environment.

The architecture must preserve the following previously approved requirements:

- BH-SEP v2.2 and BH-SDP v2.2 remain the independent normative core;
- Declarative Inspection precedes technical changes;
- PATCH mode remains the default intervention strategy;
- physical repository state remains authoritative;
- architectural authority remains human;
- the core remains deterministic and operating-system agnostic;
- Linux, Windows and macOS are supported through isolated infrastructure adapters;
- agents, tools and providers remain replaceable;
- operations fail closed when policy, scope or authorization is insufficient;
- Surgical DevOps remains independent of the Surgical Kernel implementation.

The central architectural question is:

> How can Surgical DevOps obtain the speed and parallelism of agent-based orchestration without granting agents direct, unrestricted or ungoverned access to the user's execution environment?

---

## 2. Decision Drivers

This decision balances the following forces:

1. **Safety** — prevent agents from exceeding authorized scope.
2. **Determinism** — preserve normative behavior across agents, providers and operating systems.
3. **Human authority** — keep architectural and critical operational decisions under human control.
4. **Traceability** — record intent, plan, authorization, execution, validation and outcome.
5. **Portability** — support Linux, Windows and macOS without embedding OS-specific behavior in the core.
6. **Interoperability** — coordinate replaceable agents, tools and providers through explicit contracts.
7. **Recoverability** — preserve sufficient state to stop, resume, compensate or recover when technically possible.
8. **Performance** — enable controlled parallelism and reduce unnecessary manual development cycles.
9. **Worktree preservation** — prevent unrelated or pre-existing modifications from being overwritten.

---

## 3. Decision

The **Surgical DevOps Orchestrator SHALL be the mandatory trust boundary** between AI agents, automated tools, execution providers and every capability able to access or modify the operational environment.

AI agents SHALL NOT receive direct and unrestricted access to the user's terminal.

Every operation capable of affecting the filesystem, Git state, processes, network, credentials, services, remote repositories or external resources SHALL be requested through the Orchestrator and evaluated under Surgical DevOps policies before execution.

The authority chain is:

**Human Authority**\
→ **Approved/Frozen Architectural Decisions**\
→ **BH-SEP + BH-SDP + Security Policies**\
→ **Surgical DevOps Orchestrator**\
→ **Controlled Infrastructure Adapters**\
→ **Authorized Workspace and External Resources**

Agents and providers may propose, analyze and perform authorized work. They SHALL NOT:

- expand their own permissions;
- bypass the Orchestrator;
- redefine policies;
- silently change operational mode;
- approve their own critical operations;
- freeze architectural decisions;
- treat generated statements as physical evidence.

---

## 4. Architectural Position

The Orchestrator is:

- a capability of Surgical DevOps;
- part of the Surgical DevOps Accelerator evolution;
- the control plane for deterministic engineering execution;
- repository-aware but repository-agnostic;
- provider-independent;
- operating-system agnostic at its core;
- independent of the Surgical Kernel runtime;
- responsible for enforcing policy, scope, evidence and execution state.

The Orchestrator is not:

- an unrestricted shell wrapper;
- a replacement for human engineering judgment;
- part of the Surgical Kernel implementation;
- owned by a target repository;
- coupled to a single LLM or coding agent;
- an authority allowed to change frozen architecture autonomously.

The Surgical Kernel and other repositories are targets or consumers of the Orchestrator. They are not implementation owners of the orchestration layer.

---

## 5. Mandatory Operational Pipeline

Every mutating operation SHALL pass through the following minimum states:

1. **Intent Reception** — identify requester, project, workspace and objective.
2. **Declarative Inspection** — collect the required state through read-only capabilities.
3. **Planning** — produce an explicit, bounded and reviewable operation plan.
4. **Policy Evaluation** — determine permissions, risk level and approval requirements.
5. **Snapshot or Checkpoint** — preserve logical state under BH-SDP when required.
6. **Mediated Execution** — invoke only authorized adapters and capabilities.
7. **Validation** — run mechanical checks and compare expected versus observed state.
8. **Diff and Worktree Inspection** — prove the effective scope of repository changes.
9. **Audit Recording** — record decisions, effects, evidence, results and failures.
10. **Explicit Completion or Safe Failure** — terminate without silent continuation after error.

The deterministic pipeline is therefore:

**TASK**\
→ **REPOSITORY DISCOVERY**\
→ **DECLARATIVE INSPECTION**\
→ **HYPOTHESIS**\
→ **RISK AND SCOPE CLASSIFICATION**\
→ **CHANGE PLAN**\
→ **POLICY / HUMAN AUTHORIZATION**\
→ **SNAPSHOT**\
→ **MEDIATED EXECUTION**\
→ **AUTOMATED VALIDATION**\
→ **DIFF / WORKTREE INSPECTION**\
→ **AUDIT RECORD**\
→ **DELIVERY**

Read-only operations MAY use a reduced pipeline, but SHALL remain constrained by workspace, identity, policy and declared purpose.

---

## 6. PATCH Mode

PATCH SHALL remain the default intervention mode.

Technical changes SHOULD be expressed as minimal, reviewable and attributable patches. Whole-file replacement, broad rewriting, unrestricted refactoring and destructive operations SHALL require:

- explicit justification;
- elevated risk classification;
- scope verification;
- applicable snapshot or checkpoint;
- human approval when required by policy;
- post-execution diff and validation.

PATCH mode does not eliminate validation. The Orchestrator SHALL evaluate the effective change set, including:

- renamed and deleted files;
- generated files;
- formatter or build side effects;
- dependency lockfile changes;
- indirect configuration changes;
- modifications to previously dirty worktrees.

Pre-existing or unrelated changes SHALL be preserved and excluded from commits unless explicitly authorized.

---

## 7. Operating-System Independence

The Orchestrator core SHALL operate on logical contracts and remain independent of Linux, Windows and macOS.

Platform-specific behavior SHALL be isolated behind infrastructure adapters, including:

- filesystem access and canonical path resolution;
- Git execution and repository providers;
- process creation and termination;
- shell integration when unavoidable;
- signals and resource limits;
- permissions and process identity;
- physical snapshots and platform-native recovery mechanisms;
- secure credential storage;
- network and service integration.

Every adapter SHALL implement the same security contract and produce normalized evidence.

Platform differences SHALL NOT change the normative meaning of an operation. The same logical policy decision SHALL produce equivalent authorization and safety behavior on every supported platform.

---

## 8. Multi-Agent and Multi-Provider Orchestration

Agents, tools and providers SHALL be replaceable components connected through explicit contracts.

No provider SHALL receive implicit authority or privileged access outside the capabilities granted by the Orchestrator.

Parallel execution MAY occur only when:

- task dependencies are declared;
- scopes are independent or concurrency control is explicit;
- concurrent writes to the same resource are prevented or detected;
- results can be merged and validated deterministically;
- partial failure cannot promote an inconsistent state as successful;
- each sub-operation remains independently traceable.

The Orchestrator SHALL preserve the distinction between:

- **planning authority**;
- **execution capability**;
- **validation evidence**;
- **human approval**.

No single agent output SHALL satisfy all four roles for a critical operation.

---

## 9. Snapshot and Recovery Semantics

BH-SDP SHALL define snapshots at the logical protocol level, independently of the operating system.

Adapters MAY implement snapshots through:

- Git anchors;
- controlled file copies;
- manifests and cryptographic hashes;
- state databases;
- platform-native filesystem snapshots;
- compensating operation records.

The Orchestrator SHALL classify operations as:

- automatically reversible;
- reversible with intervention;
- compensable but not reversible;
- irreversible.

Snapshots SHALL NOT be represented as a universal guarantee of rollback.

Irreversible operations or operations with uncertain recovery SHALL receive higher risk classification and MAY require explicit human approval.

---

## 10. Mandatory Security Criteria

An implementation conforms to this ADR only when all criteria in this section are enforced.

### 10.1 Workspace Boundary

- Paths SHALL be resolved and canonicalized before access.
- Access SHALL be rejected when the resolved target is outside authorized roots.
- `..`, symbolic links, junctions, mounts or equivalent mechanisms SHALL NOT bypass the boundary.
- Unresolved globs, variables and substitutions SHALL NOT silently expand scope.
- Broad targets such as a filesystem root or complete home directory SHALL be invalid by default.
- Existing unrelated worktree changes SHALL be detected before mutation.

### 10.2 Capabilities and Least Privilege

- Every operation SHALL receive only the required read, write, process, Git, network or credential capabilities.
- Capabilities SHALL be denied by default and granted by explicit policy.
- Agents SHALL NOT grant additional capabilities to themselves.
- Privilege elevation SHALL be separate, auditable and proportionate to risk.
- Capability lifetime SHALL be limited to the authorized operation whenever possible.

### 10.3 Process Execution

- Structured process APIs SHALL be preferred over shell command strings.
- Arguments SHALL be transported separately whenever supported.
- Working directory SHALL be explicit.
- Timeouts, output limits and termination policies SHALL be enforced.
- Child processes SHALL inherit only the required environment.
- Recursive, destructive or broad-scope operations SHALL be blocked or elevated for approval.

### 10.4 Network and External Systems

- Network access SHALL be denied by default or constrained by destination and purpose allowlists.
- Download and execution SHALL be treated as separate capabilities.
- External content SHALL be considered untrusted until validated.
- Publishing, sending, sharing and external resource creation SHALL require authorization proportionate to impact.
- Remote mutations SHALL produce identifiable and auditable evidence.

### 10.5 Secrets and Sensitive Data

- Secrets SHALL NOT be included in prompts, logs, patches or artifacts without explicit necessity.
- Credentials SHALL be obtained through platform mechanisms and used only for the authorized operation.
- Logs SHALL redact sensitive values.
- Tokens SHALL NOT be persisted in commands, configuration files or history when a safer mechanism exists.
- Agents SHALL NOT request users to expose credentials through chat or source files.

### 10.6 Integrity, Idempotency and Concurrency

- Mutating operations SHALL have a unique identity and observable state.
- Retries SHALL be idempotent or explicitly classified as non-idempotent.
- Concurrent writes SHALL require locking, serialization or conflict detection.
- Inspected state SHALL be compared with pre-write state when concurrent modification is possible.
- Partial results SHALL NOT be promoted as complete success.
- Commit contents SHALL be explicitly enumerated and SHALL exclude unrelated changes.

### 10.7 Human Approval Proportional to Risk

The Orchestrator SHALL classify operations into at least the following levels:

| Level | Characteristics | Minimum Treatment |
|---|---|---|
| R0 — Observation | Bounded read-only operation with no external effect | Automatic execution with audit record |
| R1 — Reversible local change | Restricted, recoverable patch | Policy-controlled execution and mandatory validation |
| R2 — Sensitive change | Dependencies, configuration, remote Git, services or material data | Policy-defined approval and snapshot/checkpoint |
| R3 — Critical or irreversible | Broad deletion, elevated privilege, publication, secrets or material external impact | Explicit human approval and reinforced evidence |

The detailed taxonomy MAY evolve. The treatment of a critical operation SHALL NOT be silently reduced.

### 10.8 Fail-Closed Behavior

The operation SHALL be blocked when:

- policy is missing, invalid or ambiguous;
- identity or workspace cannot be resolved;
- instructions conflict with a higher authority;
- required approval is absent;
- the adapter cannot guarantee its security contract;
- a mandatory snapshot cannot be created;
- effective execution diverges from the authorized plan;
- validation fails;
- essential audit evidence is lost;
- unrelated worktree modifications would be overwritten.

Safe failure means stopping, preserving evidence and reporting the known state. It does not authorize additional corrective actions outside the approved plan.

---

## 11. Threat Model Summary

| Threat | Mandatory Architectural Control |
|---|---|
| Agent executes arbitrary commands | Exclusive Orchestrator mediation and least-privilege capabilities |
| Workspace escape | Canonical paths, boundary validation and link/mount controls |
| Prompt injection from repository or external content | Inspected data never acquires authority; instruction hierarchy remains enforced |
| Accidental deletion or overwrite | PATCH mode, risk classification, snapshot and proportional approval |
| Overwrite of unrelated worktree changes | Pre-execution status inspection and explicit commit scope |
| Credential disclosure | Minimal environment, redaction and non-persistence controls |
| Inconsistent concurrent writes | Locks, state preconditions and post-execution validation |
| Compromised or defective provider | Contracts, isolation, replaceability and no implicit authority |
| OS-specific semantic divergence | OS-agnostic core and adapter conformance suite |
| Incomplete audit evidence | Operation ledger containing identity, plan, effects, validation and outcome |
| Automation makes architectural decisions | Human authority and formal ADR approval process |

---

## 12. Consequences

### 12.1 Positive Consequences

- AI agents do not require unrestricted terminal access.
- Intelligence and execution authority remain separated.
- BH-SEP and BH-SDP apply uniformly across providers.
- Operations become more reproducible and auditable.
- Linux, Windows and macOS share one normative execution model.
- Controlled parallelism becomes possible.
- Providers can be replaced without redefining governance.
- Worktree preservation becomes an enforceable invariant.
- Policy, approval, snapshot and recovery mechanisms gain a stable architectural foundation.
- Surgical Kernel development can be accelerated without coupling the Kernel to the Orchestrator.

### 12.2 Negative Consequences and Costs

- Implementation is more complex than connecting an agent directly to a shell.
- The Orchestrator becomes a critical security component requiring rigorous testing and hardening.
- Inspection, policy evaluation, snapshot and validation introduce latency.
- Cross-platform adapters increase maintenance and test-matrix costs.
- Some automation remains blocked until specific policies exist.
- Human approvals reduce speed for sensitive operations.
- Recovery claims must be limited to what each adapter can prove.

### 12.3 Residual Risks

This decision reduces but does not eliminate:

- logical errors in authorized policies;
- vulnerabilities in the Orchestrator or its adapters;
- malicious actions by legitimately authorized users;
- external effects without transactional rollback;
- dependence on operating-system security mechanisms;
- incorrect agent results produced within formally valid scope.

These risks SHALL be addressed through defense in depth, code review, isolation, negative testing, observability and controlled policy evolution.

---

## 13. Alternatives Considered

### 13.1 Direct Agent Access to the Terminal

**Description:** Give the agent broad shell access and rely on textual instructions.

**Rejected because:** Textual instructions are not a technical trust boundary. This alternative permits arbitrary commands, workspace escape, secret disclosure and non-deterministic behavior.

### 13.2 Human Confirmation for Every Command

**Description:** Display every low-level command and execute only after individual confirmation.

**Rejected as the primary architecture because:** It creates approval fatigue and does not solve path canonicalization, capabilities, concurrency, indirect effects or audit integrity. Human approval remains required, but it is applied proportionally to risk and supported by a structured plan.

### 13.3 Orchestration Implemented Inside Each Target Project

**Description:** Duplicate agent and security logic in Surgical Kernel, BH-SMC and other repositories.

**Rejected because:** It duplicates protocols, produces divergent policy behavior and couples domain applications to operational infrastructure.

### 13.4 A Separate Development Orchestration Product

**Description:** Create a project independent from Surgical DevOps.

**Rejected because:** Development Orchestration is an approved evolution of Surgical DevOps and SHALL preserve BH-SEP and BH-SDP as its normative core. The capability belongs in the Surgical DevOps repository.

### 13.5 Linux-Specific Core

**Description:** Embed Linux tools and semantics directly in the Orchestrator core.

**Rejected because:** It violates the cross-platform decision and causes normative behavior to differ by operating system. Native platform mechanisms remain permitted only through adapters.

### 13.6 Fully Autonomous Orchestrator

**Description:** Allow the system to expand scope, approve critical operations and make architectural decisions without human intervention.

**Rejected because:** It violates human authority, least privilege and fail-closed behavior. Autonomy SHALL remain operational and policy-bounded.

### 13.7 Single Provider or Agent Dependency

**Description:** Design orchestration around one AI provider or coding agent.

**Rejected because:** It creates lock-in, merges governance with provider capability and weakens conformity testing. Providers SHALL remain replaceable and subordinate to the same contract.

---

## 14. Frozen Invariants

The following invariants may be changed only by a new ADR that explicitly supersedes this decision:

1. AI agents SHALL NOT have direct and unrestricted terminal access.
2. Every mutating operation SHALL be mediated by the Surgical DevOps Orchestrator.
3. The Orchestrator SHALL operate as the trust boundary and evaluate policy before execution.
4. BH-SEP v2.2 and BH-SDP v2.2 SHALL remain the normative core until formally superseded.
5. Architectural authority and critical-operation approval SHALL remain human.
6. Normative behavior SHALL remain deterministic and operating-system agnostic.
7. Platform-specific behavior SHALL remain isolated behind adapters.
8. Workspace boundaries, least privilege, auditability and fail-closed behavior SHALL be mandatory.
9. Development Orchestration SHALL evolve in the Surgical DevOps repository, not in Surgical Kernel.
10. Agents and providers SHALL remain subordinate to the Orchestrator and SHALL receive no implicit authority.
11. Pre-existing and unrelated worktree changes SHALL be preserved.
12. Physical repository state SHALL remain authoritative over agent-generated claims.

---

## 15. Architectural Acceptance Criteria

The Development Orchestration Layer SHALL NOT be declared ready for mutating use until verifiable evidence proves that:

- [ ] no execution path bypasses the Orchestrator;
- [ ] every operation has resolved identity, workspace and policy;
- [ ] reads and writes outside the workspace are blocked;
- [ ] filesystem, Git and process adapters have explicit contracts;
- [ ] Linux, Windows and macOS pass the same normative conformance suite;
- [ ] critical operations require human approval;
- [ ] process timeouts, output limits and termination policies are enforced;
- [ ] secrets are redacted and not improperly persisted;
- [ ] snapshots or checkpoints are created when policy requires them;
- [ ] inspection, policy, execution or validation failures produce fail-closed behavior;
- [ ] concurrent writes are controlled or conflicts are detected;
- [ ] pre-existing worktree changes are preserved;
- [ ] commit scope is explicit and excludes unrelated files;
- [ ] every operation records plan, decision, effects, validation and outcome;
- [ ] providers can be replaced without changing security invariants;
- [ ] negative tests cover path escape, shell injection, symbolic links, broad globs and operation retries;
- [ ] documentation distinguishes reversible, compensable and irreversible actions.

---

## 16. Adoption Strategy

Implementation SHALL proceed incrementally:

1. define core contracts, operation identity and state machine;
2. implement read-only inspection and workspace boundaries;
3. implement policy evaluation and risk classification;
4. introduce controlled filesystem, Git and process adapters;
5. add logical snapshots and the audit ledger;
6. enable PATCH mode with mechanical validation;
7. integrate providers one at a time behind the common contract;
8. enable parallelism only after concurrency controls exist;
9. expand the cross-platform conformance matrix;
10. enable higher-risk operations only after their acceptance criteria are proven.

Every stage SHALL preserve a read-only or fail-closed configuration while mutating capabilities remain incomplete or unvalidated.

---

## 17. Review Triggers

This ADR SHALL be reviewed when any of the following occurs:

- direct terminal access outside the Orchestrator becomes necessary;
- BH-SEP or BH-SDP changes normative execution semantics;
- remote or distributed execution introduces a new trust boundary;
- a sandbox changes the capability model;
- irreversible operations fall outside the defined risk classification;
- a newly discovered threat cannot be mitigated without changing an invariant;
- architectural authority is proposed for transfer to automation;
- the cross-platform scope changes;
- Development Orchestration is proposed for separation into another repository or product.

A review does not automatically change this decision. Any modification to a frozen invariant requires a superseding ADR, explicit human approval and a documented migration path.

---

## 18. Approval Record

This architectural decision was approved and frozen on **2026-08-19**.

It consolidates the approved decisions that:

- Surgical DevOps evolves into a Development Orchestration Layer;
- the Orchestrator is the mandatory trust boundary;
- AI agents do not receive direct and unrestricted terminal access;
- multi-agent and multi-provider orchestration is supported;
- the core remains deterministic and cross-platform;
- operating-system differences remain isolated behind adapters;
- snapshots remain logical and platform-independent at protocol level;
- human authority, least privilege, auditability, worktree preservation and fail-closed behavior remain mandatory.

The implementation details may evolve. The frozen invariants in this ADR may not change without a superseding architectural decision.

---

## Amendment 2026-08-21 — Surgical Human Experience Levels

**Status: APPROVED / FROZEN**

This amendment freezes the human-experience evolution model for Surgical DevOps.

### Canonical human entrypoint

The canonical human-facing entrypoint SHALL be:

`surgical`

The `surgical` command SHALL activate the Surgical DevOps environment for the current authorized workspace.

The command is a human interaction layer over the Surgical DevOps Orchestrator. It SHALL NOT create a second execution authority or bypass the existing trust boundary.

### Full Orchestrator capability from Level 1

All capabilities available in the Surgical DevOps Orchestrator SHALL be available from Level 1 whenever their policy, authorization, capability, provider and platform requirements are satisfied.

Experience levels SHALL primarily represent progressive improvement of the human user experience.

They SHALL NOT be used to artificially postpone, hide or disable existing Orchestrator capabilities.

### Level 1 — Surgical CLI

Level 1 SHALL provide a simple interactive terminal experience through the canonical `surgical` entrypoint.

Level 1 SHALL expose the complete available capability of the Surgical DevOps Orchestrator through a human-oriented interface.

It SHALL support:

- standalone operation with zero development providers;
- single-provider operation;
- multi-provider operation;
- provider and orchestrator composition through explicit contracts;
- repository discovery;
- Declarative Inspection;
- risk classification and policy evaluation;
- change planning;
- governed reads;
- governed validation;
- governed mutations when independently authorized and qualified;
- lifecycle management;
- operation records and evidence;
- snapshot and delivery semantics;
- deterministic fail-closed behavior.

The absence of an AI or development provider SHALL NOT prevent Surgical DevOps from starting or from performing capabilities that do not require a provider.

### Level 2 — Assisted Workspace

Level 2 SHALL preserve all Level 1 capabilities.

Its primary evolution SHALL be improvement of the human experience, including streaming interaction, interactive diffs, richer approval flows, improved repository context, session history, resumable interaction, improved provider-composition feedback and richer validation presentation.

### Level 3 — Orchestration Workspace

Level 3 SHALL preserve all previous capabilities and the canonical `surgical` entrypoint.

Its primary evolution SHALL be toward an advanced Development Orchestration Workspace, including multi-agent interaction, multi-orchestrator composition, parallel task decomposition, dependency-aware execution, cross-provider validation, advanced context management, richer session persistence and human supervision of concurrent governed work.

### Provider independence

Providers, AI systems, coding agents, tools and external orchestrators are plug-in capabilities.

They SHALL NOT be prerequisites for Surgical DevOps activation.

The supported composition model SHALL include standalone operation with zero development providers, single-provider operation and multi-provider operation with two or more providers, agents, tools or orchestrators.

All modes remain governed by the Surgical DevOps Orchestrator.

Provider participation SHALL NOT grant direct authority over the workspace.

### Human Experience Layer

The Human Experience Layer SHALL simplify interaction with the Surgical DevOps Orchestrator while preserving BH-SEP, BH-SDP, policy and risk evaluation, capability grants, provider composition, lifecycle and evidence, controlled adapters and the existing trust boundary.

It SHALL NOT become a second policy engine, a second trust boundary or an independent execution authority.

### Stable experience contract

The `surgical` entrypoint SHOULD remain stable across Levels 1, 2 and 3.

Internal complexity involving providers, grants, adapters, lifecycle, evidence and orchestration SHOULD remain hidden from the ordinary user unless disclosure is required for authorization, explanation, audit or advanced configuration.

The governing objective is:

> Improve the human experience over time while preserving the complete deterministic capability and trust model of the Surgical DevOps Orchestrator.

**Decision: APPROVED AND FROZEN.**
