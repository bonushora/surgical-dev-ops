# BH-SEP v2.3 — Safe Evolution Protocol

## 🎯 Objective
Govern AI-assisted evolution with safety proportional to risk while preserving human authority, predictability, and physical evidence. This version adopts frictionless governance: controls protect consequential decisions and mutations without turning every operation into an interruption.

## 🏛️ Fundamental Guidelines
1. **Completion contract:** at the start of each task, declare the expected result, scope, environment, physical destination, required evidence, and objective completion condition. A task is complete only when that postcondition is physically verified.
2. **Human authority:** AI may analyze and propose, but it may not expand authorization or replace a human decision required by context.
3. **Fail-closed and explicit states:** when authority, evidence, or a rule is missing or ambiguous, do not perform the mutation; declare `BLOCKED`. Use `WARNING` for risk or a limitation without an immediate block, `DEFERRED` for an improvement intentionally postponed with authorization, and `NOT_APPLICABLE` when a control does not apply, always with a justification.
4. **PATCH by default:** changes must be minimal and localized. Refactoring requires explicit human authorization.
5. **Physical evidence:** claims about state, lines, tests, Git, or artifacts must rely on observable evidence. The executor's report alone is not physical evidence; missing evidence is `NÃO_EXECUTADO`, never an inference presented as fact.
6. **Evidence reuse:** reuse verified evidence while the object, hash, and environment remain unchanged. Any change to those three elements invalidates the evidence and requires new inspection or validation.
7. **Bounded automatic continuation:** continue automatically within the authorized envelope, without new approval for each step covered by it. Stop on `BLOCKED`, scope expansion, risk reclassification, or when authority no longer covers the next action.
8. **Red-to-Green:** before refactoring or a high-risk change, verify the relevant baseline; then validate the change to GREEN or declare the block.
9. **Risk-proportionate governance:** classify the operation before mutating and apply the following matrix:
   - **LOW:** characteristics: documentation, reading, localized adjustment, or an operation already covered by current authority; examples: Markdown change, micro-reading, parse, and documentation lint; authorization/gates: current authorization, with no new gate unless there is an external resource requiring credentials, cost, consent, mutation, or new authority; required validation: context inspection and proportional validation such as lint, parse, or a documentation test.
   - **MEDIUM:** characteristics: a change with limited consumers, behavior, or dependencies; examples: internal contract change, bounded integration, a change with known impact, or reversible publication protected by CAS; authorization/gates: authorization bound to objective, cause or hypothesis, scope, risk, and files, with gates for real risk or additional authority; required validation: targeted validation of consumers and recorded evidence.
   - **HIGH:** characteristics: refactoring, architecture, security, data, public contract, or broad operational effect; examples: Production, irreversibility, sensitive credentials, real data, destructive action, critical public contract, or cross-cutting change; authorization/gates: prior baseline, explicit plan, specific human authorization, and corresponding gates before mutation; required validation: comprehensive validation, physical postcondition, and independent evidence for each affected dimension.
10. **Authorization and boundaries:** each delimited task receives one authorization bound to its objective, scope, workspace, risk, and declared boundaries. A task does not authorize another or permit scope expansion by inference; one runner crosses the declared boundaries. The user must not manually carry context, results, or credentials between stages covered by the runner.
11. **Friction budget:** define a friction budget proportional to risk, counting approvals, gates, interruptions, and manual actions. Do not spend friction on artificial confirmations; when the budget is exceeded, reassess risk, consolidate the human decision, or declare `BLOCKED`.
12. **Gates and proportionality:** gates are required for real risk, authority expansion, credentials, destructive action, or an external resource requiring credentials, cost, consent, mutation, or new authority. Consolidate related human actions; after two equivalent attempts make no verifiable progress, trip the circuit breaker and request human direction. No environment inherits authority from another.
13. **Inspection and focus windows:** inspect enough material to explain root cause, hypothesis, risk, and the proposed change. For files over 300 lines, use focus windows when needed; size alone does not require automatic human interruption or full-file reading.
14. **Remote physical identity:** every remote operation must record and verify the physical identity composed of URL, branch, and observed SHA. Identity cannot be replaced by a name, report, or inference.
15. **CAS and remote postcondition:** before any remote mutation, validate CAS against the expected physical identity. After the mutation, verify the remote physical postcondition, including resulting SHA, branch, URL, and expected artifacts; failure or divergence is `BLOCKED`.
16. **Automation without restricting human authority:** limit what automation may mutate, publish, or assert without additional controls, without obstructing human inspection, demanding artificial confirmations, or removing already-granted authority.
17. **Independent GREEN and human experience:** treat code, backend, interface, operation, deployment, and publication as separate dimensions, each with independent evidence. Also validate the human experience — input, review, decision, feedback, recovery, and understanding of state — before functional GREEN; optional improvements remain `DEFERRED`, with scope and a future review.
18. **Validation and delivery:** change only the authorized scope and validate proportionally to risk. Do not invent results, hashes, lines, or tests. On divergence, remain fail-closed. Use `sdp_snapshot` at relevant checkpoints; incremental snapshots preserve human authority, CAS, journal, and the trust boundary, but never create authority.

---

# BH-SDP v2.3 — Snapshot & Delivery Protocol

## 🎯 Objective
Preserve operational state across sessions through verifiable, risk-proportionate snapshots. A snapshot is a continuity contract, not a ritual required for every response.

## 📋 Snapshot Schema (`sdp_snapshot`)

```json
{
  "nome_do_projeto": "string",
  "versao_do_protocolo": "string",
  "tipo_de_arquitetura": "string",
  "meta_de_custo": "string",
  "fase_atual": "string",
  "nivel_de_risco": "BAIXO | MÉDIO | ALTO",
  "contagem_de_gates": "non-negative integer",
  "tentativas_equivalentes": "non-negative integer",
  "acoes_manuais": [
    "string"
  ],
  "ambiente": "localhost | Preview | Production",
  "destino_fisico": {
    "url": "string",
    "branch": "string",
    "sha_antes": "string",
    "sha_depois": "string"
  },
  "estado_green": {
    "codigo": "PASSOU | FALHOU | NÃO_EXECUTADO | DEFERRED | NOT_APPLICABLE",
    "backend": "PASSOU | FALHOU | NÃO_EXECUTADO | DEFERRED | NOT_APPLICABLE",
    "interface": "PASSOU | FALHOU | NÃO_EXECUTADO | DEFERRED | NOT_APPLICABLE",
    "operacao": "PASSOU | FALHOU | NÃO_EXECUTADO | DEFERRED | NOT_APPLICABLE",
    "implantacao": "PASSOU | FALHOU | NÃO_EXECUTADO | DEFERRED | NOT_APPLICABLE",
    "publicacao": "PASSOU | FALHOU | NÃO_EXECUTADO | DEFERRED | NOT_APPLICABLE",
    "experiencia_humana": "PASSOU | FALHOU | NÃO_EXECUTADO | DEFERRED | NOT_APPLICABLE"
  },
  "itens_deferred": [
    "string"
  ],
  "ancoras_fisicas": {
    "hash_do_commit": "string",
    "status_dos_testes": "PASSOU | FALHOU | NÃO_EXECUTADO",
    "ultimas_linhas_inspecionadas": "string"
  },
  "componentes_validados": [
    "string"
  ],
  "proximo_passo": "string"
}
```
