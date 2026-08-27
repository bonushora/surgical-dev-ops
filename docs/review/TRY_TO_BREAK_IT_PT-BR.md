# Tente quebrar a fronteira determinística

English: [TRY_TO_BREAK_IT.md](./TRY_TO_BREAK_IT.md)

## Afirmação falsificável

Este release apresenta uma afirmação estreita e falsificável: a saída cognitiva não confiável não possui autoridade operacional e não pode atravessar uma fronteira determinística do Surgical DevOps sem a evidência exata autorizada pelo humano e exigida por essa fronteira.

Não confie isoladamente na quantidade de testes nem nesta afirmação. Inspecione o modelo de ameaças, reproduza o baseline e ataque diretamente a implementação interna. O objetivo não é confirmar a afirmação, mas encontrar o menor contraexemplo reproduzível.

Um bypass reproduzível é um resultado valioso. Ele deve tornar vermelha a qualificação afetada até que o defeito seja corrigido e o contraexemplo se torne um teste de regressão permanente.

## Comece aqui

Use o [playbook de revisão adversarial](./ADVERSARIAL_PLAYBOOK_PT-BR.md) para o acesso rápido em cinco minutos, regras de laboratório seguro, três níveis de campanha, matriz de propriedades e ataques, demonstrações dirigidas, guia de severidade e contrato mínimo de relatório.

## Reproduza o baseline

Use um checkout limpo do commit `a3a4e2941914f14457ed1932ea4024fc495bfff1` com Node.js `24.18.0`:

```bash
npm ci
npm test
node examples/governed-engineering-loop-demo.js
npm pack --dry-run
```

O workflow canônico correspondente é o [run 33110168939](https://github.com/bonushora/surgical-dev-ops/actions/runs/33110168939), aprovado no Ubuntu, macOS e Windows.

## Alvos de alto valor

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
