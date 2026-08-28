# ADR-028 — Loop NATURAL Governado de Execução de Desenvolvimento

English: [ADR-028 in English](./ADR-028-natural-governed-development-execution-loop.md)

**Status:** CONTRATO G1 IMPLEMENTADO / ETAPAS POSTERIORES NÃO IMPLEMENTADAS
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

## Invariantes de segurança

- Saída cognitiva nunca se torna autoridade operacional.
- Aprovação abrangente ou futura é inválida e não reutilizável.
- Alvos absolutos, com travessia ou não canônicos falham fechados.
- As identidades do repositório e do workspace físico permanecem explícitas.
- Shell genérico, credenciais e efeitos externos não podem ser disfarçados como
  vocabulário de validação.
- O G1 não exporta método de filesystem, processo, execução, aprovação, grant
  ou dispatch.
- O envelope read-only existente permanece inalterado.
- A fronteira R3 de produção existente permanece inalterada.
- A versão `v2.6.0-rc.2` permanece imutável.

## Não alegações explícitas

O G1 não autoriza coleta de evidências, não aplica patch, não executa validação,
não retoma recovery e não implementa o loop autônomo de correção. Essas
capacidades exigem qualificação independente em etapas posteriores. Uma suíte
G1 verde comprova apenas o contrato canônico da tarefa e suas decisões de
contenção fail-closed.
