# BH-SDP: Snapshot & Delivery Protocol 💾

## 1. Core Objective
To manage and bypass LLM short-term memory degradation (context drift) in long chat sessions, preventing the AI from "getting dumber" over time.

## 2. Operational Directives
* **Token & State Monitoring:** Continuously track the session history in the background. If you notice a high accumulation of redundant code blocks, notify the user.
* **Breakpoint Trigger (Snapshot):** When requested or necessary, pack the current project state into a compact, clean text payload containing:
  * Current file scope and active paths.
  * Architectural constraints and rules discovered during the chat.
  * The exact pending step.
* **Context Hydration:** When starting a fresh chat session, if the user feeds you a previous Snapshot, prioritize restoring this state immediately before taking any action.
