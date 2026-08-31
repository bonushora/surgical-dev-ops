# ADR-037 — Integrated Governed Agent Gateway and Conversational Control Surface

- Status: ACCEPTED / FROZEN
- Date: 2026-08-31
- Scope: Surgical DevOps v2.6+ integrated agent execution experience
- Decision authority: Human
- Supersedes: none
- Related:
  - ADR-004 — Surgical DevOps Orchestrator Trust Boundary
  - ADR-009 — Strict Physical Identity Conditional CAS Boundary
  - ADR-010 — Governed Content-Addressed Workspace Authority
  - ADR-011 — Intent-Driven Orchestration User Modes
  - ADR-012 — Local AI Provider and Multi-Agent Coordination
  - ADR-013 — Governed AI Engineering Agent Integration
  - ADR-014 — Governed AI Behavior Contract
  - ADR-019 — Single-Agent Governed Engineering Loop
  - ADR-028 — NATURAL Governed Development Execution Loop
  - ADR-033 — Governed Autonomous Runner Mode
  - ADR-034 — Deterministic Governed Workspace Experience
  - ADR-036 — NATURAL Agentic Governed Experience

## Context

Surgical DevOps already possesses deterministic orchestration, governed physical
authority, strict workspace confinement, conditional mutation, CAS, recovery,
journal, governed AI behavior, NATURAL/ENGINEER/EXPERT interaction profiles,
and a cross-platform execution sandbox adapted physically to Linux, Windows and
macOS.

ADR-036 freezes the intended NATURAL user experience as a persistent,
mission-oriented, agentic-governed engineering workflow.

A remaining product friction exists between conversational cognition and
deterministic execution.

Without an integrated control surface, a human may still need to act as a manual
transport layer:

1. the cognitive system proposes a shell block;
2. the human copies the block;
3. the terminal executes it;
4. the human copies the output;
5. the cognitive system interprets it;
6. the cycle repeats.

This manual bridge is not required by the deterministic security model.

It is an integration limitation.

The desired architecture is therefore:

    Conversational UI
          |
          | structured governed intentions
          v
    Integrated Governed Agent Gateway
          |
          | validated governed operations
          v
    Surgical Orchestrator
          |
          | deterministic authority
          v
    Governed Sandbox / Adapters
          |
          +-- Linux
          +-- Windows
          +-- macOS

The model remains cognitively capable but physically non-authoritative.

## Decision

Surgical DevOps SHALL provide an Integrated Governed Agent Gateway that allows
the conversational/agentic experience to invoke deterministic Surgical
capabilities directly through structured governed operations.

The human SHALL no longer be required to copy and paste shell commands merely to
transport an already-authorized operation between cognition and the
Orchestrator.

The gateway SHALL NOT bypass, replace or weaken the Orchestrator.

It is a governed mediation and presentation layer over existing authority.

## 1. Separation of cognition and authority

The cognitive provider MAY:

- reason;
- plan;
- request evidence;
- propose operations;
- interpret results;
- revise plans;
- diagnose failures;
- request additional authority.

The cognitive provider SHALL NOT directly receive:

- unrestricted filesystem APIs;
- unrestricted process spawning;
- Bash authority;
- PowerShell authority;
- Git mutation authority;
- network mutation authority;
- secret access authority;
- credential authority;
- release authority;
- publication authority;
- sandbox administration authority.

Physical authority remains exclusively mediated by deterministic Surgical
components.

## 2. Structured governed tools

The gateway SHALL expose structured operation contracts instead of raw native
machine primitives.

Conceptual governed tools MAY include:

- workspace.status
- workspace.search
- workspace.read
- workspace.diff
- evidence.inspect
- evidence.microread
- tests.run
- tests.runCanonical
- mutation.propose
- mutation.applyConditional
- git.status
- git.diff
- git.stage
- git.commit
- journal.inspect
- journal.append
- mission.status
- mission.plan
- mission.resume
- authority.inspect
- authority.request

These names are illustrative.

The normative requirement is that physical operations are requested through
typed/structured governed capabilities.

## 3. Tool contracts are not authority

The existence of a tool contract SHALL NOT imply permission to invoke its
physical effect.

Each invocation remains subject to applicable:

- human authority;
- mission scope;
- physical workspace identity;
- repository identity;
- CAS;
- state freshness;
- sandbox constraints;
- command qualification;
- sensitive-content rules;
- durability requirements;
- journal requirements;
- recovery requirements;
- provider restrictions.

A denied capability MUST remain denied even if the cognitive provider repeatedly
requests it.

## 4. Provider independence

The gateway SHALL be provider-independent.

Compatible cognition MAY be supplied by:

- local models;
- OpenAI models;
- other remote providers;
- enterprise models;
- future qualified providers.

Changing the cognitive provider SHALL NOT alter deterministic physical
authority.

Provider capability != Surgical authority.

## 5. Surgical Governed Tools remain sovereign

All physical effects SHALL be produced through Surgical-governed mechanisms.

A provider MAY select or request a Surgical tool.

A provider SHALL NOT replace the implementation of that tool with unrestricted
native execution.

The Orchestrator remains authoritative over whether the requested operation:

- exists;
- is qualified;
- is currently authorized;
- is valid for the current physical state;
- may execute;
- must request additional human authority;
- must fail closed.

## 6. Integrated execution loop

A governed mission MAY proceed directly through the following cycle:

1. human supplies objective;
2. NATURAL establishes governed mission;
3. agent creates/updates live plan;
4. agent requests governed evidence;
5. gateway invokes approved Surgical read capabilities;
6. structured result returns to cognition;
7. agent proposes the smallest legitimate operation;
8. Orchestrator validates authority/state/CAS;
9. operation executes if authorized;
10. result returns as structured evidence;
11. agent runs qualification;
12. failures are diagnosed;
13. repair proceeds while still within authority;
14. canonical qualification executes when required;
15. checkpoint occurs when permitted;
16. mission reaches GREEN or a genuine authority boundary.

The human does not need to manually transport command text or command output
during this normal loop.

## 7. Approval Broker

The gateway SHALL provide a contextual approval broker for operations requiring
additional human authority.

An approval request SHOULD communicate:

- requested capability;
- human-readable reason;
- exact or bounded scope;
- workspace/repository identity;
- mission identity;
- relevant state/CAS binding;
- authorization lifetime;
- excluded authority classes.

Approval MAY support forms such as:

- authorize once;
- authorize this operation class within this mission;
- deny.

Any mission-scoped authorization MUST remain bounded by the deterministic
authority contract.

## 8. No approval laundering

The conversational layer MUST NOT transform ambiguous natural-language consent
into broader operational authority.

Authorization MUST resolve through qualified deterministic authority semantics.

For example:

- permission to edit one governed file != permission to modify repository-wide;
- local commit permission != push permission;
- testing permission != arbitrary shell permission;
- package inspection != package publication;
- provider setup != credential disclosure.

## 9. Structured results

Tool results SHALL return structured execution evidence suitable for both:

- deterministic validation;
- cognitive interpretation.

Where applicable, results SHOULD distinguish:

- success;
- failure;
- denied;
- stale state;
- CAS mismatch;
- environmental limitation;
- missing capability;
- human authority required;
- incomplete evidence.

Natural-language rendering MAY summarize these states but MUST NOT erase their
deterministic classification.

## 10. Event streaming

The gateway SHALL support a mission event stream.

Events MAY include:

- MISSION_STARTED
- PLAN_UPDATED
- AUTHORITY_REQUIRED
- AUTHORITY_GRANTED
- AUTHORITY_DENIED
- EVIDENCE_DISCOVERED
- OPERATION_STARTED
- OPERATION_COMPLETED
- OPERATION_DENIED
- TEST_STARTED
- TEST_PASSED
- TEST_FAILED
- REPAIR_STARTED
- QUALIFICATION_STARTED
- CHECKPOINT_CREATED
- STATE_INVALIDATED
- MISSION_BLOCKED
- MISSION_GREEN
- MISSION_CANCELLED

Equivalent deterministic event names MAY be used.

Events SHALL be auditable and content-minimized where sensitive information is
involved.

## 11. Conversational progress projection

The NATURAL interface SHALL transform mission events into concise user-facing
progress updates.

The experience SHOULD resemble an engineer actively working:

> I found a material inconsistency in the governed workspace integration.

> The targeted regression now passes. I am running the canonical suite.

> Canonical qualification found one valid failure. I am repairing the real
> defect without weakening the expectation.

This presentation layer SHALL remain non-authoritative.

## 12. Unified session across surfaces

CLI, local Web UI and Desktop UI MAY expose the same governed mission.

They SHALL be projections over the same underlying mission/authority/evidence
contracts rather than independent authority implementations.

A UI surface MUST NOT become a separate trust boundary that bypasses the
Orchestrator.

## 13. Local control plane

A richer Desktop/Web experience SHOULD communicate with a local governed control
plane or equivalent mediated runtime.

The UI SHALL NOT directly execute unrestricted operating-system operations.

The control plane SHALL delegate physical operations only through qualified
Surgical mechanisms.

## 14. Cross-platform experience

Linux, Windows and macOS SHALL expose equivalent governed agent semantics over
their existing platform-adapted sandbox implementations.

The user experience SHOULD remain materially consistent across platforms.

Physical implementation details MAY differ.

Security semantics MAY NOT be weakened to create superficial UX parity.

Unsupported physical capability MUST fail closed.

## 15. Elimination of manual copy/paste as the normal path

Manual copy/paste SHALL remain possible as an explicit fallback or diagnostic
workflow.

It SHALL NOT remain the required normal transport mechanism between NATURAL
cognition and governed execution.

When an operation is:

- supported;
- qualified;
- authorized;
- within current mission scope;
- valid for current physical state;

the gateway SHOULD invoke it directly through the Orchestrator.

## 16. Explicit authority display

The conversational control surface SHOULD expose current authority state.

For example:

    Read workspace       ALLOWED
    Run tests            ALLOWED
    Governed mutation    ALLOWED
    Local Git commit     ALLOWED
    Network              DENIED
    Git push             DENIED
    Release              DENIED
    Publish              DENIED

This is a projection of deterministic authority.

Displaying authority does not create it.

## 17. Mission state and plan integration

ADR-036 mission state and live-plan semantics SHALL be exposed through the
gateway.

The gateway SHALL NOT maintain an independent, conflicting mission truth.

The deterministic mission state remains sovereign.

## 18. Resume

A conversational session MAY resume a prior mission.

Resume SHALL:

1. load durable mission/evidence references;
2. revalidate physical workspace identity;
3. revalidate repository state;
4. revalidate relevant CAS/state assumptions;
5. inspect current authority;
6. invalidate stale grants;
7. reconstruct only the cognitively useful context;
8. continue or fail closed.

Conversation history alone SHALL NOT restore physical authority.

## 19. Sensitive-content mediation

Evidence MUST pass the applicable sensitive-content boundary before reaching a
cognitive provider.

The gateway SHALL NOT forward raw command output indiscriminately.

Sensitive evidence MAY be:

- denied;
- minimized;
- redacted;
- hashed;
- represented as metadata;
- retained locally without provider exposure.

Provider convenience does not override confidentiality.

## 20. Streaming must not leak secrets

Mission event streaming SHALL respect sensitive-data classification.

Raw secrets, credentials, private keys, unrestricted environment content and
other governed sensitive material SHALL NOT be included in user/provider event
streams merely because an operation produced them.

## 21. Command catalog mediation

Where native command execution is required, the requested operation SHALL pass
through the existing qualified command/capability mechanisms.

The gateway SHALL NOT become a generic unrestricted shell proxy.

## 22. Git mediation

Git operations SHALL remain distinct governed capabilities.

At minimum, authority SHALL distinguish:

- inspect status;
- inspect diff;
- stage;
- local commit;
- fetch/read remote state;
- push;
- tag mutation;
- history rewrite;
- release-related Git actions.

Authorization for one class SHALL NOT imply another.

## 23. Network mediation

Network access SHALL remain independently governed.

A provider connection required for cognition SHALL NOT imply that arbitrary
project network operations are authorized.

Tool-mediated external mutations require their own authority.

## 24. External service integrations

Future integrations with services such as:

- GitHub;
- GitLab;
- CI providers;
- issue trackers;
- artifact registries;
- deployment systems;

MAY be exposed through governed structured connectors.

Their presence SHALL NOT bypass local Surgical authority or human approval
contracts.

## 25. Deterministic tool protocol

Requests and results SHOULD use canonical deterministic serialization where
authority, audit or replay resistance depends on exact representation.

Critical fields MAY include:

- protocol version;
- mission ID;
- request ID;
- workspace identity;
- repository identity;
- expected state/CAS;
- operation type;
- normalized arguments;
- authority reference;
- timestamp/nonce where applicable;
- result classification;
- evidence digest.

## 26. Anti-replay

Privileged operation requests SHALL preserve applicable anti-replay guarantees.

A previously authorized operation MUST NOT be replayed against materially
different physical state merely because the conversational system retained its
request.

## 27. TOCTOU

The integrated experience MUST NOT hide time-of-check/time-of-use invalidation.

Where physical identity/state must be revalidated immediately before an effect,
the Orchestrator SHALL perform that revalidation.

A friendly conversational workflow cannot waive TOCTOU protections.

## 28. Fail-closed gateway

The gateway MUST fail closed when:

- requested tool is unknown;
- tool schema is invalid;
- mission identity is missing;
- workspace identity cannot be verified;
- state is stale;
- CAS mismatches;
- authorization is absent or ambiguous;
- sensitive-content policy cannot be applied;
- required platform adapter is unavailable;
- deterministic result cannot be established.

The gateway SHALL return a structured denial/failure rather than infer success.

## 29. Model errors do not become machine authority

Hallucinated:

- file names;
- commands;
- repository paths;
- branches;
- tool calls;
- permissions;
- test results;
- commits;
- network resources;

MUST NOT become physical facts merely because the model generated them.

The Orchestrator establishes physical truth.

## 30. Desktop/Web/CLI parity

A Desktop or Web UI MAY provide a richer experience than CLI.

It MAY include:

- chat;
- mission plan;
- authority panel;
- test status;
- changes;
- evidence timeline;
- checkpoint history;
- journal projection;
- approval controls.

All such interfaces MUST consume the same governed backend semantics.

## 31. Human interruption

The human SHALL retain the ability to:

- pause;
- deny;
- redirect;
- cancel;
- inspect;
- revoke applicable mission authority.

Human intervention remains sovereign over agent continuity.

## 32. Provider failure

Cognitive provider failure SHALL NOT corrupt the deterministic mission state.

The session MAY:

- retry according to policy;
- switch to another qualified provider;
- continue locally;
- block awaiting human action.

Provider replacement SHALL NOT alter authority.

## 33. Provider substitution

A mission MAY change cognitive provider only through qualified provider
selection rules.

Existing governed state MAY be projected to the new provider only through the
same sensitive-content boundaries.

Provider substitution does not create a new authority envelope.

## 34. Auditability

Each physically consequential operation SHALL remain attributable to:

- mission;
- authority;
- deterministic tool/capability;
- physical state;
- result.

Cognitive summaries MAY assist review but SHALL NOT replace auditable evidence.

## 35. Product objective

The intended integrated experience is:

> The human describes an engineering objective in NATURAL. The cognitive system
> reasons and requests governed tools. Surgical DevOps validates authority and
> physical state, executes permitted operations, returns structured evidence,
> and the cognitive system continues until GREEN or a genuine authority
> boundary — without requiring the human to manually copy commands and outputs
> between chat and terminal.

## 36. Distinction from unrestricted coding agents

The desired experience may be comparable in convenience to modern integrated
coding agents.

The trust model remains intentionally different.

Surgical DevOps does not make the cognitive model the operating-system
principal.

The Orchestrator and human authority remain sovereign.

## Frozen invariants

The following are ACCEPTED / FROZEN:

- ADR-036 defines the NATURAL agentic experience.
- ADR-037 defines its integrated governed execution bridge.
- manual copy/paste is not the intended normal execution path;
- structured governed tools mediate physical effects;
- the cognitive model receives no direct machine authority;
- Surgical Orchestrator remains the execution authority;
- provider and authority remain separate;
- a provider can be replaced without changing physical authority;
- approvals remain deterministic and contextual;
- tool availability does not grant tool authority;
- event streaming is non-authoritative and sensitive-data-aware;
- CLI/Web/Desktop are projections of the same governed mission semantics;
- platform-specific sandboxes remain governed by their existing architecture;
- Linux, Windows and macOS expose equivalent authority semantics;
- Git, network, release and publication remain independently authorized;
- resume requires physical revalidation;
- persistent memory does not restore authority;
- CAS, TOCTOU, anti-replay, journal, durability and recovery remain normative;
- BH-SEP v2.2 remains normative;
- BH-SDP v2.2 remains normative;
- fail-closed behavior remains normative.

## Qualification requirements

ADR-037 SHALL NOT be considered implemented solely because this document exists.

Executable qualification SHALL eventually demonstrate, at minimum:

1. structured tool request validation;
2. structured tool result validation;
3. unknown-tool denial;
4. unauthorized-tool denial;
5. mission-bound execution;
6. workspace-bound execution;
7. state/CAS invalidation;
8. direct governed read without copy/paste;
9. direct governed test execution without copy/paste;
10. direct governed mutation through existing authority;
11. contextual approval flow;
12. local checkpoint mediation;
13. push denial when not separately authorized;
14. sensitive-output redaction/minimization;
15. mission event streaming;
16. live-plan integration;
17. interruption;
18. governed resume;
19. provider substitution without authority change;
20. provider failure without deterministic-state corruption;
21. NATURAL integrated flow;
22. ENGINEER/EXPERT non-regression;
23. Linux semantic qualification;
24. Windows semantic qualification;
25. macOS semantic qualification;
26. canonical regression.

Any material reversal of this decision requires a new ADR.
