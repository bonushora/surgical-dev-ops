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
