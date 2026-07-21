# 📦 BH-SDP — BônusHora Snapshot & Delivery Protocol

O **BH-SDP (Snapshot & Delivery Protocol)** é um protocolo de encapsulamento de estado projetado para mitigar a perda de contexto em sessões de desenvolvimento assistido por Inteligência Artificial.

Seu objetivo é transformar conhecimento temporário de uma sessão de desenvolvimento em um artefato estruturado, permitindo continuidade segura entre diferentes sessões, agentes ou desenvolvedores.

O BH-SDP preserva:

- objetivos atuais;
- decisões arquiteturais;
- arquivos envolvidos;
- contratos estabelecidos;
- restrições importantes;
- próximos passos seguros.

---

# 🏛️ Princípios da Preservação de Estado

## 1. Background Tracking (Rastreamento em Segundo Plano)

Durante a evolução do projeto, o estado relevante da sessão deve ser continuamente acompanhado.

Esse estado inclui:

- objetivos ativos;
- alterações realizadas;
- arquivos inspecionados;
- decisões tomadas;
- contratos definidos.

O acompanhamento permite gerar um Snapshot consistente quando necessário.

---

## 2. Context & Definition Interception (Intercepção de Mudanças e Definições)

O Snapshot deve ser gerado quando ocorrerem eventos relevantes como:

- mudança de arquivo ou contexto de trabalho;
- pausa planejada no desenvolvimento;
- definição de regra de negócio importante;
- alteração de contrato de API;
- criação ou modificação de modelos de dados;
- decisões arquiteturais relevantes.

O objetivo é impedir que conhecimento crítico permaneça apenas no histórico temporário da conversa.

---

## 3. Context Exhaustion Protection (Proteção contra Exaustão de Contexto)

Sessões longas podem sofrer degradação de contexto.

O BH-SDP estabelece que, quando houver risco de perda de informações importantes devido ao tamanho da sessão, o estado atual deve ser consolidado em um Snapshot antes da continuidade.

---

## 4. Self-Correction Alert (Alerta de Autocorreção)

Novas solicitações devem ser comparadas com definições críticas já estabelecidas.

Caso exista conflito entre:

- uma nova solicitação;
- uma regra de negócio validada;
- um contrato existente;
- uma decisão arquitetural;

o conflito deve ser identificado antes da implementação.

---

## 5. Pure Code Block (Bloco de Código Puro)

O Snapshot deve ser produzido em um bloco markdown isolado.

Isso permite:

- cópia direta;
- armazenamento;
- transferência para uma nova sessão;
- recuperação rápida do contexto.

---

## 6. Self-Starting Instruction (Instrução Auto-Iniciável)

Todo Snapshot deve terminar com uma instrução clara para continuidade.

A próxima sessão deve saber:

- onde o trabalho parou;
- qual arquivo deve ser inspecionado;
- qual microetapa deve ser executada.

---

# 🤖 Artefato: System Prompt para IA

Sempre que iniciar uma sessão onde seja necessário preservar continuidade de contexto:

```text
Opere também sob o protocolo complementar BH-SDP (Snapshot & Delivery Protocol).

Mantenha o estado atual da sessão organizado contendo:

- objetivo central;
- arquivos envolvidos;
- decisões críticas;
- restrições;
- próximo passo seguro.

Gere um Snapshot quando:

1. O usuário solicitar [SNAPSHOT].
2. Uma definição crítica do projeto for estabelecida.
3. Houver mudança relevante de contexto.
4. A sessão estiver próxima de perder informações importantes.
5. Existir conflito entre uma nova solicitação e uma decisão anterior validada.

Formato obrigatório:

### 📦 BH-SDP SNAPSHOT

- Objetivo Central Atual:
- Últimos Arquivos Alterados/Inspecionados:
- Definições Críticas Estabelecidas:
- Status Atual:
- Próximos Passos:

Finalize sempre com:

"DIRETRIZ DE RETOMADA:
Baseado neste Snapshot, execute o próximo passo listado seguindo as regras de evolução segura."
