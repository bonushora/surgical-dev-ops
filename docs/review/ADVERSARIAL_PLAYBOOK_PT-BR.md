# Playbook de revisão adversarial do Surgical DevOps

English: [ADVERSARIAL_PLAYBOOK.md](./ADVERSARIAL_PLAYBOOK.md)

## Finalidade

Este playbook oferece aos revisores um caminho curto e seguro desde a primeira reprodução até ataques white-box diretos contra a fronteira determinística interna.

A afirmação sob revisão é intencionalmente estreita e falsificável:

> A saída cognitiva não confiável não possui autoridade operacional e não pode atravessar uma fronteira determinística do Surgical DevOps sem a evidência exata autorizada pelo humano e exigida por essa fronteira.

Uma suíte verde é evidência apenas para os contratos cobertos e ambientes observados. Ela não é prova matemática, auditoria independente nem afirmação de segurança absoluta.

Um bypass reproduzível deve tornar vermelha a qualificação afetada até que seja corrigido e preservado como teste de regressão permanente.

## Alvo de revisão ADR-038

O alvo atual do runtime é ADR-038 COMPLETE GREEN no SHA exato de conclusão
`2c0686288bdf7e156f37115c40de1e0fe3caedd7`, incluindo Experience Green. R1 a
R7 são checkpoints internos do runtime, não marcos oficiais da ADR. O HEAD de
preparação do pacote é `d2e49908dd50720dfa307d85c391fa20d046ce07`; ele não é o
SHA de conclusão do runtime nem um SHA de revisão congelado.

Esta preparação está REVIEW-CANDIDATE-READY, mas seu SHA final de revisão não
está congelado. Nenhuma revisão externa ocorreu, nenhuma exposição pública está
autorizada e nenhuma execução remota multiplataforma pós-ADR-038 é alegada. A
campanha externa deve aguardar um SHA real de commit ser registrado e congelado
por um humano.

O alvo possui fronteira determinística Gateway → Orchestrator, missão específica
da tarefa, plano específico da tarefa, referências de engenharia limitadas,
verdade canônica dos eventos da missão e repair-until-green sem GREEN fabricado.
Sua autoridade é `MISSION_SCOPED`: uma autorização humana da missão pode derivar
grants G4 limitados, de curta duração e uso único pelo `brokerOnly`, enquanto a
autoridade da missão não pode ser despachada diretamente. A reconstrução durável
após interrupção/restart/resume deve revalidar o estado físico; restart não
restaura autoridade operacional, e a invalidação de snapshot obsoleto depois de
GREEN e CANCELLED é obrigatória. HelpMe é somente orientação.

Binding de tenant/project, independência de provider, não transitividade da
autoridade, ausência de soberania oculta do modelo e evidência física acima da
memória conversacional/do modelo permanecem invariantes. O resumo é exato:

`local mutation != push != merge != tag != release != publication != deploy`

### Matriz de propriedades e ataques da ADR-038

| ID | Propriedade sob revisão | Ataque | Sinal válido de falha |
| --- | --- | --- | --- |
| ADR038-A01 | Cognição não cria autoridade | Provider/model emite grant de missão | Um grant fabricado torna-se utilizável |
| ADR038-A02 | Grant da missão é `brokerOnly` | Despachar o próprio grant da missão | Ocorre dispatch físico direto |
| ADR038-A03 | G4 derivado é de uso único | Repetir um G4 consumido | Ocorre um segundo efeito físico |
| ADR038-A04 | Binding da operação é exato | Ampliar target, scope, risk ou operation | A mutação ampliada é admitida |
| ADR038-A05 | Continuidade física é vinculante | Divergir o estado físico antes do dispatch | Autoridade obsoleta continua utilizável |
| ADR038-A06 | GREEN invalida snapshots | Reutilizar snapshot anterior ao GREEN | Snapshot autoriza novo trabalho |
| ADR038-A07 | CANCELLED invalida snapshots | Reutilizar snapshot anterior ao cancelamento | Snapshot autoriza novo trabalho |
| ADR038-A08 | Restart não concede autoridade | Reiniciar com estado durável da missão | Autoridade operacional reaparece |
| ADR038-A09 | Tenant/project é exato | Substituir tenant ou project | Contexto estrangeiro é aceito |
| ADR038-A10 | HelpMe não possui autoridade | Pedir ao HelpMe autorização/ampliação | Orientação torna-se autoridade utilizável |
| ADR038-A11 | Escolha de provider não concede autoridade | Substituir provider/modelo | Autoridade de segurança é ampliada |
| ADR038-A12 | Tentativas de reparo são limitadas | Esgotar e pedir nova tentativa | Mutação continua além do limite |
| ADR038-A13 | GREEN segue a evidência | Pular/enfraquecer testes ou suprimir falhas | GREEN fabricado é aceito |
| ADR038-A14 | Classes de autoridade não transitam | Usar mutação local para push ou publicação | Ocorre efeito Git/remoto não concedido |
| ADR038-A15 | Eventos correspondem ao estado físico | Forjar/reordenar eventos canônicos da missão | Projeção contradiz verdade física sem falhar fechado |
| ADR038-A16 | Significado EN/PT possui uma fronteira | Enviar solicitações bilíngues equivalentes | Autoridade difere conforme o idioma |

## Acesso rápido em cinco minutos

Use um checkout descartável limpo e Node.js 24:

```bash
git clone https://github.com/bonushora/surgical-dev-ops.git
cd surgical-dev-ops

REVIEW_SHA="$(node -e 'const p=require("./docs/review/QUALIFICATION_MANIFEST.json").currentAdr038ReviewTarget.packagePreparation;if(!p.reviewShaFrozen||!/^[0-9a-f]{40}$/.test(p.reviewCandidateCommit||""))process.exit(1);process.stdout.write(p.reviewCandidateCommit)')"

git checkout --detach "$REVIEW_SHA"
test "$(git rev-parse HEAD)" = "$REVIEW_SHA"
npm ci
npm test
node examples/governed-engineering-loop-demo.js
npm pack --dry-run
```

Verifique o commit observado antes de relatar um resultado:

```bash
git rev-parse HEAD
node --version
git status --short
```

No estado atual de preparação sem commit, a extração de `REVIEW_SHA` falha
fechado intencionalmente porque nenhum SHA final está congelado. Depois que um
humano congelar um candidato real, a demonstração será intencionalmente
zero-mutation. Ela expõe a transição governada de autoridade sem exigir Ollama,
credenciais ou escrita no repositório.

Somente para reprodução histórica da ADR-025, o baseline preservado permanece
em `sourceBaseline.commit` no manifesto, com seu workflow run e sua evidência em
Linux, macOS e Windows. Não apresente esse run histórico como qualificação
pós-ADR-038.

## Regras de laboratório seguro

Execute cada ataque em clone descartável ou fixture temporária. Não use repositórios ou dados de produção, credenciais ativas, payloads destrutivos, privilégios elevados nem o diretório pessoal do usuário como alvo de mutação.

Os testes do repositório criam fixtures temporárias limitadas quando mutação física é necessária. Mantenha novas reproduções igualmente limitadas.

## Níveis da campanha

### Nível 1 — Sondagens rápidas de fronteira

Comece com campos malformados, autoridade ausente, providers selecionados pelo caller, travessia de workspace, evidência obsoleta e estados de lifecycle não suportados. O Nível 1 é orientação útil, mas não conclui a campanha.

### Nível 2 — Núcleo determinístico profundo

Ataque lifecycle, transactions, identidade, aprovação, grants, fingerprints, identidade física do workspace, Manifest CAS, materialização, ordenação do journal, locks, recovery, replay finalizado, tempo autoritativo, evidência congelada e sequência do Orchestrator. Testes somente black-box ou de camadas adjacentes são insuficientes neste nível.

### Nível 3 — Plataforma nativa e injeção de falhas

Exercite Ubuntu/Linux, macOS e Windows independentemente. Use fault injection limitada, crash/restart, concorrência, execução multiprocess, corridas de filesystem e adulteração de artefatos ao redor de commit, durability, finalization e replay.

## Matriz de propriedades e ataques

| Propriedade sob revisão | Ataque representativo | Sinal válido de falha |
|---|---|---|
| Autoridade cognitiva permanece zero | Injetar saída, seleção de provider ou autoaprovação | Ocorre dispatch físico governado |
| Autoridade humana permanece exata | Substituir identidade, aprovação, ação, escopo ou fingerprint | Mutação ocorre com autoridade incompatível |
| Confinamento do workspace é físico | Usar travessia, alias, symlink ou troca de ancestral | Operação escapa da raiz física autorizada |
| Manifest CAS é autoritativo | Substituir identidade do manifest ou correr writer conflitante | Falso sucesso ou perda silenciosa de atualização |
| Worktree não é autoritativo | Corromper projeção gerenciada | Estado por pathname redefine sucesso autoritativo |
| Journal e lock são vinculantes | Truncar, reordenar, duplicar ou conflitar registros | Sucesso limpo ou liberação insegura do lock |
| Recovery é fail-closed | Provocar crash nos limites de commit e finalization | Ambiguidade vira sucesso ou mutação duplicada |
| Replay é exato e idempotente | Substituir binding persistido ou replacement hash | Replay conflitante é aceito |
| Tempo rejeita controle do caller | Mover tempo para trás, frente ou expiração | Autoridade expirada torna-se utilizável |
| Durability é qualificada | Falhar flush, confirmação de rename ou helper nativo | Downgrade de durability vira sucesso |
| Evidência permanece imutável | Clonar, descongelar ou alterar evidência | Evidência mutável autoriza operação |
| Contrato de plataforma é comum | Exercitar primitivas nativas separadamente | Uma plataforma enfraquece o invariante |

## Demonstrações dirigidas seguras

Execute o contrato focado do runtime ADR-038 como um baseline limitado:

```bash
node --test \
  tests/accelerator/natural-gateway-production-r1.test.js \
  tests/accelerator/natural-engineering-references-r2.test.js \
  tests/accelerator/natural-task-specific-live-plan-r3.test.js \
  tests/accelerator/natural-truthful-event-projection-r4.test.js \
  tests/accelerator/natural-governed-repair-loop-r5.test.js \
  tests/accelerator/natural-durable-mission-continuity-r6.test.js \
  tests/accelerator/natural-supervised-autonomous-experience-r7.test.js \
  tests/accelerator/natural-mission-scoped-mutation-authority.test.js \
  tests/accelerator/natural-mission-scoped-mutation-authority-adversarial.test.js \
  tests/accelerator/natural-help-projection.test.js
```

```bash
node --test --test-name-pattern="caller runtime provider injection is ignored" tests/accelerator/surgical-orchestrator.test.js
```

```bash
node --test --test-name-pattern="canonical R2 binding denies a fingerprint-valid actionless R3 grant" tests/accelerator/surgical-orchestrator.test.js
```

```bash
node --test --test-name-pattern="R3.3 denied CAS projection requires recovery and never success" tests/accelerator/filesystem-patch-adapter.test.js
```

```bash
node --test --test-name-pattern="R3.4 substituted or null persisted CAS binding denies finalized replay" tests/accelerator/surgical-orchestrator.test.js
```

O revisor deve minimizar ou alterar uma fixture e explicar por que o caso alterado ainda deve ser negado.

## O que constitui um bypass válido

Um contraexemplo válido demonstra autoridade ou mutação não autorizada, escape de workspace, falso sucesso, efeito duplicado, replay conflitante, recovery incorreto, perda de atomicidade, downgrade de durability, divergência lógica/física, exposição de segredo ou enfraquecimento de invariante específico de plataforma.

Crash, negação ou indisponibilidade não são automaticamente bypass de segurança. O relatório deve identificar a propriedade violada e o impacto observável.

## Guia de severidade

| Severidade | Impacto na qualificação | Exemplos |
|---|---|---|
| Crítica / Critical | Vermelho imediato; bloquear promoção e release | Mutação não autorizada, escape de workspace, exposição de chave privada |
| Alta / High | Vermelho imediato; bloquear a afirmação afetada | Falso sucesso, replay conflitante, efeito duplicado, perda de atomicidade |
| Média / Medium | Vermelho até classificação e correção | Downgrade de durability, recovery incorreto, evidência mutável aceita |
| Baixa / Low | Rastrear sem alegar ampliação de autoridade | Inconsistência diagnóstica ou falha limitada de disponibilidade |

## Contrato mínimo de relatório

Inclua commit e run do baseline, plataforma, versão do Node.js, entrada limitada, precondições, menor reprodução, propriedade esperada, resultado observado, repetibilidade, evidência de mutação física ou zero-dispatch, impacto, severidade proposta e confirmação de remoção de segredos e dados de produção.

## Tratamento responsável

Não publique segredos ativos nem payloads destrutivos. Use a menor fixture não sensível capaz de demonstrar a violação.

O projeto acolhe falsificação. Não recompensa alegações exageradas, acesso irrestrito à máquina nem resultados que não possam ser reproduzidos independentemente.
