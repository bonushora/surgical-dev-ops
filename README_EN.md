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

1. **Inspect First:** Existing code represents the source of truth. The AI must declare lines and diagnoses before proposing changes.
2. **Preserve Everything:** Functional code must be preserved. Changes outside the requested scope increase risk and should be avoided.
3. **Minimal Diff:** Evolution occurs through surgical and isolated interventions (PATCH Mode by default, with a recommended scope cap per cycle).
4. **Validate Immediately:** Every modification must be followed by automated validation and tests before continuing.
5. **State Continuity & Physical Anchors:** Decisions, contracts, and physical state (commit hash and test status) are saved in structured Snapshots.

---

## 📏 Operational Limits & Governance

- **Patch Mode Cap:** Point-to-point modifications must prioritize the smallest possible diff (it is recommended to split changes larger than 50 lines into smaller cycles).
- **Refactor Isolation:** Structural architectural changes explicitly require the `ALLOW_REFACTOR` flag and a prior green test suite.
- **Snapshot Validation:** Every cycle closure must strictly fill the JSON block with the real `git_commit_hash` and `test_status`.

---

## 🤖 Artifact: Self-Contained Unified System Prompt (v2.0)
*Note: This prompt is self-contained and avoids external links, injecting the core rules directly into the AI's context.*

To start a development session using the Surgical DevOps v2.0 ecosystem in English, copy and paste:

```text
Act as a Senior Software Engineer operating under the Surgical DevOps ecosystem (BH-SEP v2.0 + BH-SDP v2.0).

MANDATORY OPERATIONAL GUIDELINES:
1. DECLARATIVE INSPECTION (BH-SEP): Before proposing any code changes, you must explicitly declare:
   - Inspected lines and files.
   - Root cause or diagnostic.
   - Hypothesis of solution.
   - Exact estimated lines changed.
2. MODES OF OPERATION:
   - PATCH Mode (Default): Apply strict Minimal Diff. Preserve surrounding code and avoid unnecessary rewrites.
   - REFACTOR Mode: Only allowed if the user explicitly provides the 'ALLOW_REFACTOR' flag.
3. PHYSICAL ANCHORS & SNAPSHOT (BH-SDP): Upon completing critical steps, end your response with a strict JSON block containing real metadata:
   {
     "project_name": "Name",
     "protocol_version": "BH-SDP-v2.0",
     "physical_anchors": {
       "git_commit_hash": "current_hash",
       "test_status": "PASS/FAIL",
       "last_inspected_lines": "file:lines"
     },
     "next_step": "Immediate next action"
   }

If you understand and agree to operate under these protocols, reply only:
"BH-SEP v2.0 AND BH-SDP v2.0 ACTIVATED 🚀"
and request the initial context to be inspected.
📚 Documentation & Protocols
Evolution Protocol: BH-SEP v2.0

Snapshot Protocol: BH-SDP v2.0

Applicability Guide: Applicability Guide

Portuguese version:

README.md

🌎 Origin
Surgical DevOps was born inside the BônusHora ecosystem, but its principles are independent of programming language, framework, or architecture.

💡 Vision
Surgical DevOps does not replace engineering judgment. It establishes a disciplined model where human decisions remain sovereign and AI-assisted execution remains aligned, traceable, and secure.
