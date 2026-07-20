# Surgical Context Engineering: Mitigating LLM Hallucinations and Amnesia in Production

## Abstract
The adoption of Large Language Models (LLMs) as coding assistants has dramatically accelerated development velocity, but it has introduced two severe engineering bottlenecks: *context drift* (which causes regressions in complex software systems) and *token-exhaustion amnesia* (the degradation of chat memory during long sessions). This paper introduces **Surgical DevOps (BH-SEP and BH-SDP)**, a practical, agnostic prompt-engineering framework that forces language models to operate through strict, isolated code interventions (*Minimal Diffs*) and background state tracking (*Snapshots*).

---

## 1. The Productivity Paradox with LLMs
Integrating AI assistants like GPT-4, Claude, and Gemini into development workflows yields high initial velocity. However, as the codebase scales or the chat session grows, tool efficiency degrades exponentially. Senior developers frequently encounter two systemic pathologies:

### 1.1 Context Drift (The "Guessing" Effect)
When requested to alter a specific function, the model often attempts to rewrite adjacent code blocks, alter code styles, or change variable names outside the required scope. In strict execution environments—such as memory-sensitive **C development**—this unrequested autonomy can introduce catastrophic memory leaks or break pointer tracking.

### 1.2 Context Exhaustion (Amnesia)
Every LLM operates within a fixed context window. As files are sent and extensive pieces of code are generated, the token limit fills up. To stay within limits, the model quietly drops older information, losing its grasp of architectural patterns, business logic rules, and current task constraints.

---

## 2. The Architectural Solution: Surgical DevOps
The Surgical DevOps framework shifts AI interaction from a "conversational" dynamic to a "protocol-driven, strict engineering pipeline." It isolates the execution into two complementary layers:

### 2.1 BH-SEP: Safe Evolution Protocol
Forces the model to act as a precision surgical instrument.
* **Inspect First Principle:** The model cannot assume any architecture or dependency. It must read the full definition or target source file entirely before drafting changes.
* **Minimal Diff Deliverables:** The model is explicitly barred from outputting full files. It must isolate changes into standard Git patch formats or localized blocks, ensuring minimal git footprint and zero collateral damage to working code.

### 2.2 BH-SDP: Snapshot & Delivery Protocol
A manual, active state manager for short-term chat memory.
* **State Breakpoints:** Before memory degradation occurs, the AI compiles a dense, structured state payload (the *Snapshot*).
* **Hydration Loop:** The developer can instantly drop the Snapshot into a completely fresh, empty chat session. This clears out thousands of wasted tokens from old conversation logs while immediately restoring 100% of the active architectural constraints.

---

## 3. Empirical Results and Conclusion
By applying Surgical DevOps, development teams drastically decrease the overhead spent on fixing AI-generated regressions. Furthermore, token spending is highly optimized, allowing developers to extend the lifecycles of their AI sessions indefinitely without encountering model performance degradation. The framework proves that the problem with modern AI coding isn't the capacity of the models, but the lack of formal governance over their output.
