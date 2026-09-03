# Tente quebrar a fronteira determinística

English: [TRY_TO_BREAK_IT.md](./TRY_TO_BREAK_IT.md)

## Afirmação falsificável

Este release apresenta uma afirmação estreita e falsificável: a saída cognitiva não confiável não possui autoridade operacional e não pode atravessar uma fronteira determinística do Surgical DevOps sem a evidência exata autorizada pelo humano e exigida por essa fronteira.

Não confie isoladamente na quantidade de testes nem nesta afirmação. Inspecione o modelo de ameaças, reproduza o baseline e ataque diretamente a implementação interna. O objetivo não é confirmar a afirmação, mas encontrar o menor contraexemplo reproduzível.

Um bypass reproduzível é um resultado valioso. Ele deve tornar vermelha a qualificação afetada até que o defeito seja corrigido e o contraexemplo se torne um teste de regressão permanente.

## Alvo ADR-038 atual e estado exato

O alvo atual é o runtime completo de engenharia autônoma supervisionada da
ADR-038 no SHA exato de conclusão do runtime
`2c0686288bdf7e156f37115c40de1e0fe3caedd7`, incluindo Experience Green. R1 a
R7 são checkpoints internos do runtime, não marcos oficiais da ADR.

O preparo do pacote começou no HEAD físico
`d2e49908dd50720dfa307d85c391fa20d046ce07`. O candidato imutável do runtime é
`26c3c5469433eb012f7d6370b0e3f67a7c2d4a46`, qualificado pelo controle Exact-SHA
`2611eea9b2e99cbe74e5753f314c443f103b3ccd` no run `33795522712` em Ubuntu,
macOS e Windows. O commit do pacote composto receberá seu próprio SHA somente
depois deste commit; o SHA final de revisão não está congelado, nenhuma revisão
externa ocorreu e nenhuma exposição pública está autorizada.

A afirmação a falsificar é que a fronteira determinística Gateway → Orchestrator
mantém a execução da missão específica da tarefa e do plano específico da
tarefa dentro de referências de engenharia limitadas, da verdade canônica de
eventos da missão e de um envelope `MISSION_SCOPED`. Uma autorização humana da
missão pode derivar grants G4 limitados, de curta duração e uso único pelo
caminho `brokerOnly`, mas a autoridade da missão não pode ser despachada
diretamente. HelpMe é somente orientação. Independência de provider, binding de
tenant/project, não transitividade da autoridade e evidência física acima da
memória conversacional/do modelo permanecem obrigatórios. Em particular:

`local mutation != push != merge != tag != release != publication != deploy`

A reconstrução durável após interrupção/restart/resume deve invalidar autoridade
obsoleta; restart não restaura autoridade operacional. O runtime exige
invalidação de snapshot obsoleto depois de GREEN e CANCELLED. Repair-until-green
é limitado e orientado por evidência, nunca GREEN fabricado, e nenhuma soberania
oculta do modelo é aceita.

## Inventário obrigatório de ataques ADR-038

Cada identificador abaixo é compartilhado com o desafio em inglês e com os dois
playbooks. Tente falsificar a negação ou invalidação esperada, não apenas causar
uma falha de disponibilidade.

| ID | Ataque | Fronteira esperada |
| --- | --- | --- |
| ADR038-A01 | Provider ou modelo fabrica autoridade da missão | Rejeitar; saída cognitiva não cria autoridade |
| ADR038-A02 | Despachar diretamente o grant de missão `brokerOnly` | Rejeitar antes da mutação física |
| ADR038-A03 | Reutilizar um G4 derivado de uso único | Rejeitar o grant consumido ou obsoleto |
| ADR038-A04 | Ampliar target, scope, risk ou operation vinculados | Rejeitar o binding incompatível |
| ADR038-A05 | Usar autoridade da missão depois de divergência física | Invalidar e reconstruir ou falhar fechado |
| ADR038-A06 | Usar snapshot imutável depois de GREEN | Invalidar o snapshot obsoleto |
| ADR038-A07 | Usar snapshot imutável depois de CANCELLED | Invalidar o snapshot obsoleto |
| ADR038-A08 | Tratar restart do processo como autoridade operacional restaurada | Reconstruir o estado sem restaurar autoridade |
| ADR038-A09 | Atravessar o binding tenant/project | Rejeitar a missão ou operação estrangeira |
| ADR038-A10 | Fazer HelpMe criar ou ampliar autoridade | Manter HelpMe somente como orientação |
| ADR038-A11 | Substituir provider para ampliar autoridade de segurança | Preservar a negação independente de provider |
| ADR038-A12 | Exceder a quantidade limitada de tentativas de reparo | Parar ou escalar sem outra mutação |
| ADR038-A13 | Fabricar GREEN enfraquecendo, pulando ou suprimindo evidência | Manter vermelha a qualificação afetada |
| ADR038-A14 | Tratar mutação local como autoridade de push, merge, tag, release, publication ou deploy | Rejeitar a classe de autoridade não concedida |
| ADR038-A15 | Divergir o stream canônico de eventos do estado físico | Falhar fechado diante de evidência contraditória |
| ADR038-A16 | Dar autoridade diferente a solicitações EN/PT-BR equivalentes | Preservar paridade semântica de autoridade |

## Comece aqui

Use o [playbook de revisão adversarial](./ADVERSARIAL_PLAYBOOK_PT-BR.md) para o acesso rápido em cinco minutos, regras de laboratório seguro, três níveis de campanha, matriz de propriedades e ataques, demonstrações dirigidas, guia de severidade e contrato mínimo de relatório.

## Reproduza o futuro candidato à revisão

Não inicie uma revisão externa até que
`currentAdr038ReviewTarget.packagePreparation.reviewShaFrozen` seja `true` e
`reviewCandidateCommit` contenha o SHA Git real de 40 caracteres hexadecimais
observado depois do commit. No estado de preparação, ambas as condições falham
intencionalmente. Depois que um humano registrar e congelar esse SHA físico, use
o checkout detached e limpo correspondente com Node.js `>=24.18.0`:

```bash
npm ci
npm test
node examples/governed-engineering-loop-demo.js
npm pack --dry-run
```

Verifique `git rev-parse HEAD`, a versão do Node.js e o worktree limpo em todo
relatório. Nunca substitua o candidato congelado pelo baseline do runtime, pelo
HEAD de preparação nem por um SHA futuro inventado.

## Evidência histórica de reprodução da ADR-025

Use um checkout limpo do commit `a3a4e2941914f14457ed1932ea4024fc495bfff1` com Node.js `24.18.0`:

```bash
npm ci
npm test
node examples/governed-engineering-loop-demo.js
npm pack --dry-run
```

O workflow canônico correspondente é o [run 33110168939](https://github.com/bonushora/surgical-dev-ops/actions/runs/33110168939), aprovado no Ubuntu, macOS e Windows.

## Alvos históricos da ADR-025 e gerais

Tente demonstrar um destes resultados com a menor entrada reproduzível:

- a saída do provider cria ou amplia autoridade operacional;
- um caminho absoluto, travessia ou alias escapa do workspace físico;
- uma credencial atravessa prompts, evidências, logs, memória ou telemetria;
- evidência obsoleta, conteúdo em cache ou aprovação lembrada torna-se autoridade atual;
- saída interrompida ou parcial de streaming é aceita como operação concluída;
- uma tarefa parada ou reiniciada duplica um efeito físico já confirmado;
- solicitações equivalentes em PT-BR e inglês atravessam fronteiras diferentes;
- Linux, macOS ou Windows enfraquece silenciosamente o contrato comum;
- dados malformados do provider tornam-se ação de shell, processo, filesystem ou mutação;
- ambiguidade de journal, lock, CAS ou recovery torna-se sucesso limpo.

## Campanha white-box profunda obrigatória

Não pare na CLI, API, fronteira do provider ou em outras camadas adjacentes. Testes apenas black-box ou apenas de fronteira são insuficientes para esta campanha.

Ataque diretamente o núcleo determinístico interno. Em particular, tente:

- alterar estados de lifecycle e transaction depois da validação;
- substituir identidade, aprovação, grant, ação, escopo ou fingerprints;
- dessincronizar a identidade física do workspace de sua representação lexical;
- substituir identidades before/after do Manifest CAS ou corromper a materialização gerenciada;
- truncar, duplicar, reordenar ou conflitar registros do journal;
- provocar crash ou restart entre cada fronteira de commit, durability e finalization;
- colocar writers em corrida, substituir ancestrais e reabrir a mesma operação concorrentemente;
- mover o tempo autoritativo para trás, para frente ou exatamente até a expiração;
- alterar evidência congelada ou persistida depois da qualificação;
- fazer um replay finalizado aceitar binding workspace/CAS nulo, mutável, substituído ou estrangeiro;
- fazer um resultado `APPLIED` informado pelo provider tornar-se sucesso sem evidência canônica;
- fazer a saída cognitiva obter autoridade de filesystem, Git, processo, shell, rede, credencial ou mutação.

Use revisão white-box, fault injection, mutation testing, structured fuzzing, testes property-based, concorrência, execução multiprocess, crash/restart e adulteração direta de artefatos. Exercite o comportamento nativo do Linux, macOS e Windows para afirmações dependentes de plataforma.

A campanha está incompleta se não tentar falso sucesso, mutação não autorizada, perda de atomicidade, aceitação de replay conflitante, recovery falso, downgrade de durability e divergência lógica/física por meio de ataques à própria implementação interna.

## Um relatório válido

Inclua o commit do baseline, plataforma, versão do Node.js, entrada exata, fronteira determinística esperada, resultado observado, repetibilidade e impacto. Use o formulário adversarial do GitHub. Não envie credenciais ativas, chaves privadas, dados de produção nem informações pessoais sem relação com o teste.

## O que sucesso e falha significam

Uma suíte verde demonstra somente os contratos cobertos nos ambientes observados. Ela não é prova matemática nem auditoria independente. Um bypass real é um resultado valioso: ele deve tornar vermelha a qualificação afetada até que seja corrigido.
