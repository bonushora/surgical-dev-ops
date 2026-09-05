# BH-SEP v2.3 — Safe Evolution Protocol

## Objective

Govern AI-assisted evolution with risk-proportionate safety while preserving human authority, predictability, and physical evidence. This version adopts **Governance Without Friction**: controls protect consequential decisions and mutations without turning every operation into an interruption.

## Normative invariants

1. **Human authority:** AI may analyze and propose, but it may not expand authorization or replace a human decision required by context.
2. **Fail-closed:** when authority, evidence, or a rule is missing or ambiguous, do not perform the mutation; declare the block.
3. **PATCH by default:** changes must be minimal and localized. Refactoring requires explicit human authorization.
4. **Physical evidence:** claims about state, lines, tests, Git, or artifacts must rely on observable evidence. Missing evidence is `NÃO_EXECUTADO` (or the normative equivalent), never an inference presented as fact.
5. **Red-to-Green:** before refactoring or a high-risk change, verify the relevant baseline; then validate the change to GREEN or declare the block.

## Risk-proportionate governance

Classify the operation before mutating:

- **BAIXO:** documentation, low-impact adjustments, micro-readings, and operations already covered by current authority. Inspect relevant context and use proportional validation (for example, Markdown lint, parsing, or a documentation test). No new approval is needed for an operation already authorized.
- **MÉDIO:** a change with limited consumers, behavior, or dependencies. State the objective, cause or hypothesis, files and ranges read, risk, and scope estimate; perform targeted validation and record the result.
- **ALTO:** refactoring, architectural change, security, data, public contracts, or broad operational effect. Require a prior baseline, an explicit plan, and specific human authorization before mutation; validate comprehensively.

A diff estimate predicts scope; it is not a physical three-line limit. If scope grows, reassess risk and request authorization when the category or authorization changes.

Risk belongs to the delimited operation, not to the project as a whole. Reclassify
mandatorily when scope or environment changes.

| Level | Criterion and proportional control |
| --- | --- |
| **BAIXO** | Local, reversible, isolated operation with no credentials or external effect; one authorization; no intermediate gates; directly pertinent validation. |
| **MÉDIO** | Limited functional change, affected consumers, integration, or reversible publication; gates only for a new boundary; consumer tests, CAS, and remote postcondition. |
| **ALTO** | Production, sensitive credentials, real data, destructive action, irreversibility, or architecture; explicit authorization, rollback, before/after evidence, and pertinent/canonical suite. |

## Authorization, execution, and gates

Each delimited task receives one authorization bound to its objective, scope,
workspace, risk, and declared boundaries. A task does not authorize another task
or permit scope expansion by inference.

One runner carries the task across the declared boundaries (local, backend,
interface, operation, deployment, and publication). The user does not carry state,
credentials, results, or context between stages; the runner delivers bound
evidence or stops closed.

Gates are required only for real risk, authority expansion, credentials,
destructive action, or an external resource. Consolidate related human actions
into one explicit decision. After two equivalent attempts make no verifiable
progress, trip the circuit breaker, preserve evidence, and request human direction.

Proportionality is mandatory: localhost uses minimal local controls; Preview uses
the required integration gates and evidence; Production requires explicitly
qualified authority, credentials, publication, and reversibility. No environment
inherits authority from another.

GREEN is separated into **code**, **backend**, **interface**, **operation**,
**deployment**, and **publication**, each requiring independent evidence. The
human flow (input, review, decision, and recovery) must be validated before
functional GREEN. Optional improvements remain `DEFERRED`, with scope and a
future review point.

## Execution and completion contract

Define the completion contract before execution: objective, files, workspace,
environment, operations, risk, boundaries, physical postcondition, and required
evidence. One authorization binds all these elements. One continuous runner operates
within the authorized envelope across declared boundaries; the user does not
manually carry context, results, or credentials between stages.

Gates exist only for real risk, authority, credentials, an external resource,
irreversibility, or publication. Related human actions are consolidated into one
gate. After two equivalent attempts make no verifiable progress, trip the circuit
breaker, preserve evidence, and stop in `BLOCKED`.

Within the authorized envelope, continuation may be automatic. Reuse evidence only
while object, hash, and environment remain unchanged. Valid states include
`BLOCKED`, `WARNING`, `DEFERRED`, and `NOT_APPLICABLE`; none is GREEN by inference.
The friction budget records gates, attempts, manual actions, and environment changes.

## Physical boundaries and evidence

`localhost`, `Preview`, and `Production` are independent boundaries. The mandatory
physical destination identity includes URL, branch, and remote SHA; no environment
inherits authority from another. Confirm CAS before any remote mutation. After it,
confirm the destination's physical postcondition. An executor's report is not
physical evidence: only an observation bound to Git state, content, and environment
qualifies the result.

PATCH is the default. Preserve fail-closed behavior, human authority, CAS, journal,
recovery, and the trust boundary; local mutation does not authorize push, merge, tag,
release, publication, or deploy.

## Inspection and focus windows

Inspect enough material first to explain root cause, hypothesis, risk, and proposed change. For files over 300 lines, use focus windows when needed for safety or context. Size alone does not require automatic human interruption or full-file reading; widen the window when the decision depends on additional context.

Micro-readings and operations covered by current authority may proceed without new approval. AI must stop and declare a block upon divergence, insufficient authorization, reclassified risk, or unverifiable evidence.

## Automation restriction, not human restriction

**Automation Restriction, Not Human Restriction** means limiting what automation may mutate, publish, or assert without additional controls; it does not obstruct human inspection, demand artificial confirmations, or remove already-granted authority. Controls apply to the automated action and its risk, not to the person or every trivial reading.

## Validation and delivery

Change only the authorized scope. For low risk, validate proportionally; for medium risk, validate affected consumers; for high risk and refactoring, preserve the baseline and explicit authorization and run the pertinent suite. Do not invent results, hashes, lines, or tests. On divergence, remain fail-closed.

Use the BH-SDP v2.3 `sdp_snapshot` at relevant checkpoints: session handoff, block, divergence, important phase change, and relevant conclusion. A snapshot is not required at the end of every response.

Snapshots are incremental: record only the delta since the previous snapshot, the
accumulated gate count, and new anchors; do not repeat confirmed context. The
snapshot preserves fail-closed behavior, human authority, CAS, journal, and the
trust boundary; it never creates authority.


<!-- BEGIN BH-SDP v2.3 -->

# BH-SDP v2.3 — Snapshot & Delivery Protocol

## Objective

Preserve operational state across sessions through verifiable, risk-proportionate snapshots. A snapshot is a continuity contract, not a ritual required for every response.

## When to emit

Emit `sdp_snapshot` at relevant checkpoints: session handoff, block, divergence, relevant conclusion, phase change, or another point where losing state could cause an unsafe decision. A trivial operation covered by current authority does not require an additional snapshot merely because it occurred.

## Evidence rules

- Anchors must reference observable physical data, such as a hash, branch, files, and inspected lines.
- Test status must be factual. When execution or evidence is absent, use `NÃO_EXECUTADO`; never invent PASSOU, FALHOU, a hash, or coverage.
- Declare blocks, divergences, limitations, and the next step. A snapshot does not itself authorize a future mutation.
- Risk level must reflect the operation and may be reassessed when scope changes.
- A delimited task has one authorization and one runner across declared
  boundaries; the user does not carry context, credentials, or results between
  stages.
- Count a gate only for real risk, authority expansion, credentials, destructive
  action, or an external resource. Consolidate human actions; after two
  equivalent attempts, record the circuit breaker and await human direction.
- Record proportionality by environment (`localhost`, `Preview`, or `Production`)
  and do not transfer authority between environments.
- GREEN is separated into code, backend, interface, operation, deployment, and
  publication; the validated human flow comes before functional GREEN. Optional
  improvements remain `DEFERRED`.
- Risk belongs to the operation, not the project; reclassify when scope or
  environment changes. `localhost`, `Preview`, and `Production` are independent
  boundaries.
- Record the completion contract, friction budget, and the states `BLOCKED`,
  `WARNING`, `DEFERRED`, and `NOT_APPLICABLE`. Automatic continuation is limited
  to the authorized envelope.

## Stable schema

JSON keys remain in Portuguese for compatibility across multilingual consumers. The v2.3 schema is:

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
  "acoes_manuais": "non-negative integer",
  "ambiente": "localhost | Preview | Production",
  "destino_fisico": {
    "url": "string | null",
    "branch": "string | null",
    "sha_remoto": "string | null"
  },
  "estado_green": {
    "codigo": "GREEN | RED | BLOCKED | WARNING | DEFERRED | NOT_APPLICABLE",
    "backend": "GREEN | RED | BLOCKED | WARNING | DEFERRED | NOT_APPLICABLE",
    "interface": "GREEN | RED | BLOCKED | WARNING | DEFERRED | NOT_APPLICABLE",
    "operacao": "GREEN | RED | BLOCKED | WARNING | DEFERRED | NOT_APPLICABLE",
    "implantacao": "GREEN | RED | BLOCKED | WARNING | DEFERRED | NOT_APPLICABLE",
    "publicacao": "GREEN | RED | BLOCKED | WARNING | DEFERRED | NOT_APPLICABLE"
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

## Checkpoint example

```sdp_snapshot
{
  "nome_do_projeto": "surgical-dev-ops",
  "versao_do_protocolo": "BH-SDP-v2.3 / BH-SEP-v2.3 Deterministic",
  "tipo_de_arquitetura": "BH-SMC (Surgical Middleware Core / Harness)",
  "meta_de_custo": "Zero / Minimum (Open Source / Free Tier)",
  "fase_atual": "Documentation validation",
  "nivel_de_risco": "MÉDIO",
  "contagem_de_gates": 0,
  "tentativas_equivalentes": 0,
  "acoes_manuais": 0,
  "ambiente": "localhost",
  "destino_fisico": {
    "url": null,
    "branch": null,
    "sha_remoto": null
  },
  "estado_green": {
    "codigo": "GREEN",
    "backend": "NOT_APPLICABLE",
    "interface": "NOT_APPLICABLE",
    "operacao": "GREEN",
    "implantacao": "NOT_APPLICABLE",
    "publicacao": "NOT_APPLICABLE"
  },
  "itens_deferred": [],
  "ancoras_fisicas": {
    "hash_do_commit": "<HASH_DO_COMMIT_VERIFICADO>",
    "status_dos_testes": "NÃO_EXECUTADO",
    "ultimas_linhas_inspecionadas": "protocols/BH-SEP.md:1-18; protocols/BH-SDP.md:1-25"
  },
  "componentes_validados": [
    "Versioned-path v2.3 normative files created",
    "JSON schema validated"
  ],
  "proximo_passo": "Run the pertinent documentation validation"
}
```
