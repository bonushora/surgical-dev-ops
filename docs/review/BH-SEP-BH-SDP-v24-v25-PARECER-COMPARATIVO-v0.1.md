# Parecer documental de consistência e comparação — BH-SEP / BH-SDP v2.4 × v2.5

**Estado:** `DOCUMENTARY_COMPARISON=COMPLETED` · `NORMATIVE_AMENDMENTS=PROPOSED_ONLY` · `OPERATIONAL_TESTS_V2_5=NOT_EXECUTED` · `INDEPENDENT_SECURITY_REVIEW=NOT_COMPLETED` · `GLOBAL_GREEN=NOT_ESTABLISHED`  
**Objeto:** texto normativo disponível em `bonushora/surgical-dev-ops`, `main` no commit `e461e5b7ab4312d7a84b207678e42c7f665a53db` (consulta de 24/11/2026).  
**Base adicional:** parecer fornecido pelo usuário, com achados F1–F21; [Issue #25](https://github.com/bonushora/surgical-dev-ops/issues/25), plano diferencial D01–D12; [Issue #24](https://github.com/bonushora/surgical-dev-ops/issues/24), revisão externa pendente.  
**Modalidade:** revisão de texto e comparação. Nenhum teste físico, ataque, experimento de recuperação, migração ou certificação de segurança foi executado neste parecer.

## 1. Fontes oficiais efetivamente examinadas

| Fonte | Objeto Git blob SHA |
|---|---|
| [BH-SEP v2.4](https://github.com/bonushora/surgical-dev-ops/blob/e461e5b7ab4312d7a84b207678e42c7f665a53db/protocols/v2.4/BH-SEP.md) | `5cbc781af160a4dbd273f30082eb5ce8f40aacf0` |
| [BH-SDP v2.4](https://github.com/bonushora/surgical-dev-ops/blob/e461e5b7ab4312d7a84b207678e42c7f665a53db/protocols/v2.4/BH-SDP.md) | `9204a9b48cc99a1b83e5ea68c01aaf8cf97de391` |
| [BH-SEP v2.5](https://github.com/bonushora/surgical-dev-ops/blob/e461e5b7ab4312d7a84b207678e42c7f665a53db/protocols/v2.5/BH-SEP.md) | `addb1062459c381e0529b39a28e938c935ec4f79` |
| [BH-SDP v2.5](https://github.com/bonushora/surgical-dev-ops/blob/e461e5b7ab4312d7a84b207678e42c7f665a53db/protocols/v2.5/BH-SDP.md) | `9ce0baf355d0c8dc44d44a1f31a1234a7f180a39` |
| [Runtime containment loader](https://github.com/bonushora/surgical-dev-ops/blob/e461e5b7ab4312d7a84b207678e42c7f665a53db/accelerator/core/containment-profile-loader.js) | `428d095e2d9f916a55fe1386537af104303485b2` |

Os SHAs da tabela são **identificadores Git de blob**, não SHA-256 do conteúdo. O loader declara explicitamente o perfil integrado v2.4 e o manifesto `protocols/v2.4/BH-CONTAINMENT-MANIFEST.json` com SHA-256 ancorado `9100f46f924247a003881e9bccc3802574b139553e9a716c8d3922197ba124c2`.

## 2. Matriz diferencial textual

| Área | v2.4 | v2.5 | Classificação |
|---|---|---|---|
| SEP 1–6 | Contrato, autoridade humana, falha fechada, PATCH, prova física e reuso condicionado | Redação literal preservada | **PRESERVADO** |
| SEP 7 | Continuação dentro do envelope, parar em BLOCKED | Acrescenta consolidação precheck/PATCH/validação/postcheck/entrega e limita alegações quando não houver runner | **AMPLIADO** |
| SEP 8–10 | Red-to-Green, risco, autorização delimitada | Redação literal preservada | **PRESERVADO** |
| SEP 11 | Orçamento proporcional de fricção | Acrescenta meta para baixo risco: uma autorização e nenhuma confirmação intermediária rotineira | **AMPLIADO** |
| SEP 12 | Gates reais e disjuntor após duas tentativas sem progresso | Desestimula pacotes, hashes, revisões ou marcos redundantes sem nova hipótese/consumidor/fronteira | **AMPLIADO** |
| SEP 13–18 | Inspeção, CAS, remoto, automação, GREEN dimensional, entrega | Redação literal preservada | **PRESERVADO** |
| SEP 19–25 | Contenção integrada, transporte e credenciais, fail-closed, ausência de alegações universais | Redação literal preservada | **PRESERVADO** |
| SEP 26–35 | Inexistentes | Missão contínua, bloqueio localizado, reuso comprovável, entrega única, correção cirúrgica, snapshots materiais, GREEN específico, terminal seguro, CAS remoto, prioridade da contenção | **ACRESCENTADO** |
| SDP exemplo de `sdp_snapshot` | Campos existentes e sete dimensões em `estado_green` | Exemplo JSON literalmente igual | **PRESERVADO** |
| SDP contenção 1–6 | Revalidação de perfil/manifesto/geração e não restauração de autoridade | Redação literal preservada | **PRESERVADO** |
| SDP regras 7–13 | Inexistentes | Antifricção, reuso com verificação, consolidar entrega, não promoção por inferência, remoto/CAS e prioridade da contenção | **ACRESCENTADO** |
| Transição para v2.5 | Não há regra v2.5 | Proíbe inferir migração a partir de publicação normativa | **ACRESCENTADO** |

**Verificação estrutural:** BH-SEP tem 25 regras em v2.4 e 35 em v2.5; 22 regras antigas são literalmente idênticas e as regras 7, 11 e 12 foram ampliadas. O SDP mantém literalmente o exemplo de snapshot e suas seis regras de contenção; acrescenta as regras 7–13. Isso comprova preservação **textual**, não equivalência de implementação nem ausência de novas ambiguidades.

## 3. Reavaliação dos 21 achados apresentados

Classificações abaixo são o juízo desta **segunda leitura documental**. `LEGADO` = já presente na v2.4 (ou substancialmente presente); `NOVO` = surge com redação v2.5; `MISTO` = envolve ambos. Um apontamento documental não demonstra falha operacional.

| ID | Origem | Parecer após cotejo | Encaminhamento proposto |
|---|---|---|---|
| **F1** | LEGADO | **Lacuna plausível:** há autorização humana delimitada (SEP 2/10), mas não forma padronizada de ligar o contrato declarado à autorização concedida. Não é prova de que agentes tenham autoridade própria. | Exigir evidência verificável da vinculação, proporcional ao risco; sem autorização, `BLOCKED`. |
| **F2** | LEGADO | **Lacuna plausível:** a regra manda classificar risco, mas não especifica arbitragem independente quando a classificação favorece o executor. | Proibir rebaixamento unilateral para escapar de gate; mudanças justificadas de risco exigem autoridade competente. Não proibir todo rebaixamento fundamentado em absoluto. |
| **F3** | MISTO | **Ambiguidade real, não contradição necessária:** SDP 3 obriga revalidar fisicamente perfil e identidade; SEP 28/SDP 8 dispensam **reexecução de validação** quando invariantes persistem. | Diferenciar `CHECK_BINDINGS` (obrigatório na reutilização) de `RERUN_TESTS` (condicional). Proibir reuso se o comparador confiável não puder verificar invariantes. |
| **F4** | MISTO | **Lacuna parcialmente real:** faltam método e responsável pela prova de invariantes. Um TTL universal para toda evidência não é normativamente necessário; autorizações e atributos dinâmicos devem ser revalidados no momento de uso. | Dizer explicitamente que evidência não é autoridade; janelas de validade dependem do tipo de dado/autoridade, não de prazo universal arbitrário. |
| **F5** | LEGADO | **Lacuna de modelagem:** `estado_green` apresenta estados por dimensão, não um estado de execução de tarefa; portanto ausência de `BLOCKED` nesse enum não significa que o bloqueio seja intrinsecamente irregistrável. | Propor campo **opcional separado** para bloqueios com operação e motivo, mantendo o enum de GREEN intacto. |
| **F6** | LEGADO | **Lacuna anterior à v2.5:** a exigência de registrar contenção quando há dados já existe no SDP v2.4, mas o exemplo JSON não contém campo específico. A v2.5 declara que não exige novas chaves legadas. | Propor objeto `contencao` **facultativo e compatível**; não convertê-lo em requisito retroativo sem decisão de versão. |
| **F7** | NOVO | **Lacuna de transição:** a publicação v2.5 não define ato de adoção, responsável ou gate físico completo. A Issue #25 já propõe D01–D12, mas nada foi executado e ela não equivale à decisão de migração. | Adoção humana expressa, perfil e SHA fixados, qualificação por plataforma/risco e autorização específica; preservar o loader v2.4 até então. |
| **F8** | NOVO | **Ambiguidade resolúvel:** `pare em BLOCKED` e `bloqueio localizado` são compatíveis se a parada incidir sobre a ação dependente; independência precisa de critérios de autoridade e efeitos. | Definir independência por falta de dependência de estado, autoridade, efeitos, credenciais e evidências. |
| **F9** | LEGADO com explicitação NOVA | **Não é conflito efetivo quando aplicada a prioridade:** SEP 16 já existia, e SEP 35/SDP 13 esclarecem que autorização humana não supera contenção. | Acrescentar remissão editorial à prioridade de segurança; não remover a soberania humana sobre decisões legítimas. |
| **F10** | MISTO | **Não são instruções opostas:** SEP 11 define opções de tratamento do orçamento, SDP 12 pede justificar interrupção quando ocorrer. | Redigir precedência e limites de fricção sem aliviar gates. |
| **F11** | NOVO | **Lacuna de representação:** SEP 32 cita documentação e alegações científicas, enquanto o exemplo legado `estado_green` não ganha novos campos. | Extensão opcional por dimensão ou mapa de qualificação versionado; preservar consumidores antigos. |
| **F12** | LEGADO | **Ambiguidade verdadeira:** “operação já coberta por autoridade vigente” não define sozinho a severidade do efeito. | Classificar por consequências, não por existir autorização; operação de alto risco permanece ALTO. |
| **F13** | MISTO | **Ambiguidade de terminologia:** separação entre evidência técnica independente do executor e auditor externo não é explícita. | Definir níveis: teste separado, avaliador independente, terceiro externo; não promover CI próprio a auditoria independente. |
| **F14** | LEGADO | **Lacuna de disjuntor:** tentativas equivalentes e condições de reinício não estão precisamente definidas. | Congelar nova tentativa equivalente até hipótese/entrada/causa materialmente distinta e autoridade apropriada. |
| **F15** | LEGADO | **Lacuna do exemplo tipado:** missão, autorização, timestamp e aplicabilidade remota não aparecem como campos estruturados; `sha_*` está tipado como string. | Extensões opcionais ou versão posterior do schema; sem inventar SHA quando não aplicável. |
| **F16** | MISTO | **Duplicação editorial, não necessariamente defeito:** várias regras v2.5 reforçam invariantes legadas em contexto antifricção. | Manter invariantes e explicitar precedência/referências cruzadas; não eliminar proteções por deduplicação. |
| **F17** | NOVO | **Lista cumulativa, não contraditória:** SEP 28 acrescenta perfil e demais condições às condições mínimas do SEP 6. | Declarar conjunto cumulativo e prever invalidadores contextuais (revogação, expiração, CAS, mudança de geração etc.). |
| **F18** | MISTO | **Compatível:** exigir experiência humana para `GREEN funcional` não nega que cada dimensão tenha estado próprio. | Explicitar que GREEN de dimensão não implica automaticamente GREEN funcional global. |
| **F19** | MISTO | **Baixo risco editorial:** a numeração do SDP sempre reiniciou na sua seção; a v2.5 usa “acima” para apontar regras 1–6. | Prefixos `SEP-`/`SDP-` e links estáveis melhoram referências, sem renumerar históricos. |
| **F20** | NOVO | **Ambiguidade leve:** entrega final e pacote de continuidade podem ser o mesmo conjunto lógico sem implicar um ZIP. | Um artefato lógico proporcional, sem empacotamento cerimonial. |
| **F21** | LEGADO | **Risco de interoperabilidade plausível:** enums misturam inglês/português e acentuação desde o exemplo v2.4. | Definir representação canônica e tabela de adaptação de legado, com compatibilidade testada antes de alterar consumidores. |

**Prioridade proposta:** 1) F1/F2/F3/F4/F7 como prevenção de ampliação indevida de autoridade; 2) F5/F6/F11/F15/F21 como consistência de representação; 3) demais como clarificações editoriais e qualificação de evidência. Essa prioridade é **analítica**, não severidade de vulnerabilidade explorada.

## 4. Regra de conciliação sugerida — somente proposta

> Para reutilizar uma evidência previamente qualificada, um componente confiável deve confirmar no momento de uso a identidade do objeto e suas condições de aplicabilidade: hash pertinente, ambiente, perfil, manifesto, geração, plataforma e quaisquer dependências materiais. A reconferência desses vínculos não implica reexecução automática de todos os testes, mas qualquer alteração, ausência de prova ou estado dinâmico relevante (incluindo revogação, expiração, autoridade consumida e CAS) invalida o uso pretendido. Evidências e snapshots não criam, prolongam ou restauram autoridade. A contenção ativa e os gates exigidos pelo risco prevalecem sobre a política de redução de fricção. Bloqueios são localizados apenas quando a independência das demais ações for verificável.

Não inserir essa redação nos originais sem processo normativo próprio.

## 5. Validador de snapshot proposto (artefato separado)

Arquivo complementar: `BH-SDP-v2.5-schema-compatibilidade-RASCUNHO.json`.

- Rascunho em JSON Schema Draft 2020-12, **não é norma aprovada**.
- Respeita tipos/estados existentes; prevê `contencao`, `bloqueios`, referência de autorização, missão e timestamp como **campos opcionais propostos**.
- `additionalProperties: true` evita incompatibilidades retroativas; **não significa aceitação de semântica desconhecida** pelo runtime.
- Não declara `required` global: o documento oficial traz um **exemplo de estrutura tipada**, não um contrato formal de obrigatoriedade de todas as chaves; obrigatoriedade material exigirá decisão normativa separada.
- Validação de JSON **não prova** legitimidade de autoridade, identidade remota, validade temporal, ACL, segurança de contenção, integridade física, independência de auditoria ou GREEN.
- A regra condicional `destino_fisico.aplicabilidade = NOT_APPLICABLE` exige justificativa **somente quando esse campo de extensão for usado**; não altera snapshots antigos que não o incluam.

## 6. Encaminhamento e limites

A [Issue #25](https://github.com/bonushora/surgical-dev-ops/issues/25) já contém 12 cenários diferenciais D01–D12 e aponta pré-requisitos para teste **posterior**. A [Issue #24](https://github.com/bonushora/surgical-dev-ops/issues/24) solicita revisão adversarial externa do [PR #23](https://github.com/bonushora/surgical-dev-ops/pull/23). Nenhuma das issues é evidência de execução física ou revisão externa concluída.

**A decisão preservada** é manter o perfil protegido v2.4 pinado, preservar documentos normativos originais, não fazer merge/migração/release e não converter `PASS_DOCUMENTARY`, `PR_CI_PASS_SCOPED` ou `NOT_EXECUTED` em `GLOBAL_GREEN`.
