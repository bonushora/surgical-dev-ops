# BH-SDP v2.5 — Snapshot & Delivery Protocol

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

## ⚙️ BH-SDP v2.5 — Normative anti-friction continuity effects

The following rules are part of BH-SDP v2.5 itself. The sdp_snapshot schema above remains compatible with existing consumers; old snapshots do not require new fields.

7. **Material, not ceremonial checkpoints:** create a snapshot on final delivery, material changes in session, risk, environment, scope, authority, or responsible party, prolonged blocking, and high-risk recovery boundaries. Do not snapshot after each response, microtask, or already-covered gate.
8. **Verifiable continuity:** reference available physical anchors and proven states. Reuse evidence without rerunning it when object, hash, profile, generation, and environment are unchanged; revalidate after material changes.
9. **One continuity package:** consolidate context, decision, evidence, and next step proportionally. Do not duplicate logs or make the user manually transfer credentials across stages of one authorized runner.
10. **No inference-based promotion:** a NOT_EXECUTED result never becomes PASS because of reports, memory, generic CI, or a snapshot. Failures in one dimension do not automatically block independent authorized tasks.
11. **Remote identity:** for remote actions, capture URL, branch, and SHA before/after under CAS. Otherwise record a justified NOT_APPLICABLE; do not invent a commit hash.
12. **Scope and friction budget:** record only material approvals, gates, and attempts without forcing checkpoints. Explain necessary exceptions when the friction budget is exceeded. A snapshot never creates authority.
13. **Preserved containment:** containment continuity rules 1–6 above remain fully binding and take precedence in any conflict. There is no automatic migration of the v2.4 protected profile to v2.5.

**Transition:** normative publication is not evidence of runtime activation and changes no historical contracts, credentials, network privileges, or permissions.
