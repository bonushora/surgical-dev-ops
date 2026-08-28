# ADR-29 — Contrato Bilíngue do Produto

- **Status:** APROVADA / CONGELADA
- **Data da decisão:** 2026-08-28
- **Produto:** Surgical DevOps
- **Contrato:** `BILINGUAL_PRODUCT_CONTRACT = EN_US + PT_BR`

## Contexto

O Surgical DevOps destina-se tanto ao uso internacional de engenharia quanto
a usuários de língua portuguesa. A apresentação por idioma deve, portanto,
ser tratada como contrato arquitetural do produto, e não como detalhe
incidental de documentação.

O Orchestrator determinístico, o modelo de autoridade, as trust boundaries, o
comportamento fail-closed, os requisitos de evidência, a semântica de
autorização, as regras de mutação, as identidades de erro e os invariantes de
segurança devem permanecer independentes do idioma humano selecionado.

## Decisão

Inglês (Estados Unidos) e Português (Brasil) são idiomas oficiais de primeira
classe do produto.

Toda superfície voltada ao usuário introduzida ou materialmente alterada após
esta decisão DEVE oferecer apresentação semanticamente equivalente em EN-US e
PT-BR antes de a funcionalidade afetada poder ser considerada completa como
produto.

Isso inclui, quando aplicável:

- interação NATURAL;
- ajuda e status da CLI;
- prompts governados de autorização e aprovação;
- explicações governadas de erros;
- configuração e orientação de seleção de providers;
- saída legível por humanos de recovery e reconciliation;
- documentação pública do produto destinada ao usuário final;
- outras mensagens visíveis ao usuário introduzidas por funcionalidades.

## Fronteira determinística de idioma

A localização NÃO DEVE:

1. criar, ampliar, reduzir ou reinterpretar autoridade operacional;
2. alterar identidade, escopo, validade, alvo ou regras de replay da autorização;
3. alterar resultados fail-closed;
4. mudar a semântica de Journal, Manifest CAS, R3, recovery ou mutação;
5. criar caminhos de execução por idioma com privilégios diferentes;
6. usar resultado de tradução por LLM como decisão portadora de autoridade;
7. tornar texto localizado a identidade canônica de máquina de um erro ou política.

Identificadores estáveis de máquina e transições determinísticas de estado
permanecem neutros quanto ao idioma. Mensagens humanas localizadas são
projeções desses estados e identidades estáveis.

## Requisito de paridade semântica

As superfícies EN-US e PT-BR DEVEM ser testadas quanto à paridade semântica no
nível apropriado à funcionalidade.

Uma funcionalidade não está completa como produto quando uma nova superfície
voltada ao usuário existe apenas em um dos idiomas oficiais, salvo quando essa
superfície estiver explicitamente classificada como evidência interna/não
pertencente ao produto.

Os testes DEVEM preferir chaves estáveis de mensagem, schemas ou
identificadores semânticos determinísticos em vez de acoplar comportamento de
segurança ao texto traduzido.

## Migração das superfícies existentes

Esta decisão não afirma que todas as strings históricas voltadas ao usuário no
repositório já sejam bilíngues.

As superfícies existentes DEVEM ser migradas incrementalmente através de gates
de implementação explicitamente delimitados. Nenhuma string monolíngue
histórica é silenciosamente declarada qualificada por esta ADR.

## Relação com G9 e G10

O G9 permanece APROVADO / CONGELADO no commit
`3f0a6608ee1bd4bef7f28ed897951c9744a9f2fc`.

O commit de congelamento documental imediatamente anterior a esta ADR é
`450eaa53fd820ae95a2c1d93251cd3481322fd39`.

Este contrato bilíngue é ortogonal ao gate G10 do ciclo anti-replay. O G10 deve
preservar este contrato para toda nova superfície voltada ao usuário que
introduzir, mas a apresentação por idioma NÃO DEVE alterar autoridade nem
semântica de execução do G10.

## Regra de qualificação

Para futuros milestones voltados ao usuário:

`PRODUCT_GREEN = DETERMINISTIC_GREEN + EN_US/PT_BR_SEMANTIC_PARITY`

Essa fórmula é uma regra de completude do produto. Ela não substitui gates
existentes de segurança, correção, auditoria, plataforma ou qualificação
determinística.

## Consequências

- A revisão internacional pode usar inglês como superfície nativa do produto.
- Usuários brasileiros recebem comportamento e explicações equivalentes em PT-BR.
- A semântica determinística de segurança permanece independente do idioma.
- Novas capacidades voltadas ao usuário carregam obrigação de completude bilíngue.
- A localização passa a ser arquitetura testável, e não tradução best-effort.
