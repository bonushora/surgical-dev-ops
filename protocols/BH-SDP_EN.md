# BH-SDP — Snapshot & Delivery Protocol (v2.2)

The **BH-SDP (Snapshot & Delivery Protocol)** is a state encapsulation and preservation protocol for AI-assisted development sessions.

v2.2 introduces **Physical Anchors** and **Localized Unified Schema Keys** to ensure robust CI/CD integration.

---

## 🏛️ Principles of State Preservation

### 1. Physical Anchors (Anti-Amnesia)
Snapshots must reference real metadata from the repository/environment:
- **Git Commit Hash:** Exact commit hash or branch name.
- **Test Status:** Objective test suite result (`PASSOU`, `FALHOU`, `PENDENTE`).
- **Last Inspected Lines:** Log of inspected files and line ranges.

### 2. Unified Localized JSON Schema
To maintain multi-language CI/CD parser compatibility, JSON keys inside the `sdp_snapshot` block remain standardized in Portuguese (`nome_do_projeto`, `nivel_de_risco`, `ancoras_fisicas`, etc.).

---

## 🤖 Artifact: Strict Snapshot Schema (v2.2)

Every technical output or phase completion MUST end with:

```sdp_snapshot
{
  "nome_do_projeto": "<PROJECT_NAME>",
  "versao_do_protocolo": "BH-SDP-v2.2 / BH-SEP-v2.2 Deterministico",
  "tipo_de_arquitetura": "BH-SMC (Surgical Middleware Core / Harness)",
  "meta_de_custo": "Zero / Mínimo (Open Source / Free Tier)",
  "fase_atual": "<CURRENT_PHASE>",
  "nivel_de_risco": "BAIXO | MÉDIO | ALTO",
  "ancoras_fisicas": {
    "hash_do_commit": "<COMMIT_HASH_OR_BRANCH>",
    "status_dos_testes": "PASSOU | FALHOU | PENDENTE",
    "ultimas_linhas_inspecionadas": "<LINE_RANGES_OR_FILES>"
  },
  "componentes_validados": [
    "<VALIDATED_ITEM_1>",
    "<VALIDATED_ITEM_2>"
  ],
  "proximo_passo": "<NEXT_STEP_DESCRIPTION>"
}
