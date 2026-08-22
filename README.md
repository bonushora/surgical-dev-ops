# Surgical DevOps 🚀

> **Open Engineering Protocol for AI-Assisted Software Development**

O **Surgical DevOps** é uma especificação aberta criada para estabelecer um modelo disciplinado de colaboração entre engenheiros de software e sistemas de Inteligência Artificial.

Seu objetivo é tornar o desenvolvimento assistido por IA mais:

- previsível;
- rastreável;
- seguro;
- preservável entre sessões.

O Surgical DevOps é independente de:

- modelo de IA;
- fornecedor;
- linguagem de programação;
- framework;
- IDE;
- arquitetura de software.

Ele define protocolos. Ferramentas, agentes, prompts, SDKs e integrações são implementações desses protocolos.

---

# Protocolos Principais

## BH-SEP v2.2 — Safe Evolution Protocol

O BH-SEP define como evoluir software existente com segurança.

Princípios fundamentais:

- **Inspect First:** nenhuma alteração sem inspeção prévia.
- **Focus Window:** arquivos grandes devem ser analisados em partes.
- **Patch First:** alterações pontuais são o padrão.
- **Refactor Control:** refatorações exigem autorização explícita.
- **Red-to-Green:** validação antes de atribuir falhas às mudanças.

---

## BH-SDP v2.2 — Snapshot & Delivery Protocol

O BH-SDP define como preservar e transferir contexto técnico entre sessões.

Seu objetivo é evitar perda de conhecimento operacional.

O snapshot registra:

- projeto;
- versão do protocolo;
- arquitetura;
- fase atual;
- nível de risco;
- âncoras físicas;
- componentes validados;
- próximo passo.

---

# Ciclo de Vida do Surgical DevOps

O Surgical DevOps possui dois estados operacionais:


Modo Livre
|
| /DETERMINISTICO
v
Modo Determinístico
|
| /LIVRE
v
Modo Livre


---

# 🔓 Modo Livre

Estado consultivo.

Neste modo, a IA responde normalmente sem aplicar as regras operacionais do Surgical DevOps.

Ativação:


/LIVRE


Confirmação:


MODO LIVRE ATIVADO 🔓


---

# 🚀 Modo Determinístico

Estado operacional.

Quando ativado, BH-SEP e BH-SDP passam a governar a sessão.

Ativação:


/DETERMINISTICO


Confirmação:


BH-SEP v2.2 E BH-SDP v2.2 ATIVADOS 🚀


Após a ativação:

1. O escopo operacional é exibido.
2. O estado atual é confirmado.
3. O primeiro artefato é solicitado para inspeção.

---

# Escopo Permanente do Modo Determinístico

Enquanto o modo determinístico estiver ativo:

1. A Inspeção Declarativa precede respostas técnicas ou alterações.

2. O Modo PATCH permanece como estratégia padrão.

3. O Snapshot BH-SDP é mantido conforme o protocolo.

4. Mudanças de estado ocorrem somente pelos gatilhos:


/DETERMINISTICO
/LIVRE


---

# 🔒 Persistência do Estado Operacional

Após ativação, o modo determinístico entra em estado operacional persistente.

Enquanto ativo, a implementação não deve:

- abandonar implicitamente o modo determinístico;
- ignorar BH-SEP;
- ignorar BH-SDP;
- alterar estratégia sem autorização explícita.

A saída ocorre somente através de:


/LIVRE


Na ausência desse comando, o estado determinístico permanece ativo.

---

# ⚡ Ativação Universal RAW

## Ativação agnóstica do Surgical DevOps

O Surgical DevOps foi projetado para ser independente de plataforma, fornecedor ou modelo de Inteligência Artificial.

A ativação do modo determinístico ocorre através de um artefato textual universal que pode ser utilizado em qualquer sistema de IA compatível.

Copie o bloco abaixo e cole no início de uma nova sessão:

```text
Surgical DevOps Activation

Ative o modo determinístico do Surgical DevOps.

Carregue e aplique conjuntamente:

BH-SEP v2.2 — Safe Evolution Protocol
BH-SDP v2.2 — Snapshot & Delivery Protocol

Estado operacional:

MODO: DETERMINÍSTICO

Regras obrigatórias:

1. Aplicar Inspeção Declarativa antes de qualquer alteração técnica.

2. Utilizar Modo PATCH como estratégia padrão.

3. Preservar o estado operacional durante toda a sessão.

4. Manter o contexto através do mecanismo de snapshot definido pelo BH-SDP.

5. Não alterar o modo operacional sem o comando explícito:

/LIVRE

Após a ativação:

1. Confirmar:

BH-SEP v2.2 E BH-SDP v2.2 ATIVADOS 🚀

2. Exibir o escopo operacional ativo.

3. Solicitar o primeiro arquivo, diretório ou artefato para inspeção.

Fim da ativação.

Este artefato é apenas o mecanismo de ativação.

Os protocolos BH-SEP e BH-SDP permanecem como núcleo normativo independente de qualquer implementação.

Sequência Operacional
Sessão iniciada

      |
      v

/DETERMINISTICO

      |
      v

Surgical DevOps ativo

      |
      v

BH-SEP + BH-SDP

      |
      v

Escopo exibido

      |
      v

Primeiro artefato solicitado

      |
      v

Inspeção Declarativa

      |
      v

PATCH / REFACTOR autorizado

      |
      v

Snapshot BH-SDP

      |
      v

Continuidade da sessão
Separação de Responsabilidades
README

Define:

visão;
ciclo de vida;
estados operacionais.
BH-SEP

Define:

evolução segura;
inspeção;
alterações;
validação.
BH-SDP

Define:

snapshots;
preservação de contexto;
continuidade operacional.
Implementações

O Surgical DevOps é agnóstico de plataforma.

Implementações podem incluir:

prompts;
agentes;
SDKs;
extensões;
integrações;
ferramentas.

Esses componentes utilizam a especificação, mas não fazem parte do núcleo normativo.

Filosofia

O Surgical DevOps não substitui julgamento humano.

Ele cria uma disciplina operacional para colaboração entre humanos e sistemas de IA.

As decisões técnicas permanecem sob responsabilidade do engenheiro.

Estrutura Inicial
surgical-dev-ops/

├── README.md
├── README_EN.md
├── protocols/
│   ├── BH-SEP.md
│   └── BH-SDP.md
└── LICENSE
Status

🚀 Surgical DevOps v2.4.0

A versão v2.4.0 fecha a fronteira operacional de mutação governada do
Surgical DevOps, preservando BH-SEP v2.2 e BH-SDP v2.2 como núcleo normativo
independente.

Principais capacidades qualificadas no baseline atual:

- Surgical DevOps Accelerator / Orchestrator;
- inspeção declarativa e preparação determinística de tarefas;
- autoridade humana autenticada para operações críticas R3;
- grants de capacidade com escopo exato e comportamento fail-closed;
- FILESYSTEM_PATCH governado por transação;
- locking determinístico de alvo exato;
- journal durável e autoridade de commit persistida;
- recovery determinístico após process crash/restart;
- proteção contra replay conflitante e remutação duplicada;
- enforcement de primitivas de durabilidade de filesystem;
- Governed Content-Addressed Workspace como autoridade de mutação;
- conteúdo imutável e manifests content-addressed;
- Manifest CAS com transição condicional genuína da autoridade interna;
- worktree comum explicitamente não autoritativa;
- managed materialization separada da transição de autoridade;
- materialização e recovery idempotentes;
- detecção fail-closed de projeção gerenciada corrompida;
- Production Mutation Provider qualificado e bounded;
- Local Offline Human Authority com assinatura Ed25519;
- runtime de produção sem autoridade privada de assinatura;
- integração R3 governada através de `surgical> patch`;
- continuidade operacional através de process restart;
- testes end-to-end usando processos reais da CLI;
- hardening do Git preflight;
- suíte canônica com 595 testes: 591 PASS, 0 FAIL e 4 platform-specific SKIP;
- GitHub Actions mantendo a matriz canônica Linux / Windows / macOS.

Invariantes e limites preservados:

- BH-SEP e BH-SDP permanecem na versão normativa v2.2;
- a worktree física comum não redefine a autoridade content-addressed;
- callers não podem selecionar ou autoqualificar o Production Mutation Provider;
- autenticação isoladamente não autoriza mutação R3;
- private signing authority não é exposta ao runtime de produção;
- generic shell/process authority não é exposta pela fronteira de mutação;
- Strict Physical Identity-Conditional CAS de pathname permanece UNQUALIFIED
  conforme ADR-009;
- essa limitação não redefine a autoridade content-addressed adotada pela
  ADR-010;
- POWER_LOSS_VALIDATED permanece falso até qualificação física específica por
  plataforma/filesystem;
- nenhuma suíte de process crash/restart deve ser representada como prova de
  durabilidade universal contra perda física de energia.

Baseline operacional da v2.4.0: Governed Content-Addressed Mutation Authority.
