# ADR-012 — Local AI Provider and Multi-Agent Coordination Boundary

**Status:** APPROVED / FROZEN
**Date:** 2026-08-22
**Decision ID:** SDO-10
**Scope:** Surgical DevOps / AI Providers / Local AI / Multi-Agent Coordination
**Extends:** ADR-002, ADR-004, ADR-005, ADR-006 and ADR-011

---

## 1. Context

ADR-011 establishes Intent-Driven Orchestration and separates AI decision
autonomy from Surgical DevOps execution authority.

Surgical DevOps must not require a paid external AI provider in order to use
intent-driven orchestration.

Users and engineers SHALL be able to select a local/free AI execution path
where technically feasible.

At the same time, the architecture must remain provider-independent and capable
of evolving toward multiple specialized AI agents without transferring
execution authority from the Surgical DevOps Orchestrator to an AI coordinator.

---

## 2. Decision

Surgical DevOps SHALL support local/free AI providers as first-class selectable
options.

Ollama is APPROVED as the first reference local AI model runtime/provider for
the Intent-Driven Orchestration architecture.

The selected AI model SHALL remain configurable.

Llama 3 MAY be offered as one supported local model.

Llama 3 SHALL NOT become mandatory, normative or architecturally privileged.

Other compatible models MAY be used through Ollama without redefining the
Surgical DevOps governance architecture.

---

## 3. Provider Selection

The user-facing architecture SHALL permit explicit AI provider selection.

A provider selector MAY expose options conceptually equivalent to:

1. Local / Free — Ollama
2. OpenAI
3. Anthropic
4. Google
5. Other supported provider
6. Custom compatible provider

Provider availability MAY differ by installation, platform, deployment or
commercial configuration.

No specific commercial AI provider SHALL become mandatory.

---

## 4. Local / Free Mode

The Local / Free AI option SHALL permit Intent-Driven Orchestration without
requiring a paid inference API.

The initial reference architecture is:

Human Intent
→ Interaction Mode
→ AI Provider Selector
→ Ollama
→ Selected Local Model
→ AI Reasoning Layer
→ Surgical DevOps Orchestrator
→ Governed Execution

Local execution SHALL NOT be interpreted as trusted execution.

AI output produced by a local model SHALL remain untrusted input until validated
by the Surgical DevOps governance boundary.

---

## 5. Ollama Boundary

Ollama SHALL be treated as an AI model runtime/provider boundary.

Ollama SHALL NOT become:

- the Surgical DevOps authority boundary;
- the mutation authority;
- the policy authority;
- the human approval authority;
- the risk-classification authority;
- the capability-grant authority;
- the journal authority;
- the CAS authority;
- the recovery authority.

The Surgical DevOps Orchestrator remains responsible for all such governance
functions.

---

## 6. Model Independence

The architecture SHALL distinguish between:

- AI provider;
- AI runtime;
- AI model;
- AI role;
- Surgical DevOps authority.

A local model MAY be replaced without redefining the Orchestrator.

A remote provider MAY be replaced without redefining the Orchestrator.

Model selection SHALL remain a configuration concern unless a future ADR
explicitly changes this decision.

---

## 7. AI Reasoning Authority

A selected model MAY perform cognitive functions authorized by ADR-011,
including:

- intent interpretation;
- reasoning;
- diagnosis;
- operational decision-making;
- planning;
- artifact selection;
- validation selection;
- proposal generation;
- evaluation;
- explanation.

The selected AI model SHALL NOT acquire additional execution authority merely
because it made a decision.

The normative rule remains:

> AI decides the permitted procedure.
> Surgical DevOps governs execution authority.

---

## 8. Future Multi-Agent Architecture

Surgical DevOps SHALL be architected so that multiple AI agents or specialized
AI roles MAY be supported in the future.

Possible roles MAY include:

- Coordinator;
- Planner;
- Implementation Agent;
- Test Agent;
- Reviewer;
- Security Reviewer;
- Documentation Agent;
- Domain Specialist.

Different roles MAY use:

- the same model;
- different local models;
- different remote models;
- different AI providers;
- combinations of local and remote providers.

No specific multi-agent topology is frozen by this ADR.

---

## 9. AI Agent Coordinator

A future AI Agent Coordinator MAY:

- decompose objectives;
- assign work to agents;
- select specialized roles;
- coordinate reasoning;
- aggregate proposals;
- compare alternatives;
- resolve cognitive workflow;
- determine execution proposals.

However:

> Agent coordination is not execution authority.

The AI Agent Coordinator SHALL NOT become the Surgical DevOps Orchestrator.

The Coordinator governs cognitive workflow.

The Surgical DevOps Orchestrator governs operational authority.

---

## 10. Authority Separation

The normative architecture is:

Human
→ declares intent

AI Coordinator / AI Provider
→ interprets
→ reasons
→ decides
→ plans
→ coordinates

Surgical DevOps Orchestrator
→ validates scope
→ applies policy
→ classifies risk
→ validates authority
→ grants bounded capabilities
→ enforces human approval where required
→ governs mutation
→ governs CAS
→ governs journal
→ governs recovery
→ verifies execution

Project Workspace
→ receives only governed operations

No AI agent, coordinator, provider or model SHALL bypass this authority chain.

---

## 11. Delegation Between Agents

Delegation from one AI agent to another SHALL NOT transfer execution authority.

An agent SHALL NOT gain authority because:

- a coordinator assigned it a task;
- another agent requested an operation;
- a model recommended an action;
- the operation originated from a local provider;
- multiple agents agreed on a proposal.

Authority SHALL continue to originate from Surgical DevOps governance.

---

## 12. Initial Implementation Strategy

The first Intent-Driven implementation SHOULD use a single selected AI
provider/model before introducing multi-agent coordination.

Preferred initial path:

Human Intent
→ Selected AI Provider
→ Interpret
→ Reason
→ Decide
→ Plan
→ Surgical DevOps Orchestrator
→ Governed Execution

This path SHALL be qualified end-to-end before multi-agent execution complexity
is introduced.

---

## 13. Multi-Agent Introduction Criteria

Multi-agent coordination SHOULD be introduced only after the single-agent path
has demonstrated:

1. deterministic provider contracts;
2. structured intent interpretation;
3. bounded planning;
4. governed repository inspection;
5. governed proposal handling;
6. correct authority-frontier escalation;
7. safe mutation integration;
8. validation and evidence generation;
9. provider failure isolation;
10. preservation of existing Surgical DevOps authority invariants.

---

## 14. User Interaction

The provider selector SHALL integrate with the interaction modes established by
ADR-011.

Example:

Interaction Mode:
1. Natural
2. Engineer
3. Expert / Deterministic

AI Provider:
1. Local / Free — Ollama
2. OpenAI
3. Anthropic
4. Google
5. Other / Custom

Local Model:
1. Llama 3
2. Other installed model
3. Custom model

Exact UI representation is an implementation detail.

The architectural requirement is explicit, replaceable selection.

---

## 15. Commercial Independence

Surgical DevOps SHALL NOT require paid AI inference merely to provide its core
Intent-Driven Orchestration capability.

A local/free execution path is an approved product capability.

Commercial AI providers MAY provide:

- higher reasoning quality;
- larger context;
- specialized models;
- managed inference;
- enterprise integrations.

These advantages SHALL NOT convert a commercial provider into an architectural
dependency.

---

## 16. Security

Local AI providers SHALL be governed by the same trust principles as remote AI
providers.

Local execution SHALL NOT automatically grant:

- shell access;
- unrestricted filesystem access;
- unrestricted Git access;
- credential access;
- mutation authority;
- remote publication authority;
- deployment authority.

Provider output SHALL remain subject to validation.

Malformed, adversarial or unexpected AI output SHALL fail closed at the
Orchestrator boundary.

---

## 17. Failure Semantics

Failure of Ollama, a local model, a remote provider or an AI coordinator SHALL
NOT corrupt Surgical DevOps authority state.

Provider failure SHALL be distinguishable from execution failure.

Provider unavailability SHALL NOT authorize bypass of governance.

If no valid provider is available, the system MAY:

- fall back to another configured provider;
- remain in Expert / Deterministic Mode;
- request user action;
- stop safely.

---

## 18. Preservation of Existing Baseline

The implementation authorized by this ADR SHALL extend the qualified
Surgical DevOps v2.4.1 baseline.

The following SHALL NOT be weakened merely to enable AI integration:

- workspace boundaries;
- deterministic inspection;
- authenticated human authority;
- risk classification;
- capability grants;
- mutation transaction;
- Manifest CAS;
- journal;
- durability;
- recovery;
- fail-closed behavior;
- provider independence.

---

## 19. Rejected Alternatives

### 19.1 Mandatory paid AI provider

Rejected because it creates cost dependency and vendor coupling.

### 19.2 Llama 3 as mandatory model

Rejected because models evolve independently of Surgical DevOps authority.

### 19.3 Ollama as Orchestrator

Rejected because model runtime and execution authority are distinct concerns.

### 19.4 Multi-agent implementation before single-agent qualification

Rejected because it introduces unnecessary complexity before the fundamental
Intent-Driven path is proven.

### 19.5 Agent delegation as capability delegation

Rejected because cognitive delegation SHALL NOT create operational authority.

---

## Amendment 2026-08-23 — NATURAL Default Local AI and Provider Cost Neutrality

**Status:** APPROVED / FROZEN

### NATURAL default local AI experience

For the NATURAL interaction profile, Surgical DevOps SHALL prefer Llama 3
through the approved Ollama local AI provider boundary as the default
cognitive user experience when that provider and model are locally available
and qualified for the requested cognitive function.

This is a product-experience default only.

Llama 3 SHALL NOT become mandatory, normative, architecturally privileged or
an operational authority boundary. Ollama SHALL NOT become mandatory.

The provider-independent architecture established by this ADR remains
unchanged. A user or organization MAY replace the default model or provider
with another supported local or remote AI provider without redefining the
Surgical DevOps Orchestrator, BH-SEP, BH-SDP, human authority, risk
classification, capability boundaries or fail-closed semantics.

No AI provider or model receives direct operational authority merely because
it is selected as the NATURAL cognitive provider.

### Deterministic fallback

If the default local AI provider or model is absent, unavailable, incompatible
or not qualified for the requested cognitive function, Surgical DevOps SHALL
preserve safe startup and all deterministic capabilities that do not require
that AI provider.

Provider unavailability SHALL NOT authorize governance bypass.

The NATURAL experience SHOULD clearly distinguish between:

- cognitive AI availability; and
- deterministic Surgical DevOps availability.

### User-facing provider transparency

The NATURAL experience SHOULD identify the active cognitive provider/model
when materially useful and SHALL make clear that compatible AI providers may
be substituted.

The product SHALL NOT imply that a specific AI vendor is required in order to
preserve Surgical DevOps governance.

For the approved local default, user-facing language MAY explain that local
execution can operate without per-call API charges, while remaining subject
to the applicable model/runtime licenses, local computing resources and other
costs borne by the user.

The product SHALL NOT describe this property in a manner that implies absence
of all possible cost, licensing condition or infrastructure requirement.

### External AI provider costs

A supported external or commercial AI provider MAY charge the user or
organization directly according to that provider's own pricing, plans, usage
rules, licenses and contractual terms.

Unless a future explicit commercial decision establishes a separate managed
AI offering, Surgical DevOps SHALL NOT receive, act as an intermediary for, or retain
payments, usage charges, provider fees or commissions arising from the
customer's consumption of third-party AI providers.

Selection of an external AI provider therefore SHALL NOT, by itself, create a
commission or revenue-share relationship between Surgical DevOps and that AI
provider.

Responsibility for selecting, contracting with and paying an external AI
provider remains with the user or organization using that provider, subject
to the provider's own terms.

### Preserved invariants

This amendment does not alter the previously frozen requirements that:

1. Ollama is a replaceable AI runtime/provider boundary.
2. Llama 3 is a replaceable model.
3. no paid AI provider is mandatory;
4. provider replacement does not redefine Orchestrator authority;
5. cognitive delegation does not create operational authority;
6. local and remote providers remain subject to the same governance
   principles;
7. provider failure fails safely; and
8. the deterministic core remains usable without an AI provider for
   capabilities that do not require cognitive inference.

## 20. Frozen Decision

The following decisions are APPROVED and FROZEN:

1. Surgical DevOps SHALL support a Local / Free AI provider option.
2. Ollama is the first approved reference local AI runtime/provider.
3. Llama 3 MAY be supported but SHALL NOT be mandatory.
4. Local AI model selection SHALL remain configurable.
5. Commercial and remote AI providers remain supported through replaceable
   provider contracts.
6. Ollama SHALL NOT become the Surgical DevOps authority boundary.
7. Local execution SHALL NOT imply trusted execution.
8. AI output remains untrusted until governed by Surgical DevOps.
9. The architecture SHALL permit future multi-agent coordination.
10. A future AI Agent Coordinator MAY coordinate cognition and work allocation.
11. AI Agent Coordinator and Surgical DevOps Orchestrator SHALL remain distinct.
12. Agent coordination SHALL NOT constitute execution authority.
13. Delegation between AI agents SHALL NOT transfer capabilities.
14. The first implementation SHOULD qualify a single-agent provider path before
    introducing multi-agent execution.
15. All providers and agents SHALL remain subordinate to the same normative
    Surgical DevOps governance core.
16. The qualified v2.4.1 authority, mutation, CAS, journal and recovery
    invariants SHALL be preserved.
17. Any future proposal making an AI provider, model or coordinator the
    unrestricted execution authority requires a new ADR explicitly superseding
    this decision.

---

## 21. Decision Authority

**Decision:** APPROVED / FROZEN

**Date:** 2026-08-22

**Authority:** Project authority through explicit architectural decision.

ADR-012 extends ADR-011 without superseding the human-authority, trust-boundary,
provider-independence or governed-execution decisions established previously.
