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
