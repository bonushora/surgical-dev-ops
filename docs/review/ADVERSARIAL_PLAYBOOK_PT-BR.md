# Playbook de revisão adversarial do Surgical DevOps

English: [ADVERSARIAL_PLAYBOOK.md](./ADVERSARIAL_PLAYBOOK.md)

## Finalidade

Este playbook oferece aos revisores um caminho curto e seguro desde a primeira reprodução até ataques white-box diretos contra a fronteira determinística interna.

A afirmação sob revisão é intencionalmente estreita e falsificável:

> A saída cognitiva não confiável não possui autoridade operacional e não pode atravessar uma fronteira determinística do Surgical DevOps sem a evidência exata autorizada pelo humano e exigida por essa fronteira.

Uma suíte verde é evidência apenas para os contratos cobertos e ambientes observados. Ela não é prova matemática, auditoria independente nem afirmação de segurança absoluta.

Um bypass reproduzível deve tornar vermelha a qualificação afetada até que seja corrigido e preservado como teste de regressão permanente.

## Acesso rápido em cinco minutos

Use um checkout descartável limpo e Node.js 24:

```bash
git clone https://github.com/bonushora/surgical-dev-ops.git
cd surgical-dev-ops

BASELINE="$(node -p "require('./docs/review/QUALIFICATION_MANIFEST.json').sourceBaseline.commit")"

git checkout --detach "$BASELINE"
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

A demonstração é intencionalmente zero-mutation. Ela expõe a transição governada de autoridade sem exigir Ollama, credenciais ou escrita no repositório.

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
