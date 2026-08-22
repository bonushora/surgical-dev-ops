# Surgical DevOps 🚀
> Portuguese version: [README.md](./README.md)

**Surgical DevOps** is an agnostic, open-source protocol ecosystem created to govern and standardize the behavior of Large Language Models (LLMs) during AI-assisted software development cycles.

Its goal is to reduce regressions, prevent unwarranted assumptions about existing systems, and preserve strategic knowledge during long development sessions.

The ecosystem operates by combining two core protocols:

* **[BH-SEP v2.2](./protocols/BH-SEP.md) (Safe Evolution Protocol):** Defines how the AI must safely evolve existing software through Declarative Inspection (*Inspect First*), Large File Circuit Breaker (*Focus Window*), Dual Modes (*Patch* and *Refactor*), and Prior Validation (*Red-to-Green*).

* **[BH-SDP v2.2](./protocols/BH-SDP.md) (Snapshot & Delivery Protocol):** Defines mechanisms for cross-session state preservation via Physical Anchoring in repository metadata (*Git Commit Hash*, *Test Status*, and *Risk Level*) within a strict JSON block in English.

---

## ⚡ Quick Shortcut Commands (Slash Commands)

Once the System Prompt is loaded into the session, you can toggle between operation modes by sending slash-prefixed commands (`/`):

* Send **`/DETERMINISTIC`** to activate or re-confirm strict surgical protection.
* Send **`/FREE`** to disable restrictions and chat openly.

---

## 🤖 Artifacts: System Prompts for AI (v2.2)

### 🎯 1. Surgical Mode (Deterministic — Default)

```text
# Access the protocols:
# [https://raw.githubusercontent.com/bonushora/surgical-dev-ops/main/protocols/BH-SEP.md](https://raw.githubusercontent.com/bonushora/surgical-dev-ops/main/protocols/BH-SEP.md)
# [https://raw.githubusercontent.com/bonushora/surgical-dev-ops/main/protocols/BH-SDP.md](https://raw.githubusercontent.com/bonushora/surgical-dev-ops/main/protocols/BH-SDP.md)
#
# Strictly and combinedly adopt the guidelines of BH-SEP v2.2 and BH-SDP v2.2.
# Operate strictly as a Senior Software Engineer. MANDATORY BLOCKING RULE: Before ANY response or change, it is MANDATORY and ESSENTIAL to perform Declarative Inspection (lines read, root cause, hypothesis, and diff estimate in maximum 3 lines). Respect Patch Mode by default.
#
# SNAPSHOT STRUCTURE:
# Generate the sdp_snapshot block with fields and values in ENGLISH (project_name, protocol_version, architecture_type, cost_goal, current_phase, risk_level, physical_anchors, validated_components, next_step).
#
# MODE TRIGGERS:
# Ignore the informal use of the words "free" or "deterministic" in normal sentences. Toggle the mode ONLY if the command starts with a slash:
# - If you receive "/DETERMINISTIC", re-confirm activation of this mode.
# Permanent Scope: 1. Declarative Inspection | 2. PATCH Mode | 3. Mandatory Snapshot | 4. Triggers: /DETERMINISTIC | /FREE
# - If you receive "/FREE", switch to Consultative Mode without restrictions.
#
# After understanding the protocols, confirm by answering:
# "BH-SEP v2.2 AND BH-SDP v2.2 ACTIVATED 🚀"
🔓 2. Free Mode (Exploratory / Non-Deterministic)
Plaintext
# Operate as a Senior Software Engineer in Consultative / Free Mode.
#
# It is not necessary to apply restrictions of Declarative Inspection, Patch Mode, or JSON Snapshots.
# Respond directly, flexibly, and adaptively.
#
# MODE TRIGGERS:
# - If you receive "/DETERMINISTIC", switch to Safe Surgical Mode.
# - If you receive "/FREE", re-confirm activation of this mode.
#
# Confirm by answering:
# "FREE MODE ACTIVATED 🔓"
📚 Documentation
Core protocols:

BH-SEP v2.2 — Safe Evolution Protocol

BH-SDP v2.2 — Snapshot & Delivery Protocol

Applicability Guide

Portuguese version:

README.md

🌎 Origin
Surgical DevOps was born within the BônusHora ecosystem, but its principles are independent of language, framework, or architecture.

💡 Vision
Surgical DevOps does not replace engineering judgment. It establishes a disciplined model where human decisions remain sovereign and AI-assisted execution remains aligned, traceable, and secure.

---

## Surgical DevOps v2.3 — Development Orchestration Layer

Surgical DevOps v2.3 evolves the project from a protocol-only operational
baseline into a governed Development Orchestration Layer while preserving
BH-SEP v2.2 and BH-SDP v2.2 as the independent normative core.

Implemented capabilities include:

- Surgical DevOps Accelerator / Orchestrator;
- deterministic declarative inspection and task preparation;
- authenticated human authority for critical R3 operations;
- exact-scope capability grants with fail-closed enforcement;
- governed FILESYSTEM_PATCH transactions;
- deterministic exact-target locking;
- durable mutation journal and persisted commit authority;
- deterministic process-crash / process-restart recovery;
- conflicting-replay rejection and zero duplicate remutation;
- filesystem durability primitive enforcement;
- qualified mutation-provider boundary;
- hardened read-only Git preflight;
- canonical conformance suite with 508 tests;
- GitHub Actions conformance on pushes and pull requests;
- native conformance matrix validated on the same baseline across Linux,
  Windows and macOS.

Explicit v2.3 limitations:

- BH-SEP and BH-SDP remain normatively versioned at v2.2;
- the canonical suite has been directly validated on Linux, Windows and
  macOS on the same technical baseline (GitHub Actions run 32545548306,
  commit 0586fa4113de00c075113f12fd98059f44feba8f);
- the Safe Exclusive Write primitive is directly qualified on Linux, Windows
  and macOS on that baseline;
- Strict Physical Identity-Conditional CAS remains UNQUALIFIED;
- production physical mutation dependent on that CAS remains fail-closed;
- this boundary does not reduce the threat model or weaken normative
  invariants, and its future qualification is a separate specialized line
  independent from v2.3 closure;
- POWER_LOSS_VALIDATED remains false until platform/filesystem-specific
  qualification is completed.
