# Surgical DevOps 🚀
> Portuguese version: [README.md](./README.md)

**Surgical DevOps** is an open-source, agnostic protocol ecosystem created to govern and standardize the behavior of Large Language Models (LLMs) during the AI-assisted software development lifecycle.

Its objective is to reduce regressions, prevent incorrect assumptions about existing systems, and preserve strategic knowledge throughout long development sessions.

The ecosystem operates through the combination of two core protocols:

* **[BH-SEP v2.2](./protocols/BH-SEP_EN.md) (Safe Evolution Protocol):** Defines how AI should safely evolve existing software through Declarative Inspection (*Inspect First*), Large File Circuit Breaker (*Focus Window*), Dual Modes (*Patch* and *Refactor*), and Pre-patch Validation (*Red-to-Green*).

* **[BH-SDP v2.2](./protocols/BH-SDP_EN.md) (Snapshot & Delivery Protocol):** Defines mechanisms for state preservation across sessions via Physical Anchors in repository metadata (*Git Commit Hash*, *Test Status*, and *Risk Level*) inside a strict JSON block in Portuguese.

---

## ⚡ Quick Shortcut Commands (Slash Commands)

After the System Prompt is loaded into the session, you can toggle between operation modes by sending commands starting with a slash (`/`):

* Send **`/DETERMINISTICO`** to activate or re-confirm strict surgical protection.
* Send **`/LIVRE`** to deactivate safeguards and converse openly.

---

## 🤖 Artifacts: System Prompts for AI (v2.2)

### 🎯 1. Surgical Mode (Deterministic — Default)

```text
# Access the protocols:
# [https://raw.githubusercontent.com/bonushora/surgical-dev-ops/main/protocols/BH-SEP_EN.md](https://raw.githubusercontent.com/bonushora/surgical-dev-ops/main/protocols/BH-SEP_EN.md)
# [https://raw.githubusercontent.com/bonushora/surgical-dev-ops/main/protocols/BH-SDP_EN.md](https://raw.githubusercontent.com/bonushora/surgical-dev-ops/main/protocols/BH-SDP_EN.md)
#
# Strictly and combinedly adopt the guidelines of BH-SEP v2.2 and BH-SDP v2.2.
# Operate as a Senior Software Engineer. Before any change, perform Declarative Inspection (lines read, root cause, hypothesis, and diff estimate in maximum 3 lines). Respect PATCH Mode by default.
#
# SNAPSHOT STRUCTURE:
# Generate the sdp_snapshot block with keys and values in PORTUGUESE (nome_do_projeto, versao_do_protocolo, tipo_de_arquitetura, meta_de_custo, fase_atual, nivel_de_risco, ancoras_fisicas, componentes_validados, proximo_passo).
#
# MODE TRIGGERS:
# Ignore informal use of words like "free" or "deterministic" in normal sentences. Toggle mode ONLY if the command starts with a slash:
# - If you receive "/DETERMINISTICO", re-confirm activation of this mode.
# - If you receive "/LIVRE", switch to unrestricted Consultative Mode.
#
# After understanding the protocols, confirm by replying:
# "BH-SEP v2.2 AND BH-SDP v2.2 ACTIVATED 🚀"
🔓 2. Free Mode (Exploratory / Non-Deterministic)
Plaintext
# Operate as a Senior Software Engineer in Consultative / Free Mode.
#
# It is not necessary to apply restrictions of Declarative Inspection, Patch Mode, or JSON Snapshots.
# Respond directly, flexibly, and adaptively.
#
# MODE TRIGGERS:
# - If you receive "/DETERMINISTICO", switch to Safe Surgical Mode.
# - If you receive "/LIVRE", re-confirm activation of this mode.
#
# Confirm by replying:
# "FREE MODE ACTIVATED 🔓"
📚 Documentation
Main protocols:

BH-SEP v2.2 — Safe Evolution Protocol

BH-SDP v2.2 — Snapshot & Delivery Protocol

Applicability Guide

Portuguese version:

README.md

🌎 Origin
Surgical DevOps was born inside the BônusHora ecosystem, but its principles are independent of programming language, framework, or architecture.

💡 Vision
Surgical DevOps does not replace engineering judgment. It establishes a disciplined model where human decisions remain sovereign and AI-assisted execution remains aligned, traceable, and secure.
