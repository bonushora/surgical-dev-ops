# ADR-002 — Surgical DevOps Accelerator

**Status:** APPROVED / FROZEN
**Date:** 2026-08-19
**Decision ID:** SDO-0
**Scope:** Surgical DevOps
**Related Protocols:** BH-SEP v2.2 / BH-SDP v2.2

## 1. Context

The Surgical DevOps ecosystem currently provides deterministic governance through BH-SEP and BH-SDP, including declarative inspection, PATCH mode, snapshot preservation, physical anchoring and controlled evolution.

The current launcher identifies a target repository and establishes its physical Git context, but the development workflow still depends heavily on manual interaction with an external coding agent.

This creates an opportunity to evolve Surgical DevOps from a protocol-only governance layer into an operational engineering accelerator.

## 2. Decision

Surgical DevOps will be evolved with a new operational capability named:

**Surgical DevOps Accelerator**

The Accelerator will orchestrate a deterministic development workflow:

1. Repository discovery
2. Declarative inspection
3. Task decomposition
4. Risk classification
5. Change planning
6. Surgical execution
7. Automated validation
8. Diff inspection
9. Snapshot generation
10. Delivery / commit preparation

The Accelerator will operate above the target repository and remain independent of the Surgical Kernel implementation.

## 3. Architectural Position

The Surgical DevOps Accelerator is:

- a capability of Surgical DevOps;
- repository-agnostic;
- Git-aware;
- protocol-governed;
- compatible with external coding agents;
- independent of the Surgical Kernel runtime;
- independent of any specific LLM provider;
- designed to reduce unnecessary interactive development cycles.

The Surgical Kernel is a consumer/target of the accelerator, not its implementation owner.

## 4. Relationship With Codex

The Accelerator does not replace Codex or require Codex.

Codex may remain an execution engine for code changes.

The architectural distinction is:

**Surgical DevOps** determines how engineering work must be inspected, controlled, validated and delivered.

**Execution Agent** performs the actual code-generation or code-modification work.

This separation allows Surgical DevOps to orchestrate different execution agents without coupling the protocol to a single provider.

## 5. Deterministic Development Pipeline

TASK
→ REPOSITORY DISCOVERY
→ DECLARATIVE INSPECTION
→ HYPOTHESIS
→ RISK / SCOPE CLASSIFICATION
→ CHANGE PLAN
→ SURGICAL EXECUTION
→ AUTOMATED VALIDATION
→ DIFF / WORKTREE INSPECTION
→ SNAPSHOT
→ DELIVERY

The pipeline must preserve BH-SEP and BH-SDP invariants.

## 6. Safety Boundaries

The Accelerator MUST NOT:

- silently delete repository content;
- bypass Git state inspection;
- bypass declarative inspection;
- perform unrestricted refactoring by default;
- commit unvalidated changes;
- overwrite unrelated worktree modifications;
- alter the Surgical Kernel architecture without explicit authorization;
- treat an LLM-generated statement as equivalent to physical validation.

Physical repository state remains authoritative.

## 7. PATCH Mode

PATCH remains the default intervention mode.

The Accelerator may propose larger refactors, but a transition from PATCH to REFRACTOR requires an explicit architectural decision.

## 8. Snapshot Requirement

BH-SDP remains mandatory.

Every meaningful development cycle must preserve sufficient physical anchoring to reconstruct:

- repository;
- branch;
- commit;
- worktree state;
- validation status;
- risk level;
- completed work;
- next step.

## 9. Provider Independence

The Accelerator MUST NOT depend architecturally on:

- OpenAI Codex;
- a specific LLM;
- a specific IDE;
- a specific operating system;
- a specific programming language.

Execution providers are replaceable components.

## 10. Initial Implementation Strategy

The first implementation phase will focus on a local CLI/harness.

The initial version will prioritize:

1. repository inspection;
2. deterministic task preparation;
3. controlled execution boundaries;
4. validation orchestration;
5. diff inspection;
6. snapshot generation;
7. delivery preparation.

No modification to the Surgical Kernel is required for the initial Accelerator implementation.

## 11. Success Criterion

The objective is not merely to generate code faster.

The objective is to reduce the number of manual development cycles required to safely transform a defined engineering task into a validated repository state.

Speed is therefore measured together with:

- correctness;
- reproducibility;
- traceability;
- regression resistance;
- preservation of existing work;
- validation coverage.

## 12. Frozen Decision

The following architectural decision is frozen:

> The Surgical DevOps Accelerator will be implemented as a new capability of the Surgical DevOps repository, operating as an independent deterministic engineering harness above target repositories.

The Surgical Kernel will not contain the Accelerator implementation.

Future implementation work must preserve this architectural boundary unless a new ADR explicitly supersedes this decision.

---

**Status: APPROVED / FROZEN**
