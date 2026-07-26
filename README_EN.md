# Surgical DevOps 🚀
> Versão em Português: [README.md](./README.md)

**Surgical DevOps** is an open-source, agnostic protocol ecosystem created to govern and standardize the behavior of Large Language Models (LLMs) during the AI-assisted software development lifecycle.

Its objective is to reduce regressions, prevent incorrect assumptions about existing systems, and preserve strategic knowledge throughout long development sessions.

The ecosystem operates through the combination of two core protocols:

* **[BH-SEP v2.0](./protocols/BH-SEP_EN.md) (Safe Evolution Protocol):** Defines how AI should safely evolve existing software through Declarative Inspection (*Inspect First*), Dual Modes (*Patch* and *Refactor*), Minimal Diff, and deterministic Schema circuit breakers.

* **[BH-SDP v2.0](./protocols/BH-SDP_EN.md) (Snapshot & Delivery Protocol):** Defines mechanisms for state preservation across sessions via Physical Anchors in repository metadata (*Git Commit Hash* and *Test Status*) inside a strict JSON block.

---

## 🔄 The Workflow

### The Traditional Model (Path to Regressions)

`[Prompt]` ──> `[AI Mental Reconstruction]` ──> `[Rewriting Existing Code]` ──> `[Bug / Regression]`

### The Surgical DevOps v2.0 Model (Harness & Physical Anchors)

`[Existing Code (Truth)]` ──> `[Declarative Inspection]` ──> `[Minimal Diff / Circuit Breaker]` ──> `[Pass/Fail Validation]` ──> `[Anchored Snapshot]` ──> `[Next Safe Step]`

---

## 🏛️ Core Principles of the Ecosystem

1. **Inspect First:**
Existing code represents the source of truth. The AI must declare lines and diagnoses before proposing changes.

2. **Preserve Everything:**
Functional code must be preserved. Changes outside the requested scope increase risk and should be avoided.

3. **Minimal Diff:**
Evolution occurs through surgical and isolated interventions (PATCH Mode by default).

4. **Validate Immediately:**
Every modification must be followed by automated validation and tests before continuing.

5. **State Continuity & Physical Anchors:**
Decisions, contracts, and physical state (commit hash and test status) are saved in structured Snapshots.

---

## 🤖 Artifact: Unified System Prompt for AI (v2.0)

To start a development session using the Surgical DevOps v2.0 ecosystem in English, copy and paste:

> Access the protocols:
> `https://raw.githubusercontent.com/bonushora/surgical-dev-ops/main/protocols/BH-SEP_EN.md`
> `https://raw.githubusercontent.com/bonushora/surgical-dev-ops/main/protocols/BH-SDP_EN.md`
>
> Strictly and combinedly adopt the BH-SEP v2.0 (Safe Evolution Protocol) and BH-SDP v2.0 (Snapshot & Delivery Protocol) directives.
>
> Operate as a Senior Software Engineer. Before any modification, perform a Declarative Inspection (inspected lines, root cause, hypothesis, and estimated diff). Respect PATCH Mode by default.
>
> After understanding the protocols, confirm by replying:
> **"BH-SEP v2.0 AND BH-SDP v2.0 ACTIVATED 🚀"**
>
> Then request the file or context to be inspected first.

---

## 📚 Documentation

Main protocols:

- [BH-SEP v2.0 — Safe Evolution Protocol](./protocols/BH-SEP_EN.md)
- [BH-SDP v2.0 — Snapshot & Delivery Protocol](./protocols/BH-SDP_EN.md)
- [Applicability Guide](./APPLICABILITY.md)

Portuguese version:

- [README.md](./README.md)

---

## 🌎 Origin

Surgical DevOps was born inside the BônusHora ecosystem, but its principles are independent of programming language, framework, or architecture.

---

## 💡 Vision

Surgical DevOps does not replace engineering judgment. It establishes a disciplined model where human decisions remain sovereign and AI-assisted execution remains aligned, traceable, and secure.
