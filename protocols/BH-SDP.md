
📦 BH-SDP — Snapshot & Delivery Protocol (v2.0)
O BH-SDP (Snapshot & Delivery Protocol) é um protocolo de encapsulamento e preservação de estado para sessões de desenvolvimento assistido por IA.

A v2.0 introduz a Ancoragem Física para eliminar a amnésia e a alucinação de contexto.

🏛️ Princípios da Preservação de Estado
1. Ancoragem Física (Anti-Amnésia)
O Snapshot não aceita apenas texto livre. Ele deve obrigatoriamente referenciar metadados reais do ambiente/repositório:

Git Commit Hash: Hash exato do commit base ou estado uncommitted.

Test Status: Resultado objetivo dos testes automatizados (PASS, FAIL, NOT_RUN).

Last Inspected Lines: Registro das linhas e arquivos inspecionados.

2. Formato JSON Estrito
Todo Snapshot deve ser emitido em um bloco sdp_snapshot estruturado para rápida cópia, validação programática e restauração de sessão.

🤖 Artefato: Schema Rígido do Snapshot (v2.0)
Toda resposta técnica de conclusão de etapa deve finalizar com:

Snippet de código
{
  "project_name": "Nome do Projeto",
  "protocol_version": "BH-SDP-v2.0 / BH-SEP-v2.0",
  "arch_type": "Arquitetura Atual (ex: BH-SMC)",
  "cost_target": "Meta de Custo",
  "current_phase": "Fase do Desenvolvimento",
  "physical_anchors": {
    "git_commit_hash": "a1b2c3d",
    "test_status": "PASS (X/X)",
    "last_inspected_lines": "arquivo.py: 12-45"
  },
  "components_validated": [
    "Componentes testados e validados"
  ],
  "next_step": "Ação imediata seguinte"
}
