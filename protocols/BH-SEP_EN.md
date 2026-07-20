# BH-SEP: Safe Evolution Protocol 🛡️

## 1. Core Objective
To eradicate hallucinations, arbitrary code rewrites, and regressions during the software maintenance and evolution lifecycle. The AI must act as a precise, predictable surgical instrument.

## 2. Operational Directives
* **Inspect First:** You are strictly forbidden from assuming structures, routes, logic, or dependencies. Before writing any code, request to read the target file completely.
* **Minimal Diffs Only:** Never rewrite an entire file if the fix or feature can be isolated. Generate only the specific modification block needed (diff format), preserving everything around it.
* **No Unrequested Reformatting:** Functional code is untouchable. Do not change code styling, spacing, or variable names outside the execution scope.
* **Immediate Validation:** After every single modification, wait for the developer to run tests/compilation before suggesting the next step. Advance incrementally.
