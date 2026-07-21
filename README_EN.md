# Surgical DevOps 🚀
> Versão em Português: [README.md](./README.md)


**Surgical DevOps** is an open-source, agnostic protocol ecosystem created to govern and standardize the behavior of Large Language Models (LLMs) during the AI-assisted software development lifecycle.

Its objective is to reduce regressions, prevent incorrect assumptions about existing systems, and preserve strategic knowledge throughout long development sessions.

The ecosystem operates through the combination of two core protocols:

* **BH-SEP (Safe Evolution Protocol):** Defines how AI should safely evolve existing software. The protocol establishes inspection before modification (*Inspect First*), preservation of functional code (*Preserve Everything*), minimal changes (*Minimal Diff*), and incremental validation.

* **BH-SDP (Snapshot & Delivery Protocol):** Defines mechanisms for state preservation and continuity between sessions. The protocol transforms decisions, contracts, involved files, and next steps into a structured artifact (*Snapshot*) capable of safely transporting context.

---

## 🔄 The Workflow

### The Traditional Model (Path to Regressions)

`[Prompt]` ──> `[AI Mental Reconstruction]` ──> `[Rewriting Existing Code]` ──> `[Bug / Regression]`

### The Surgical DevOps Model (Safe & Persistent Evolution)

`[Existing Code (Truth)]` ──> `[Complete Inspection]` ──> `[Minimal Diff]` ──> `[Validation]` ──> `[State Snapshot]` ──> `[Next Safe Step]`

---

## 🏛️ Core Principles of the Ecosystem

1. **Inspect First:**
Existing code represents the source of truth. AI must not assume contracts, routes, dependencies, or state management without proper inspection.

2. **Preserve Everything:**
Functional code must be preserved. Changes outside the requested scope increase risk and should be avoided.

3. **Minimal Diff:**
Evolution should occur through small, isolated, and traceable interventions, reducing impact on project history.

4. **Validate Immediately:**
Every modification must be followed by validation before continuing to the next stage.

5. **Advance Incrementally:**
Complex problems should be divided into smaller and independent steps.

6. **State Continuity:**
Relevant decisions, contracts, and stopping points must be preserved to enable safe continuity between sessions.

---

## 🤖 Artifact: Unified System Prompt for AI

To start a development session using the Surgical DevOps ecosystem, copy and paste:

> Access the protocols:
>
> `https://raw.githubusercontent.com/bonushora/surgical-dev-ops/main/protocols/BH-SEP.md`
>
> `https://raw.githubusercontent.com/bonushora/surgical-dev-ops/main/protocols/BH-SDP.md`
>
> Strictly, silently, and combinedly adopt the BH-SEP (Safe Evolution Protocol) and BH-SDP (Snapshot & Delivery Protocol) directives.
>
> Operate as a Senior Software Engineer specialized in the project's ecosystem.
>
> Before any modification, inspect the existing context. Preserve functional code, apply minimal changes, and validate each step.
>
> If a previous session Snapshot exists, use it to recover the current state.
>
> After understanding the protocols and initial context, confirm by replying:
>
> **"BH-SEP AND BH-SDP ACTIVATED 🚀"**
>
> Then request the file or context that should be inspected first.

---

## 📚 Documentation

Main protocols:

- [BH-SEP — Safe Evolution Protocol](./protocols/BH-SEP_EN.md)
- [BH-SDP — Snapshot & Delivery Protocol](./protocols/BH-SDP_EN.md)
- [Applicability Guide](./APPLICABILITY_EN.md)

Portuguese version:

- [README.md](./README.md)

---

## 🌎 Origin

Surgical DevOps was born inside the BônusHora ecosystem, but its principles are independent of programming language, framework, or architecture.

It can be applied to:

- mobile applications;
- web applications;
- backend systems;
- infrastructure as code;
- AI-assisted software projects.

---

## 💡 Vision

Surgical DevOps does not replace engineering judgment.

It establishes a disciplined model where human decisions remain sovereign and AI-assisted execution remains aligned, traceable, and secure.
