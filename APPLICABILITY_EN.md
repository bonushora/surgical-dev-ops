# 🎯 Applicability Guide and Use Cases — BH Ecosystem

The **BH-SEP (Safe Evolution Protocol)** and **BH-SDP (Snapshot & Delivery Protocol)** form an agnostic engineering ecosystem created to govern and standardize the behavior of Large Language Models (LLMs) during AI-assisted software development.

Although they originated within the BônusHora ecosystem, their principles address universal problems in modern AI-assisted engineering:

- hallucination caused by lack of context;
- incorrect assumptions about existing architectures;
- unnecessary rewrites of functional code;
- regression generation;
- loss of strategic knowledge during long sessions;
- context degradation between development sessions.

They operate in a complementary way:

- **BH-SEP defines how AI must analyze and modify software safely.**
- **BH-SDP defines how AI must preserve, transfer, and recover the strategic state of a project.**

The result is a controlled operational model:


Existing Code (Truth)
↓
Complete Inspection
↓
Minimal Change
↓
Immediate Validation
↓
State Snapshot
↓
Next Safe Step


---

# 🎯 When Should They Be Applied?

# 🛡️ BH-SEP — Safe Evolution Protocol

## Legacy Systems and Production Software

Applicable when software already has users, hidden business rules, historical architectural decisions, or critical dependencies.

In these situations, AI must not mentally reconstruct the system.

The protocol requires:

- complete inspection before any modification;
- preservation of existing behavior;
- respect for current contracts;
- isolated changes;
- validation after every intervention.

The existing code represents the **Truth Center**.

---

## Complex Refactoring

Large files, state management systems, component trees, dependency injection, and external integrations contain high regression risks.

BH-SEP prevents:

- unsolicited restructuring;
- cosmetic improvements outside scope;
- accidental removal of existing logic;
- unauthorized architectural changes.

AI must modify only the smallest necessary scope.

---

## New Developer or New AI Session Onboarding

When a new developer or a new AI session enters an existing project, the protocol acts as a contextual safety layer.

Before suggesting changes:

- the project must be inspected;
- contracts must be identified;
- existing decisions must be preserved.

No modification should originate from assumptions.

---

## Critical Fixes and Hotfixes

During urgent situations, speed cannot replace precision.

BH-SEP enables fast interventions while maintaining:

- low impact;
- traceability;
- reduced risk of side effects.

---

# 💾 BH-SDP — Snapshot & Delivery Protocol

## Context Degradation Prevention

Long sessions accumulate:

- source code;
- decisions;
- constraints;
- temporary assumptions;
- architectural contracts.

BH-SDP creates a structured artifact capable of transporting the current project state into a new session.

---

## Critical Definition Protection

When an important decision is established, such as:

- business rule;
- architecture;
- data model;
- API contract;
- operational workflow;

the state can be consolidated into a Snapshot.

This mechanism transforms temporary conversation knowledge into operational documentation.

---

## Breakpoints and Continuity

When there is:

- development pause;
- file change;
- session migration;
- transfer to another developer;

the Snapshot works as a continuity artifact.

It contains:

- current objective;
- inspected files;
- established decisions;
- constraints;
- next actions.

---

## Conflict Detection

If a new request contradicts a previously established definition, the Snapshot allows identification of the divergence before implementation.

The conflict must be resolved before code modification.

---

## Manual Invocation

A Snapshot can be requested directly using:


[SNAPSHOT]


---

# 💻 Compatible Applications and Technologies

Surgical DevOps is independent of programming language or technology stack.

It can be applied to:

## Mobile Applications

Examples:

- Flutter;
- React Native;
- Swift;
- Kotlin.

Protects:

- navigation flows;
- state management;
- dependencies;
- interface contracts.

---

## Web Applications

Examples:

- React;
- Vue;
- Angular;
- Next.js.

Protects:

- shared components;
- global states;
- integrations;
- frontend architecture.

---

## Backend Systems

Examples:

- Node.js;
- Python/FastAPI;
- Go;
- Java.

Protects:

- API contracts;
- authentication;
- data models;
- middleware logic.

---

## Infrastructure as Code

Examples:

- Terraform;
- Ansible;
- Docker.

Protects environments against incorrect modifications capable of causing broad impacts.

---

# 💾 Snapshot Transfer Workflow

## 1. Generation

AI produces an artifact containing:

- current state;
- decisions;
- constraints;
- next steps.

---

## 2. Storage

The Snapshot can be temporarily stored as:


snapshot.txt


or another documentation mechanism.

---

## 3. New Session Hydration

A new session receives:

1. protocol activation command;
2. previous Snapshot.

The new AI restores context before executing any modification.

---

# 💡 Summary

The combination of **BH-SEP + BH-SDP** transforms AI from a simple code generator into a controlled engineering assistant.

It enables:

- safe evolution of complex systems;
- preservation of architectural knowledge;
- reduction of regressions;
- continuity between sessions;
- predictable collaboration between humans and AI.

Surgical DevOps does not replace engineering judgment.

It creates a disciplined operating model where human decisions remain sovereign and AI execution remains aligned, traceable, and safe.
