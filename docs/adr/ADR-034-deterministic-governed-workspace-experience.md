# ADR-034 — Deterministic Governed Workspace Experience

- Status: IMPLEMENTED / QUALIFIED
- Date: 2026-08-30
- Scope: NATURAL governed access to user-authorized local workspaces
- Sequencing: implementation begins only after closure of the active ADR-020 / ADR-023 latency milestone

## Context

Surgical DevOps already provides deterministic workspace boundaries, governed
read and patch adapters, task authority, evidence retrieval, mutation journals,
recovery and content-addressed mutation controls. However, the human experience
of discovering, reading and working with project files remains more fragmented
than the workspace experience offered by modern coding agents.

The product needs a fluid, Codex-like project experience without granting an AI
provider direct filesystem, shell, Git, network or publication authority. User
experience may be simplified, but the deterministic trust boundary must remain
strict and fail closed.

## Decision

Surgical DevOps SHALL implement a Deterministic Governed Workspace Experience
for NATURAL mode. The experience SHALL allow a user to authorize an exact local
project root and then interact naturally with project evidence while every
physical operation remains mediated by the deterministic Orchestrator.

The AI provider SHALL NOT receive direct access to the filesystem, shell,
processes, Git credentials, network or publication mechanisms. It may request
intent-level evidence and propose changes only through governed capabilities.

This experience SHALL be a projection of the existing Orchestrator and its
adapters, not a parallel or less-governed execution path.

## Required architecture

### 1. Deterministic workspace session

Each session SHALL bind to an explicitly authorized physical workspace root.
The binding SHALL record sufficient physical and repository identity to detect
replacement, escape, aliasing or stale authority. Reopened sessions SHALL
revalidate that identity before reusing any capability.

### 2. Governed discovery index

The Orchestrator SHALL provide bounded listing, deterministic search and
project discovery capabilities. Results SHALL be reproducible for the same
workspace state and SHALL respect exclusions, resource ceilings and sensitive
file policy.

### 3. Progressive evidence retrieval

The cognitive provider MAY request additional evidence recursively by intent.
Only the Orchestrator may translate those requests into physical reads.
Microreads covered by current read authority SHALL not require repetitive human
approval. Any expansion of root, purpose, capability or risk SHALL require new
human authority.

### 4. Sensitive file boundary

Secrets, credentials, private keys, authentication material and explicitly
excluded paths SHALL be blocked or deterministically redacted before content
can reach the cognitive provider. Filename patterns alone SHALL NOT be treated
as sufficient protection.

### 5. Scoped mutation envelope

Write authority SHALL be separate from read authority. Before mutation, the
user SHALL receive a comprehensible plan identifying purpose, affected paths,
validation and material risk. Approval SHALL produce a bounded, expiring and
state-bound mutation envelope. It SHALL NOT become generic future authority.

### 6. Qualified command catalog

Shell and process execution SHALL remain separate capabilities. Automated
validation MAY use only commands admitted by a qualified catalog, bound to an
exact working directory, argument contract, environment policy and execution
budget. Arbitrary provider-generated shell execution is forbidden.

### 7. Persistent project context

Surgical DevOps MAY preserve non-authoritative project context between sessions
to reduce repeated discovery. Persisted context SHALL never substitute for
fresh physical identity, authorization or evidence checks.

### 8. Audit and recovery

Every physical read class, authority expansion, proposed mutation, committed
mutation and validation result SHALL remain attributable through the existing
operation record, journal and recovery boundaries. Content telemetry remains
disabled unless separately and explicitly authorized.

## Deterministic invariants

The implementation SHALL preserve all of the following:

1. The human remains the sole source of new operational authority.
2. The model never receives direct machine authority.
3. Workspace confinement is based on physical identity, not path strings alone.
4. Symlink, junction, traversal and alias escapes fail closed.
5. TOCTOU or identity change invalidates stale authority.
6. Read authority does not imply write, shell, Git, network or publish authority.
7. Mutation requires conditional CAS and the existing durability boundary.
8. Ambiguous scope, stale state or incomplete evidence fails closed.
9. NATURAL may hide incidental complexity but may not weaken an invariant.
10. Existing ENGINEER and EXPERT experiences remain distinct.

## Required adversarial qualification

Before this milestone can be declared complete, qualification SHALL cover at
least:

- parent traversal and absolute-path escape;
- symlink, hard-link and platform-specific junction/reparse-point escape;
- workspace replacement and inode/file-identity change;
- TOCTOU between inspection, authorization and mutation;
- sensitive-content disclosure and deterministic redaction;
- unauthorized expansion from read to write;
- unauthorized shell, Git, network or publication access;
- stale persistent context after project mutation;
- bounded search and evidence exhaustion;
- Linux, macOS and Windows native conformance;
- NATURAL usability without repetitive micro-approval;
- preservation of operation records, journal, recovery and strict CAS.

## Sequencing constraint

This ADR is approved and frozen now but SHALL NOT be implemented concurrently
with the active latency-contract reconciliation and qualification work governed
by ADR-020 and ADR-023. Implementation begins only after that milestone has a
reconciled contract, qualified tests and an explicitly recorded closure.

The sequencing constraint prevents latency baselines from being confounded by
new discovery, indexing and evidence-retrieval behavior.

## Non-goals

This decision does not authorize:

- unrestricted filesystem access;
- direct provider access to local files;
- arbitrary shell execution;
- implicit access to the user's home directory;
- silent credential collection;
- automatic Git push, release, tag movement or package publication;
- weakening fail-closed behavior for convenience;
- implementation as part of this documentation-only commit.

## Consequences

The user receives a substantially more fluid project experience while Surgical
DevOps retains a stronger authority boundary than a conventional unrestricted
coding agent. The implementation will require composition and extension of
existing workspace, evidence, authority and mutation components, plus native
adversarial qualification on all supported operating systems.

The original approval commit changed no runtime behavior; the implementation
closure below records the later qualified runtime work.

## Implementation closure

Implementation began only after commit `43f518e5b9b1011e298713d87cc665620e6c70a6`
closed the ADR-020 / ADR-023 latency-contract reconciliation. The sequencing
constraint was therefore preserved.

The qualified implementation is composed from the existing Orchestrator
boundaries and adds the following bounded projections:

- `deterministic-workspace-session-adapter.js` binds and revalidates the exact
  physical repository, HEAD and worktree state;
- `governed-workspace-discovery-index.js` provides deterministic bounded
  inventory search with exclusions and stale-state invalidation;
- `sensitive-content-boundary.js` performs content-aware blocking and
  deterministic redaction before recursive evidence reaches cognition;
- `qualified-command-catalog.js` formally admits the existing fixed Node
  syntax validation contract and is consumed by the process adapter;
- `governed-workspace-audit.js` provides bounded content-free attributable
  event chaining; and
- `natural-governed-workspace-experience.js` projects these contracts for
  NATURAL mode while retaining separate task, mutation and execution authority.

The existing single-use G4 authorization, R3 composition, journal, recovery,
durability and Manifest CAS remain the only mutation route. Persistent project
memory remains explicitly non-authoritative.

Qualification covers physical replacement and stale state, traversal and
alias containment, bounded search exhaustion, content-based secret detection,
redaction, read-to-write and external-effect escalation, qualified-command
admission, content-free audit chaining, repeat microreads under one exact task
envelope and comprehensible authority-free mutation review. Native filesystem
and sandbox behavior continues to be qualified by the canonical Linux, macOS
and Windows matrix.
