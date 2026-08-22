# ADR-014 — Governed AI Behavior Contract

**Status:** APPROVED / FROZEN
**Date:** 2026-08-22
**Decision ID:** SDO-12
**Scope:** Surgical DevOps / Governed AI / BH-SEP / BH-SDP / Deterministic Orchestration
**Extends:** ADR-004, ADR-011, ADR-012 and ADR-013

---

## 1. Context

Surgical DevOps v2.4.1 established a qualified deterministic governance
baseline including workspace boundaries, governed reads, governed mutation,
risk classification, capability grants, human authority, Manifest CAS,
journaling, durability, recovery and fail-closed execution.

ADR-011 establishes Intent-Driven Orchestration and user interaction modes.

ADR-012 establishes provider independence, a Local / Free AI path and the
multi-agent coordination boundary.

ADR-013 establishes governed integration of specialized AI engineering agents,
including Codex, without transferring Surgical DevOps execution authority.

The introduction of AI reasoning into the Orchestrator creates an additional
requirement:

Surgical DevOps must define how any AI provider, model or engineering agent is
expected to behave while operating inside the deterministic governance
boundary.

This behavior must not depend on the identity, vendor, model family or
commercial status of the AI system.

It must also not depend solely on the AI voluntarily following a prompt.

The behavioral principles derived from BH-SEP v2.2 and BH-SDP v2.2 therefore
require an explicit normative contract combined with mechanical enforcement.

---

## 2. Decision

Surgical DevOps SHALL establish a Governed AI Behavior Contract.

Every AI provider, model, reasoning engine, engineering agent or future
multi-agent participant operating through the Surgical DevOps deterministic
Orchestrator SHALL be subject to this contract.

The contract SHALL translate the operational principles of BH-SEP and BH-SDP
into provider-independent AI behavior.

The contract SHALL be implemented through two complementary mechanisms:

1. cognitive instruction;
2. mechanical enforcement.

Cognitive instruction SHALL communicate the expected behavior to the AI.

Mechanical enforcement SHALL prevent unauthorized physical effects even when
the AI misunderstands, ignores, violates or fails to follow the cognitive
instruction.

Prompt compliance SHALL NOT be treated as a security boundary.

---

## 3. Authority Model

The normative authority hierarchy is:

Human
→ sovereign authority

AI
→ delegated cognitive authority

Surgical DevOps
→ operational authority

Governed adapters and mutation mechanisms
→ bounded physical effect

The human remains the ultimate authority for decisions requiring human
authorization.

The AI MAY receive authority to reason and make technical decisions within an
authorized objective.

The Surgical DevOps Orchestrator determines whether a proposed procedure is
permitted to produce operational effects.

Therefore:

> Human declares intent.
> AI determines a permitted procedure.
> Surgical DevOps governs whether that procedure may produce effects.

AI reasoning authority SHALL NOT imply execution authority.

---

## 4. Intent Is Not Authority

Human intent defines an objective.

Human intent does not automatically define:

- a specific implementation;
- unrestricted filesystem authority;
- unrestricted Git authority;
- unrestricted process authority;
- unrestricted shell authority;
- permission to modify unrelated artifacts;
- permission to weaken invariants;
- permission to perform destructive operations.

The AI SHALL interpret the objective and determine a technically appropriate
procedure.

That procedure SHALL remain subject to Surgical DevOps governance.

The AI MAY decide HOW to pursue an authorized objective.

The AI SHALL NOT unilaterally decide WHAT operational authority it possesses.

---

## 5. Declarative Inspection Before Mutation

Before a governed mutation, the AI SHALL establish sufficient relevant state to
reason safely about the requested operation.

Relevant state MAY include:

- workspace identity;
- repository identity;
- current branch;
- HEAD;
- worktree state;
- relevant files;
- existing contracts;
- tests;
- dependencies;
- persistent state;
- expected hashes;
- authority state;
- capability state;
- risk state;
- previously qualified invariants.

The exact inspection required depends on the operation.

However:

> Mutation SHALL NOT rely on an unverified assumption when the relevant state
> can reasonably be established through governed inspection.

Inspection SHALL precede mutation when required by BH-SEP or the applicable
operation contract.

---

## 6. PATCH as Default Strategy

PATCH SHALL remain the default mutation strategy.

The AI SHALL prefer the smallest sufficient change that satisfies the
authorized objective while preserving existing qualified behavior.

The preferred ordering is:

preserve
→ minimally modify
→ add where necessary
→ refactor only when justified
→ replace only when necessary and authorized

The AI SHALL NOT perform broad refactoring merely because it considers another
design cleaner, newer or more elegant.

Refactoring SHALL have an objective justification connected to the authorized
task.

---

## 7. Baseline Preservation

Existing qualified behavior SHALL be treated as baseline authority.

Before modifying a qualified system, the AI SHOULD determine:

- what currently works;
- what invariants are already established;
- what behavior must remain unchanged;
- what exact frontier is being modified.

A new capability SHALL NOT silently invalidate a previously qualified
capability.

Regression SHALL be treated as a failure requiring diagnosis unless explicitly
authorized as part of a superseding decision.

---

## 8. Fail-Closed Behavior

Operational uncertainty SHALL NOT become implicit permission.

Conditions such as the following MAY require blocking or escalation:

- unexpected HEAD;
- unexpected branch;
- conflicting worktree state;
- hash divergence;
- missing capability;
- insufficient authority;
- invalid workspace;
- unresolved risk classification;
- unexpected physical state;
- ambiguous destructive scope;
- failed precondition;
- invalid or incomplete evidence.

When a required precondition cannot be established, the default behavior SHALL
be fail-closed.

The AI SHALL NOT substitute statements equivalent to "probably safe" for a
required authority check.

---

## 9. Autonomous Progress Within Authority

Governed AI SHOULD be capable of making useful autonomous progress without
requiring human confirmation for every ordinary technical step.

Within an authorized objective and valid capabilities, an AI MAY perform a
sequence conceptually equivalent to:

inspect
→ analyze
→ plan
→ read
→ propose
→ patch
→ validate
→ diagnose failure
→ correct
→ validate again
→ report

provided each operation remains inside the granted authority boundary.

The purpose of human authority is not to force the human to micromanage every
technical operation.

The purpose is to preserve human sovereignty over decisions that materially
cross an authority boundary.

---

## 10. Human Escalation Boundary

Technical difficulty alone SHALL NOT require human escalation.

The AI SHOULD escalate when it reaches a material decision or authority
frontier.

Examples MAY include:

- significant architectural decisions;
- destructive operations;
- normative protocol changes;
- reduction of an existing guarantee;
- operations outside the authorized workspace;
- credential or secret handling requiring human action;
- publication;
- release;
- protected remote promotion;
- irreversible operations;
- creation or expansion of authority;
- material ambiguity in human intent;
- conflicting requirements that cannot safely be resolved;
- a decision explicitly reserved for human authority.

The AI SHOULD resolve ordinary technical implementation decisions itself when
they remain within the authorized objective and governance boundary.

---

## 11. Cognitive Capability Does Not Increase Authority

The sophistication of an AI system SHALL NOT determine its operational
authority.

Therefore:

high reasoning capability
≠
high execution authority

agentic capability
≠
shell authority

engineering specialization
≠
mutation authority

multi-agent consensus
≠
execution authority

A more capable model MAY produce better plans.

It SHALL NOT receive additional physical authority merely because it is more
capable.

---

## 12. Evidence-Based Validation

Mutation completion SHALL require appropriate validation.

Writing a file SHALL NOT by itself establish successful task completion.

Depending on the operation, evidence MAY include:

- syntax validation;
- compilation;
- build results;
- relevant tests;
- regression tests;
- process exit status;
- Git state;
- hashes;
- tree identity;
- CAS evidence;
- journal records;
- operation records;
- recovery evidence;
- invariant checks.

The AI SHALL distinguish between:

- action performed;
- action validated;
- objective satisfied.

These are not necessarily equivalent states.

---

## 13. Failure Is Evidence

A failed validation SHALL be treated as evidence.

The AI SHALL NOT hide, suppress or manipulate a failure merely to preserve a
green status.

When a validation fails, the AI SHOULD determine whether the cause is:

- a regression;
- an implementation defect;
- a pre-existing defect;
- an obsolete expectation;
- an environmental problem;
- a test defect;
- an authority/precondition problem;
- another identifiable cause.

The AI SHOULD correct the cause when correction is within authority.

The AI SHALL NOT merely modify validation criteria to make an incorrect
implementation appear successful.

---

## 14. Evidence Over Narrative

AI narrative SHALL NOT substitute for mechanically available evidence.

Statements such as:

- "the repository is clean";
- "the tests passed";
- "the expected commit is active";
- "the patch is safe";
- "the operation completed";

SHOULD be supported by governed evidence when such evidence is available.

Preferred evidence includes:

- exit status;
- HEAD identity;
- branch identity;
- worktree state;
- hashes;
- tree identity;
- test results;
- build results;
- operation records;
- journal records;
- CAS state.

The AI explains evidence.

It does not replace evidence.

---

## 15. BH-SDP Continuity

Governed AI SHALL preserve sufficient logical continuity across execution
frontiers.

The continuity state SHOULD be capable of representing, as applicable:

- project;
- protocol version;
- operating mode;
- strategy;
- current phase;
- baseline;
- repository authority;
- current objective;
- validated components;
- changes performed;
- known risks;
- blockers;
- human decisions;
- pending authority frontiers;
- next step.

Changing the AI provider SHALL NOT invalidate the logical authority history.

Changing:

Ollama → Codex

Codex → another provider

one model → another model

one session → another session

SHALL NOT by itself reset the governed project state.

---

## 16. Provider Independence

The Governed AI Behavior Contract SHALL apply independently of provider.

It SHALL apply to integrations including, where supported:

- Ollama;
- Llama-family models;
- Codex;
- OpenAI-compatible providers;
- Anthropic-compatible providers;
- Google-compatible providers;
- future local models;
- future remote models;
- engineering agents;
- multi-agent coordinators;
- specialized review or testing agents.

Provider replacement SHALL NOT weaken the contract.

No provider-specific capability SHALL implicitly supersede BH-SEP, BH-SDP or
Surgical DevOps governance.

---

## 17. Cognitive Instruction Layer

Each AI integration SHALL receive sufficient normative context to understand
the expected Surgical DevOps behavior.

This MAY include structured instructions describing:

- the authority hierarchy;
- inspection requirements;
- PATCH preference;
- baseline preservation;
- fail-closed behavior;
- escalation boundaries;
- evidence requirements;
- validation requirements;
- BH-SDP continuity;
- prohibited authority expansion.

The exact prompt format is an implementation detail.

However, the semantic behavior contract SHALL remain stable across providers
where technically possible.

---

## 18. Mechanical Enforcement Layer

The Orchestrator SHALL NOT trust cognitive instruction as the sole enforcement
mechanism.

Physical operations SHALL remain governed by mechanical controls including, as
applicable:

- workspace boundaries;
- capability grants;
- policy;
- risk classification;
- human authority;
- state validation;
- CAS;
- mutation transaction boundaries;
- journaling;
- durability;
- recovery;
- process restrictions;
- governed filesystem adapters;
- governed Git adapters.

If the AI proposes an unauthorized operation, the Orchestrator SHALL be able to
block it independently of the AI's reasoning.

This is a core security property.

---

## 19. AI Output Is Untrusted Input

AI output SHALL be treated as untrusted input to the governance layer.

This applies even when the AI:

- generated the correct answer previously;
- is operating locally;
- is considered highly capable;
- is specialized for software engineering;
- is a paid provider;
- is a trusted vendor;
- has multiple agents agreeing on the same action.

AI confidence SHALL NOT substitute for authority.

AI consensus SHALL NOT substitute for authority.

---

## 20. No Self-Expansion of Authority

An AI SHALL NOT grant itself additional capabilities.

An AI SHALL NOT reinterpret a capability grant to expand its scope.

An AI SHALL NOT create an alternate execution path intended to bypass a denied
operation.

An AI SHALL NOT treat access to a tool as permission to use that tool for any
purpose.

Tool availability and operational authority are distinct concepts.

---

## 21. Multi-Agent Behavior

Future multi-agent coordination SHALL preserve the same contract.

Individual agents MAY specialize in:

- planning;
- coding;
- review;
- testing;
- security analysis;
- documentation;
- research.

A coordinator MAY assign cognitive work among agents.

However, neither an individual agent nor the coordinator SHALL acquire
operational authority merely through delegation.

Agent-to-agent delegation SHALL NOT transfer Surgical DevOps capabilities
implicitly.

Any physical effect SHALL cross the canonical Surgical DevOps governance
boundary.

---

## 22. Interaction Modes

The contract SHALL apply to every interaction mode established by ADR-011.

Natural Mode MAY hide most governance mechanics from the user.

Engineer Mode MAY expose plans, risks, affected artifacts, validations and
authority frontiers.

Expert / Deterministic Mode MAY expose explicit governed commands and lower
level controls.

The presentation MAY differ.

The authority model SHALL NOT.

Natural Mode SHALL NOT mean reduced governance.

Engineer Mode SHALL NOT mean increased implicit authority.

Expert Mode SHALL NOT mean unrestricted authority.

---

## 23. Safe Provider Failure

AI provider failure SHALL fail safely.

Examples include:

- provider unavailable;
- timeout;
- malformed output;
- context overflow;
- invalid structured response;
- model refusal;
- model crash;
- local runtime failure;
- network failure.

Provider failure SHALL NOT corrupt the authority state.

Surgical DevOps MAY:

- retry within policy;
- select another configured provider;
- fall back to local AI;
- fall back to Expert Mode;
- request human action;
- stop safely.

Provider failure SHALL NOT justify governance bypass.

---

## 24. Auditability

Governed AI decisions SHOULD be attributable where practical.

The system SHOULD be able to distinguish:

- human intent;
- AI interpretation;
- AI proposal;
- governance decision;
- human approval where required;
- executed operation;
- validation evidence;
- final outcome.

The exact persistence representation is an implementation decision.

However, AI reasoning/proposal and operational authority SHOULD NOT collapse
into an indistinguishable event.

---

## 25. Security Invariants

The following invariants are mandatory:

1. Human authority remains sovereign.
2. AI authority remains delegated and bounded.
3. Surgical DevOps remains operationally authoritative.
4. Intent does not equal execution permission.
5. Inspection precedes mutation when required.
6. PATCH remains the default mutation strategy.
7. Qualified baseline behavior is preserved unless explicitly superseded.
8. Unresolved operational uncertainty fails closed.
9. AI may progress autonomously only within granted authority.
10. Human escalation occurs at material authority or decision frontiers.
11. Cognitive capability does not increase operational authority.
12. AI output is untrusted until governed.
13. Validation requires evidence appropriate to the operation.
14. Failures SHALL NOT be hidden merely to preserve a successful status.
15. Narrative SHALL NOT substitute for mechanically available evidence.
16. BH-SDP continuity survives provider and session changes.
17. Provider choice SHALL NOT weaken governance.
18. Prompt compliance SHALL NOT be a security boundary.
19. Physical effects SHALL be mechanically governable.
20. AI SHALL NOT expand its own authority.
21. Multi-agent delegation SHALL NOT transfer operational authority implicitly.
22. Provider failure SHALL fail safely.

---

## 26. Implementation Direction

The v2.5 implementation SHOULD realize this contract incrementally.

The preferred layering is:

Human
→ Interaction Mode
→ Intent Interpreter
→ AI Provider / Engineering Agent
→ Structured Cognitive Proposal
→ Governed Planning
→ Surgical DevOps Authority Boundary
→ Canonical Orchestrator
→ Governed Capability
→ Physical Effect
→ Validation
→ BH-SDP Continuity

The implementation SHOULD avoid placing provider-specific logic inside the
canonical mutation authority mechanisms.

---

## 27. Preservation of v2.4.1

This decision extends the qualified v2.4.1 baseline.

It SHALL NOT justify weakening:

- deterministic orchestration;
- workspace boundaries;
- human authority;
- risk classification;
- capability grants;
- governed reads;
- governed mutation;
- Manifest CAS;
- mutation journaling;
- durability;
- recovery;
- fail-closed behavior.

The addition of AI autonomy SHALL preserve these guarantees.

---

## 28. Rejected Alternatives

### 28.1 Prompt-only governance

Rejected.

Prompt instructions improve expected cognitive behavior but do not constitute a
sufficient security boundary.

### 28.2 Fully unrestricted autonomous agent

Rejected as the canonical architecture.

It collapses cognitive authority and operational authority.

### 28.3 Human approval for every technical step

Rejected.

It would unnecessarily reduce productivity and make intent-driven orchestration
equivalent to manual CLI operation.

### 28.4 Provider-specific behavioral governance

Rejected.

The normative behavior must survive provider replacement.

### 28.5 Multi-agent consensus as authority

Rejected.

Agreement among AI agents does not create operational authority.

### 28.6 Successful narrative as validation

Rejected.

Operational success requires appropriate evidence.

---

## 29. Frozen Decision

The following decisions are APPROVED and FROZEN:

1. Surgical DevOps SHALL establish a provider-independent Governed AI Behavior
   Contract.
2. The contract SHALL derive its normative behavior from BH-SEP and BH-SDP.
3. The human remains sovereign authority.
4. AI operates as delegated cognitive authority.
5. Surgical DevOps remains operational authority.
6. Human intent defines an objective but SHALL NOT implicitly grant unrestricted
   execution authority.
7. AI MAY determine technical procedure within the authorized objective.
8. Declarative inspection SHALL precede mutation when required.
9. PATCH SHALL remain the default mutation strategy.
10. Qualified baseline behavior SHALL be preserved unless explicitly
    superseded.
11. Unresolved operational uncertainty SHALL fail closed.
12. AI SHOULD progress autonomously through ordinary technical work while
    remaining within granted authority.
13. Human escalation SHOULD occur at material authority, architecture,
    destructive or equivalent decision frontiers rather than at every technical
    step.
14. AI cognitive capability SHALL NOT determine operational authority.
15. Mutation completion SHALL require appropriate validation evidence.
16. Validation failure SHALL be treated as evidence and SHALL NOT be hidden
    merely to preserve a green result.
17. AI narrative SHALL NOT substitute for mechanically available evidence.
18. BH-SDP continuity SHALL survive provider, model and session changes.
19. The contract SHALL apply to Ollama, Llama, Codex and future providers or
    agents.
20. Cognitive instruction SHALL communicate the behavioral contract to AI
    systems.
21. Cognitive instruction alone SHALL NOT constitute the security boundary.
22. Surgical DevOps SHALL mechanically enforce physical authority independently
    of AI compliance.
23. AI output SHALL be treated as untrusted input to governance.
24. AI SHALL NOT expand its own authority.
25. Multi-agent coordination SHALL NOT create or implicitly transfer execution
    authority.
26. Provider failure SHALL fail safely.
27. The qualified v2.4.1 governance, CAS, journal, durability and recovery
    invariants SHALL remain preserved.
28. Any future proposal to make prompt compliance, AI confidence or AI consensus
    an execution authority requires a new ADR explicitly superseding this
    decision.

---

## 30. Decision Authority

**Decision:** APPROVED / FROZEN

**Date:** 2026-08-22

**Authority:** Project authority through explicit architectural decision.

ADR-014 extends ADR-011, ADR-012 and ADR-013 without superseding their
interaction-mode, provider-independence, multi-agent or governed engineering
agent decisions.
