# ADR-024 — Governed Frontier Conversational Experience

Status: **APPROVED AND FROZEN**
Date: 2026-08-25

## Context

Surgical DevOps now provides a strong deterministic operational boundary, a
governed workspace-evidence loop, bilingual NATURAL intent handling, temporary
conversation memory, session-local evidence-bound caching and qualified local
model selection.

Manual qualification also established an important product fact: strong
governance alone does not create a fluid conversational experience. Small local
models remain slower and cognitively weaker than frontier services on complex
engineering work. Repeated evidence acquisition, terminal-only presentation,
limited continuity and delayed first output make the current experience feel
less capable than a modern hosted assistant even when the final operation is
safer.

The product must not conceal this limitation or weaken deterministic controls to
improve perceived speed. It must instead combine frontier-quality cognition with
advantages specific to a governed development environment: authoritative project
continuity, evidence-bound memory, deterministic execution, durable task state
and automatic validation through completion.

## Decision

NATURAL will evolve into a Governed Frontier Conversational Experience. The
experience is intended to become better than a generic hosted chat assistant for
work on an authorized software project. It is not claimed to be universally
better for unrelated conversation.

The architecture consists of the following qualified boundaries.

### 1. Provider-neutral frontier cognition

Surgical DevOps may use a qualified frontier provider for complex cognition.
Every external provider requires a dedicated adapter and explicit qualification
of identity, endpoint, credentials, supported cognitive capabilities, request and
response bounds, timeout, streaming semantics, privacy, commercial disclosure
and fail-closed behavior.

No provider is activated automatically. Provider choice remains explicit and
reversible. Credentials exist only inside the provider adapter boundary and may
never enter prompts, evidence, logs, memory, telemetry or operational authority.

Qualified local models remain available:

- Gemma 3 4B is the fast local profile;
- Qwen 3 8B is the local quality profile;
- local execution remains the free, private and offline option;
- absence or failure of a remote provider must preserve a safe local or
  deterministic fallback without silently changing authority.

### 2. Deterministic cognitive routing

A zero-operational-authority router selects only among already qualified
cognitive profiles according to a closed policy. Routing may consider task type,
risk, requested language, latency class, privacy mode, availability and explicit
user preference.

The router cannot install a model, create credentials, expand network scope,
authorize an operation or choose an unqualified provider. A cognitive model
cannot select itself or its successor.

### 3. Streaming presentation

The user receives immediate deterministic acknowledgement and bounded progress
events. Cognitive text is streamed when the selected adapter has qualified
streaming semantics.

Streamed text is presentation-only and never becomes incremental operational
authority. Operational decisions consume only a complete, validated canonical
result. Interrupted, malformed or oversized streams fail closed and cannot be
reinterpreted as success.

### 4. Commit-bound project evidence index

The Orchestrator maintains a bounded read-only index of authorized project
evidence. Entries are bound to physical workspace identity, repository HEAD,
canonical target, content hash, byte count, parser version and observation time.

An index entry may accelerate retrieval but cannot replace physical evidence when
the governing contract requires a fresh observation. Changes to HEAD, worktree
state, target identity, content hash or index schema invalidate affected entries.
The cognitive provider receives only the minimum evidence required for the task.

### 5. Governed persistent project memory

Project continuity may persist across sessions only as a distinct governed data
plane. Memory records must identify their source and class:

- frozen architectural decision;
- human preference;
- verified repository fact;
- task state;
- cognitive summary or hypothesis.

Facts require evidence bindings. Cognitive summaries are explicitly
non-authoritative. Memory is scoped to one physical project, inspectable,
correctable, exportable and deletable by the user. It may not store credentials,
private keys, raw secrets or hidden provider reasoning.

Memory never grants authority. A remembered approval is not a current approval,
and a remembered repository fact is not current physical evidence after its
binding becomes stale.

### 6. Task-envelope authorization

NATURAL requests one comprehensible authorization for a bounded task envelope.
The envelope binds objective, physical workspace, allowed capability vocabulary,
risk ceiling, evidence-step ceiling, mutation policy, validity and stop
conditions.

Contained microreads may proceed without repeated prompts. Any workspace change,
new capability, increased risk, mutation, credential use, external side effect or
architectural decision stops at a new human-authority boundary.

This implements Governance Without Friction by reducing redundant prompts, not
by reducing governance.

### 7. Durable asynchronous task experience

Authorized work may continue as a bounded task after the immediate conversational
turn. The user receives deterministic state transitions, progress, current
boundary, evidence, test results and final outcome.

Task resumption after process restart requires durable task identity and verified
state. No task may infer success from silence, resume expired authority, duplicate
a mutation or bypass journal and recovery contracts. Monitoring CI is read-only;
reruns, commits, pushes, releases and external messages remain separately governed
side effects.

### 8. Conversational product surface

NATURAL will expose a terminal and/or web conversational surface with:

- streamed answers and progress;
- visible active project, provider and privacy mode;
- conversation and task history;
- pending authorization cards in human language;
- evidence and artifact links through progressive disclosure;
- explicit stop, resume, clear-memory and provider-switch controls;
- equivalent Brazilian Portuguese and English behavior.

ENGINEER and EXPERT remain distinct technical experiences over the same canonical
Orchestrator. NATURAL presentation cannot create a separate execution path.

## Experience objectives

The qualified target on supported reference hardware and network conditions is:

- deterministic acknowledgement visible within 300 ms;
- first streamed cognitive text within 2 seconds for a warm qualified remote
  provider;
- evidence-bound cache reuse within 1 second;
- a common new local project explanation targeted below 15 seconds where the
  qualified hardware profile permits it;
- no repeated approval for operations contained by one active task envelope;
- explicit progress for any operation exceeding 2 seconds;
- resumable project and task continuity without treating memory as authority.

These are qualification objectives, not unconditional performance claims. The
interface must report when hardware, network or provider behavior prevents them.

## Security and governance invariants

- The human remains sovereign over decisions and approvals.
- The Orchestrator remains the only operational authority.
- Cognitive providers retain zero filesystem, Git, process, shell, network,
  credential, approval and mutation authority.
- BH-SEP v2.2, BH-SDP v2.2, R3, physical workspace confinement, Manifest CAS,
  mutation journal, durability, locking, recovery and fail-closed behavior remain
  unchanged.
- Streaming, indexing, memory, routing, caching and background tasks introduce no
  alternate operational execution path.
- Provider output, memory and indexed content remain untrusted data until consumed
  by the appropriate deterministic contract.
- Portuguese and English requests with equivalent meaning cross equivalent
  authority and evidence boundaries.
- Telemetry is not operational authority and may not contain project content,
  prompts, responses, credentials or secrets.

## Delivery sequence

Implementation proceeds through independently green milestones:

1. ADR-024-A — conversational latency and quality evaluation harness;
2. ADR-024-B — canonical streaming and progress event contract;
3. ADR-024-C — commit-bound project evidence index;
4. ADR-024-D — governed persistent project memory;
5. ADR-024-E — task-envelope authorization consolidation;
6. ADR-024-F — durable asynchronous task state and resume;
7. ADR-024-G — first qualified frontier-provider adapter and guided setup;
8. ADR-024-H — NATURAL terminal/web experience integration;
9. ADR-024-I — bilingual adversarial, latency and cross-platform qualification.

Each milestone must preserve the previous green baseline. A feature remains
disabled or fail-closed until its own acceptance evidence exists.

## Acceptance criteria

ADR-024 is implemented only when all of the following are true:

- a qualified frontier adapter and both qualified local profiles can be selected
  without changing operational governance;
- streaming improves time-to-first-output while incomplete output cannot trigger
  an operation;
- project indexing demonstrably reduces repeated evidence cost and invalidates
  stale bindings;
- persistent memory survives restart, remains project-confined and cannot replay
  authority;
- one task-envelope authorization covers only its exact microoperations and stops
  at every expansion boundary;
- an authorized asynchronous task can report, stop and resume without duplicate
  physical effects;
- Portuguese and English end-to-end scenarios are behaviorally equivalent;
- objective latency and response-quality evaluations meet the qualified profile
  or disclose a failed target without falsifying success;
- canonical Linux, macOS and Windows CI is green;
- security regression, malformed-provider, stale-evidence, memory-poisoning,
  interrupted-stream and restart tests are green;
- documentation clearly distinguishes local cost neutrality from external
  provider pricing and privacy.

## Non-goals

- Making a probabilistic model deterministic.
- Claiming universal conversational superiority over hosted assistants.
- Bundling, silently downloading or silently selecting a model.
- Granting a provider direct filesystem, shell, process or mutation access.
- Persisting hidden chain-of-thought or provider-private reasoning.
- Weakening human authorization to obtain lower latency.
- Treating cached, indexed or remembered data as fresh physical authority.

## Consequences

The user experience can become materially more capable and continuous than a
generic chat for work on an authorized project. This requires additional
infrastructure, provider qualification, evaluation and durable data contracts.
External frontier cognition may introduce direct provider cost and privacy
considerations, which must be disclosed before activation.

Local-only operation remains supported but is not represented as cognitively
equivalent to a frontier provider. Product claims must be evidence-based: the
experience is complete only after the acceptance gates above are green.
