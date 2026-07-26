# BH-SDP v2.2 — Snapshot & Delivery Protocol

## 🎯 Objetivo
Preservar o estado operacional do projeto entre sessões através de um contrato estrito em JSON emitido em Português.

## 📋 Schema do Snapshot (`sdp_snapshot`)

```json
{
  "nome_do_projeto": "string",
  "versao_do_protocolo": "string",
  "tipo_de_arquitetura": "string",
  "meta_de_custo": "string",
  "fase_atual": "string",
  "nivel_de_risco": "BAIXO | MÉDIO | ALTO",
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
