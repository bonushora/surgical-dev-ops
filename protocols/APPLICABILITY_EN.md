# 🎯 BH-AP — Applicability Guide and Operational Limits (v2.1)

This document establishes the **success criteria, metrics, and NON-applicability cases** of the Surgical DevOps ecosystem.

---

## 🛑 NON-Applicability Cases (Where the Protocol FAILS)

Surgical DevOps **MUST NOT be used** for:

1. **Zero-to-One Prototyping (Exploratory Greenfield):**
   - *Why:* Enforcing PATCH Mode or Declarative Inspection on an empty repository adds friction without value. Greenfield development requires generation freedom.
2. **Systems Without Automated Test Suites:**
   - *Why:* Without `pytest` or `npm test`, Physical Anchoring degrades to model self-reporting. The protocol requires an external test runner to guarantee determinism.
3. **Creative Writing, Pure Documentation, or UI Design Tasks:**
   - *Why:* The protocol was engineered strictly for defensive source code evolution.

---

## 📊 Metrics and Success Criteria

| Metric | Target | Measurement Method |
| :--- | :--- | :--- |
| **Legacy Code Regression Rate** | `< 5%` of changes | Broken tests post AI-assisted PR. |
| **Diff Size per Intervention** | `< 50 lines` (PATCH Mode) | `git diff --shortstat` per commit. |
| **Physical Anchoring Compliance** | `100%` in Snapshots | Valid `git_commit_hash` and test status presence. |
| **Server Schema Adherence** | `0` schema exceptions in production | `HTTP 422` rejection rate on Middleware. |

---

## 🛡️ Where Determinism Resides: Circuit Breakers vs Prompts

> **ARCHITECTURE NOTICE:**
> No natural language prompt is 100% deterministic. True determinism **requires the Server Harness (BH-SMC)**:
> - The **Prompt** constrains model scope and forces intent declaration.
> - **Pydantic/FastAPI** rejects outputs violating the JSON Schema.
> - **Pytest** validates whether code execution actually passes.
