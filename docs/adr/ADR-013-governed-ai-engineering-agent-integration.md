# ADR-013 — Governed AI Engineering Agent Integration

**Status:** APPROVED / FROZEN
**Date:** 2026-08-22
**Decision ID:** SDO-11
**Scope:** Surgical DevOps / AI Engineering Agents / Codex / Deterministic Orchestrator
**Extends:** ADR-004, ADR-011 and ADR-012

---

## 1. Context

ADR-011 establishes Intent-Driven Orchestration in which AI may interpret human
intent, reason, decide and plan while Surgical DevOps retains execution
authority.

ADR-012 establishes provider independence, a Local / Free AI path through
Ollama, model independence and a future multi-agent coordination boundary.

A further integration class is required for AI systems specialized in software
engineering.

Such systems may provide capabilities beyond ordinary conversational inference,
including repository analysis, implementation planning, code generation,
testing proposals, review and agentic software-engineering workflows.

Codex is APPROVED as the first reference AI engineering agent integration for
this class.

This integration SHALL preserve the deterministic authority boundary already
qualified by Surgical DevOps.

---

## 2. Decision

Surgical DevOps SHALL permit integration with specialized AI engineering agents.

Codex is APPROVED as the first reference integration of this class.

Codex SHALL NOT become:

- the Surgical DevOps Orchestrator;
- an independent execution authority;
- an unrestricted shell authority;
- an unrestricted filesystem authority;
- an unrestricted Git authority;
- a mutation authority outside Surgical DevOps governance;
- a substitute for capability grants;
- a substitute for human authority where human authority is required.

The integration SHALL remain subordinate to the Surgical DevOps deterministic
governance boundary.

---

## 3. Architectural Position

The normative relationship is:

Human Intent
→ Interaction Layer
→ AI Provider / Engineering Agent
→ Structured Reasoning or Execution Proposal
→ Surgical DevOps Governance
→ Surgical Orchestrator
→ Governed Capabilities
→ Workspace

For Codex:

Human Intent
→ Codex Integration
→ reasoning / diagnosis / plan / proposal
→ Surgical DevOps Orchestrator
→ policy / risk / authority / capability validation
→ governed operation

Codex SHALL operate above or behind the Surgical DevOps authority boundary,
never around it.

---

## 4. AI Provider and Engineering Agent Distinction

Surgical DevOps SHALL distinguish between a general AI provider and an AI
engineering agent.

A general AI provider MAY primarily provide inference functions such as:

- interpretation;
- reasoning;
- planning;
- evaluation;
- explanation.

An AI engineering agent MAY additionally provide specialized software
engineering behavior such as:

- repository analysis;
- implementation proposals;
- patch generation;
- test planning;
- code review;
- iterative engineering workflows.

Both classes SHALL remain subject to the same Surgical DevOps authority
principles.

Engineering specialization SHALL NOT imply additional authority.

---

## 5. Initial Codex Integration

The first Codex integration SHOULD prefer a governed reasoning/proposal path.

Conceptually:

Human Intent
→ Codex
→ repository reasoning
→ diagnosis
→ implementation plan
→ proposed changes
→ proposed validations
→ Surgical DevOps Orchestrator

At this stage, Codex SHOULD NOT receive unrestricted independent terminal
authority merely because it is capable of agentic execution.

The purpose of the initial integration is to qualify Codex as a cognitive and
engineering provider under Surgical DevOps governance.

---

## 6. Future Governed Agent Execution

A later qualified integration MAY allow Codex or another engineering agent to
request bounded operational capabilities.

Examples MAY include capabilities equivalent to:

- governed filesystem read;
- governed Git read;
- governed validation process execution;
- governed patch application.

Any such capability SHALL be:

- explicit;
- bounded;
- attributable;
- policy-checked;
- risk-classified where applicable;
- limited to the authorized workspace;
- revocable or terminal according to its contract;
- auditable;
- subordinate to Surgical DevOps authority.

The existence of an engineering agent SHALL NOT create generic shell authority.

---

## 7. Prohibited Direct Full-Autonomy Bypass

Surgical DevOps SHALL NOT define its canonical Codex integration as:

Surgical DevOps
→ unrestricted autonomous Codex
→ unrestricted terminal
→ workspace

if that path bypasses Surgical DevOps policy, capability, risk, authority,
journal, CAS, recovery or validation boundaries.

Agent autonomy SHALL be bounded by governance.

The engineering agent MAY decide how to solve an authorized objective.

It SHALL NOT decide unilaterally what operational authority it possesses.

---

## 8. Deterministic Orchestrator Authority

The Surgical DevOps Orchestrator remains authoritative for operational
governance.

When an AI engineering agent requests or proposes operation X, Surgical DevOps
MUST be able to determine, as applicable:

1. whether X belongs to the declared objective;
2. whether X is inside the authorized workspace;
3. whether X is permitted by policy;
4. the risk classification of X;
5. whether the required capability exists;
6. whether human approval is required;
7. whether physical state still satisfies the expected authority boundary;
8. whether X may proceed;
9. how X is recorded and validated.

The result SHALL be an explicit governed outcome such as ALLOWED, BLOCKED,
DENIED, REQUIRES_AUTHORITY or an equivalent fail-closed state.

---

## 9. Provider Selection

The AI selection architecture MAY expose choices conceptually equivalent to:

1. Local / Free — Ollama;
2. Codex;
3. OpenAI-compatible provider;
4. Anthropic-compatible provider;
5. Google-compatible provider;
6. other supported provider;
7. custom compatible provider.

Exact naming and user-interface representation are implementation details.

Codex SHALL NOT be mandatory.

Ollama SHALL NOT be mandatory.

No commercial AI provider SHALL become a mandatory dependency of the normative
Surgical DevOps governance core.

---

## 10. Provider Contract Direction

The v2.5 AI Provider Port SHALL be designed so that Codex can be integrated
without modifying the normative mutation-provider authority contract.

AI provider contracts and mutation-provider contracts SHALL remain distinct.

The term provider SHALL NOT be used to transfer mutation authority implicitly
to an AI model or engineering agent.

Conceptually, an AI provider contract MAY expose cognitive operations such as:

- interpret;
- reason;
- plan;
- propose;
- evaluate;
- explain.

A future engineering-agent contract MAY expose requests for governed actions,
but those requests SHALL cross the Surgical DevOps authority boundary before
physical execution.

---

## 11. Mutation Provider Separation

The existing Surgical DevOps mutation-provider abstraction represents governed
physical mutation authority.

It SHALL NOT be repurposed to represent Codex, Ollama, Llama or another AI
provider.

AI Provider:

AI cognition / engineering proposal

Mutation Provider:

bounded physical mutation implementation

These concerns SHALL remain separate.

This separation prevents AI selection from becoming mutation-authority
selection.

---

## 12. Multi-Agent Compatibility

The Codex integration SHALL remain compatible with the future multi-agent
architecture authorized by ADR-012.

A future topology MAY include:

AI Coordinator
→ Local Planner
→ Codex Engineering Agent
→ Review Agent
→ Test Agent
→ Surgical DevOps Orchestrator
→ Governed Execution

Different agents MAY use different models and providers.

However:

> Multi-agent consensus does not create execution authority.

The Surgical DevOps Orchestrator remains the operational authority boundary.

---

## 13. Human Interaction Modes

Codex integration SHALL be usable through the interaction modes established by
ADR-011.

Natural Mode MAY hide most engineering-agent mechanics.

Engineer Mode MAY expose:

- diagnosis;
- implementation plan;
- affected artifacts;
- risk;
- proposed patches;
- validation evidence;
- authority frontiers.

Expert / Deterministic Mode MAY expose lower-level governed controls.

No interaction mode SHALL require that the user grant unrestricted authority to
Codex.

---

## 14. Security Invariants

The following invariants SHALL apply to Codex and future engineering agents:

1. AI output is untrusted until governed.
2. Agent specialization does not imply authority.
3. Agent autonomy does not imply shell authority.
4. Repository access SHALL remain bounded.
5. Mutation SHALL remain governed.
6. Risk classification SHALL not be bypassed.
7. Human authority SHALL remain enforceable.
8. Capability grants SHALL remain bounded.
9. CAS invariants SHALL remain preserved.
10. Journal and recovery invariants SHALL remain preserved.
11. Provider failure SHALL fail safely.
12. Agent delegation SHALL not transfer authority implicitly.

---

## 15. Failure Semantics

Failure, timeout, malformed output or unavailability of Codex SHALL NOT corrupt
Surgical DevOps authority state.

Codex failure SHALL be distinguishable from governed execution failure.

If Codex is unavailable, Surgical DevOps MAY:

- use another configured AI provider;
- use a local provider;
- continue in Expert / Deterministic Mode;
- request user action;
- stop safely.

Provider unavailability SHALL NOT authorize governance bypass.

---

## 16. Implementation Sequence

The preferred implementation sequence remains:

v2.5-A
Interaction Mode Contract

v2.5-B
AI Provider Port, including architectural compatibility with Codex

v2.5-C
Ollama reference adapter

v2.5-D
Intent Interpreter

v2.5-E
Governed Planning Layer

v2.5-F
Single-Agent Governed Loop

v2.5-G
Natural Mode

v2.5-H
Engineer Mode

v2.5-I
Expert compatibility qualification

v2.5-J
End-to-end AI qualification

Codex integration MAY be introduced incrementally through the AI Provider Port
without requiring that unrestricted agent execution be enabled.

A later phase MAY qualify bounded engineering-agent action requests.

---

## 17. Preservation of v2.4.1 Baseline

This decision SHALL extend, not replace, the qualified Surgical DevOps v2.4.1
baseline.

The implementation SHALL preserve:

- deterministic orchestration;
- workspace boundaries;
- human authority;
- risk classification;
- capability grants;
- governed reads;
- governed mutation;
- Manifest CAS;
- mutation journal;
- durability;
- recovery;
- fail-closed behavior;
- Expert / Deterministic compatibility.

No Codex integration benefit SHALL justify weakening these invariants.

---

## 18. Rejected Alternatives

### 18.1 Codex as unrestricted execution authority

Rejected because AI engineering capability and operational authority are
different concerns.

### 18.2 Direct unrestricted terminal integration as the canonical path

Rejected because it can bypass the qualified Surgical DevOps governance
boundary.

### 18.3 Codex represented as the existing mutation provider

Rejected because cognitive provider selection and physical mutation authority
must remain separate.

### 18.4 Codex as mandatory AI provider

Rejected because Surgical DevOps remains provider-independent.

### 18.5 Prohibiting future bounded Codex execution entirely

Rejected because governed agent execution may provide substantial engineering
value when capabilities are explicitly bounded and qualified.

---

## 19. Frozen Decision

The following decisions are APPROVED and FROZEN:

1. Surgical DevOps SHALL support specialized AI engineering-agent integrations.
2. Codex is the first approved reference engineering-agent integration.
3. Codex SHALL remain subordinate to the Surgical DevOps deterministic
   Orchestrator.
4. Codex SHALL NOT become an independent or parallel execution authority.
5. Codex SHALL NOT receive unrestricted shell authority merely because it is an
   agentic engineering system.
6. The initial Codex path SHOULD prioritize reasoning, diagnosis, planning and
   proposals.
7. Future Codex execution MAY use explicitly bounded governed capabilities after
   qualification.
8. AI Provider and mutation-provider contracts SHALL remain separate.
9. The existing mutation-provider abstraction SHALL NOT be repurposed as the
   Codex integration contract.
10. Codex SHALL remain optional and replaceable.
11. Local/free AI through Ollama SHALL remain compatible with Codex integration.
12. Future multi-agent coordination MAY use Codex as one specialized agent.
13. Multi-agent coordination or consensus SHALL NOT create execution authority.
14. All physical effects SHALL remain subordinate to Surgical DevOps governance.
15. The qualified v2.4.1 authority, CAS, journal, durability and recovery
    invariants SHALL be preserved.
16. Any future proposal granting unrestricted execution authority to an AI
    engineering agent requires a new ADR explicitly superseding this decision.

---

## 20. Decision Authority

**Decision:** APPROVED / FROZEN

**Date:** 2026-08-22

**Authority:** Project authority through explicit architectural decision.

ADR-013 extends ADR-011 and ADR-012 without superseding their human-authority,
provider-independence, local-AI or multi-agent authority-boundary decisions.
