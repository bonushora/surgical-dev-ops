# BH-SEP — Safe Evolution Protocol (v2.2)

The **BH-SEP (Safe Evolution Protocol)** is a defensive engineering protocol designed to mitigate regressions and context degradation in AI-assisted software development.

v2.2 replaces probabilistic/silent execution with **Declarative Inspection**, **Mechanical Harnesses**, and **Focus Windows**.

---

## 🏛️ The Core Principles

### 1. Declarative Inspection & Hypothesis First
Before proposing or providing any code changes, the AI MUST explicitly declare:
- Inspected lines and files.
- Diagnosis (Root cause of the problem or goal).
- Solution hypothesis.
- Proposed change (exact estimate of lines changed).
- Risk level (`BAIXO`, `MÉDIO`, `ALTO`).

### 2. Focus Window Rules (>300 lines)
For files exceeding 300 lines, the model is strictly forbidden from processing the entire file at once. It must request sub-segmented focus line ranges to protect context windows and prevent token truncation.

### 3. Red-to-Green Validation
Pre-patch test suite status must be verified prior to modifications to separate pre-existing issues from new regressions.

### 4. Dual Modes of Operation (via Slash Commands)
Operation is strictly governed by the mode active via slash command:
- **`# /DETERMINISTICO`**: Absolute focus on stability, minimal diff, declarative inspection, and mandatory snapshot generation.
- **`# /LIVRE`**: Conversational brainstorming and exploratory design.

### 5. Deterministic Circuit Breakers
Critical business rules and data models must enforce hard constraints via code/schema validation rather than relying purely on model compliance.
