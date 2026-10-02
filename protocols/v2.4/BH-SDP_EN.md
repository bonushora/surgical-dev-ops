# BH-SDP v2.4 — Snapshot & Delivery Protocol

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

## 🛡️ Containment continuity rules

1. The snapshot must record `profile_id`, trusted-manifest SHA-256, observed generation, WebSocket policy, and per-platform qualification state when such evidence exists.
2. Containment state in a snapshot is continuity evidence only; it never creates or restores authority.
3. `profile_id`, manifest, generation, components, and environment must be physically revalidated by the trusted runtime before reuse.
4. `NÃO_EXECUTADO` must not be promoted by inference, another operating system's result, or generic CI.
5. A change to profile, manifest, generation, component, hash, or environment invalidates containment evidence reuse.
6. A previous snapshot cannot enable fallback, WebSocket, credentials, network, mutation, or publication that the current profile does not explicitly qualify.
