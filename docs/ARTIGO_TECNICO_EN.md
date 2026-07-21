# Surgical Context Engineering: Mitigating LLM Hallucinations and Amnesia in Production

## Abstract

The adoption of Large Language Models (LLMs) as coding assistants has increased software development speed, but it has also introduced two major engineering bottlenecks: *context negligence* (which generates regressions in complex systems) and *token exhaustion amnesia* (degradation of chat memory during long development sessions).

This article presents the **Surgical DevOps ecosystem (BH-SEP and BH-SDP)**, an agnostic and practical engineering approach that forces language models to operate through strict code interventions (*Minimal Diffs*) and structured state preservation through *Snapshots*.

---

## 1. The Productivity Paradox with LLMs

The integration of AI assistants such as GPT, Claude, and Gemini into software development workflows provides significant productivity gains. However, as projects grow or chat sessions become longer, developers encounter systemic reliability problems.

Senior engineers commonly face two major challenges:

### 1.1 Context Negligence (The "Guessing" Effect)

When requested to perform a targeted modification, models may attempt to rewrite adjacent stable functions, alter validated method signatures, or assume global states that do not exist.

In legacy systems or software with complex business rules, this behavior breaks code isolation and introduces silent regressions that increase review and maintenance costs.

### 1.2 Token Exhaustion Amnesia (Context Drift)

Every LLM operates within a limited context window. As conversations accumulate logs, source files, and generated code, earlier instructions may lose influence.

The practical symptom is the loss of previously established business rules, architectural decisions, and operational constraints, forcing developers to repeatedly restore the same context.

---

## 2. The Solution: Surgical DevOps Ecosystem

To address these failures without requiring fine-tuning or complex infrastructure, Surgical DevOps introduces a protocol-based approach operating at the interaction layer between developers and AI systems.

The ecosystem is composed of two complementary protocols:


[Existing Code (Truth)] ──> [BH-SEP: Full Inspection] ──> [BH-SEP: Surgical Intervention (Minimal Diff)]

[Clean New Session] <── [BH-SDP: Context Hydration] <── [BH-SDP: State Snapshot]


---

### 2.1 BH-SEP (Safe Evolution Protocol) — The "Truth First" Philosophy

BH-SEP establishes that the existing repository code is the primary source of architectural truth.

The protocol changes AI behavior through two fundamental principles:

1. **Inspect First:**
The model must not generate modifications based on assumptions or incomplete information. It must inspect the complete target file before proposing changes.

2. **Minimal Diff:**
Changes must be isolated and surgical. The AI should modify only the required blocks, reducing Git history impact and protecting unrelated working logic.

---

### 2.2 BH-SDP (Snapshot & Delivery Protocol) — State Encapsulation

BH-SDP addresses context volatility through continuous state preservation.

The protocol introduces **Background Tracking**, where relevant session information is consolidated into structured Snapshots.

A Snapshot may be generated when:

- The context window approaches exhaustion.
- Important business rules or API contracts are established.
- The developer pauses or changes development focus.

A Snapshot contains:

- current objective;
- inspected or modified files;
- architectural decisions;
- established constraints;
- next safe execution steps.

It also provides a **Resumption Directive** allowing a new AI session to continue safely without reconstructing the entire previous conversation.

---

## 3. Practical Implementation

To deploy the ecosystem, developers initialize new AI sessions by loading the official protocols directly from version-controlled sources.

This guarantees that operational rules remain consistent across different AI models and development environments.

### 3.1 Unified Activation Prompt

> Access the protocol URLs:
>
> `https://raw.githubusercontent.com/bonushora/surgical-dev-ops/main/protocols/BH-SEP.md`
>
> `https://raw.githubusercontent.com/bonushora/surgical-dev-ops/main/protocols/BH-SDP.md`
>
> Adopt the BH-SEP (Safe Evolution Protocol) and BH-SDP (Snapshot & Delivery Protocol) directives strictly and silently.
>
> Operate as a Senior Software Engineer following these protocols. If a previous Snapshot is provided, hydrate the current context from it. Otherwise, request the first file or context that must be inspected.

---

## 3.2 Session Handoff Flow (Delivery)

When a development stage is completed or context transfer is required, the AI produces a structured Snapshot:

**📦 BH-SDP AUTOMATIC SNAPSHOT**

- **Current Objective:** Current development goal.
- **Files Inspected or Modified:** Relevant repository files.
- **Critical Definitions Established:** Business rules, contracts, and constraints.
- **Current Status:** Validated state of the implementation.
- **Next Safe Steps:** Ordered continuation instructions.

The developer stores this artifact and provides it to the next clean session after protocol activation.

The new session can immediately continue from the preserved state without unnecessary reconstruction.

---

## 4. Results and Conclusion

The Surgical DevOps ecosystem changes the interaction model between developers and AI assistants.

By reducing unnecessary rewrites, preventing context loss, and preserving architectural decisions, development teams can divide complex engineering tasks into multiple controlled sessions while maintaining predictability, safety, and auditability.

The framework demonstrates that reliable AI-assisted software development depends not only on model capability, but also on disciplined governance of AI behavior.
