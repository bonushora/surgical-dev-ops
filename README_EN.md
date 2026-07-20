# Surgical DevOps 🚀

> **Note:** [Clique aqui para ler a versão em Português](./README.md).

**Surgical DevOps** is an open-source, agnostic protocol ecosystem designed to govern and standardize the behavior of Large Language Models (LLMs) during the software development lifecycle, eliminating code regressions and context drift in long chat sessions.

The ecosystem operates by coupling two core protocols:

* **BH-SEP (Safe Evolution Protocol):** Forces the AI to act with surgical precision. It is strictly forbidden from assuming context or rewriting entire functional files. The core focus is a total analysis of the target file (*Inspect First*) followed by isolated, tactical code changes (*Minimal Diffs*).
* **BH-SDP (Snapshot & Delivery Protocol):** Manages the model's short-term memory. The AI actively tracks its own token consumption and triggers a structured breakpoint (*Snapshot*) so the developer can transfer the current progress to a clean session before memory degradation or hallucinations occur.

---

## 🔄 The Workflow

### The Traditional Model (The Path to Chaos)
`[Prompt]` ──> `[AI Mental Reconstruction]` ──> `[Generates Entire New File]` ──> `[Bug / Regression]`

### The BH-SEP + BH-SDP Model (Safe & Persistent Evolution)
`[Existing Code (Truth)]` ──> `[Full Inspection]` ──> `[Minimal Diff]` ──> `[Validation/Check]` ──> `[Background Snapshot]` ──> `[Next Step]`

---

## 🏛️ Core Principles of the Ecosystem

1. **Inspect First:** Existing code is the absolute truth. Never assume contracts, routes, or state management structures. The AI must read the entire target file before proposing any modifications.
2. **Preserve Everything:** Functional code is sacred. No reformatting, reorganizing, or attempting to "improve" adjacent blocks unless explicitly requested.
3. **Minimal Diff:** Pure surgical intervention. Modify only the exact block required for the feature or fix, generating the smallest footprint possible in the Git history.
4. **Validate Immediately:** A mandatory stop after every single modification. Run linters, build tools, or navigation tests before taking any further steps.
5. **Advance Incrementally:** Break complex issues into micro-steps. Only proceed to step B once step A is fully consolidated and validated.
6. **Continuous State Tracking:** The AI must track business logic, constraints, and current breakpoints in the background, proactively fighting against context degradation.

---

## 🤖 Artifact: Unified System Prompt for AI

Whenever starting a new development session, copy, paste, and send the instruction below as the very first prompt in your chat to activate the protocol ecosystem:

> Simultaneously access the protocol URLs at `raw.githubusercontent.com/bonushora/surgical-dev-ops/main/protocols/BH-SEP.md` and `raw.githubusercontent.com/bonushora/surgical-dev-ops/main/protocols/BH-SDP.md`. Strictly, silently, and combinedly adopt the BH-SEP (Safe Evolution Protocol) and BH-SDP (Snapshot & Delivery Protocol) directives contained within them.
>
> Operate as a Senior Software Engineer specializing in the project's ecosystem based on the downloaded rules. Maintain active background monitoring and, once you understand the base files provided in the URLs, confirm activation by replying strictly with the message: "BH-SEP AND BH-SDP ACTIVATED 🚀". If I provide a previous session Snapshot for context hydration, process it next. Otherwise, ask which file or context we should inspect first.
