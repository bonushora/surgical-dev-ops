# Surgical DevOps

[![Accelerator Conformance](https://github.com/bonushora/surgical-dev-ops/actions/workflows/accelerator-conformance.yml/badge.svg)](https://github.com/bonushora/surgical-dev-ops/actions/workflows/accelerator-conformance.yml)
[![Licença: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

> Uma fronteira operacional determinística para agentes probabilísticos de engenharia com IA.

English: [README.md](./README.md)

O Surgical DevOps é um orquestrador de desenvolvimento open source que mantém os
modelos de IA fora da fronteira de confiança operacional. Os modelos podem
raciocinar, explicar e propor. Autoridade humana, escopo, execução, evidência,
mutação e tratamento de falhas permanecem governados por contratos determinísticos.

O projeto **não** afirma tornar determinístico um modelo de linguagem. Ele torna o
sistema operacional ao redor do modelo explícito, limitado, auditável e fail-closed.

## Baseline qualificado atual

| Evidência | Valor |
| --- | --- |
| Linha de release | Surgical DevOps v2.6.0-rc.4 |
| Commit canônico | [`36ef01f53690e644976668248499ab9d5031f52f`](https://github.com/bonushora/surgical-dev-ops/commit/36ef01f53690e644976668248499ab9d5031f52f) |
| Run canônico do CI | [Accelerator Conformance #32808535616](https://github.com/bonushora/surgical-dev-ops/actions/runs/32808535616) |
| Resultado da matriz | Ubuntu, macOS e Windows: **PASS** |
| Suíte canônica | 864 testes descobertos; 859 aprovados; 0 falhas; 5 skips específicos de plataforma |
| Protocolos normativos | BH-SEP v2.2 + BH-SDP v2.2 |

A trilha completa, incluindo os runs que falharam antes do baseline verde, está em
[Evidências de Engenharia](./docs/ENGINEERING_EVIDENCE.md).
Revisores independentes podem começar pelo
[Pacote de Revisão Externa](./docs/EXTERNAL_ENGINEERING_REVIEW.md).

## Por que este projeto existe

Ferramentas de engenharia com IA são probabilísticas, mas escrita em filesystem,
execução de processos, estado Git, credenciais e mutação de produção exigem
autoridade determinística:

```text
Objetivo humano
      |
      v
Cognição probabilística (sem autoridade operacional)
      |
      v
Contratos determinísticos de admissão e autoridade
      |
      v
Orchestrator canônico
      |
      v
Adapter governado -> evidência vinculada ou resultado fail-closed
```

O provider de IA nunca se torna provider de autoridade. Uma resposta útil, um
plano ou uma saída confiante do modelo não autorizam uma operação física.

## Invariantes centrais

- **Soberania humana:** autoridade crítica nasce de intenção humana verificada.
- **Intenção não é autoridade:** linguagem natural não cria capabilities.
- **Inspecionar primeiro:** mutação exige inspeção declarativa e escopo limitado.
- **PATCH por padrão:** alterações mínimas prevalecem sobre reescritas amplas.
- **Grants exatos:** operações vinculam ação, alvo, workspace, lifecycle, risco e identidade.
- **Sem execução direta do modelo:** providers cognitivos não recebem autoridade
  de filesystem, shell, processo, rede, credenciais ou mutação.
- **Estado de mutação durável:** locking, journal, autoridade de commit, recovery e
  replay permanecem explícitos.
- **Fail-closed:** evidência ausente, inválida, expirada, ambígua ou não qualificada
  não pode se tornar sucesso.

## Qualificação por plataforma

| Plataforma | Mecanismo qualificado | Evidência atual |
| --- | --- | --- |
| Linux | Contenção Bubblewrap deny-default e primitivas POSIX | Matriz canônica: PASS |
| macOS | Perfil Seatbelt deny-default aplicado por helper nativo fixo | Matriz canônica: PASS |
| Windows | Helper fixo de segurança/durabilidade Win32 e adapters governados | Matriz canônica: PASS |

Esses mecanismos não são apresentados como sandboxes idênticos. São implementações
nativas diferentes avaliadas contra contratos limitados em comum. Consulte
[Evidências de Engenharia](./docs/ENGINEERING_EVIDENCE.md).

## IA governada e modos de interação

- **NATURAL:** linguagem orientada a resultados e revelação progressiva.
- **ENGINEER:** linguagem natural com evidências técnicas relevantes.
- **EXPERT:** controle determinístico orientado a comandos.

O provider local de referência é o Ollama quando disponível. Providers são
substituíveis e permanecem fora da autoridade operacional. Análises amplas no modo
NATURAL atravessam autorização humana e um loop recursivo governado de evidências.

Para engenharia avançada de repositório, OpenAI Codex é o agente de referência
recomendado e o alvo mais próximo do ciclo conversacional completo de
desenvolvimento. Essa recomendação não concede autoridade privilegiada nem
alega superioridade comparativa universal. Consulte o
[guia bilíngue de seleção de agentes de IA](./docs/AI_PROVIDER_SELECTION_PT-BR.md).

O modo ENGINEER acrescenta uma proposta imutável vinculada ao alvo READ_FILE e
ao SHA-256 BEFORE realmente observados. O fluxo para obrigatoriamente em
`HUMAN_AUTHORITY_REQUIRED`; a mutação física continua sendo uma operação R3
explícita e separada.

## Início rápido

Runtime declarado: Node.js `>=24.18.0`.

```bash
npm install -g surgical-dev-ops
surgical-devops --version
surgical-devops --help
surgical-devops
```

O executável de compatibilidade `surgical` também é fornecido. Para executar a suíte:

Na primeira execução em um terminal humano, um onboarding bilíngue seleciona uma
das três experiências fornecidas pela mesma instalação: `NATURAL`, `ENGINEER` ou
`EXPERT`. Para refazer a preferência de interface:

```bash
surgical-devops --configure
```

Para usar um perfil somente na invocação atual, sem alterar a preferência salva:

```bash
surgical-devops --interaction NATURAL
surgical-devops --interaction ENGINEER
surgical-devops --interaction EXPERT
```

Para selecionar o idioma completo das superfícies humanas somente na invocação
atual, sem reescrever a preferência salva:

```bash
surgical-devops --language pt-BR
surgical-devops --language en
```

A preferência não contém autoridade operacional. Todos os perfis usam o mesmo
Orchestrator e os mesmos contratos BH-SEP/BH-SDP, R3, journal, Manifest CAS e
anti-replay.

Para executar a suíte:

```bash
npm ci
npm test
```

## Protocolos normativos e RAW imutáveis

Os artefatos originais em português BH-SEP v2.2 e BH-SDP v2.2 estão congelados em
caminhos estáveis. Eles não são substituídos pelo README internacional nem pelas
traduções inglesas.

- [BH-SEP v2.2 — RAW original](https://raw.githubusercontent.com/bonushora/surgical-dev-ops/main/protocols/BH-SEP.md)
- [BH-SDP v2.2 — RAW original](https://raw.githubusercontent.com/bonushora/surgical-dev-ops/main/protocols/BH-SDP.md)
- [BH-SEP v2.2 — tradução inglesa](./protocols/BH-SEP_EN.md)
- [BH-SDP v2.2 — tradução inglesa](./protocols/BH-SDP_EN.md)

Versões futuras devem usar novos caminhos versionados e não podem sobrescrever ou
redirecionar os RAW originais. Consulte [Preservação dos Protocolos](./protocols/README.md)
e a [ADR-018](./docs/adr/ADR-018-immutable-protocol-raw-and-international-documentation.md).

## Arquitetura e evidências

- [Trilha de Evidências de Engenharia](./docs/ENGINEERING_EVIDENCE.md)
- [Mapa da Documentação](./docs/DOCUMENTATION.md)
- [Trust Boundary — ADR-004](./docs/adr/ADR-004-surgical-devops-orchestrator-trust-boundary.md)
- [Autoridade Humana — ADR-006](./docs/adr/ADR-006-authenticated-human-authority-boundary.md)
- [Journal e Recovery — ADR-007](./docs/adr/ADR-007-governed-mutation-transaction-recovery.md)
- [Adapter Windows — ADR-008](./docs/adr/ADR-008-windows-native-filesystem-safety-durability.md)
- [Autoridade Content-Addressed — ADR-010](./docs/adr/ADR-010-governed-content-addressed-workspace-authority.md)
- [Modos de Interação — ADR-011](./docs/adr/ADR-011-intent-driven-orchestration-user-modes.md)
- [Comportamento Governado da IA — ADR-014](./docs/adr/ADR-014-governed-ai-behavior-contract.md)
- [Experiência Humana Bilíngue Completa — ADR-031](./docs/adr/ADR-031-complete-bilingual-human-experience_PT-BR.md)

## O que o CI verde não afirma

- Não é prova de segurança absoluta.
- Não torna determinístico o raciocínio probabilístico do modelo.
- Não afirma durabilidade universal contra perda física de energia.
- `POWER_LOSS_VALIDATED` permanece falso até qualificação física específica.
- O CAS estrito de pathname permanece não qualificado conforme a ADR-009.
- Windows, Linux e macOS não possuem primitivas de isolamento idênticas.
- Revisão adversarial externa permanece uma qualificação separada.
- O desafio externo reproduzível está disponível em
  [`docs/review/TRY_TO_BREAK_IT.md`](docs/review/TRY_TO_BREAK_IT.md).

Afirmações sem suporte permanecem não qualificadas em vez de se tornarem verdes.

## Contribuindo e licença

Leia [CONTRIBUTING.md](./CONTRIBUTING.md). Alterações devem preservar o modelo de
autoridade, a paridade bilíngue, os RAW estáveis e o comportamento fail-closed.

[MIT](./LICENSE) © 2026 Thales Rangel.
