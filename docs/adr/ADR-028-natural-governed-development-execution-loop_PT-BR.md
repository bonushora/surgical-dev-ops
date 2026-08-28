# ADR-028 — Loop NATURAL Governado de Execução de Desenvolvimento

English: [ADR-028 in English](./ADR-028-natural-governed-development-execution-loop.md)

**Status:** G1–G4 IMPLEMENTADOS / ETAPAS POSTERIORES NÃO IMPLEMENTADAS
**Data:** 2026-08-28
**Escopo:** Surgical DevOps / desenvolvimento governado no modo NATURAL
**Estende:** ADR-004, ADR-006, ADR-007, ADR-010, ADR-014 e ADR-019

## Contexto

O NATURAL pode obter evidências governadas e produzir uma proposta de engenharia
sem autoridade, enquanto a fronteira R3 existente pode executar um patch exato
autorizado. Faltava um contrato canônico que conectasse essas capacidades em uma
tarefa delimitada de desenvolvimento capaz de futuramente repetir etapas de
evidência, proposta e validação.

## Decisão congelada

O Surgical DevOps implementará um Loop NATURAL Governado de Execução de
Desenvolvimento. O provider cognitivo compreende, analisa e propõe. O
Orchestrator determinístico permanece como única fronteira operacional. O
humano permanece soberano sobre a autoridade exata e qualquer expansão de
escopo, risco ou arquitetura.

A sequência qualificada de entrega será:

1. G1 — contrato canônico de tarefa sem autoridade;
2. G2 — planejamento governado e aquisição de evidências;
3. G3 — proposta exata de patch e diff;
4. G4 — autorização humana vinculada ao conteúdo e não reutilizável;
5. G5 — composição com execução R3, journal e Manifest CAS existentes;
6. G6 — validação qualificada e loop delimitado de correção;
7. G7 — qualificação de recovery, conflito e anti-replay;
8. G8 — experiência NATURAL bilíngue;
9. GQ — qualificação adversarial e nativa multiplataforma.

## Contrato G1

O G1 introduz `sdo.natural_development_task_contract.v1`. Ele vincula um
objetivo à identidade física exata do workspace, HEAD do repositório, modo de
trabalho, lista permitida de alvos, vocabulário qualificado de validação, teto
de risco, teto de etapas de evidência e teto de tentativas de patch.

O vocabulário inicial de validação qualificada contém somente `VALIDATE_JS`;
seu mapeamento operacional permanece na fronteira fixa `NODE_SYNTAX_CHECK` já
existente.

O contrato declara estas políticas fixas:

- mutação exige autorização R3 exata e separada;
- somente validação fixa e qualificada é permitida;
- uso de credenciais e shell genérico são proibidos;
- efeitos externos e decisões arquiteturais param para o humano;
- expansão de workspace, alvo ou risco interrompe a tarefa;
- evidência obsoleta, limites esgotados, conflito e recovery interrompem;
- sucesso exige que todas as validações autorizadas sejam aprovadas.

O G1 pode apenas classificar se uma etapa proposta permanece dentro da fronteira
declarada da tarefa. Uma proposta mutante contida ainda carrega
`requiresExactR3Authority: true` e autoridade zero de mutação ou dispatch.

## G2 — planejamento e evidências governadas

O G2 introduz `sdo.natural_development_planning_loop.v1` como composição sem
autoridade sobre o loop recursivo read-only já existente. Antes de qualquer
planejamento cognitivo ou dispatch governado, ele verifica o fingerprint do
contrato, a identidade física do workspace e o HEAD do repositório.

O provider cognitivo pode solicitar somente:

- `WORKSPACE_FILES`, inventário read-only do repositório já autorizado;
- `READ_FILE` para um alvo presente na lista permitida do contrato; ou
- `VALIDATE_JS` para um alvo JavaScript permitido.

A política G2 é avaliada depois do envelope de contenção NATURAL existente e
antes do dispatcher read-only canônico. Expansão de alvo ou de etapas de
evidência retorna `STOPPED`, preserva o pedido pendente para revisão humana e
realiza zero dispatch. O grounding determinístico existente permanece padrão
para todos os consumidores anteriores; somente a composição G2 o desativa para
seu planejamento de alvos exatos, impedindo redirecionamento para um README não
declarado.

Os resultados G2 vinculam todas as evidências e a resposta cognitiva final ao
fingerprint do contrato G1. Eles permanecem profundamente imutáveis e carregam
explicitamente autoridade operacional, de mutação, aprovação e dispatch iguais
a zero.

## G3 — proposta exata de patch e diff

O G3 introduz `sdo.natural_development_patch_proposal.v1`. Ele aceita somente
um resultado G2 concluído e imutável e uma proposta governada de engenharia sem
autoridade. Objetivo, alvo e SHA-256 BEFORE devem corresponder ao contrato G1 e
a um item exato de evidência governada `READ_FILE`.

O resultado G2 passa a carregar seu próprio fingerprint determinístico de
planejamento. O G3 revalida esse fingerprint e verifica independentemente o
Base64 canônico, o tamanho em bytes e o SHA-256 da substituição proposta. Uma
substituição sem mudança, troca de alvo, evidência BEFORE obsoleta ou estouro do
limite de tentativas falha fechada.

O G3 emite `sdo.natural_development_exact_diff.v1` com a representação explícita
`FULL_FILE_REPLACEMENT`. O diff vincula alvo, hashes BEFORE e AFTER e tamanhos em
bytes em seu próprio fingerprint. Ele é dado exato para revisão mecânica, não
uma alegação de que evidência truncada representa um diff textual completo por
linhas.

O estado final é `HUMAN_REVIEW_REQUIRED`. A proposta carrega os bytes completos
da substituição, o tipo de validação e fingerprints necessários às etapas
posteriores de autoridade, mas continua expondo autoridade operacional, de
mutação, aprovação e dispatch iguais a zero.

## G4 — autorização humana exata

O G4 introduz `sdo.natural_development_patch_authorization.v1`. Ele aceita
somente uma proposta G3 imutável, uma decisão explícita e imutável denominada
`APPROVE_EXACT_PATCH` e uma asserção verificada de identidade humana. A decisão
deve repetir os fingerprints da proposta e do diff, o alvo e os hashes exatos
BEFORE e AFTER. Aprovação abrangente, futura, implícita ou mutável falha
fechada.

A identidade verificada deve identificar o mesmo sujeito humano, incluir a
audience fixa `surgical-devops:natural-development-r3` e usar um operation ID
derivado exclusivamente do fingerprint da proposta G3. O instante da
autorização deve ser igual ao instante de verificação da identidade, permanecer
dentro do intervalo verificado da identidade e expirar em no máximo dez
minutos.

A autorização vincula toda a cadeia de fingerprints G1–G4. Ela é marcada como
de uso único, não reutilizável e `AUTHORIZED_FOR_R3_COMPOSITION`, mas permanece
não consumida e expõe autoridade operacional, de mutação, aprovação e dispatch
iguais a zero. Consumo, estado anti-replay e mutação física pertencem ao G5 e ao
G7, não a esta fronteira de materialização de evidência.

## Invariantes de segurança

- Saída cognitiva nunca se torna autoridade operacional.
- Aprovação abrangente ou futura é inválida e não reutilizável.
- Alvos absolutos, com travessia ou não canônicos falham fechados.
- As identidades do repositório e do workspace físico permanecem explícitas.
- Shell genérico, credenciais e efeitos externos não podem ser disfarçados como
  vocabulário de validação.
- O G1 não exporta método de filesystem, processo, execução, aprovação, grant
  ou dispatch.
- O G4 não exporta método de execução, mutação, dispatch, grant ou consumo.
- O envelope read-only existente permanece inalterado.
- A fronteira R3 de produção existente permanece inalterada.
- A versão `v2.6.0-rc.2` permanece imutável.

## Não alegações explícitas

O G1 não autoriza coleta de evidências. O G2 compõe somente as fronteiras
read-only e de validação fixa já qualificadas. O G3 materializa apenas dados
para revisão. O G4 materializa somente evidência de autorização humana exata;
ele não consome essa evidência, não cria grant R3, não aplica patch, não retoma
recovery e não implementa o loop autônomo de correção. Essas capacidades exigem
qualificação independente em etapas posteriores. Uma suíte G1–G4 verde comprova
somente o contrato canônico, o planejamento governado, a contenção de
evidências, a proposta exata de patch/diff sem autoridade e o vínculo exato e
não reutilizável da autorização humana.
